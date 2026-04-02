import { getLineupData } from '@/lib/lineup';
import { getValidTokens, getSpotifyUser } from '@/lib/spotify';
import PlannerClient from '@/components/PlannerClient';

export default async function PlannerPage() {
  // Load lineup (from cache or scrape)
  const lineup = await getLineupData();

  // Check Spotify auth status
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

  return <PlannerClient initialLineup={lineup} initialSpotifyUser={spotifyUser} />;
}
