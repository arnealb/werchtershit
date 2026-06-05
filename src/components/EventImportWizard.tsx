'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDayLabel, type LineupData } from '@/types/lineup';

type Step = 'method' | 'search' | 'url' | 'image' | 'extracting' | 'preview';
type Method = 'search' | 'url' | 'image';

interface EventCandidate {
  name: string;
  location: string;
  datesText: string;
  url: string;
}

interface Draft {
  name: string;
  location: string;
  lineup: LineupData;
}

interface Props {
  isAuthenticated: boolean;
}

export default function EventImportWizard({ isAuthenticated }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<Method>('search');
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<EventCandidate[] | null>(null);

  const [url, setUrl] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const startMethod = (m: Method) => {
    setMethod(m);
    setError(null);
    setStep(m);
  };

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setCandidates(null);
    try {
      const res = await fetch('/api/events/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Zoeken mislukt');
      setCandidates(data.candidates ?? []);
    } catch (e) {
      console.error('Event search failed:', e);
      setError('Zoeken is mislukt. Probeer het opnieuw.');
    } finally {
      setSearching(false);
    }
  };

  const importFromUrl = async (targetUrl: string, hint?: string) => {
    setStep('extracting');
    setError(null);
    try {
      const res = await fetch('/api/events/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, hint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import mislukt');
      setDraft(data.draft);
      setSourceUrl(data.sourceUrl);
      setStep('preview');
    } catch (e) {
      console.error('URL import failed:', e);
      setError(e instanceof Error ? e.message : 'Import mislukt');
      setStep(method);
    }
  };

  const importFromImage = async (file: File) => {
    setStep('extracting');
    setError(null);
    try {
      const dataUrl = await downscaleImage(file);
      const res = await fetch('/api/events/import-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import mislukt');
      setDraft(data.draft);
      setSourceUrl(undefined);
      setStep('preview');
    } catch (e) {
      console.error('Image import failed:', e);
      setError(e instanceof Error ? e.message : 'Import mislukt');
      setStep('image');
    }
  };

  const save = async () => {
    if (!draft) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          location: draft.location,
          lineup: draft.lineup,
          sourceUrl,
          sourceType: method === 'search' ? 'ai_search' : method === 'url' ? 'ai_url' : 'ai_screenshot',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Opslaan mislukt');
      router.push(`/e/${data.event.slug}`);
    } catch (e) {
      console.error('Event save failed:', e);
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="mt-16 text-center px-6 animate-rise">
        <p className="text-4xl mb-4">🔐</p>
        <h2 className="font-display text-lg text-cream uppercase mb-2">Verbind eerst met Spotify</h2>
        <p className="text-sm text-fog leading-relaxed mb-6">
          Dan kun je zelf events toevoegen voor iedereen.
        </p>
        <a
          href="/api/spotify/auth"
          className="inline-block rounded-xl bg-spotify hover:bg-spotify-hi px-6 py-3 text-sm font-bold text-white transition-colors"
        >
          Verbind met Spotify
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      {error && (
        <div className="mb-4 rounded-lg bg-ember-deep/25 border border-ember-deep px-3 py-2 text-sm text-ember-soft animate-rise">
          {error}
        </div>
      )}

      {/* Step: choose method */}
      {step === 'method' && (
        <div className="space-y-2.5 animate-rise">
          <MethodCard
            emoji="🔎"
            title="Zoek op naam"
            badge="Makkelijkst"
            description='Typ bijv. "Pukkelpop 2026" — AI zoekt het event en de timetable voor je.'
            onClick={() => startMethod('search')}
          />
          <MethodCard
            emoji="🔗"
            title="Plak een link"
            description="Heb je de timetable-pagina al? Plak de link en AI leest hem uit."
            onClick={() => startMethod('url')}
          />
          <MethodCard
            emoji="📸"
            title="Upload een poster of screenshot"
            description="Foto van een timetable-poster (bv. van Instagram)? AI leest hem uit."
            onClick={() => startMethod('image')}
          />
        </div>
      )}

      {/* Step: search */}
      {step === 'search' && (
        <div className="space-y-3 animate-rise">
          <BackButton onClick={() => setStep('method')} />
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder='Bijv. "Sunrise Festival 2026"'
              autoFocus
              className="flex-1 rounded-xl border border-line bg-card px-3.5 py-3 text-sm text-cream placeholder:text-fog-dim focus:border-ember focus:outline-none"
            />
            <button
              onClick={runSearch}
              disabled={searching || query.trim().length < 2}
              className="rounded-xl bg-ember hover:bg-ember-soft disabled:bg-card disabled:text-fog-dim px-5 text-sm font-bold text-white transition-colors"
            >
              {searching ? '…' : 'Zoek'}
            </button>
          </div>

          {searching && <LoadingBars label="Het web doorzoeken…" />}

          {candidates && candidates.length === 0 && (
            <p className="text-center text-sm text-fog py-6">
              Niets gevonden. Probeer een andere naam, of gebruik een link/screenshot.
            </p>
          )}

          {candidates && candidates.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-fog uppercase tracking-widest">
                Is dit wat je bedoelt?
              </p>
              {candidates.map((candidate, index) => (
                <button
                  key={`${candidate.url}-${index}`}
                  onClick={() => importFromUrl(candidate.url, candidate.name)}
                  className="w-full rounded-xl border border-line bg-card hover:border-ember p-3.5 text-left transition-colors"
                >
                  <p className="text-sm font-bold text-cream">{candidate.name}</p>
                  <p className="text-xs text-fog mt-0.5">
                    {[candidate.datesText, candidate.location].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-[10px] text-fog-dim mt-1 truncate">{candidate.url}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step: url */}
      {step === 'url' && (
        <div className="space-y-3 animate-rise">
          <BackButton onClick={() => setStep('method')} />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && url && importFromUrl(url)}
            placeholder="https://www.festival.be/timetable"
            autoFocus
            className="w-full rounded-xl border border-line bg-card px-3.5 py-3 text-sm text-cream placeholder:text-fog-dim focus:border-ember focus:outline-none"
          />
          <button
            onClick={() => importFromUrl(url)}
            disabled={!url.trim()}
            className="w-full rounded-xl bg-ember hover:bg-ember-soft disabled:bg-card disabled:text-fog-dim py-3 text-sm font-bold text-white transition-colors"
          >
            Lees deze pagina →
          </button>
          <p className="text-[11px] text-fog-dim text-center">
            Werkt het best met een pagina waar de settijden op staan.
          </p>
        </div>
      )}

      {/* Step: image */}
      {step === 'image' && (
        <div className="space-y-3 animate-rise">
          <BackButton onClick={() => setStep('method')} />
          <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-soot/60 p-6 text-center transition-colors hover:border-ember">
            <span className="text-3xl">📸</span>
            <span className="text-sm font-bold text-cream">Kies een foto of screenshot</span>
            <span className="text-[11px] text-fog">PNG of JPG · hoe scherper, hoe beter</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFromImage(file);
              }}
            />
          </label>
        </div>
      )}

      {/* Step: extracting */}
      {step === 'extracting' && (
        <div className="py-16 animate-rise">
          <LoadingBars label="AI leest de timetable uit… dit duurt even" />
        </div>
      )}

      {/* Step: preview */}
      {step === 'preview' && draft && (
        <div className="space-y-4 animate-rise">
          <BackButton onClick={() => setStep('method')} label="Opnieuw beginnen" />

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-fog" htmlFor="event-name">
              Naam van het event
            </label>
            <input
              id="event-name"
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              maxLength={120}
              className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-cream focus:border-ember focus:outline-none"
            />
            <label className="block text-[11px] font-semibold text-fog" htmlFor="event-location">
              Locatie
            </label>
            <input
              id="event-location"
              type="text"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              maxLength={120}
              placeholder="Bijv. Kiewit, Hasselt"
              className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm text-cream placeholder:text-fog-dim focus:border-ember focus:outline-none"
            />
          </div>

          <div className="space-y-2.5">
            <p className="text-xs font-bold text-fog uppercase tracking-widest">
              Gevonden timetable — klopt dit ongeveer?
            </p>
            {draft.lineup.map((day) => (
              <div key={day.day} className="rounded-xl border border-line bg-card p-3">
                <p className="text-sm font-bold text-cream">
                  {formatDayLabel(day)}
                  {day.hasTimes === false && (
                    <span className="ml-2 text-[10px] font-semibold uppercase text-fog-dim">
                      nog geen settijden
                    </span>
                  )}
                </p>
                {day.stages.map((stage) => (
                  <div key={stage.stageName} className="mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ember-soft">
                      {stage.stageName} · {stage.artists.length} acts
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-fog">
                      {stage.artists
                        .map((artist) =>
                          day.hasTimes === false
                            ? artist.name
                            : `${artist.name} (${artist.startTime.display})`,
                        )
                        .join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <button
            onClick={save}
            disabled={isSaving || !draft.name.trim()}
            className="w-full rounded-xl bg-spotify hover:bg-spotify-hi disabled:bg-card disabled:text-fog-dim py-3.5 text-sm font-bold text-white transition-colors"
          >
            {isSaving ? 'Opslaan…' : 'Klopt — voeg dit event toe'}
          </button>
          <p className="text-[11px] text-fog-dim text-center pb-4">
            Niet helemaal juist? Probeer een andere bron — AI-extractie is niet altijd perfect.
          </p>
        </div>
      )}

      {step === 'method' && (
        <p className="mt-6 text-center text-[11px] text-fog-dim">
          Toegevoegde events zijn zichtbaar voor iedereen.{' '}
          <Link href="/" className="text-fog underline">
            Terug naar events
          </Link>
        </p>
      )}
    </div>
  );
}

function MethodCard({
  emoji,
  title,
  badge,
  description,
  onClick,
}: {
  emoji: string;
  title: string;
  badge?: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3.5 rounded-2xl border border-line bg-card p-4 text-left transition-colors hover:border-ember"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="flex-1">
        <span className="flex items-center gap-2 text-sm font-bold text-cream">
          {title}
          {badge && (
            <span className="rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-bold uppercase text-ember">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-fog">{description}</span>
      </span>
      <span className="text-lg text-fog-dim">›</span>
    </button>
  );
}

function BackButton({ onClick, label = 'Terug' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="text-xs font-semibold text-ember-soft hover:text-ember">
      ← {label}
    </button>
  );
}

function LoadingBars({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="flex items-end gap-1.5 h-10">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="eq-bar w-2 rounded-full bg-ember"
            style={{ height: '100%', animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <p className="text-sm font-semibold text-cream">{label}</p>
    </div>
  );
}

/** Downscale to max 2000px and re-encode as JPEG so uploads stay small. */
async function downscaleImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Bestand lezen mislukt'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Afbeelding laden mislukt'));
    img.src = dataUrl;
  });

  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.88);
}
