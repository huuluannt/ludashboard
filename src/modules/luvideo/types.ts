export interface VideoItem {
  id: string;
  title: string;
  channel: string;
  thumb: string;
  published: string;
  duration?: string;
}

export interface SavedVideo extends VideoItem {
  savedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  videos: SavedVideo[];
  createdAt: string;
  updatedAt: string;
}

export interface LuVideoState {
  apiKey: string;
  autoplay: boolean;
  videos: VideoItem[];
  currentIndex: number;
  query: string;
}
