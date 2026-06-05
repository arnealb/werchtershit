import Link from 'next/link';
import { getEditablePlaylists, getValidTokens } from '@/lib/spotify';
import { SpotifyMark } from '@/components/SelectedArtistsPanel';
import type { SpotifyPlaylistSummary } from '@/types/spotify';

export const dynamic = 'force-dynamic';

export default async function PlaylistsPage() {
  const tokens = await getValidTokens();

  let playlists: SpotifyPlaylistSummary[] = [];
  let loadError = false;

  if (tokens) {
    try {
      playlists = await getEditablePlaylists(tokens.accessToken);
    } catch (err) {
      console.error('[/playlists] Failed to load playlists:', err);
      loadError = true;
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-coal">
      <header className="sticky top-0 z-10 border-b border-line bg-soot/90 backdrop-blur px-4 pt-3 pb-3 pt-safe">
        <h1 className="font-display text-xl text-cream uppercase">
          Mijn <span className="text-ember">playlists</span>
        </h1>
        <p className="text-xs text-fog mt-0.5">Bekijk en beheer je Spotify-playlists</p>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-4">
        {!tokens ? (
          <div className="animate-rise mt-16 text-center px-6">
            <p className="text-4xl mb-4">🎧</p>
            <h2 className="font-display text-lg text-cream uppercase mb-2">Verbind eerst met Spotify</h2>
            <p className="text-sm text-fog leading-relaxed mb-6">
              Dan zie je hier al je playlists en kun je ze aanpassen.
            </p>
            <a
              href="/api/spotify/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-spotify hover:bg-spotify-hi px-6 py-3 text-sm font-bold text-white transition-colors"
            >
              <SpotifyMark /> Verbind met Spotify
            </a>
          </div>
        ) : loadError ? (
          <p className="mt-16 text-center text-sm text-fog">
            Playlists laden is mislukt. Probeer de pagina te verversen.
          </p>
        ) : playlists.length === 0 ? (
          <div className="animate-rise mt-16 text-center px-6">
            <p className="text-4xl mb-4">🎶</p>
            <h2 className="font-display text-lg text-cream uppercase mb-2">Nog geen playlists</h2>
            <p className="text-sm text-fog leading-relaxed mb-6">
              Kies artiesten in de line-up en maak je eerste festival-playlist.
            </p>
            <Link
              href="/planner"
              className="inline-block rounded-xl bg-ember hover:bg-ember-soft px-6 py-3 text-sm font-bold text-white transition-colors"
            >
              Naar de line-up →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {playlists.map((playlist, index) => (
              <li key={playlist.id} className="animate-rise" style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}>
                <Link
                  href={`/playlists/${playlist.id}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-card hover:bg-card-hi p-3.5 transition-colors"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ember/15 text-lg">
                    🎵
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-cream truncate">{playlist.name}</p>
                    <p className="text-xs text-fog mt-0.5">
                      {playlist.trackCount} nummers
                      {playlist.collaborative && ' · samen met vrienden'}
                    </p>
                  </div>
                  <span className="text-fog-dim text-lg">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
