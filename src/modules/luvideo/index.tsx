import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, PlayCircle, SkipBack, SkipForward, Repeat, X, Key, Info, ExternalLink } from 'lucide-react';
import Icon from '@/components/Icon';
import { VideoItem } from './types';
import { searchVideos } from './youtubeApi';

const STORAGE_KEY = 'luvideo_api_key';
const AUTOPLAY_KEY = 'luvideo_autoplay';
const DEFAULT_QUERY = 'trending music';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export default function LuVideoModule() {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '');
  const [autoplay, setAutoplay] = useState<boolean>(() => localStorage.getItem(AUTOPLAY_KEY) !== 'false');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const ytApiLoaded = useRef(false);

  // Initialize YT API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        ytApiLoaded.current = true;
      };
    } else {
      ytApiLoaded.current = true;
    }

    if (apiKey) {
      handleSearch(DEFAULT_QUERY);
    } else {
      setShowApiKeyModal(true);
    }
  }, []);

  const handleSearch = async (query: string) => {
    if (!query.trim() || !apiKey) return;
    setIsSearching(true);
    setError(null);
    try {
      const results = await searchVideos(query, apiKey);
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

  const playVideo = (index: number) => {
    if (index < 0 || index >= videos.length) return;
    setCurrentIndex(index);
  };

  const navigate = (dir: number) => {
    const next = currentIndex + dir;
    if (next >= 0 && next < videos.length) {
      setCurrentIndex(next);
    } else if (dir === 1 && videos.length > 0) {
      setCurrentIndex(0); // Loop
    }
  };

  const onPlayerStateChange = useCallback((event: any) => {
    if (event.data === 0 && autoplay) { // YT.PlayerState.ENDED
      navigate(1);
    }
  }, [autoplay, videos.length, currentIndex]);

  useEffect(() => {
    if (currentIndex === -1 || !videos[currentIndex]) return;

    const videoId = videos[currentIndex].id;
    
    if (ytApiLoaded.current && window.YT && window.YT.Player) {
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
  }, [currentIndex]);

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

  const saveApiKey = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem(STORAGE_KEY, newKey);
    setShowApiKeyModal(false);
    handleSearch(searchQuery || DEFAULT_QUERY);
  };

  const toggleAutoplay = () => {
    const newVal = !autoplay;
    setAutoplay(newVal);
    localStorage.setItem(AUTOPLAY_KEY, String(newVal));
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-[#f0f0f8] overflow-hidden font-sans">
      {/* Header / Search Bar */}
      <header className="flex items-center gap-4 px-6 h-16 border-b border-white/10 bg-[#0a0a0f]/90 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-2 flex-shrink-0">
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
                <p className="text-white/40 text-sm">Search and select a video from the list</p>
              </div>
            ) : (
              <div id="luvideo-player" className="w-full h-full" />
            )}
          </div>

          {/* Now Playing Bar */}
          {currentIndex !== -1 && videos[currentIndex] && (
            <div className="bg-[#111118] border-t border-white/10 p-4 flex items-center gap-4 animate-in slide-in-from-bottom duration-300">
              <div className="flex-1 min-width-0">
                <span className="text-[10px] font-bold text-[#e8ff47] tracking-[0.2em] uppercase block mb-1">Now Playing</span>
                <h3 className="text-sm font-bold truncate leading-tight">{videos[currentIndex].title}</h3>
                <span className="text-xs text-white/40">{videos[currentIndex].channel}</span>
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
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h4 className="text-[10px] font-bold text-white/30 tracking-[0.1em] uppercase">
              {videos.length > 0 ? `Results (${videos.length})` : 'Queue'}
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
                <button
                  key={video.id}
                  onClick={() => playVideo(index)}
                  className={`w-full flex gap-3 p-2 rounded-xl transition-all text-left hover:bg-white/5 group ${
                    currentIndex === index ? 'bg-[#e8ff47]/5 border border-[#e8ff47]/20' : 'border border-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0 w-32 h-[72px] bg-black rounded-lg overflow-hidden">
                    <img src={video.thumb} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                    {video.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-bold px-1.5 py-0.5 rounded text-white">
                        {video.duration}
                      </span>
                    )}
                    {currentIndex === index && (
                      <div className="absolute inset-0 bg-[#e8ff47]/20 flex items-center justify-center text-[#e8ff47]">
                        <PlayCircle size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-width-0">
                    <h5 className={`text-[13px] font-bold leading-tight mb-1 line-clamp-2 ${
                      currentIndex === index ? 'text-[#e8ff47]' : 'text-white'
                    }`}>
                      {video.title}
                    </h5>
                    <p className="text-[11px] text-white/40 truncate">{video.channel}</p>
                    <p className="text-[10px] text-white/20 mt-1">{video.published && new Date(video.published).toLocaleDateString()}</p>
                  </div>
                </button>
              ))
            )}
          </div>
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
