'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Artist, DaySchedule } from '@/types/lineup';
import { COLOR_STYLES } from './constants';

interface Props {
  daySchedule: DaySchedule;
  selectedIds: Set<string>;
  onToggle: (artist: Artist) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

/**
 * Photo grid of selectable artists for days where the source only published
 * a lineup (no set times yet) — a timeline would be meaningless there.
 * Artist photos come from Spotify (free API data, no AI involved).
 */
export default function ArtistGridView({
  daySchedule,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: Props) {
  const allArtists = daySchedule.stages.flatMap((s) => s.artists);
  const selectedCount = allArtists.filter((a) => selectedIds.has(a.id)).length;
  const [images, setImages] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    const names = daySchedule.stages.flatMap((s) => s.artists.map((a) => a.name));
    if (names.length === 0) return;

    (async () => {
      try {
        const res = await fetch('/api/artist-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names: names.slice(0, 100) }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setImages((prev) => ({ ...prev, ...(data.images ?? {}) }));
      } catch (e) {
        console.error('Artist images failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [daySchedule]);

  // Hide the stage grouping when it's just one generic stage
  const showStages =
    daySchedule.stages.length > 1 ||
    (daySchedule.stages[0] && !/^main$/i.test(daySchedule.stages[0].stageName));

  return (
    <div>
      {/* Controls bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-soot">
        <span className="text-xs text-fog">
          <span className="text-cream font-semibold">{selectedCount}</span>/{allArtists.length} gekozen
          <span className="hidden sm:inline text-fog-dim"> · settijden nog niet bekend</span>
        </span>
        <div className="ml-auto flex gap-1.5">
          <button
            onClick={onSelectAll}
            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-card-hi text-cream hover:bg-line transition-colors"
          >
            Alles
          </button>
          <button
            onClick={onClearAll}
            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-card text-fog hover:text-cream transition-colors"
          >
            Wis dag
          </button>
        </div>
      </div>

      {/* Artist grid */}
      <div className="px-4 py-4 space-y-6">
        {daySchedule.stages.map((stage) => (
          <div key={stage.stageName}>
            {showStages && (
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-ember-soft">
                {stage.stageName}
              </p>
            )}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {stage.artists.map((artist) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  imageUrl={images[artist.name] ?? null}
                  selected={selectedIds.has(artist.id)}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtistCard({
  artist,
  imageUrl,
  selected,
  onToggle,
}: {
  artist: Artist;
  imageUrl: string | null;
  selected: boolean;
  onToggle: (artist: Artist) => void;
}) {
  const colors = COLOR_STYLES[artist.color in COLOR_STYLES ? artist.color : 'default'];
  const initials = artist.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <button
      onClick={() => onToggle(artist)}
      aria-pressed={selected}
      className="group text-left"
      title={artist.name}
    >
      <div
        className={[
          'relative aspect-square w-full overflow-hidden rounded-xl transition-all duration-150',
          selected
            ? 'ring-2 ring-ember shadow-lg shadow-ember/30 scale-[1.02]'
            : 'ring-1 ring-line group-hover:ring-fog-dim',
        ].join(' ')}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 14vw"
            className={[
              'object-cover transition-all duration-150',
              selected ? '' : 'group-hover:scale-105',
            ].join(' ')}
            unoptimized
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: colors.bg }}
          >
            <span className="font-display text-2xl" style={{ color: '#f3ede2' }}>
              {initials}
            </span>
          </div>
        )}

        {selected && (
          <>
            <div className="absolute inset-0 bg-ember/25" />
            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ember text-xs font-bold text-white shadow">
              ✓
            </span>
          </>
        )}
      </div>
      <p
        className={[
          'mt-1.5 truncate text-xs font-bold uppercase tracking-wide transition-colors',
          selected ? 'text-ember-soft' : 'text-cream',
        ].join(' ')}
      >
        {artist.name}
      </p>
    </button>
  );
}
