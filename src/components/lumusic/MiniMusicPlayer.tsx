import { Music2, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { selectCurrentTrack, useMusicStore } from '@/state/musicStore';

interface MiniMusicPlayerProps {
  onClose?: () => void;
}

export default function MiniMusicPlayer({ onClose }: MiniMusicPlayerProps) {
  const currentTrack = useMusicStore(selectCurrentTrack);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const currentTime = useMusicStore((state) => state.currentTime);
  const duration = useMusicStore((state) => state.duration);
  const volume = useMusicStore((state) => state.volume);
  const repeatMode = useMusicStore((state) => state.repeatMode);
  const shuffle = useMusicStore((state) => state.shuffle);
  const playerMessage = useMusicStore((state) => state.playerMessage);
  const play = useMusicStore((state) => state.play);
  const pause = useMusicStore((state) => state.pause);
  const nextTrack = useMusicStore((state) => state.nextTrack);
  const previousTrack = useMusicStore((state) => state.previousTrack);
  const requestSeek = useMusicStore((state) => state.requestSeek);
  const setVolume = useMusicStore((state) => state.setVolume);
  const toggleMute = useMusicStore((state) => state.toggleMute);
  const setRepeatMode = useMusicStore((state) => state.setRepeatMode);
  const toggleShuffle = useMusicStore((state) => state.toggleShuffle);

  const cycleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  return (
    <div className="border-t border-[var(--color-border-subtle)] px-2 py-2">
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-sm">
        {currentTrack ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl bg-[var(--color-surface-muted)]">
              {currentTrack.thumbnail ? <img src={currentTrack.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold">{currentTrack.title}</p>
              <p className="truncate text-[10px] text-[var(--color-text-tertiary)]">{currentTrack.channelTitle}</p>
              {playerMessage && <p className="truncate text-[9px] text-[var(--color-danger)]">{playerMessage}</p>}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
                title="Close LuMusic"
                aria-label="Close LuMusic"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
              <Music2 size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold">LuMusic ready</p>
              <p className="truncate text-[10px] text-[var(--color-text-tertiary)]">Search and play music</p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
                title="Close LuMusic"
                aria-label="Close LuMusic"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={previousTrack}
            disabled={!currentTrack}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-35"
            title="Previous"
          >
            <SkipBack size={13} fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={isPlaying ? pause : play}
            disabled={!currentTrack}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--color-text-primary)] text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-35"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={nextTrack}
            disabled={!currentTrack}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-35"
            title="Next"
          >
            <SkipForward size={13} fill="currentColor" />
          </button>
          <button
            type="button"
            onClick={toggleShuffle}
            disabled={!currentTrack}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
              shuffle ? 'bg-blue-50 text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
            }`}
            title="Shuffle"
          >
            <Shuffle size={12} />
          </button>
          <button
            type="button"
            onClick={cycleRepeat}
            disabled={!currentTrack}
            className={`relative flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
              repeatMode !== 'off'
                ? 'bg-blue-50 text-[var(--color-accent)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
            }`}
            title={`Repeat ${repeatMode}`}
          >
            <Repeat size={12} />
            {repeatMode === 'one' && <span className="absolute right-0.5 top-0 text-[7px] font-bold">1</span>}
          </button>
        </div>

        <div className="mt-2 flex items-center gap-2 text-[9px] text-[var(--color-text-tertiary)]">
          <span className="w-8 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            value={Math.min(currentTime, Math.max(1, duration))}
            onChange={(event) => requestSeek(Number(event.currentTarget.value))}
            disabled={!currentTrack}
            className="h-1 min-w-0 flex-1 accent-[var(--color-accent)] disabled:opacity-35"
            aria-label="Music progress"
          />
          <span className="w-8">{formatTime(duration)}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
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
          <span className="w-7 text-[9px] text-[var(--color-text-tertiary)]">{volume}</span>
        </div>
      </div>
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
