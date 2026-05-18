import { Pause, Play, PlayCircle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { VideoItem } from '@/modules/luvideo/types';

interface LuVideoMiniState {
  currentVideo: VideoItem | null;
  isPlaying: boolean;
  hasVideo: boolean;
  volume: number;
}

const EMPTY_STATE: LuVideoMiniState = {
  currentVideo: null,
  isPlaying: false,
  hasVideo: false,
  volume: 70,
};

export default function LuVideoMiniPlayer() {
  const [state, setState] = useState<LuVideoMiniState>(EMPTY_STATE);

  useEffect(() => {
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<LuVideoMiniState>).detail;
      if (!detail) return;
      setState({
        currentVideo: detail.currentVideo ?? null,
        isPlaying: Boolean(detail.isPlaying),
        hasVideo: Boolean(detail.hasVideo),
        volume: typeof detail.volume === 'number' && Number.isFinite(detail.volume) ? detail.volume : EMPTY_STATE.volume,
      });
    };

    window.addEventListener('luvideo:state', handleState);
    window.dispatchEvent(new CustomEvent('luvideo:request-state'));
    return () => window.removeEventListener('luvideo:state', handleState);
  }, []);

  const sendControl = (action: 'play' | 'pause' | 'next' | 'previous') => {
    window.dispatchEvent(new CustomEvent('luvideo:control', { detail: { action } }));
  };

  const sendVolume = (volume: number) => {
    window.dispatchEvent(new CustomEvent('luvideo:control', { detail: { action: 'volume', volume } }));
  };

  const toggleMute = () => {
    window.dispatchEvent(new CustomEvent('luvideo:control', { detail: { action: 'toggleMute' } }));
  };

  const video = state.currentVideo;

  return (
    <div className="border-t border-[var(--color-border-subtle)] px-2 py-2">
      <div className="overflow-hidden rounded-2xl border border-[#e8ff47]/25 bg-[#0d0d12] p-2 text-white shadow-sm">
        {video ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-10 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-black">
              {video.thumb ? <img src={video.thumb} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold">{video.title}</p>
              <p className="truncate text-[10px] text-white/45">{video.channel}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8ff47]/10 text-[#e8ff47]">
              <PlayCircle size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold">LuVideo ready</p>
              <p className="truncate text-[10px] text-white/45">Open a video to control it here</p>
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => sendControl('previous')}
            disabled={!state.hasVideo}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            title="Previous video"
          >
            <SkipBack size={13} fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={() => sendControl(state.isPlaying ? 'pause' : 'play')}
            disabled={!state.hasVideo}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e8ff47] text-black transition-colors hover:bg-[#d4eb2e] disabled:cursor-not-allowed disabled:opacity-35"
            title={state.isPlaying ? 'Pause video' : 'Play video'}
          >
            {state.isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={() => sendControl('next')}
            disabled={!state.hasVideo}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            title="Next video"
          >
            <SkipForward size={13} fill="currentColor" />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            title={state.volume > 0 ? 'Mute video' : 'Unmute video'}
            aria-label={state.volume > 0 ? 'Mute video' : 'Unmute video'}
          >
            {state.volume > 0 ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={state.volume}
            onChange={(event) => sendVolume(Number(event.currentTarget.value))}
            className="h-1 min-w-0 flex-1 accent-[#e8ff47]"
            aria-label="LuVideo volume"
          />
          <span className="w-7 text-[9px] text-white/45">{state.volume}</span>
        </div>
      </div>
    </div>
  );
}
