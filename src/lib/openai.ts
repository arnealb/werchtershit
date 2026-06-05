import type { SpotifyTrackCandidate } from '@/types/spotify';
import { activeModel, activeProvider, generateStructuredJson } from './llm';

interface SmartPrepInput {
  artists: {
    id: string;
    name: string;
    /** Festival set length — longer sets warrant more prep tracks */
    setDurationMinutes: number;
    /** Per-artist track budget (set-weighted) */
    maxTracks: number;
    candidates: SpotifyTrackCandidate[];
  }[];
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

const SMART_PREP_SCHEMA = {
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
} as const;

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
  const candidateUris = new Set(
    input.artists.flatMap((artist) => artist.candidates.map((track) => track.uri)),
  );
  const compactInput = {
    artists: input.artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      setDurationMinutes: artist.setDurationMinutes,
      maxTracks: artist.maxTracks,
      candidates: artist.candidates.map((track) => ({
        uri: track.uri,
        name: track.name,
        primaryArtist: track.primaryArtist,
        spotifyArtistName: track.spotifyArtistName,
        albumName: track.albumName ?? null,
        releaseDate: track.releaseDate ?? null,
        popularity: track.popularity ?? null,
        sources: track.sources,
        recentLivePlayCount: track.liveCount ?? null,
        alreadyInPlaylist: track.alreadyInPlaylist,
      })),
    })),
  };

  console.info('[llm] Ranking smart prep candidates', {
    provider: activeProvider(),
    model: activeModel(),
    artistCount: compactInput.artists.length,
    candidateCount: compactInput.artists.reduce((sum, artist) => sum + artist.candidates.length, 0),
    budgets: compactInput.artists.map((artist) => `${artist.name}:${artist.maxTracks}`),
  });

  const output = await generateStructuredJson({
    instructions: [
      'You curate preparation playlists for Rock Werchter festival visitors.',
      'Choose the songs that a casual listener should know before seeing each selected artist live.',
      'Strongest signal: candidates with a recentLivePlayCount and the "live_setlist" source were ACTUALLY played at the artist\'s recent concerts — prioritize these.',
      'Then prefer live staples, recognizable hits, popular songs, and recent singles/album tracks.',
      'Aim for a representative mix across the artist\'s career: include the classics, not only recent work.',
      'For each artist return EXACTLY maxTracks tracks when enough candidates exist — never fewer. Only when the candidate list itself is smaller, return all candidates. Order best-first.',
      'Do not invent songs. Only select track URIs from the provided candidate lists.',
      'Avoid tracks marked alreadyInPlaylist unless every good candidate is already covered.',
      'Write each reason in Dutch (Flemish-friendly), one short casual sentence.',
    ].join(' '),
    input: JSON.stringify(compactInput),
    schema: SMART_PREP_SCHEMA,
    schemaName: 'smart_prep_recommendations',
  });

  const parsedJson = JSON.parse(output) as unknown;
  if (!isSmartPrepResponse(parsedJson)) {
    throw new Error('LLM response did not match smart prep schema');
  }

  const parsed = parsedJson;
  console.info('[llm] Received smart prep ranking', {
    selectionCount: parsed.selections.length,
    selectedTrackCount: parsed.selections.reduce((sum, selection) => sum + selection.tracks.length, 0),
  });

  const maxTracksByArtistId = new Map(
    input.artists.map((artist) => [artist.id, artist.maxTracks]),
  );

  return {
    selections: parsed.selections.map((selection) => ({
      festivalArtistId: selection.festivalArtistId,
      tracks: selection.tracks
        .filter((track) => candidateUris.has(track.uri))
        .slice(0, maxTracksByArtistId.get(selection.festivalArtistId) ?? Number.MAX_SAFE_INTEGER)
        .map((track) => ({
          uri: track.uri,
          reason: track.reason,
        })),
    })),
  };
}
