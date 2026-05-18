import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Edit2, ListMusic, Play, Plus, Trash2, X } from 'lucide-react';
import { useMusicStore } from '@/state/musicStore';

export default function MusicPlaylists() {
  const playlists = useMusicStore((state) => state.playlists);
  const createPlaylist = useMusicStore((state) => state.createPlaylist);
  const renamePlaylist = useMusicStore((state) => state.renamePlaylist);
  const deletePlaylist = useMusicStore((state) => state.deletePlaylist);
  const playPlaylist = useMusicStore((state) => state.playPlaylist);
  const removeTrackFromPlaylist = useMusicStore((state) => state.removeTrackFromPlaylist);
  const movePlaylistTrack = useMusicStore((state) => state.movePlaylistTrack);
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedId) ?? playlists[0] ?? null,
    [playlists, selectedId],
  );

  const submitCreate = () => {
    const id = createPlaylist(name);
    if (id) {
      setSelectedId(id);
      setName('');
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 flex-shrink-0 items-center gap-2 px-3">
        <ListMusic size={15} className="text-[var(--color-accent)]" />
        <h3 className="text-xs font-semibold">Playlists</h3>
      </div>

      <div className="flex flex-shrink-0 gap-2 px-3 pb-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitCreate();
          }}
          className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2.5 text-xs outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white"
          placeholder="New playlist..."
        />
        <button
          type="button"
          onClick={submitCreate}
          disabled={!name.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-text-primary)] text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-35"
          title="Create playlist"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[120px_1fr] border-t border-[var(--color-border-subtle)]">
        <div className="min-h-0 overflow-y-auto border-r border-[var(--color-border-subtle)] p-2">
          {playlists.length === 0 ? (
            <p className="px-2 py-4 text-center text-[11px] leading-5 text-[var(--color-text-tertiary)]">No playlists yet</p>
          ) : (
            playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => setSelectedId(playlist.id)}
                className={`mb-1 w-full rounded-lg px-2 py-2 text-left transition-colors ${
                  selectedPlaylist?.id === playlist.id
                    ? 'bg-[var(--color-text-primary)] text-white'
                    : 'hover:bg-[var(--color-surface-subtle)]'
                }`}
              >
                <p className="truncate text-[11px] font-semibold">{playlist.name}</p>
                <p className={`mt-0.5 text-[10px] ${selectedPlaylist?.id === playlist.id ? 'text-white/60' : 'text-[var(--color-text-tertiary)]'}`}>
                  {playlist.tracks.length} songs
                </p>
              </button>
            ))
          )}
        </div>

        <div className="min-h-0 overflow-y-auto p-2">
          {selectedPlaylist ? (
            <>
              <div className="mb-2 flex items-center gap-1">
                {renamingId === selectedPlaylist.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        renamePlaylist(selectedPlaylist.id, renameValue);
                        setRenamingId(null);
                      }
                      if (event.key === 'Escape') setRenamingId(null);
                    }}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--color-border-subtle)] px-2 text-xs outline-none focus:border-[var(--color-accent)]"
                  />
                ) : (
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold">{selectedPlaylist.name}</p>
                )}
                <button
                  type="button"
                  onClick={() => playPlaylist(selectedPlaylist.id)}
                  disabled={selectedPlaylist.tracks.length === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-35"
                  title="Play playlist"
                >
                  <Play size={13} fill="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenamingId(selectedPlaylist.id);
                    setRenameValue(selectedPlaylist.name);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
                  title="Rename playlist"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => deletePlaylist(selectedPlaylist.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-red-50 hover:text-[var(--color-danger)]"
                  title="Delete playlist"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {selectedPlaylist.tracks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-[11px] leading-5 text-[var(--color-text-tertiary)]">
                  Add tracks from search results.
                </div>
              ) : (
                selectedPlaylist.tracks.map((track, index) => (
                  <div key={track.videoId} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-muted)]">
                    <button
                      type="button"
                      onClick={() => playPlaylist(selectedPlaylist.id, index)}
                      className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--color-surface-muted)]"
                    >
                      {track.thumbnail ? <img src={track.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold">{track.title}</p>
                      <p className="truncate text-[10px] text-[var(--color-text-tertiary)]">{track.channelTitle}</p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => movePlaylistTrack(selectedPlaylist.id, index, index - 1)}
                        disabled={index === 0}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-white hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-25"
                        title="Move up"
                        aria-label={`Move ${track.title} up`}
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePlaylistTrack(selectedPlaylist.id, index, index + 1)}
                        disabled={index === selectedPlaylist.tracks.length - 1}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-white hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-25"
                        title="Move down"
                        aria-label={`Move ${track.title} down`}
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTrackFromPlaylist(selectedPlaylist.id, track.videoId)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] opacity-100 hover:bg-red-50 hover:text-[var(--color-danger)] md:opacity-0 md:group-hover:opacity-100"
                      title="Remove from playlist"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))
              )}
            </>
          ) : (
            <p className="px-2 py-4 text-center text-[11px] leading-5 text-[var(--color-text-tertiary)]">Create a playlist to save tracks.</p>
          )}
        </div>
      </div>
    </section>
  );
}
