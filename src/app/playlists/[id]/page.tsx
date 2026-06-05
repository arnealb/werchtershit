import Link from 'next/link';
import { getPlaylistDetails, getPlaylistTracks, getSpotifyUser, getValidTokens } from '@/lib/spotify';
import { getGenerationsByPlaylist } from '@/lib/playlist-meta';
import PlaylistDetailClient from '@/components/PlaylistDetailClient';

export const dynamic = 'force-dynamic';

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tokens = await getValidTokens();

  if (!tokens) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-coal">
        <p className="text-sm text-fog">Verbind eerst met Spotify om deze playlist te bekijken.</p>
        <a
          href="/api/spotify/auth"
          className="rounded-xl bg-spotify px-6 py-3 text-sm font-bold text-white"
        >
          Verbind met Spotify
        </a>
      </div>
    );
  }

  try {
    const user = await getSpotifyUser(tokens.accessToken);
    const [details, tracks, generations] = await Promise.all([
      getPlaylistDetails(id, tokens.accessToken),
      getPlaylistTracks(id, tokens.accessToken),
      getGenerationsByPlaylist(user.id),
    ]);

    return (
      <PlaylistDetailClient
        details={{ ...details, trackCount: tracks.length }}
        initialTracks={tracks}
        generation={generations.get(id) ?? null}
      />
    );
  } catch (err) {
    console.error('[/playlists/[id]] Failed to load playlist:', err);
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-coal">
        <p className="text-sm text-fog">Deze playlist kon niet geladen worden.</p>
        <Link href="/playlists" className="text-sm font-semibold text-ember-soft">
          ← Terug naar playlists
        </Link>
      </div>
    );
  }
}
