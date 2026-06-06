/**
 * Provider-agnostic LLM helpers. When GEMINI_API_KEY is set everything runs
 * on Google Gemini (free tier); otherwise OpenAI is used. Callers pass
 * OpenAI-style strict JSON schemas; the Gemini path sanitizes them.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type LlmProvider = 'gemini' | 'openai';

export function activeProvider(): LlmProvider {
  return process.env.GEMINI_API_KEY ? 'gemini' : 'openai';
}

export function activeModel(): string {
  return activeProvider() === 'gemini'
    ? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
    : process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
}

export interface StructuredRequest {
  instructions: string;
  input: string;
  imageDataUrl?: string;
  schema: object;
  schemaName: string;
  /** Override the default model (e.g. a stronger one for extraction) */
  model?: string;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

/** Strip JSON-schema keywords Gemini's responseSchema doesn't accept. */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) {
      if (key === 'additionalProperties' || key === 'strict') continue;
      out[key] = toGeminiSchema(value);
    }
    return out;
  }
  return schema;
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

// Free-tier rate-limit responses ask for a wait via RetryInfo, e.g. "42s"
function retryDelayFromError(errorBody: string): number | null {
  const match = errorBody.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  return match ? Number(match[1]) * 1000 : null;
}

const MAX_RETRY_DELAY_MS = 45_000;

async function geminiRequest(model: string, body: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  // Free tier hiccups (429/503) are common — retry with backoff, honoring
  // the API's requested wait when it fits within the serverless time budget
  const fallbackDelays = [0, 2_000, 5_000];
  let lastError = '';
  for (let attempt = 0; attempt < fallbackDelays.length; attempt++) {
    const requested = retryDelayFromError(lastError);
    const delay =
      attempt === 0
        ? 0
        : requested !== null
          ? Math.min(requested + 1_000, MAX_RETRY_DELAY_MS)
          : fallbackDelays[attempt];
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const parts: { text?: string }[] = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((part) => part.text ?? '').join('');
      if (!text) throw new Error('Gemini response did not contain text');
      return text;
    }

    lastError = `${res.status} ${await res.text()}`;
    if (res.status !== 429 && res.status !== 503) break;
  }
  throw new Error(`Gemini request failed: ${lastError}`);
}

async function geminiStructured(req: StructuredRequest): Promise<string> {
  const parts: Record<string, unknown>[] = [{ text: req.input }];
  if (req.imageDataUrl) {
    const image = parseDataUrl(req.imageDataUrl);
    if (!image) throw new Error('Invalid image data URL');
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  }

  return geminiRequest(req.model ?? activeModel(), {
    systemInstruction: { parts: [{ text: req.instructions }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(req.schema),
      temperature: 0.2,
    },
  });
}

/**
 * Gemini-only: answer a prompt grounded in Google Search results. Returns
 * plain text (Gemini does not combine search grounding with JSON mode, so
 * callers parse it with a second structured call).
 */
export async function groundedSearchText(prompt: string): Promise<string> {
  return geminiRequest(process.env.GEMINI_MODEL ?? 'gemini-2.5-flash', {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
  });
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

export async function callOpenAI(body: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  if (data.output_text) return data.output_text;
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === 'output_text' || content.type === 'text') && content.text) {
        return content.text;
      }
    }
  }
  throw new Error('OpenAI response did not contain output text');
}

async function openaiStructured(req: StructuredRequest): Promise<string> {
  const input: unknown = req.imageDataUrl
    ? [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: req.input },
            { type: 'input_image', image_url: req.imageDataUrl },
          ],
        },
      ]
    : req.input;

  return callOpenAI({
    model: req.model ?? activeModel(),
    instructions: req.instructions,
    input,
    text: {
      format: {
        type: 'json_schema',
        name: req.schemaName,
        strict: true,
        schema: req.schema,
      },
    },
  });
}

// ─── Public entry point ───────────────────────────────────────────────────────

/** Generate schema-validated JSON (returned as string) on the active provider. */
export async function generateStructuredJson(req: StructuredRequest): Promise<string> {
  return activeProvider() === 'gemini' ? geminiStructured(req) : openaiStructured(req);
}
