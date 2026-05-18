import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, PlayCircle, SkipBack, SkipForward, Repeat, X, Key, Info, 
  ExternalLink, List, Plus, Trash2, Edit2, Check, FolderPlus, ArrowUp, ArrowDown
} from 'lucide-react';
import Icon from '@/components/Icon';
import { saveModuleCloudData, subscribeModuleCloudData } from '@/firebase/moduleCloudSync';
import { VideoItem, Playlist, SavedVideo } from './types';
import { searchVideos } from './youtubeApi';

const STORAGE_KEY = 'luvideo_api_key';
const AUTOPLAY_KEY = 'luvideo_autoplay';
const PLAYLISTS_KEY = 'luvideo_playlists';
const PLAYLISTS_UPDATED_AT_KEY = 'luvideo_playlists_updated_at';
const ACTIVE_PLAYLIST_KEY = 'luvideo_active_playlist';
const DEFAULT_QUERY = 'trending music';

interface LuVideoPlaylistsCloudValue {
  playlists: Playlist[];
  activePlaylistId?: string | null;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export default function LuVideoModule() {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '');
  const [autoplay, setAutoplay] = useState<boolean>(() => localStorage.getItem(AUTOPLAY_KEY) !== 'false');
  const [playlists, setPlaylists] = useState<Playlist[]>(loadStoredPlaylists);
  const [playlistsUpdatedAt, setPlaylistsUpdatedAt] = useState<number>(loadStoredPlaylistsUpdatedAt);
  const [playlistsCloudReady, setPlaylistsCloudReady] = useState(false);

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ytReady, setYtReady] = useState(Boolean(window.YT?.Player));
  const [isPlaying, setIsPlaying] = useState(false);

  // Playlist Mode States
  const [viewMode, setViewMode] = useState<'search' | 'playlists'>(() =>
    loadStoredActivePlaylistId() ? 'playlists' : 'search',
  );
  const [playbackSource, setPlaybackSource] = useState<'search' | 'playlists'>('search');
  const [activePlaylistId, setActivePlaylistIdState] = useState<string | null>(loadStoredActivePlaylistId);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showAddMenu, setShowAddMenu] = useState<string | null>(null); // videoId

  const playerRef = useRef<any>(null);
  const ytApiLoaded = useRef(false);
  const playlistsUpdatedAtRef = useRef(playlistsUpdatedAt);
  const activePlaylistIdRef = useRef(activePlaylistId);
  const initialPlaylistStartedRef = useRef(false);
  const applyingRemotePlaylistsRef = useRef(false);

  // Persistence
  useEffect(() => {
    playlistsUpdatedAtRef.current = playlistsUpdatedAt;
  }, [playlistsUpdatedAt]);

  useEffect(() => {
    activePlaylistIdRef.current = activePlaylistId;
    if (activePlaylistId) {
      localStorage.setItem(ACTIVE_PLAYLIST_KEY, activePlaylistId);
    } else {
      localStorage.removeItem(ACTIVE_PLAYLIST_KEY);
    }
  }, [activePlaylistId]);

  const selectPlaylist = useCallback((playlistId: string | null, sync = true) => {
    activePlaylistIdRef.current = playlistId;
    setActivePlaylistIdState(playlistId);
    if (!sync) return;

    const updatedAt = Date.now();
    playlistsUpdatedAtRef.current = updatedAt;
    setPlaylistsUpdatedAt(updatedAt);
  }, []);

  useEffect(() => {
    return subscribeModuleCloudData<LuVideoPlaylistsCloudValue>('luvideo', 'playlists', {
      onData: (remote) => {
        if (remote.updatedAt <= playlistsUpdatedAtRef.current) return;

        const remotePlaylists = Array.isArray(remote.value.playlists) ? remote.value.playlists : [];
        const hasRemoteActivePlaylist = Object.prototype.hasOwnProperty.call(remote.value, 'activePlaylistId');
        let nextActivePlaylistId = hasRemoteActivePlaylist
          ? remote.value.activePlaylistId ?? null
          : activePlaylistIdRef.current;

        if (nextActivePlaylistId && !remotePlaylists.some((playlist) => playlist.id === nextActivePlaylistId)) {
          nextActivePlaylistId = null;
        }

        applyingRemotePlaylistsRef.current = true;
        playlistsUpdatedAtRef.current = remote.updatedAt;
        activePlaylistIdRef.current = nextActivePlaylistId;
        setPlaylists(remotePlaylists);
        setPlaylistsUpdatedAt(remote.updatedAt);
        setActivePlaylistIdState(nextActivePlaylistId);
        localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(remotePlaylists));
        localStorage.setItem(PLAYLISTS_UPDATED_AT_KEY, String(remote.updatedAt));
        if (nextActivePlaylistId) {
          localStorage.setItem(ACTIVE_PLAYLIST_KEY, nextActivePlaylistId);
        } else {
          localStorage.removeItem(ACTIVE_PLAYLIST_KEY);
        }

        window.setTimeout(() => {
          applyingRemotePlaylistsRef.current = false;
        }, 0);
      },
      onReady: () => setPlaylistsCloudReady(true),
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
    localStorage.setItem(PLAYLISTS_UPDATED_AT_KEY, String(playlistsUpdatedAt));
    if (!playlistsCloudReady || applyingRemotePlaylistsRef.current || playlistsUpdatedAt <= 0) return;

    const syncTimer = window.setTimeout(() => {
      saveModuleCloudData<LuVideoPlaylistsCloudValue>('luvideo', 'playlists', {
        value: { playlists, activePlaylistId },
        updatedAt: playlistsUpdatedAt,
      }).catch((error) => {
        console.error('Failed to sync LuVideo playlists', error);
      });
    }, 600);

    return () => window.clearTimeout(syncTimer);
  }, [playlists, activePlaylistId, playlistsUpdatedAt, playlistsCloudReady]);

  // Initialize YT API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        ytApiLoaded.current = true;
        setYtReady(true);
      };
    } else {
      ytApiLoaded.current = true;
      setYtReady(true);
    }
  }, []);

  useEffect(() => {
    if (initialPlaylistStartedRef.current || currentIndex !== -1 || !activePlaylistId) return;

    const playlist = playlists.find((item) => item.id === activePlaylistId);
    if (!playlist?.videos.length) return;

    initialPlaylistStartedRef.current = true;
    setViewMode('playlists');
    setPlaybackSource('playlists');
    setCurrentIndex(0);
  }, [activePlaylistId, currentIndex, playlists]);

  const handleSearch = async (query: string, key = apiKey) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    if (!key) {
      setShowApiKeyModal(true);
      setError(null);
      return;
    }

    initialPlaylistStartedRef.current = true;
    setIsSearching(true);
    setError(null);
    setViewMode('search');
    setPlaybackSource('search');
    try {
      const results = await searchVideos(trimmedQuery, key);
      setVideos(results);
      if (results.length > 0 && autoplay) {
        setCurrentIndex(0);
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
      if (err.message?.includes('API key')) {
        setShowApiKeyModal(true);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const activeVideos = playbackSource === 'search' 
    ? videos 
    : playlists.find(p => p.id === activePlaylistId)?.videos || [];

  const playVideo = (index: number, source: 'search' | 'playlists' = viewMode) => {
    const targetVideos = source === 'search' ? videos : playlists.find(p => p.id === activePlaylistId)?.videos || [];
    if (index < 0 || index >= targetVideos.length) return;
    
    initialPlaylistStartedRef.current = true;
    setPlaybackSource(source);
    setCurrentIndex(index);
  };

  const navigate = useCallback((dir: number) => {
    const next = currentIndex + dir;
    if (next >= 0 && next < activeVideos.length) {
      setCurrentIndex(next);
    } else if (dir === 1 && activeVideos.length > 0) {
      setCurrentIndex(0); // Loop
    }
  }, [activeVideos, currentIndex]);

  const onPlayerStateChange = useCallback((event: any) => {
    if (event.data === 0) {
      setIsPlaying(false);
    }
    if (event.data === 0 && autoplay) { // YT.PlayerState.ENDED
      navigate(1);
    }
    if (event.data === 1) {
      setIsPlaying(true);
    }
    if (event.data === 2) {
      setIsPlaying(false);
    }
  }, [autoplay, navigate]);

  const currentVideo = currentIndex >= 0 ? activeVideos[currentIndex] ?? null : null;

  useEffect(() => {
    const emitState = () => {
      window.dispatchEvent(
        new CustomEvent('luvideo:state', {
          detail: {
            currentVideo,
            isPlaying,
            hasVideo: Boolean(currentVideo),
          },
        }),
      );
    };

    emitState();
    window.addEventListener('luvideo:request-state', emitState);
    return () => window.removeEventListener('luvideo:request-state', emitState);
  }, [currentVideo, isPlaying]);

  useEffect(() => {
    const handleControl = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (!action) return;

      if (action === 'play') {
        if (currentIndex === -1 && activeVideos.length > 0) {
          setCurrentIndex(0);
          setIsPlaying(true);
          return;
        }
        playerRef.current?.playVideo?.();
        setIsPlaying(true);
        return;
      }

      if (action === 'pause') {
        playerRef.current?.pauseVideo?.();
        setIsPlaying(false);
        return;
      }

      if (action === 'next') {
        navigate(1);
        return;
      }

      if (action === 'previous') {
        navigate(-1);
      }
    };

    window.addEventListener('luvideo:control', handleControl);
    return () => window.removeEventListener('luvideo:control', handleControl);
  }, [activeVideos.length, currentIndex, navigate]);

  useEffect(() => {
    if (currentIndex === -1 || !activeVideos[currentIndex]) return;

    const videoId = activeVideos[currentIndex].id;
    
    if (ytReady && ytApiLoaded.current && window.YT && window.YT.Player) {
      if (playerRef.current) {
        try {
          playerRef.current.loadVideoById(videoId);
        } catch (e) {
          createPlayer(videoId);
        }
      } else {
        createPlayer(videoId);
      }
    }
  }, [currentIndex, playbackSource, activePlaylistId, ytReady]);

  const createPlayer = (videoId: string) => {
    playerRef.current = new window.YT.Player('luvideo-player', {
      videoId,
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        enablejsapi: 1,
      },
      events: {
        onStateChange: onPlayerStateChange,
        onError: (e: any) => {
          console.error('YT Player Error:', e.data);
          if ([101, 150, 5].includes(e.data) && autoplay) {
            setTimeout(() => navigate(1), 2000);
          }
        }
      },
    });
  };

  const updatePlaylists = useCallback((updater: Playlist[] | ((current: Playlist[]) => Playlist[])) => {
    const updatedAt = Date.now();
    playlistsUpdatedAtRef.current = updatedAt;
    setPlaylists((current) => (typeof updater === 'function' ? updater(current) : updater));
    setPlaylistsUpdatedAt(updatedAt);
  }, []);

  // Playlist Management
  const createPlaylist = (name: string) => {
    if (!name.trim()) return;
    const newPlaylist: Playlist = {
      id: crypto.randomUUID(),
      name: name.trim(),
      videos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updatePlaylists((current) => [...current, newPlaylist]);
    selectPlaylist(newPlaylist.id);
    setNewPlaylistName('');
    setIsCreatingPlaylist(false);
    return newPlaylist.id;
  };

  const deletePlaylist = (id: string) => {
    updatePlaylists((current) => current.filter(p => p.id !== id));
    if (activePlaylistId === id) {
      selectPlaylist(null);
      if (playbackSource === 'playlists') {
        setPlaybackSource('search');
        setCurrentIndex(-1);
      }
    }
  };

  const addVideoToPlaylist = (playlistId: string, video: VideoItem) => {
    updatePlaylists((current) => current.map(p => {
      if (p.id === playlistId) {
        if (p.videos.find(v => v.id === video.id)) return p;
        const saved: SavedVideo = { ...video, savedAt: new Date().toISOString() };
        return { ...p, videos: [...p.videos, saved], updatedAt: new Date().toISOString() };
      }
      return p;
    }));
    setShowAddMenu(null);
  };

  const removeVideoFromPlaylist = (playlistId: string, videoId: string) => {
    updatePlaylists((current) => current.map(p => {
      if (p.id === playlistId) {
        return { ...p, videos: p.videos.filter(v => v.id !== videoId), updatedAt: new Date().toISOString() };
      }
      return p;
    }));
  };

  const saveApiKey = (newKey: string) => {
    const trimmedKey = newKey.trim();
    if (!trimmedKey) return;

    setApiKey(trimmedKey);
    localStorage.setItem(STORAGE_KEY, trimmedKey);
    setShowApiKeyModal(false);
    handleSearch(searchQuery || DEFAULT_QUERY, trimmedKey);
  };

  const toggleAutoplay = () => {
    const newVal = !autoplay;
    setAutoplay(newVal);
    localStorage.setItem(AUTOPLAY_KEY, String(newVal));
  };

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  const movePlaylistVideo = (playlistId: string, fromIndex: number, toIndex: number) => {
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist || toIndex < 0 || toIndex >= playlist.videos.length || fromIndex === toIndex) return;

    const currentPlayingVideoId =
      playbackSource === 'playlists' && playlistId === activePlaylistId ? activeVideos[currentIndex]?.id : null;
    const nextVideos = [...playlist.videos];
    const [movedVideo] = nextVideos.splice(fromIndex, 1);
    if (!movedVideo) return;

    nextVideos.splice(toIndex, 0, movedVideo);
    updatePlaylists((current) =>
      current.map((item) =>
        item.id === playlistId
          ? { ...item, videos: nextVideos, updatedAt: new Date().toISOString() }
          : item,
      ),
    );

    if (currentPlayingVideoId) {
      const nextPlayingIndex = nextVideos.findIndex((video) => video.id === currentPlayingVideoId);
      if (nextPlayingIndex >= 0) setCurrentIndex(nextPlayingIndex);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-[#f0f0f8] overflow-hidden font-sans">
      {/* Header / Search Bar */}
      <header className="flex items-center gap-4 px-6 h-16 border-b border-white/10 bg-[#0a0a0f]/90 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-2 flex-shrink-0 cursor-pointer" onClick={() => setViewMode('search')}>
          <div className="w-8 h-8 bg-[#e8ff47] text-black flex items-center justify-center rounded-lg font-black text-xs">▶</div>
          <span className="font-bold text-xl tracking-tight hidden sm:inline">Lu<em className="text-[#e8ff47] not-italic">Video</em></span>
        </div>

        <div className="flex-1 max-w-xl relative">
          <input
            type="text"
            placeholder="Search YouTube..."
            className="w-full bg-[#18181f] border border-white/10 rounded-full px-5 py-2 text-sm focus:outline-none focus:border-[#e8ff47] transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
          />
          <button
            onClick={() => handleSearch(searchQuery)}
            className="absolute right-1 top-1 bottom-1 px-4 bg-[#e8ff47] text-black rounded-full hover:bg-[#d4eb2e] transition-colors"
          >
            <Search size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'playlists' ? 'search' : 'playlists')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${
              viewMode === 'playlists' ? 'border-[#e8ff47] text-[#e8ff47] bg-[#e8ff47]/10' : 'border-white/10 text-white/50'
            }`}
          >
            <List size={14} />
            <span className="hidden sm:inline">Playlists</span>
          </button>
          
          <button
            onClick={toggleAutoplay}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${
              autoplay ? 'border-[#e8ff47] text-[#e8ff47] bg-[#e8ff47]/10' : 'border-white/10 text-white/50'
            }`}
          >
            <Repeat size={14} />
            <span className="hidden sm:inline">Autoplay</span>
            <span className={`font-bold ${autoplay ? 'text-[#e8ff47]' : 'text-white/30'}`}>{autoplay ? 'ON' : 'OFF'}</span>
          </button>
          
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="p-2 text-white/50 hover:text-white transition-colors"
            title="Settings"
          >
            <Key size={18} />
          </button>
        </div>
      </header>

      {/* API Key Banner if missing */}
      {!apiKey && !showApiKeyModal && (
        <div className="bg-[#e8ff47]/10 border-b border-[#e8ff47]/20 px-6 py-2 flex items-center gap-3 text-sm text-white/70">
          <Info size={16} className="text-[#e8ff47]" />
          <span>Add a <strong>YouTube API Key</strong> to start searching.</span>
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="ml-auto bg-[#e8ff47] text-black px-3 py-1 rounded-full text-xs font-bold hover:bg-[#d4eb2e]"
          >
            Setup API Key
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Player Section */}
        <section className="flex-1 flex flex-col bg-black border-r border-white/5 overflow-hidden">
          <div className="flex-1 relative bg-black flex items-center justify-center">
            {currentIndex === -1 ? (
              <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="w-20 h-20 bg-[#e8ff47]/10 border-2 border-[#e8ff47]/20 rounded-full flex items-center justify-center mx-auto mb-6 text-[#e8ff47]">
                  <PlayCircle size={40} />
                </div>
                <h2 className="text-xl font-bold mb-2">Ready to watch?</h2>
                <p className="text-white/40 text-sm">Search or select a playlist video</p>
              </div>
            ) : (
              <div id="luvideo-player" className="w-full h-full" />
            )}
          </div>

          {/* Now Playing Bar */}
          {currentIndex !== -1 && activeVideos[currentIndex] && (
            <div className="bg-[#111118] border-t border-white/10 p-4 flex items-center gap-4 animate-in slide-in-from-bottom duration-300">
              <div className="flex-1 min-width-0">
                <span className="text-[10px] font-bold text-[#e8ff47] tracking-[0.2em] uppercase block mb-1">
                  Now Playing {playbackSource === 'playlists' && `• ${playlists.find(p => p.id === activePlaylistId)?.name}`}
                </span>
                <h3 className="text-sm font-bold truncate leading-tight">{activeVideos[currentIndex].title}</h3>
                <span className="text-xs text-white/40">{activeVideos[currentIndex].channel}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="p-2.5 rounded-full bg-white/5 hover:bg-[#e8ff47] hover:text-black transition-all"
                  title="Previous"
                >
                  <SkipBack size={18} fill="currentColor" />
                </button>
                <button
                  onClick={() => navigate(1)}
                  className="p-2.5 rounded-full bg-white/5 hover:bg-[#e8ff47] hover:text-black transition-all"
                  title="Next"
                >
                  <SkipForward size={18} fill="currentColor" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Sidebar / Video List */}
        <aside className="w-full md:w-[380px] flex flex-col bg-[#111118] overflow-hidden">
          {viewMode === 'search' ? (
            <>
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-white/30 tracking-[0.1em] uppercase">
                  {videos.length > 0 ? `Results (${videos.length})` : 'Search Queue'}
                </h4>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {isSearching ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-3 p-2 animate-pulse">
                      <div className="w-32 h-[72px] bg-white/5 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 bg-white/5 rounded w-full" />
                        <div className="h-3 bg-white/5 rounded w-2/3" />
                        <div className="h-2 bg-white/5 rounded w-1/2 mt-2" />
                      </div>
                    </div>
                  ))
                ) : videos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 opacity-30">
                    <Icon name="play-circle" size={40} className="mb-4" />
                    <p className="text-sm">No videos found</p>
                  </div>
                ) : (
                  videos.map((video, index) => (
                    <div key={video.id} className="relative group">
                      <button
                        onClick={() => playVideo(index, 'search')}
                        className={`w-full flex gap-3 p-2 rounded-xl transition-all text-left hover:bg-white/5 ${
                          playbackSource === 'search' && currentIndex === index ? 'bg-[#e8ff47]/5 border border-[#e8ff47]/20' : 'border border-transparent'
                        }`}
                      >
                        <div className="relative flex-shrink-0 w-32 h-[72px] bg-black rounded-lg overflow-hidden">
                          <img src={video.thumb} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                          {video.duration && (
                            <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-bold px-1.5 py-0.5 rounded text-white">
                              {video.duration}
                            </span>
                          )}
                          {playbackSource === 'search' && currentIndex === index && (
                            <div className="absolute inset-0 bg-[#e8ff47]/20 flex items-center justify-center text-[#e8ff47]">
                              <PlayCircle size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-width-0">
                          <h5 className={`text-[13px] font-bold leading-tight mb-1 line-clamp-2 ${
                            playbackSource === 'search' && currentIndex === index ? 'text-[#e8ff47]' : 'text-white'
                          }`}>
                            {video.title}
                          </h5>
                          <p className="text-[11px] text-white/40 truncate">{video.channel}</p>
                          <p className="text-[10px] text-white/20 mt-1">{video.published && new Date(video.published).toLocaleDateString()}</p>
                        </div>
                      </button>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAddMenu(showAddMenu === video.id ? null : video.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full opacity-100 transition-opacity hover:bg-[#e8ff47] hover:text-black md:opacity-0 md:group-hover:opacity-100"
                        title="Add to playlist"
                      >
                        <Plus size={14} />
                      </button>

                      {showAddMenu === video.id && (
                        <div className="absolute top-10 right-2 w-48 bg-[#18181f] border border-white/10 rounded-xl shadow-2xl z-20 py-2 animate-in zoom-in-95 duration-200">
                          <div className="px-3 py-1 mb-1 text-[10px] font-bold text-white/30 uppercase tracking-wider">Add to Playlist</div>
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {playlists.map(p => (
                              <button
                                key={p.id}
                                onClick={() => addVideoToPlaylist(p.id, video)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-[#e8ff47]/10 hover:text-[#e8ff47] transition-colors flex items-center justify-between"
                              >
                                <span className="truncate">{p.name}</span>
                                {p.videos.some(v => v.id === video.id) && <Check size={12} />}
                              </button>
                            ))}
                          </div>
                          <div className="border-t border-white/5 mt-1 pt-1">
                            <button
                              onClick={() => {
                                const name = prompt('New playlist name:');
                                if (name) {
                                  const id = createPlaylist(name);
                                  if (id) addVideoToPlaylist(id, video);
                                }
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-[#e8ff47] hover:bg-[#e8ff47]/10 transition-colors flex items-center gap-2"
                            >
                              <FolderPlus size={14} />
                              <span>Create New</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => selectPlaylist(null)}
                    className={`text-[10px] font-bold tracking-[0.1em] uppercase ${!activePlaylistId ? 'text-[#e8ff47]' : 'text-white/30 hover:text-white'}`}
                  >
                    All Playlists
                  </button>
                  {activePlaylistId && (
                    <>
                      <span className="text-white/10">/</span>
                      <span className="text-[10px] font-bold text-[#e8ff47] tracking-[0.1em] uppercase truncate max-w-[150px]">
                        {activePlaylist?.name}
                      </span>
                    </>
                  )}
                </div>
                <button 
                  onClick={() => setIsCreatingPlaylist(true)}
                  className="p-1.5 bg-[#e8ff47] text-black rounded-lg hover:bg-[#d4eb2e] transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {isCreatingPlaylist && (
                  <div className="p-3 bg-white/5 rounded-xl mb-2 animate-in slide-in-from-top duration-200">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Playlist name..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-[#e8ff47]"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') createPlaylist(newPlaylistName);
                        if (e.key === 'Escape') setIsCreatingPlaylist(false);
                      }}
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => createPlaylist(newPlaylistName)}
                        className="flex-1 bg-[#e8ff47] text-black py-1.5 rounded-lg text-xs font-bold"
                      >
                        Create
                      </button>
                      <button 
                        onClick={() => setIsCreatingPlaylist(false)}
                        className="px-3 py-1.5 bg-white/5 rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!activePlaylistId ? (
                  playlists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-20 opacity-30">
                      <List size={40} className="mb-4" />
                      <p className="text-sm">No playlists yet</p>
                      <button 
                        onClick={() => setIsCreatingPlaylist(true)}
                        className="text-xs text-[#e8ff47] mt-2 underline"
                      >
                        Create your first
                      </button>
                    </div>
                  ) : (
                    playlists.map(p => (
                      <div key={p.id} className="relative group">
                        <button
                          onClick={() => selectPlaylist(p.id)}
                          className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-all text-left bg-white/2"
                        >
                          <div className="w-12 h-12 bg-[#e8ff47]/10 rounded-xl flex items-center justify-center text-[#e8ff47]">
                            <List size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="font-bold text-sm truncate">{p.name}</h5>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider">{p.videos.length} Videos</p>
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this playlist?')) deletePlaylist(p.id);
                          }}
                          className="absolute top-4 right-4 p-2 opacity-100 transition-opacity hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
                          title="Delete playlist"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )
                ) : (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 mb-4 px-2 pt-2">
                      <button
                        onClick={() => {
                          if (activePlaylist?.videos.length) playVideo(0, 'playlists');
                        }}
                        className="flex-1 bg-[#e8ff47] text-black py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#d4eb2e]"
                      >
                        <PlayCircle size={16} />
                        Play All
                      </button>
                      <button
                        onClick={() => {
                          const name = prompt('Rename playlist:', activePlaylist?.name);
                          if (name) {
                            updatePlaylists((current) =>
                              current.map(p =>
                                p.id === activePlaylistId ? { ...p, name, updatedAt: new Date().toISOString() } : p,
                              ),
                            );
                          }
                        }}
                        className="p-2 bg-white/5 rounded-xl hover:bg-white/10"
                      >
                        <Edit2 size={16} />
                      </button>
                    </div>
                    
                    {activePlaylist?.videos.length === 0 ? (
                      <div className="py-20 text-center opacity-30">
                        <PlayCircle size={40} className="mx-auto mb-4" />
                        <p className="text-sm">Playlist is empty</p>
                        <button 
                          onClick={() => setViewMode('search')}
                          className="text-xs text-[#e8ff47] mt-2 underline"
                        >
                          Find videos to add
                        </button>
                      </div>
                    ) : (
                      activePlaylist?.videos.map((video, index) => (
                        <div key={video.id} className="relative group flex items-center gap-1">
                          <div className="flex flex-col gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => movePlaylistVideo(activePlaylistId!, index, index - 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-white/50 transition-colors hover:bg-[#e8ff47] hover:text-black disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-white/5 disabled:hover:text-white/50"
                              title="Move up"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={index === activePlaylist.videos.length - 1}
                              onClick={() => movePlaylistVideo(activePlaylistId!, index, index + 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-white/50 transition-colors hover:bg-[#e8ff47] hover:text-black disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-white/5 disabled:hover:text-white/50"
                              title="Move down"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                          <button
                            onClick={() => playVideo(index, 'playlists')}
                            className={`min-w-0 flex-1 flex gap-3 p-2 pr-10 rounded-xl transition-all text-left hover:bg-white/5 ${
                              playbackSource === 'playlists' && currentIndex === index 
                                ? 'bg-[#e8ff47]/5 border border-[#e8ff47]/20' 
                                : 'border border-transparent'
                            }`}
                          >
                            <div className="relative flex-shrink-0 w-24 h-[54px] bg-black rounded-lg overflow-hidden">
                              <img src={video.thumb} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                              {playbackSource === 'playlists' && currentIndex === index && (
                                <div className="absolute inset-0 bg-[#e8ff47]/20 flex items-center justify-center text-[#e8ff47]">
                                  <PlayCircle size={18} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-width-0 py-0.5">
                              <h5 className={`text-[12px] font-bold leading-tight mb-1 line-clamp-2 ${
                                playbackSource === 'playlists' && currentIndex === index ? 'text-[#e8ff47]' : 'text-white'
                              }`}>
                                {video.title}
                              </h5>
                              <p className="text-[10px] text-white/40 truncate">{video.channel}</p>
                            </div>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeVideoFromPlaylist(activePlaylistId!, video.id);
                            }}
                            className="absolute top-2 right-2 p-1.5 opacity-100 transition-opacity hover:text-red-400 md:opacity-0 md:group-hover:opacity-100"
                            title="Remove from playlist"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#111118] border border-white/10 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className="w-12 h-12 bg-[#e8ff47]/10 rounded-xl flex items-center justify-center text-[#e8ff47]">
                <Key size={24} />
              </div>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="p-2 text-white/30 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <h3 className="text-xl font-bold mb-2">YouTube API Key</h3>
            <p className="text-white/40 text-sm mb-6 leading-relaxed">
              To use LuVideo, you need a free API key from Google Cloud. 
              Enable <strong className="text-white">YouTube Data API v3</strong> in your console.
              <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#e8ff47] flex items-center gap-1 mt-1 hover:underline">
                Google Cloud Console <ExternalLink size={12} />
              </a>
            </p>

            <input
              type="text"
              placeholder="Paste your API key here..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm mb-4 focus:outline-none focus:border-[#e8ff47] transition-all font-mono"
              defaultValue={apiKey}
              onKeyDown={(e: any) => e.key === 'Enter' && saveApiKey(e.target.value)}
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const input = document.querySelector('input[placeholder="Paste your API key here..."]') as HTMLInputElement;
                  saveApiKey(input.value);
                }}
                className="flex-1 bg-[#e8ff47] text-black font-bold py-3 rounded-xl hover:bg-[#d4eb2e] transition-all"
              >
                Save & Start
              </button>
            </div>
            
            <p className="text-[10px] text-white/20 text-center mt-6">
              Your API key is stored locally in your browser and never sent to our servers.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-full text-xs font-bold animate-in slide-in-from-bottom-4">
          {error}
        </div>
      )}
    </div>
  );
}

function loadStoredPlaylists() {
  try {
    const saved = localStorage.getItem(PLAYLISTS_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadStoredPlaylistsUpdatedAt() {
  const stored = Number(localStorage.getItem(PLAYLISTS_UPDATED_AT_KEY));
  if (Number.isFinite(stored) && stored > 0) return stored;
  return loadStoredPlaylists().length ? Date.now() : 0;
}

function loadStoredActivePlaylistId() {
  const stored = localStorage.getItem(ACTIVE_PLAYLIST_KEY);
  return stored && stored.trim() ? stored : null;
}
