'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { Artist } from '@/types/lineup';
import type { PlaylistPreviewData, SpotifyPlaylistSummary } from '@/types/spotify';

type WizardStep = 'settings' | 'building' | 'preview' | 'done';

interface SaveResult {
  playlistUrl?: string;
  addedTracks: number;
  skippedTracks: number;
  mode: 'new' | 'existing';
}

interface Props {
  eventSlug: string;
  eventName: string;
  selectedArtists: Artist[];
  playlists: SpotifyPlaylistSummary[];
  playlistsLoading: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function PlaylistCover({ playlist, size }: { playlist: SpotifyPlaylistSummary; size: number }) {
  if (!playlist.imageUrl) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-md bg-ember/15 text-sm"
        style={{ width: size, height: size }}
      >
        🎵
      </div>
    );
  }
  return (
    <Image
      src={playlist.imageUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-md object-cover"
      style={{ width: size, height: size }}
      unoptimized
    />
  );
}

const BUILD_MESSAGES = [
  'Setlists van recente concerten doorzoeken…',
  'Volledige discografieën afstruinen…',
  'Hits en klassiekers verzamelen…',
  'AI kiest de beste nummers per artiest…',
  'Bijna klaar — playlist samenstellen…',
];

export default function PlaylistWizard({
  eventSlug,
  eventName,
  selectedArtists,
  playlists,
  playlistsLoading,
  onClose,
  onSaved,
}: Props) {
  const [step, setStep] = useState<WizardStep>('settings');
  const [mode, setMode] = useState<'smart' | 'quick'>('smart');
  const [tracksPerArtist, setTracksPerArtist] = useState(5);
  const [target, setTarget] = useState<'new' | 'existing'>('new');
  const [targetPlaylistId, setTargetPlaylistId] = useState('');
  const [playlistQuery, setPlaylistQuery] = useState('');
  const [playlistName, setPlaylistName] = useState(`${eventName} — Mijn selectie`);
  const [preview, setPreview] = useState<PlaylistPreviewData | null>(null);
  const [removedUris, setRemovedUris] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [buildMessageIndex, setBuildMessageIndex] = useState(0);

  // Rotate loading messages while building
  useEffect(() => {
    if (step !== 'building') return;
    setBuildMessageIndex(0);
    const interval = setInterval(
      () => setBuildMessageIndex((i) => Math.min(i + 1, BUILD_MESSAGES.length - 1)),
      4000,
    );
    return () => clearInterval(interval);
  }, [step]);

  const artistIds = useMemo(() => selectedArtists.map((a) => a.id), [selectedArtists]);

  const filteredPlaylists = useMemo(() => {
    const query = playlistQuery.trim().toLowerCase();
    if (!query) return playlists;
    return playlists.filter((playlist) => playlist.name.toLowerCase().includes(query));
  }, [playlists, playlistQuery]);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === targetPlaylistId) ?? null,
    [playlists, targetPlaylistId],
  );

  const keptTracksByArtist = useMemo(() => {
    if (!preview) return [];
    return preview.matchedArtists
      .map((artist) => ({
        ...artist,
        tracks: artist.tracks.filter((track) => !removedUris.has(track.uri)),
      }))
      .filter((artist) => artist.tracks.length > 0);
  }, [preview, removedUris]);

  const keptTrackUris = useMemo(
    () => [...new Set(keptTracksByArtist.flatMap((a) => a.tracks.map((t) => t.uri)))],
    [keptTracksByArtist],
  );

  const buildPreview = async () => {
    setStep('building');
    setError(null);
    setRemovedUris(new Set());
    try {
      const endpoint = mode === 'smart' ? '/api/spotify/smart-prep' : '/api/spotify/playlist';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistIds,
          eventSlug,
          maxTracksPerArtist: tracksPerArtist,
          targetPlaylistId: target === 'existing' ? targetPlaylistId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Er ging iets mis');
      setPreview(data);
      setStep('preview');
    } catch (e) {
      console.error('Preview build failed:', e);
      setError('Het samenstellen is mislukt. Probeer het opnieuw.');
      setStep('settings');
    }
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/spotify/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistIds,
          eventSlug,
          mode,
          maxTracksPerArtist: tracksPerArtist,
          targetPlaylistId: target === 'existing' ? targetPlaylistId : undefined,
          trackUris: keptTrackUris,
          playlistName: target === 'new' ? playlistName.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Opslaan mislukt');
      setSaveResult({
        playlistUrl: data.playlistUrl,
        addedTracks: data.addedTracks ?? data.totalTracks ?? 0,
        skippedTracks: data.skippedTracks ?? 0,
        mode: data.mode ?? (target === 'existing' ? 'existing' : 'new'),
      });
      setStep('done');
      onSaved();
    } catch (e) {
      console.error('Save failed:', e);
      setError('Opslaan in Spotify is mislukt. Probeer het opnieuw.');
    } finally {
      setIsSaving(false);
    }
  };

  const stepperButton = (delta: number, label: string) => (
    <button
      type="button"
      onClick={() => setTracksPerArtist((n) => Math.max(1, Math.min(25, n + delta)))}
      className="h-12 w-12 rounded-full bg-card-hi text-cream text-2xl font-bold leading-none hover:bg-line active:scale-95 transition-all"
      aria-label={label}
    >
      {delta > 0 ? '+' : '−'}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm sm:p-4">
      <div className="animate-sheet sm:animate-rise bg-soot border-t sm:border border-line sm:rounded-2xl w-full sm:max-w-2xl max-h-[94dvh] sm:max-h-[88vh] rounded-t-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-display text-xl text-cream uppercase">
              {step === 'done' ? 'Klaar!' : 'Playlist maken'}
            </h2>
            <p className="text-xs text-fog mt-0.5">
              {selectedArtists.length} artiesten geselecteerd
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-card text-fog hover:text-cream text-lg leading-none transition-colors"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded-lg bg-ember-deep/25 border border-ember-deep px-3 py-2 text-sm text-ember-soft shrink-0">
            {error}
          </div>
        )}

        {/* ── Step: settings ── */}
        {step === 'settings' && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* Mode */}
              <section>
                <h3 className="text-xs font-bold text-fog uppercase tracking-widest mb-2.5">
                  Hoe kiezen we de nummers?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('smart')}
                    className={[
                      'rounded-xl border p-3.5 text-left transition-all',
                      mode === 'smart'
                        ? 'border-ember bg-ember/10 ring-1 ring-ember'
                        : 'border-line bg-card hover:border-fog-dim',
                    ].join(' ')}
                  >
                    <p className="text-sm font-bold text-cream">✨ Slim <span className="ml-1 text-[10px] font-semibold text-ember uppercase">Aanbevolen</span></p>
                    <p className="text-xs text-fog mt-1 leading-relaxed">
                      AI kiest wat ze écht live spelen: hits, klassiekers en nieuwe nummers.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('quick')}
                    className={[
                      'rounded-xl border p-3.5 text-left transition-all',
                      mode === 'quick'
                        ? 'border-ember bg-ember/10 ring-1 ring-ember'
                        : 'border-line bg-card hover:border-fog-dim',
                    ].join(' ')}
                  >
                    <p className="text-sm font-bold text-cream">⚡ Snel</p>
                    <p className="text-xs text-fog mt-1 leading-relaxed">
                      Gewoon de populairste nummers per artiest. Sneller, minder slim.
                    </p>
                  </button>
                </div>
              </section>

              {/* Tracks per artist */}
              <section>
                <h3 className="text-xs font-bold text-fog uppercase tracking-widest mb-2.5">
                  Hoeveel nummers per artiest?
                </h3>
                <div className="rounded-xl border border-line bg-card p-4">
                  <div className="flex items-center justify-center gap-6">
                    {stepperButton(-1, 'Minder nummers')}
                    <div className="text-center w-20">
                      <span className="font-display text-5xl text-cream leading-none">
                        {tracksPerArtist}
                      </span>
                    </div>
                    {stepperButton(1, 'Meer nummers')}
                  </div>
                  <div className="mt-3 flex justify-center gap-1.5">
                    {[3, 5, 10, 15, 25].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTracksPerArtist(preset)}
                        className={[
                          'rounded-full px-3 py-1 text-xs font-bold transition-colors',
                          tracksPerArtist === preset
                            ? 'bg-ember text-white'
                            : 'bg-card-hi text-fog hover:text-cream',
                        ].join(' ')}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                {mode === 'smart' && (
                  <p className="text-[11px] text-fog-dim mt-2 text-center">
                    Headliners met een lange set krijgen er automatisch wat meer, korte sets wat minder.
                  </p>
                )}
              </section>

              {/* Target */}
              <section>
                <h3 className="text-xs font-bold text-fog uppercase tracking-widest mb-2.5">
                  Waar moet de playlist komen?
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTarget('new')}
                    className={[
                      'rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all',
                      target === 'new'
                        ? 'border-ember bg-ember/10 text-cream ring-1 ring-ember'
                        : 'border-line bg-card text-fog hover:border-fog-dim',
                    ].join(' ')}
                  >
                    Nieuwe playlist
                  </button>
                  <button
                    type="button"
                    onClick={() => setTarget('existing')}
                    disabled={playlistsLoading || playlists.length === 0}
                    className={[
                      'rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all disabled:opacity-40',
                      target === 'existing'
                        ? 'border-ember bg-ember/10 text-cream ring-1 ring-ember'
                        : 'border-line bg-card text-fog hover:border-fog-dim',
                    ].join(' ')}
                  >
                    Bestaande playlist
                  </button>
                </div>
                {target === 'new' && (
                  <div className="mt-2">
                    <label className="block text-[11px] font-semibold text-fog mb-1.5" htmlFor="playlist-name">
                      Naam van je playlist
                    </label>
                    <input
                      id="playlist-name"
                      type="text"
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                      maxLength={100}
                      placeholder="Bijv. Werchter 2026 voorbereiding"
                      className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-cream placeholder:text-fog-dim focus:border-ember focus:outline-none"
                    />
                  </div>
                )}
                {target === 'existing' && (
                  <div className="mt-2 space-y-2">
                    {selectedPlaylist && (
                      <div className="flex items-center gap-2.5 rounded-xl border border-spotify/60 bg-spotify/10 px-3 py-2">
                        <PlaylistCover playlist={selectedPlaylist} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-cream truncate">{selectedPlaylist.name}</p>
                          <p className="text-[10px] text-fog">{selectedPlaylist.trackCount} nummers · gekozen ✓</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTargetPlaylistId('')}
                          className="text-[11px] font-semibold text-fog hover:text-cream shrink-0"
                        >
                          Wijzig
                        </button>
                      </div>
                    )}

                    {!selectedPlaylist && (
                      <>
                        <input
                          type="search"
                          value={playlistQuery}
                          onChange={(e) => setPlaylistQuery(e.target.value)}
                          placeholder={`Zoek in je ${playlists.length} playlists…`}
                          className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-cream placeholder:text-fog-dim focus:border-ember focus:outline-none"
                        />
                        <div className="max-h-60 overflow-y-auto rounded-xl border border-line divide-y divide-line">
                          {filteredPlaylists.length === 0 ? (
                            <p className="px-3 py-6 text-center text-xs text-fog-dim">
                              Geen playlists gevonden voor “{playlistQuery}”
                            </p>
                          ) : (
                            filteredPlaylists.map((playlist) => (
                              <button
                                key={playlist.id}
                                type="button"
                                onClick={() => setTargetPlaylistId(playlist.id)}
                                className="flex w-full items-center gap-2.5 bg-card px-3 py-2 text-left hover:bg-card-hi transition-colors"
                              >
                                <PlaylistCover playlist={playlist} size={36} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-cream truncate">{playlist.name}</p>
                                  <p className="text-[10px] text-fog-dim">{playlist.trackCount} nummers</p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}

                    <p className="text-[11px] text-fog-dim">
                      Nummers die er al in staan worden automatisch overgeslagen.
                    </p>
                  </div>
                )}
              </section>
            </div>

            <div className="px-5 py-4 border-t border-line shrink-0 pb-safe">
              <button
                onClick={buildPreview}
                disabled={selectedArtists.length === 0 || (target === 'existing' && !targetPlaylistId)}
                className="w-full rounded-xl bg-ember hover:bg-ember-soft disabled:bg-card disabled:text-fog-dim text-white text-base font-bold py-3.5 transition-colors"
              >
                Stel mijn playlist samen →
              </button>
            </div>
          </>
        )}

        {/* ── Step: building ── */}
        {step === 'building' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 py-16 min-h-[320px]">
            <div className="flex items-end gap-1.5 h-12">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="eq-bar w-2.5 rounded-full bg-ember"
                  style={{ height: '100%', animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-cream">{BUILD_MESSAGES[buildMessageIndex]}</p>
              <p className="text-xs text-fog-dim mt-2">
                {mode === 'smart'
                  ? `Dit kan even duren bij ${selectedArtists.length} artiesten — even geduld 🤘`
                  : 'Eén moment…'}
              </p>
            </div>
          </div>
        )}

        {/* ── Step: preview ── */}
        {step === 'preview' && preview && (
          <>
            <div className="px-5 py-2.5 border-b border-line flex items-center justify-between text-xs shrink-0">
              <span className="text-fog">
                <span className="text-cream font-bold">{keptTrackUris.length}</span> nummers ·{' '}
                {keptTracksByArtist.length} artiesten
              </span>
              <button
                onClick={() => setStep('settings')}
                className="font-semibold text-ember-soft hover:text-ember transition-colors"
              >
                ← Instellingen
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {keptTracksByArtist.map((artist) => {
                const festivalArtist = selectedArtists.find((a) => a.id === artist.festivalArtistId);
                return (
                  <div key={artist.festivalArtistId} className="rounded-xl border border-line bg-card p-3">
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                      <p className="text-sm font-bold text-cream truncate">{artist.festivalArtistName}</p>
                      {festivalArtist && (
                        <span className="text-[10px] text-fog-dim shrink-0 uppercase font-semibold">
                          {festivalArtist.stage} · {festivalArtist.startTime.display}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {artist.tracks.map((track) => (
                        <li key={track.uri} className="flex items-start gap-2 group">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-cream truncate">{track.name}</p>
                            {track.prepReason && (
                              <p className="text-[10px] text-fog-dim leading-snug mt-0.5">{track.prepReason}</p>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setRemovedUris((prev) => new Set([...prev, track.uri]))
                            }
                            className="shrink-0 h-6 w-6 rounded-full text-fog-dim hover:text-ember hover:bg-ember/10 text-xs transition-colors"
                            aria-label={`${track.name} verwijderen`}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {(preview.fullyCoveredArtists?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-spotify/40 bg-spotify/5 p-3">
                  <p className="text-xs font-bold text-spotify mb-1.5">
                    ✓ Al ruim vertegenwoordigd in deze playlist ({preview.fullyCoveredArtists!.length})
                  </p>
                  <p className="text-[11px] text-fog">
                    {preview.fullyCoveredArtists!.map((a) => a.name).join(' · ')}
                  </p>
                  <p className="text-[10px] text-fog-dim mt-1.5">
                    Alle goede nummers van deze artiesten staan er al in — er wordt niets dubbel toegevoegd.
                  </p>
                </div>
              )}

              {preview.unmatchedArtists.length > 0 && (
                <div className="rounded-xl border border-line bg-card p-3">
                  <p className="text-xs font-bold text-fog mb-1.5">
                    Niet gevonden op Spotify ({preview.unmatchedArtists.length})
                  </p>
                  <p className="text-[11px] text-fog-dim">
                    {preview.unmatchedArtists.map((a) => a.name).join(' · ')}
                  </p>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-line shrink-0 pb-safe">
              <button
                onClick={save}
                disabled={isSaving || keptTrackUris.length === 0}
                className="w-full rounded-xl bg-spotify hover:bg-spotify-hi disabled:bg-card disabled:text-fog-dim text-white text-base font-bold py-3.5 transition-colors"
              >
                {isSaving
                  ? 'Opslaan…'
                  : target === 'existing'
                    ? `Voeg ${keptTrackUris.length} nummers toe`
                    : `Maak playlist (${keptTrackUris.length} nummers)`}
              </button>
            </div>
          </>
        )}

        {/* ── Step: done ── */}
        {step === 'done' && saveResult && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 py-12 min-h-[320px] text-center">
            <div className="h-16 w-16 rounded-full bg-spotify/15 ring-2 ring-spotify flex items-center justify-center text-3xl">
              ✓
            </div>
            <div>
              <p className="font-display text-2xl text-cream uppercase">
                Playlist {saveResult.mode === 'existing' ? 'bijgewerkt' : 'aangemaakt'}
              </p>
              <p className="text-sm text-fog mt-1.5">
                {saveResult.addedTracks} nummers toegevoegd
                {saveResult.skippedTracks > 0 && ` · ${saveResult.skippedTracks} stonden er al in`}
              </p>
            </div>
            {saveResult.playlistUrl && (
              <a
                href={saveResult.playlistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-spotify hover:bg-spotify-hi text-white text-sm font-bold py-3 px-8 transition-colors"
              >
                Open in Spotify ↗
              </a>
            )}
            <button
              onClick={onClose}
              className="text-sm font-semibold text-fog hover:text-cream transition-colors"
            >
              Sluiten
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
