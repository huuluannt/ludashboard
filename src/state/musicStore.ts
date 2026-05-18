import { create } from 'zustand';
import type { MusicSearchResponse, MusicTrack } from '@/services/music/types';

export type RepeatMode = 'off' | 'one' | 'all';

export interface MusicPlaylist {
  id: string;
  name: string;
  tracks: MusicTrack[];
  createdAt: string;
  updatedAt: string;
}

interface MusicStore {
  searchQuery: string;
  searchResults: MusicTrack[];
  searchNotice: string;
  isSearching: boolean;
  error: string;
  playerMessage: string;
  queue: MusicTrack[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  lastVolume: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
  currentTime: number;
  duration: number;
  playbackNonce: number;
  seekNonce: number;
  seekTo: number;
  playlists: MusicPlaylist[];
  playlistsUpdatedAt: number;
  setSearchQuery: (query: string) => void;
  setSearchLoading: (loading: boolean) => void;
  setSearchResponse: (response: MusicSearchResponse) => void;
  setError: (error: string) => void;
  setPlayerMessage: (message: string) => void;
  playTrack: (track: MusicTrack, queueContext?: MusicTrack[]) => void;
  addToQueue: (track: MusicTrack) => void;
  removeFromQueue: (videoId: string) => void;
  moveQueueTrack: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  restartCurrent: () => void;
  setIsPlaying: (playing: boolean) => void;
  play: () => void;
  pause: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  setProgress: (currentTime: number, duration: number) => void;
  requestSeek: (seconds: number) => void;
  createPlaylist: (name: string) => string | null;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, track: MusicTrack) => void;
  removeTrackFromPlaylist: (playlistId: string, videoId: string) => void;
  movePlaylistTrack: (playlistId: string, fromIndex: number, toIndex: number) => void;
  playPlaylist: (playlistId: string, startIndex?: number) => void;
  setPlaylistsFromCloud: (playlists: MusicPlaylist[], updatedAt: number) => void;
}

const PLAYLISTS_KEY = 'lumusic_playlists';
const PLAYLISTS_UPDATED_AT_KEY = 'lumusic_playlists_updated_at';
const VOLUME_KEY = 'lumusic_volume';
const LAST_VOLUME_KEY = 'lumusic_last_volume';

export const useMusicStore = create<MusicStore>((set, get) => ({
  searchQuery: '',
  searchResults: [],
  searchNotice: '',
  isSearching: false,
  error: '',
  playerMessage: '',
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  volume: loadStoredVolume(),
  lastVolume: loadStoredLastVolume(),
  repeatMode: 'off',
  shuffle: false,
  currentTime: 0,
  duration: 0,
  playbackNonce: 0,
  seekNonce: 0,
  seekTo: 0,
  playlists: loadStoredPlaylists(),
  playlistsUpdatedAt: loadStoredPlaylistsUpdatedAt(),

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchLoading: (isSearching) => set({ isSearching, error: isSearching ? '' : get().error }),
  setSearchResponse: (response) =>
    set({
      searchResults: response.tracks,
      searchNotice: response.notice || '',
      isSearching: false,
      error: '',
    }),
  setError: (error) => set({ error, isSearching: false }),
  setPlayerMessage: (playerMessage) => set({ playerMessage }),

  playTrack: (track, queueContext) => {
    const nextQueue = queueContext?.length
      ? dedupeTracks(queueContext)
      : [track, ...get().queue.filter((item) => item.videoId !== track.videoId)];
    const index = Math.max(0, nextQueue.findIndex((item) => item.videoId === track.videoId));
    set({
      queue: nextQueue,
      currentIndex: index,
      isPlaying: true,
      playerMessage: '',
      currentTime: 0,
      duration: track.durationSeconds || 0,
      playbackNonce: get().playbackNonce + 1,
    });
  },

  addToQueue: (track) =>
    set((state) => {
      if (state.queue.some((item) => item.videoId === track.videoId)) return state;
      const nextQueue = [...state.queue, track];
      return {
        queue: nextQueue,
        currentIndex: state.currentIndex === -1 ? 0 : state.currentIndex,
        isPlaying: state.currentIndex === -1 ? true : state.isPlaying,
        playbackNonce: state.currentIndex === -1 ? state.playbackNonce + 1 : state.playbackNonce,
      };
    }),

  removeFromQueue: (videoId) =>
    set((state) => {
      const removedIndex = state.queue.findIndex((track) => track.videoId === videoId);
      if (removedIndex === -1) return state;
      const nextQueue = state.queue.filter((track) => track.videoId !== videoId);
      if (nextQueue.length === 0) {
        return { queue: [], currentIndex: -1, isPlaying: false, currentTime: 0, duration: 0 };
      }
      const nextIndex = Math.min(
        removedIndex < state.currentIndex ? state.currentIndex - 1 : state.currentIndex,
        nextQueue.length - 1,
      );
      return { queue: nextQueue, currentIndex: nextIndex };
    }),

  moveQueueTrack: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.queue.length || toIndex >= state.queue.length) {
        return state;
      }

      const currentTrack = state.queue[state.currentIndex] ?? null;
      const queue = [...state.queue];
      const [movedTrack] = queue.splice(fromIndex, 1);
      if (!movedTrack) return state;

      queue.splice(toIndex, 0, movedTrack);
      const currentIndex = currentTrack ? queue.findIndex((track) => track.videoId === currentTrack.videoId) : state.currentIndex;

      return {
        queue,
        currentIndex: currentIndex >= 0 ? currentIndex : Math.min(state.currentIndex, queue.length - 1),
      };
    }),

  clearQueue: () =>
    set((state) => {
      const currentTrack = state.queue[state.currentIndex];
      if (!currentTrack) return { queue: [], currentIndex: -1, isPlaying: false };
      return { queue: [currentTrack], currentIndex: 0 };
    }),

  nextTrack: () => {
    const state = get();
    if (state.queue.length === 0) return;
    if (state.shuffle && state.queue.length > 1) {
      let nextIndex = Math.floor(Math.random() * state.queue.length);
      if (nextIndex === state.currentIndex) nextIndex = (nextIndex + 1) % state.queue.length;
      set({ currentIndex: nextIndex, isPlaying: true, currentTime: 0, playbackNonce: state.playbackNonce + 1 });
      return;
    }
    if (state.currentIndex < state.queue.length - 1) {
      set({ currentIndex: state.currentIndex + 1, isPlaying: true, currentTime: 0, playbackNonce: state.playbackNonce + 1 });
      return;
    }
    if (state.repeatMode === 'all') {
      set({ currentIndex: 0, isPlaying: true, currentTime: 0, playbackNonce: state.playbackNonce + 1 });
      return;
    }
    set({ isPlaying: false });
  },

  previousTrack: () => {
    const state = get();
    if (state.queue.length === 0) return;
    const nextIndex = state.currentIndex > 0 ? state.currentIndex - 1 : 0;
    set({ currentIndex: nextIndex, isPlaying: true, currentTime: 0, playbackNonce: state.playbackNonce + 1 });
  },

  restartCurrent: () => set((state) => ({ currentTime: 0, isPlaying: true, playbackNonce: state.playbackNonce + 1 })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  setVolume: (volume) => {
    const bounded = Math.max(0, Math.min(100, volume));
    localStorage.setItem(VOLUME_KEY, String(bounded));
    if (bounded > 0) {
      localStorage.setItem(LAST_VOLUME_KEY, String(bounded));
      set({ volume: bounded, lastVolume: bounded });
      return;
    }
    set({ volume: bounded });
  },
  toggleMute: () =>
    set((state) => {
      if (state.volume > 0) {
        localStorage.setItem(VOLUME_KEY, '0');
        localStorage.setItem(LAST_VOLUME_KEY, String(state.volume));
        return { volume: 0, lastVolume: state.volume };
      }

      const restoredVolume = state.lastVolume > 0 ? state.lastVolume : 70;
      localStorage.setItem(VOLUME_KEY, String(restoredVolume));
      localStorage.setItem(LAST_VOLUME_KEY, String(restoredVolume));
      return { volume: restoredVolume, lastVolume: restoredVolume };
    }),
  setRepeatMode: (repeatMode) => set({ repeatMode }),
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
  setProgress: (currentTime, duration) => set({ currentTime, duration }),
  requestSeek: (seconds) => set((state) => ({ seekTo: seconds, seekNonce: state.seekNonce + 1 })),

  createPlaylist: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const playlist: MusicPlaylist = {
      id: crypto.randomUUID(),
      name: trimmed,
      tracks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updatePlaylists(set, (current) => [playlist, ...current]);
    return playlist.id;
  },
  renamePlaylist: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    updatePlaylists(set, (current) =>
      current.map((playlist) =>
        playlist.id === id ? { ...playlist, name: trimmed, updatedAt: new Date().toISOString() } : playlist,
      ),
    );
  },
  deletePlaylist: (id) => {
    updatePlaylists(set, (current) => current.filter((playlist) => playlist.id !== id));
  },
  addTrackToPlaylist: (playlistId, track) => {
    updatePlaylists(set, (current) =>
      current.map((playlist) => {
        if (playlist.id !== playlistId || playlist.tracks.some((item) => item.videoId === track.videoId)) return playlist;
        return { ...playlist, tracks: [...playlist.tracks, track], updatedAt: new Date().toISOString() };
      }),
    );
  },
  removeTrackFromPlaylist: (playlistId, videoId) => {
    updatePlaylists(set, (current) =>
      current.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              tracks: playlist.tracks.filter((track) => track.videoId !== videoId),
              updatedAt: new Date().toISOString(),
            }
          : playlist,
      ),
    );
  },
  movePlaylistTrack: (playlistId, fromIndex, toIndex) => {
    updatePlaylists(set, (current) =>
      current.map((playlist) => {
        if (
          playlist.id !== playlistId ||
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= playlist.tracks.length ||
          toIndex >= playlist.tracks.length
        ) {
          return playlist;
        }

        const tracks = [...playlist.tracks];
        const [movedTrack] = tracks.splice(fromIndex, 1);
        if (!movedTrack) return playlist;

        tracks.splice(toIndex, 0, movedTrack);
        return { ...playlist, tracks, updatedAt: new Date().toISOString() };
      }),
    );
  },
  playPlaylist: (playlistId, startIndex = 0) => {
    const playlist = get().playlists.find((item) => item.id === playlistId);
    if (!playlist?.tracks.length) return;
    const boundedIndex = Math.max(0, Math.min(startIndex, playlist.tracks.length - 1));
    set({
      queue: playlist.tracks,
      currentIndex: boundedIndex,
      isPlaying: true,
      playerMessage: '',
      currentTime: 0,
      duration: playlist.tracks[boundedIndex]?.durationSeconds || 0,
      playbackNonce: get().playbackNonce + 1,
    });
  },
  setPlaylistsFromCloud: (playlists, updatedAt) => {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
    localStorage.setItem(PLAYLISTS_UPDATED_AT_KEY, String(updatedAt));
    set({ playlists, playlistsUpdatedAt: updatedAt });
  },
}));

export function selectCurrentTrack(state: MusicStore) {
  return state.currentIndex >= 0 ? state.queue[state.currentIndex] ?? null : null;
}

function updatePlaylists(
  set: (partial: Partial<MusicStore> | ((state: MusicStore) => Partial<MusicStore>)) => void,
  updater: (current: MusicPlaylist[]) => MusicPlaylist[],
) {
  set((state) => {
    const playlists = updater(state.playlists);
    const updatedAt = Date.now();
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
    localStorage.setItem(PLAYLISTS_UPDATED_AT_KEY, String(updatedAt));
    return { playlists, playlistsUpdatedAt: updatedAt };
  });
}

function loadStoredPlaylists(): MusicPlaylist[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((playlist) => playlist && typeof playlist.id === 'string' && Array.isArray(playlist.tracks));
  } catch {
    return [];
  }
}

function loadStoredPlaylistsUpdatedAt() {
  const value = Number(localStorage.getItem(PLAYLISTS_UPDATED_AT_KEY));
  if (Number.isFinite(value) && value > 0) return value;
  return loadStoredPlaylists().length ? Date.now() : 0;
}

function loadStoredVolume() {
  const value = Number(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 70;
}

function loadStoredLastVolume() {
  const value = Number(localStorage.getItem(LAST_VOLUME_KEY));
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.min(100, value)) : 70;
}

function dedupeTracks(tracks: MusicTrack[]) {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.videoId)) return false;
    seen.add(track.videoId);
    return true;
  });
}
