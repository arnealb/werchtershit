'use client';

import { useEffect, useState } from 'react';

interface SpotifyUser {
  id: string;
  displayName: string;
  email: string;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  trackCount: number;
  public: boolean | null;
}

export default function TestPage() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [fetchingPlaylists, setFetchingPlaylists] = useState(false);
  const [trackResult, setTrackResult] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/spotify/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user);
          setStatus('connected');
        } else {
          setStatus('disconnected');
        }
      })
      .catch(() => setStatus('disconnected'));
  }, []);

  async function fetchPlaylists() {
    setFetchingPlaylists(true);
    setPlaylistError(null);
    try {
      const res = await fetch('/api/spotify/playlists');
      const data = await res.json();
      if (!res.ok) {
        setPlaylistError(JSON.stringify(data, null, 2));
      } else {
        setPlaylists(data.playlists);
      }
    } catch (e) {
      setPlaylistError(String(e));
    } finally {
      setFetchingPlaylists(false);
    }
  }

  async function fetchTracks(_id: string, name: string) {
    setTrackResult(`Testing Spotify search for "${name}"...`);
    const res = await fetch(`/api/spotify/tracks?artist=${encodeURIComponent(name)}`);
    const data = await res.json();
    setTrackResult(JSON.stringify(data, null, 2).slice(0, 3000));
  }

  async function disconnect() {
    await fetch('/api/spotify/me', { method: 'DELETE' });
    setUser(null);
    setPlaylists(null);
    setStatus('disconnected');
  }

  return (
    <div style={{ fontFamily: 'monospace', padding: 32, maxWidth: 640 }}>
      <h1>Spotify API Test</h1>

      <section style={{ marginBottom: 24 }}>
        <h2>Auth</h2>
        {status === 'loading' && <p>Checking...</p>}
        {status === 'disconnected' && (
          <a href="/api/spotify/auth" style={{ background: '#1db954', color: '#fff', padding: '8px 16px', textDecoration: 'none', borderRadius: 4 }}>
            Connect Spotify
          </a>
        )}
        {status === 'connected' && user && (
          <div>
            <p>Connected as: <strong>{user.displayName}</strong> ({user.email})</p>
            <p>User ID: {user.id}</p>
            <button onClick={disconnect} style={{ marginTop: 8 }}>Disconnect</button>
          </div>
        )}
      </section>

      {status === 'connected' && (
        <section style={{ marginBottom: 24 }}>
          <h2>My Playlists</h2>
          <button onClick={fetchPlaylists} disabled={fetchingPlaylists}>
            {fetchingPlaylists ? 'Fetching...' : 'Fetch my playlists'}
          </button>

          {playlistError && (
            <pre style={{ background: '#fee', padding: 12, marginTop: 12, color: '#900', whiteSpace: 'pre-wrap' }}>
              {playlistError}
            </pre>
          )}

          {playlists && (
            <ul style={{ marginTop: 12, paddingLeft: 20 }}>
              {playlists.map((p) => (
                <li key={p.id} style={{ marginBottom: 6 }}>
                  <strong>{p.name}</strong> — {p.trackCount ?? '?'} tracks — {p.public ? 'public' : 'private'}
                  <br />
                  <small>ID: {p.id}</small>
                  {' '}
                  <button onClick={() => fetchTracks(p.id, p.name)} style={{ fontSize: 11 }}>test search</button>
                </li>
              ))}
            </ul>
          )}

          {trackResult && (
            <pre style={{ background: '#111', color: '#0f0', padding: 12, marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {trackResult}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}
