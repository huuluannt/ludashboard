import { useEffect, useRef } from 'react';
import { loadYouTubeIframeApi } from '@/services/youtube/iframeApi';
import { selectCurrentTrack, useMusicStore } from '@/state/musicStore';

export default function YouTubeMusicPlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const pendingAutoplayRef = useRef(false);
  const pendingAutoplayTimerRef = useRef<number | null>(null);
  const currentTrack = useMusicStore(selectCurrentTrack);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const volume = useMusicStore((state) => state.volume);
  const repeatMode = useMusicStore((state) => state.repeatMode);
  const playbackNonce = useMusicStore((state) => state.playbackNonce);
  const seekNonce = useMusicStore((state) => state.seekNonce);
  const seekTo = useMusicStore((state) => state.seekTo);
  const setIsPlaying = useMusicStore((state) => state.setIsPlaying);
  const setProgress = useMusicStore((state) => state.setProgress);
  const setPlayerMessage = useMusicStore((state) => state.setPlayerMessage);
  const nextTrack = useMusicStore((state) => state.nextTrack);
  const restartCurrent = useMusicStore((state) => state.restartCurrent);

  const clearPendingAutoplay = () => {
    pendingAutoplayRef.current = false;
    if (pendingAutoplayTimerRef.current != null) {
      window.clearTimeout(pendingAutoplayTimerRef.current);
      pendingAutoplayTimerRef.current = null;
    }
  };

  const markPendingAutoplay = () => {
    clearPendingAutoplay();
    pendingAutoplayRef.current = true;
    pendingAutoplayTimerRef.current = window.setTimeout(() => {
      pendingAutoplayRef.current = false;
      pendingAutoplayTimerRef.current = null;
    }, 2500);
  };

  useEffect(() => {
    if (!currentTrack || !containerRef.current) return undefined;
    let cancelled = false;

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        if (playerRef.current) return;

        playerRef.current = new YT.Player(containerRef.current, {
          videoId: currentTrack.videoId,
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 1,
            controls: 1,
            enablejsapi: 1,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              const startSeconds = Math.max(0, Math.floor(useMusicStore.getState().currentTime || 0));
              if (isPlaying) {
                markPendingAutoplay();
                event.target.loadVideoById({ videoId: currentTrack.videoId, startSeconds });
              } else {
                event.target.cueVideoById({ videoId: currentTrack.videoId, startSeconds });
              }
              event.target.setVolume(volume);
              if (volume <= 0) event.target.mute?.();
              else event.target.unMute?.();
              if (isPlaying) {
                window.setTimeout(() => {
                  try {
                    event.target.playVideo();
                  } catch {
                    setPlayerMessage('Autoplay was blocked. Press Play to start.');
                  }
                }, 0);
              }
            },
            onStateChange: (event: any) => {
              if (event.data === 0) {
                clearPendingAutoplay();
                if (repeatMode === 'one') restartCurrent();
                else nextTrack();
              }
              if (event.data === 1) {
                clearPendingAutoplay();
                setIsPlaying(true);
              }
              if (event.data === 2) {
                if (pendingAutoplayRef.current) return;
                setIsPlaying(false);
              }
            },
            onError: () => {
              setPlayerMessage('This track is unavailable or cannot be embedded.');
              nextTrack();
            },
          },
        });
      })
      .catch(() => setPlayerMessage('YouTube player failed to load. Check your network connection.'));

    return () => {
      cancelled = true;
    };
  }, [currentTrack, isPlaying, nextTrack, repeatMode, restartCurrent, setIsPlaying, setPlayerMessage, volume]);

  useEffect(() => {
    if (!currentTrack || !playerRef.current) return;
    try {
      const startSeconds = Math.max(0, Math.floor(useMusicStore.getState().currentTime || 0));
      if (isPlaying) {
        markPendingAutoplay();
        playerRef.current.loadVideoById({ videoId: currentTrack.videoId, startSeconds });
        playerRef.current.playVideo();
      } else {
        playerRef.current.cueVideoById({ videoId: currentTrack.videoId, startSeconds });
      }
      playerRef.current.setVolume(volume);
      if (volume <= 0) playerRef.current.mute?.();
      else playerRef.current.unMute?.();
      setPlayerMessage('');
    } catch {
      setPlayerMessage('This track is unavailable or cannot be embedded.');
    }
  }, [currentTrack?.videoId, playbackNonce]);

  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) playerRef.current.playVideo();
      else playerRef.current.pauseVideo();
    } catch {
      setPlayerMessage('Autoplay was blocked. Press Play to start.');
    }
  }, [isPlaying, setPlayerMessage]);

  useEffect(() => {
    if (!playerRef.current) return;
    try {
      playerRef.current.setVolume(volume);
      if (volume <= 0) playerRef.current.mute?.();
      else playerRef.current.unMute?.();
    } catch {
      // Ignore volume updates before the player is ready.
    }
  }, [volume]);

  useEffect(() => {
    if (!playerRef.current) return;
    try {
      playerRef.current.seekTo(seekTo, true);
      if (isPlaying) playerRef.current.playVideo();
    } catch {
      setPlayerMessage('Unable to seek this track.');
    }
  }, [seekNonce, seekTo, isPlaying, setPlayerMessage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!playerRef.current || !currentTrack) return;
      try {
        const currentTime = Number(playerRef.current.getCurrentTime?.() || 0);
        const duration = Number(playerRef.current.getDuration?.() || currentTrack.durationSeconds || 0);
        setProgress(currentTime, duration);
      } catch {
        // The iframe can briefly reject reads while changing videos.
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentTrack, setProgress]);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.destroy?.();
      } catch {
        // Best effort cleanup for the iframe player.
      }
      clearPendingAutoplay();
      playerRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
