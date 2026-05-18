import { useState } from 'react';
import { Check, ListPlus, Play, Plus } from 'lucide-react';
import type { MusicTrack } from '@/services/music/types';
import type { MusicPlaylist } from '@/state/musicStore';

interface MusicResultCardProps {
  track: MusicTrack;
  playlists: MusicPlaylist[];
  isActive: boolean;
  onPlay: () => void;
  onAddQueue: () => void;
  onAddPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => string | null;
}

export default function MusicResultCard({
  track,
  playlists,
  isActive,
  onPlay,
  onAddQueue,
  onAddPlaylist,
  onCreatePlaylist,
}: MusicResultCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article
      className={`relative grid gap-3 rounded-xl border bg-white p-2.5 shadow-sm transition-colors sm:grid-cols-[120px_1fr_auto] ${
        isActive
          ? 'border-[var(--color-accent)]'
          : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border)]'
      }`}
    >
      <button
        type="button"
        onClick={onPlay}
        className="group relative aspect-video overflow-hidden rounded-lg bg-[var(--color-surface-muted)] text-left"
        title="Play track"
      >
        {track.thumbnail ? (
          <img src={track.thumbnail} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Play size={22} fill="currentColor" />
        </span>
        {track.duration && (
          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {track.duration}
          </span>
        )}
      </button>

      <div className="min-w-0 py-0.5">
        <button type="button" onClick={onPlay} className="block w-full text-left">
          <h3 className={`line-clamp-2 text-sm font-semibold leading-5 ${isActive ? 'text-[var(--color-accent)]' : ''}`}>
            {track.title}
          </h3>
        </button>
        <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{track.channelTitle}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-[var(--color-text-tertiary)]">
          {track.reason && (
            <span className="rounded-md bg-[var(--color-surface-subtle)] px-1.5 py-0.5">{track.reason}</span>
          )}
          {typeof track.score === 'number' && (
            <span className="rounded-md bg-[var(--color-surface-subtle)] px-1.5 py-0.5">score {track.score}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:flex-col sm:justify-center">
        <button
          type="button"
          onClick={onPlay}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-text-primary)] text-white transition-colors hover:bg-black"
          title="Play now"
        >
          <Play size={14} fill="currentColor" />
        </button>
        <button
          type="button"
          onClick={onAddQueue}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          title="Add to queue"
        >
          <ListPlus size={14} />
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          title="Add to playlist"
        >
          <Plus size={14} />
        </button>
      </div>

      {menuOpen && (
        <>
          <button className="fixed inset-0 z-20 cursor-default" type="button" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-2 top-12 z-30 w-56 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-xl">
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-[var(--color-text-tertiary)]">Add to playlist</div>
            {playlists.length === 0 ? (
              <button
                type="button"
                onClick={() => {
                  const id = onCreatePlaylist('My Music');
                  if (id) onAddPlaylist(id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--color-accent)] hover:bg-[var(--color-surface-subtle)]"
              >
                <Plus size={13} />
                Create "My Music"
              </button>
            ) : (
              playlists.map((playlist) => {
                const exists = playlist.tracks.some((item) => item.videoId === track.videoId);
                return (
                  <button
                    key={playlist.id}
                    type="button"
                    onClick={() => {
                      onAddPlaylist(playlist.id);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--color-surface-subtle)]"
                  >
                    <span className="truncate">{playlist.name}</span>
                    {exists && <Check size={13} className="text-[var(--color-accent)]" />}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </article>
  );
}
