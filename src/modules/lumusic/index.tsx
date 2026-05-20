import { FormEvent, useEffect, useRef, useState } from 'react';
import { Key, ListMusic, Loader2, Music, Pause, Play, Repeat, Search, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import MusicPlaylists from '@/components/lumusic/MusicPlaylists';
import MusicQueue from '@/components/lumusic/MusicQueue';
import MusicResultCard from '@/components/lumusic/MusicResultCard';
import YouTubeMusicPlayer from '@/components/lumusic/YouTubeMusicPlayer';
import { saveModuleCloudData, subscribeModuleCloudData } from '@/firebase/moduleCloudSync';
import { searchMusic } from '@/services/music/searchMusic';
import { selectCurrentTrack, useMusicStore, type MusicPlaylist } from '@/state/musicStore';

const YOUTUBE_API_KEY_STORAGE_KEY = 'luvideo_api_key';

interface LuMusicPlaylistsCloudValue {
  playlists: MusicPlaylist[];
}

export default function LuMusicModule() {
  const searchQuery = useMusicStore((state) => state.searchQuery);
  const setSearchQuery = useMusicStore((state) => state.setSearchQuery);
  const searchResults = useMusicStore((state) => state.searchResults);
  const searchNotice = useMusicStore((state) => state.searchNotice);
  const isSearching = useMusicStore((state) => state.isSearching);
  const error = useMusicStore((state) => state.error);
  const setSearchLoading = useMusicStore((state) => state.setSearchLoading);
  const setSearchResponse = useMusicStore((state) => state.setSearchResponse);
  const setError = useMusicStore((state) => state.setError);
  const playTrack = useMusicStore((state) => state.playTrack);
  const addToQueue = useMusicStore((state) => state.addToQueue);
  const playlists = useMusicStore((state) => state.playlists);
  const playlistsUpdatedAt = useMusicStore((state) => state.playlistsUpdatedAt);
  const addTrackToPlaylist = useMusicStore((state) => state.addTrackToPlaylist);
  const createPlaylist = useMusicStore((state) => state.createPlaylist);
  const setPlaylistsFromCloud = useMusicStore((state) => state.setPlaylistsFromCloud);
  const currentTrack = useMusicStore(selectCurrentTrack);
  const queue = useMusicStore((state) => state.queue);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const currentTime = useMusicStore((state) => state.currentTime);
  const duration = useMusicStore((state) => state.duration);
  const volume = useMusicStore((state) => state.volume);
  const repeatMode = useMusicStore((state) => state.repeatMode);
  const shuffle = useMusicStore((state) => state.shuffle);
  const play = useMusicStore((state) => state.play);
  const pause = useMusicStore((state) => state.pause);
  const nextTrack = useMusicStore((state) => state.nextTrack);
  const previousTrack = useMusicStore((state) => state.previousTrack);
  const requestSeek = useMusicStore((state) => state.requestSeek);
  const setVolume = useMusicStore((state) => state.setVolume);
  const toggleMute = useMusicStore((state) => state.toggleMute);
  const setRepeatMode = useMusicStore((state) => state.setRepeatMode);
  const toggleShuffle = useMusicStore((state) => state.toggleShuffle);
  const [sideTab, setSideTab] = useState<'playlists' | 'queue'>('queue');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(YOUTUBE_API_KEY_STORAGE_KEY) || '');
  const [apiKeyDraft, setApiKeyDraft] = useState(apiKey);
  const [showApiKeyPanel, setShowApiKeyPanel] = useState(false);
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [playlistsCloudReady, setPlaylistsCloudReady] = useState(false);
  const playlistsUpdatedAtRef = useRef(playlistsUpdatedAt);
  const applyingRemotePlaylistsRef = useRef(false);

  useEffect(() => {
    playlistsUpdatedAtRef.current = playlistsUpdatedAt;
  }, [playlistsUpdatedAt]);

  useEffect(() => {
    return subscribeModuleCloudData<LuMusicPlaylistsCloudValue>('lumusic', 'playlists', {
      onData: (remote) => {
        if (remote.updatedAt <= playlistsUpdatedAtRef.current) return;

        const remotePlaylists = Array.isArray(remote.value.playlists) ? remote.value.playlists : [];
        applyingRemotePlaylistsRef.current = true;
        playlistsUpdatedAtRef.current = remote.updatedAt;
        setPlaylistsFromCloud(remotePlaylists, remote.updatedAt);

        window.setTimeout(() => {
          applyingRemotePlaylistsRef.current = false;
        }, 0);
      },
      onReady: () => setPlaylistsCloudReady(true),
    });
  }, [setPlaylistsFromCloud]);

  useEffect(() => {
    if (!playlistsCloudReady || applyingRemotePlaylistsRef.current || playlistsUpdatedAt <= 0) return;

    const syncTimer = window.setTimeout(() => {
      saveModuleCloudData<LuMusicPlaylistsCloudValue>('lumusic', 'playlists', {
        value: { playlists },
        updatedAt: playlistsUpdatedAt,
      }).catch((syncError) => {
        console.error('Failed to sync LuMusic playlists', syncError);
      });
    }, 600);

    return () => window.clearTimeout(syncTimer);
  }, [playlists, playlistsCloudReady, playlistsUpdatedAt]);

  const submitSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setError('Search query cannot be empty.');
      return;
    }
    if (!apiKey.trim()) {
      setShowApiKeyPanel(true);
      setError('Missing YouTube API key. LuMusic reuses your LuVideo key on this device.');
      return;
    }

    setSearchLoading(true);
    try {
      setSearchResponse(await searchMusic(trimmed, apiKey));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Music search failed.');
    }
  };

  const saveApiKey = () => {
    const trimmed = apiKeyDraft.trim();
    if (!trimmed) return;
    localStorage.setItem(YOUTUBE_API_KEY_STORAGE_KEY, trimmed);
    setApiKey(trimmed);
    setShowApiKeyPanel(false);
    setError('');
  };

  const cycleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  const openMobileLibrary = (tab: 'playlists' | 'queue') => {
    setSideTab(tab);
    setMobileLibraryOpen(true);
  };

  return (
    <div className="relative flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Music size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">LuMusic</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">YouTube music search | queue | playlists</p>
          </div>
        </div>

        <form onSubmit={submitSearch} className="relative min-w-[240px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-9 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] pl-9 pr-24 text-sm outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white"
            placeholder="Search a song, artist, official audio..."
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-1 top-1 flex h-7 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Search
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setApiKeyDraft(apiKey);
            setShowApiKeyPanel((open) => !open);
          }}
          className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
            apiKey
              ? 'border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
              : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
          title="YouTube API key"
        >
          <Key size={14} />
          {apiKey ? 'Key saved' : 'Add key'}
        </button>

        <div className="grid w-full grid-cols-2 gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => openMobileLibrary('queue')}
            className="flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white shadow-sm"
          >
            <ListMusic size={14} />
            Queue
            <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px]">{queue.length}</span>
          </button>
          <button
            type="button"
            onClick={() => openMobileLibrary('playlists')}
            className="flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-3 text-xs font-semibold text-[var(--color-text-secondary)] shadow-sm"
          >
            <Music size={14} />
            Playlists
            <span className="rounded-md bg-[var(--color-surface-subtle)] px-1.5 py-0.5 text-[10px]">{playlists.length}</span>
          </button>
        </div>
      </header>

      {showApiKeyPanel && (
        <section className="border-b border-[var(--color-border-subtle)] bg-white px-4 py-3">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2">
            <div className="min-w-[220px] flex-1">
              <p className="text-xs font-semibold">YouTube API key</p>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)]">
                LuMusic uses the same local key as LuVideo. Other users need their own key, so they do not consume yours.
              </p>
            </div>
            <input
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveApiKey();
                if (event.key === 'Escape') setShowApiKeyPanel(false);
              }}
              className="h-9 min-w-[260px] flex-1 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 text-xs font-mono outline-none focus:border-[var(--color-accent)] focus:bg-white"
              placeholder="Paste the same YouTube API key used by LuVideo..."
            />
            <button
              type="button"
              onClick={saveApiKey}
              disabled={!apiKeyDraft.trim()}
              className="h-9 rounded-xl bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-35"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowApiKeyPanel(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-subtle)]"
              title="Close key panel"
            >
              <X size={14} />
            </button>
          </div>
        </section>
      )}

      {(error || searchNotice) && (
        <div className="border-b border-[var(--color-border-subtle)] px-4 py-2">
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
          {!error && searchNotice && <p className="text-xs text-amber-700">{searchNotice}</p>}
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto bg-[var(--color-surface-muted)] lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
        <section className="min-h-0 px-4 pb-4 pt-4 lg:overflow-y-auto">
          {currentTrack && (
            <div className="mb-4 rounded-2xl border border-[var(--color-border)] bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-[var(--color-surface-muted)]">
                  {currentTrack.thumbnail ? <img src={currentTrack.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-[120px] flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">Now playing</p>
                  <h3 className="truncate text-sm font-semibold">{currentTrack.title}</h3>
                  <p className="truncate text-xs text-[var(--color-text-tertiary)]">{currentTrack.channelTitle}</p>
                </div>
                <div className="order-3 flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto sm:justify-start">
                  <button
                    type="button"
                    onClick={previousTrack}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
                    title="Previous"
                  >
                    <SkipBack size={15} fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    onClick={isPlaying ? pause : play}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-text-primary)] text-white hover:bg-black"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                  </button>
                  <button
                    type="button"
                    onClick={nextTrack}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
                    title="Next"
                  >
                    <SkipForward size={15} fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    onClick={toggleShuffle}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      shuffle ? 'bg-blue-50 text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
                    }`}
                    title="Shuffle"
                  >
                    <Shuffle size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={cycleRepeat}
                    className={`relative flex h-9 w-9 items-center justify-center rounded-xl ${
                      repeatMode !== 'off'
                        ? 'bg-blue-50 text-[var(--color-accent)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
                    }`}
                    title={`Repeat ${repeatMode}`}
                  >
                    <Repeat size={14} />
                    {repeatMode === 'one' && <span className="absolute right-1 top-0 text-[8px] font-bold">1</span>}
                  </button>
                </div>
              </div>
              <div className="mt-3 grid items-center gap-3 md:grid-cols-[1fr_160px]">
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)]">
                  <span className="w-9 text-right">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, duration)}
                    value={Math.min(currentTime, Math.max(1, duration))}
                    onChange={(event) => requestSeek(Number(event.currentTarget.value))}
                    className="h-1 min-w-0 flex-1 accent-[var(--color-accent)]"
                    aria-label="Music progress"
                  />
                  <span className="w-9">{formatTime(duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
                    title={volume > 0 ? 'Mute' : 'Unmute'}
                    aria-label={volume > 0 ? 'Mute music' : 'Unmute music'}
                  >
                    {volume > 0 ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.currentTarget.value))}
                    className="h-1 min-w-0 flex-1 accent-black"
                    aria-label="Music volume"
                  />
                  <span className="w-7 text-[10px] text-[var(--color-text-tertiary)]">{volume}</span>
                </div>
              </div>
            </div>
          )}

          {isSearching ? (
            <div className="flex h-64 items-center justify-center text-center">
              <div>
                <Loader2 className="mx-auto mb-3 animate-spin text-[var(--color-accent)]" size={28} />
                <p className="text-sm font-medium">Finding music-focused results...</p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Ranking official audio, topic channels, lyrics, and music videos.</p>
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            currentTrack ? null : (
              <div className="flex h-full items-center justify-center text-center">
                <div className="max-w-sm">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
                    <Music size={26} />
                  </div>
                  <h3 className="text-base font-semibold">Search for music</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
                    LuMusic uses YouTube Data API results, then ranks them for songs instead of generic videos.
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="mx-auto flex max-w-5xl flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{searchResults.length} music results</p>
                <p className="text-[10px] text-[var(--color-text-tertiary)]">No downloads, no audio extraction, YouTube embed playback only.</p>
              </div>
              {searchResults.map((track) => (
                <MusicResultCard
                  key={track.videoId}
                  track={track}
                  playlists={playlists}
                  isActive={currentTrack?.videoId === track.videoId}
                  onPlay={() => playTrack(track, searchResults)}
                  onAddQueue={() => addToQueue(track)}
                  onAddPlaylist={(playlistId) => addTrackToPlaylist(playlistId, track)}
                  onCreatePlaylist={createPlaylist}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col bg-white lg:border-l lg:border-[var(--color-border-subtle)]">
          <div className="hidden h-10 flex-shrink-0 border-b border-[var(--color-border-subtle)] px-2 py-1.5 lg:flex">
            {(['queue', 'playlists'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSideTab(tab)}
                className={`flex-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  sideTab === tab
                    ? 'bg-[var(--color-text-primary)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="hidden min-h-0 flex-1 flex-col lg:flex">
            {sideTab === 'queue' ? <MusicQueue /> : <MusicPlaylists />}
          </div>
          {currentTrack && (
            <div className="flex-shrink-0 border-t border-[var(--color-border-subtle)] bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  YouTube player
                </p>
                <p className="truncate text-[10px] text-[var(--color-text-tertiary)]">Embed playback</p>
              </div>
              <div className="h-[220px] overflow-hidden rounded-2xl bg-black shadow-sm">
                <YouTubeMusicPlayer />
              </div>
            </div>
          )}
        </aside>
      </main>

      {mobileLibraryOpen && (
        <div className="absolute inset-0 z-40 flex items-end bg-black/35 lg:hidden">
          <button
            type="button"
            aria-label="Close music library"
            className="absolute inset-0 cursor-default"
            onClick={() => setMobileLibraryOpen(false)}
          />
          <section className="relative flex max-h-[85%] min-h-[360px] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl">
            <div className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-[var(--color-border-subtle)] px-3">
              <div className="flex min-w-0 flex-1 rounded-xl bg-[var(--color-surface-subtle)] p-1">
                {(['queue', 'playlists'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSideTab(tab)}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                      sideTab === tab
                        ? 'bg-[var(--color-text-primary)] text-white shadow-sm'
                        : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMobileLibraryOpen(false)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {sideTab === 'queue' ? (
                <MusicQueue onTrackPlay={() => setMobileLibraryOpen(false)} />
              ) : (
                <MusicPlaylists onTrackPlay={() => setMobileLibraryOpen(false)} />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const rounded = Math.floor(value);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
