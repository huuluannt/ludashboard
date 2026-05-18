import { ArrowDown, ArrowUp, ListMusic, Play, Trash2, X } from 'lucide-react';
import { selectCurrentTrack, useMusicStore } from '@/state/musicStore';

export default function MusicQueue() {
  const queue = useMusicStore((state) => state.queue);
  const currentIndex = useMusicStore((state) => state.currentIndex);
  const currentTrack = useMusicStore(selectCurrentTrack);
  const playTrack = useMusicStore((state) => state.playTrack);
  const removeFromQueue = useMusicStore((state) => state.removeFromQueue);
  const moveQueueTrack = useMusicStore((state) => state.moveQueueTrack);
  const clearQueue = useMusicStore((state) => state.clearQueue);

  return (
    <section className="flex min-h-0 flex-1 flex-col border-t border-[var(--color-border-subtle)]">
      <div className="flex h-10 flex-shrink-0 items-center gap-2 px-3">
        <ListMusic size={15} className="text-[var(--color-accent)]" />
        <h3 className="text-xs font-semibold">Queue</h3>
        <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">{queue.length} tracks</span>
        <button
          type="button"
          onClick={clearQueue}
          disabled={queue.length <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-35"
          title="Clear upcoming queue"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {queue.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] text-center">
            <p className="px-6 text-xs leading-5 text-[var(--color-text-tertiary)]">Add songs to build a listening queue.</p>
          </div>
        ) : (
          queue.map((track, index) => {
            const active = currentTrack?.videoId === track.videoId && currentIndex === index;
            return (
              <div
                key={track.videoId}
                className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                  active ? 'bg-[var(--color-surface-subtle)]' : 'hover:bg-[var(--color-surface-muted)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => playTrack(track, queue)}
                  className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface-muted)]"
                  title="Play from queue"
                >
                  {track.thumbnail ? <img src={track.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <Play size={13} fill="currentColor" />
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[11px] font-semibold ${active ? 'text-[var(--color-accent)]' : ''}`}>{track.title}</p>
                  <p className="truncate text-[10px] text-[var(--color-text-tertiary)]">{track.channelTitle}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveQueueTrack(index, index - 1)}
                    disabled={index === 0}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-white hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-25"
                    title="Move up"
                    aria-label={`Move ${track.title} up`}
                  >
                    <ArrowUp size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQueueTrack(index, index + 1)}
                    disabled={index === queue.length - 1}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-white hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-25"
                    title="Move down"
                    aria-label={`Move ${track.title} down`}
                  >
                    <ArrowDown size={11} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromQueue(track.videoId)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] opacity-100 transition-colors hover:bg-red-50 hover:text-[var(--color-danger)] md:opacity-0 md:group-hover:opacity-100"
                  title="Remove from queue"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
