export interface VideoItem {
  id: string;
  title: string;
  channel: string;
  thumb: string;
  published: string;
  duration?: string;
}

export interface LuVideoState {
  apiKey: string;
  autoplay: boolean;
  videos: VideoItem[];
  currentIndex: number;
  query: string;
}
