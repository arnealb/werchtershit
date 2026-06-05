import Link from 'next/link';
import { listEvents } from '@/lib/events';
import { getSpotifyUser, getValidTokens } from '@/lib/spotify';
import DeleteEventButton from '@/components/DeleteEventButton';

export const dynamic = 'force-dynamic';

const TILE_GRADIENTS = [
  'from-[#3b1210] to-[#1a0c0a]',
  'from-[#10243b] to-[#0a121a]',
  'from-[#2c103b] to-[#140a1a]',
  'from-[#0f3b2a] to-[#0a1a13]',
  'from-[#3b2c10] to-[#1a140a]',
];

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const fmt = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
  const startDate = new Date(`${start}T12:00:00`);
  if (!end || end === start) return fmt.format(startDate);
  const endDate = new Date(`${end}T12:00:00`);
  const shortFmt = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short' });
  return `${shortFmt.format(startDate)} – ${fmt.format(endDate)}`;
}

export default async function HomePage() {
  let events: Awaited<ReturnType<typeof listEvents>> = [];
  let loadError = false;
  try {
    events = await listEvents();
  } catch (err) {
    console.error('[home] Failed to list events:', err);
    loadError = true;
  }

  let currentUserId = '';
  try {
    const tokens = await getValidTokens();
    if (tokens) currentUserId = (await getSpotifyUser(tokens.accessToken)).id;
  } catch {
    // Not authenticated — no delete buttons
  }

  return (
    <div className="h-full overflow-y-auto bg-coal">
      <header className="sticky top-0 z-10 border-b border-line bg-soot/90 backdrop-blur px-4 pt-3 pb-3 pt-safe">
        <h1 className="font-display text-xl text-cream uppercase">
          Festival <span className="text-ember">Planner</span>
        </h1>
        <p className="text-xs text-fog mt-0.5">Kies een event of voeg er zelf één toe</p>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5">
        {loadError ? (
          <p className="mt-16 text-center text-sm text-fog">
            Events laden is mislukt. Probeer de pagina te verversen.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event, index) => (
              <li key={event.slug} className="relative animate-rise" style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}>
                {currentUserId && event.createdBy === currentUserId && (
                  <DeleteEventButton slug={event.slug} name={event.name} />
                )}
                <Link
                  href={`/e/${event.slug}`}
                  className={`group relative block overflow-hidden rounded-2xl border border-line bg-gradient-to-br p-5 transition-transform duration-200 hover:scale-[1.015] active:scale-[0.99] ${TILE_GRADIENTS[index % TILE_GRADIENTS.length]}`}
                >
                  <p className="font-display text-2xl uppercase leading-tight text-cream">
                    {event.name}
                  </p>
                  <p className="mt-1.5 text-xs font-semibold text-fog">
                    {[formatDateRange(event.startDate, event.endDate), event.location]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-ember-soft">
                    {event.artistCount} artiesten · {event.dayCount} dag{event.dayCount !== 1 ? 'en' : ''}
                  </p>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-fog-dim transition-transform group-hover:translate-x-1">
                    ›
                  </span>
                </Link>
              </li>
            ))}

            <li className="animate-rise" style={{ animationDelay: `${Math.min(events.length * 50, 450)}ms` }}>
              <Link
                href="/events/new"
                className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-soot/50 p-5 text-center transition-colors hover:border-ember hover:bg-ember/5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ember text-2xl font-bold leading-none text-white">
                  +
                </span>
                <span className="text-sm font-bold text-cream">Event toevoegen</span>
                <span className="text-[11px] text-fog">
                  Zoek op naam, plak een link of upload een poster
                </span>
              </Link>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
