export interface MusicTrack {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration?: string;
  durationSeconds?: number;
  url: string;
  score?: number;
  reason?: string;
}

export interface MusicSearchResponse {
  tracks: MusicTrack[];
  weak?: boolean;
  notice?: string;
}
