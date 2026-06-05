export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
}

export interface SpotifyUser {
  id: string;
  displayName: string;
  email: string;
}

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  url: string;
  trackCount: number;
  ownerName: string;
  isOwner: boolean;
  collaborative: boolean;
  public: boolean | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: SpotifyArtist[];
  /** Primary artist name (first in list) */
  primaryArtist: string;
  durationMs: number;
  previewUrl: string | null;
  popularity?: number;
  albumName?: string;
  releaseDate?: string;
  sources?: string[];
  prepReason?: string;
}

export interface SpotifyTrackCandidate extends SpotifyTrack {
  festivalArtistId: string;
  festivalArtistName: string;
  spotifyArtistName: string;
  sources: string[];
  alreadyInPlaylist: boolean;
}

export interface MatchedArtist {
  festivalArtistId: string;
  festivalArtistName: string;
  matched: boolean;
  matchedSpotifyName?: string;
  tracks: SpotifyTrack[];
}

export interface PlaylistPreviewData {
  matchedArtists: MatchedArtist[];
  unmatchedArtists: { id: string; name: string }[];
  totalTracks: number;
  selectedDays: string[];
  mode?: 'quick' | 'smart';
}
