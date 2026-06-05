import Link from 'next/link';
import { getEvent } from '@/lib/events';
import { getSpotifyUser, getValidTokens } from '@/lib/spotify';
import PlannerClient from '@/components/PlannerClient';

export const dynamic = 'force-dynamic';

export default async function EventPlannerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event || event.lineup.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-coal">
        <p className="text-4xl">🤷</p>
        <p className="text-sm text-fog">Dit event bestaat niet (meer) of heeft geen timetable.</p>
        <Link
          href="/"
          className="rounded-xl bg-ember px-6 py-3 text-sm font-bold text-white"
        >
          ← Naar alle events
        </Link>
      </div>
    );
  }

  let spotifyUser: { id: string; displayName: string } | null = null;
  try {
    const tokens = await getValidTokens();
    if (tokens) {
      const user = await getSpotifyUser(tokens.accessToken);
      spotifyUser = { id: user.id, displayName: user.displayName };
    }
  } catch {
    // Not authenticated — that's fine
  }

  return (
    <PlannerClient
      event={{ slug: event.slug, name: event.name }}
      initialLineup={event.lineup}
      initialSpotifyUser={spotifyUser}
    />
  );
}
