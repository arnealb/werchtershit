import type { SpotifyTrackCandidate } from '@/types/spotify';

interface SmartPrepInput {
  artists: {
    id: string;
    name: string;
    candidates: SpotifyTrackCandidate[];
  }[];
  maxTracksPerArtist: number;
}

interface SmartPrepSelection {
  festivalArtistId: string;
  tracks: {
    uri: string;
    reason: string;
  }[];
}

interface SmartPrepResponse {
  selections: SmartPrepSelection[];
}

function extractOutputText(response: {
  output_text?: string;
  output?: {
    type?: string;
    content?: { type?: string; text?: string }[];
  }[];
}): string {
  if (response.output_text) return response.output_text;

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === 'output_text' || content.type === 'text') && content.text) {
        return content.text;
      }
    }
  }

  throw new Error('OpenAI response did not contain output text');
}

function isSmartPrepResponse(value: unknown): value is SmartPrepResponse {
  if (!value || typeof value !== 'object') return false;
  const selections = (value as { selections?: unknown }).selections;
  if (!Array.isArray(selections)) return false;

  return selections.every((selection) => {
    if (!selection || typeof selection !== 'object') return false;
    const item = selection as { festivalArtistId?: unknown; tracks?: unknown };
    return (
      typeof item.festivalArtistId === 'string' &&
      Array.isArray(item.tracks) &&
      item.tracks.every((track) => {
        if (!track || typeof track !== 'object') return false;
        const candidate = track as { uri?: unknown; reason?: unknown };
        return typeof candidate.uri === 'string' && typeof candidate.reason === 'string';
      })
    );
  });
}

export async function rankSmartPrepTracks(input: SmartPrepInput): Promise<SmartPrepResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const candidateUris = new Set(
    input.artists.flatMap((artist) => artist.candidates.map((track) => track.uri)),
  );
  const compactInput = {
    maxTracksPerArtist: input.maxTracksPerArtist,
    artists: input.artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      candidates: artist.candidates.map((track) => ({
        uri: track.uri,
        name: track.name,
        primaryArtist: track.primaryArtist,
        spotifyArtistName: track.spotifyArtistName,
        albumName: track.albumName ?? null,
        releaseDate: track.releaseDate ?? null,
        popularity: track.popularity ?? null,
        sources: track.sources,
        alreadyInPlaylist: track.alreadyInPlaylist,
      })),
    })),
  };

  console.info('[openai] Ranking smart prep candidates', {
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    artistCount: compactInput.artists.length,
    candidateCount: compactInput.artists.reduce((sum, artist) => sum + artist.candidates.length, 0),
    maxTracksPerArtist: input.maxTracksPerArtist,
  });

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      instructions: [
        'You curate preparation playlists for Rock Werchter festival visitors.',
        'Choose the songs that a casual listener should know before seeing each selected artist live.',
        'Prefer live staples, recognizable hits, popular songs, and recent singles/album tracks.',
        'Do not invent songs. Only select track URIs from the provided candidate lists.',
        'Avoid tracks marked alreadyInPlaylist unless every good candidate is already covered.',
        'Return concise reasons in plain English.',
      ].join(' '),
      input: JSON.stringify(compactInput),
      text: {
        format: {
          type: 'json_schema',
          name: 'smart_prep_recommendations',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['selections'],
            properties: {
              selections: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['festivalArtistId', 'tracks'],
                  properties: {
                    festivalArtistId: { type: 'string' },
                    tracks: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['uri', 'reason'],
                        properties: {
                          uri: { type: 'string' },
                          reason: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  const parsedJson = JSON.parse(extractOutputText(await response.json())) as unknown;
  if (!isSmartPrepResponse(parsedJson)) {
    throw new Error('OpenAI response did not match smart prep schema');
  }

  const parsed = parsedJson;
  console.info('[openai] Received smart prep ranking', {
    selectionCount: parsed.selections.length,
    selectedTrackCount: parsed.selections.reduce((sum, selection) => sum + selection.tracks.length, 0),
  });

  return {
    selections: parsed.selections.map((selection) => ({
      festivalArtistId: selection.festivalArtistId,
      tracks: selection.tracks
        .filter((track) => candidateUris.has(track.uri))
        .slice(0, input.maxTracksPerArtist)
        .map((track) => ({
          uri: track.uri,
          reason: track.reason,
        })),
    })),
  };
}
