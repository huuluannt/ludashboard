import { useState, useEffect, useCallback, useRef } from 'react';
import { saveModuleCloudData, subscribeModuleCloudData } from '@/firebase/moduleCloudSync';
import {
  createBlankNote,
  emitNotesChanged,
  loadNotesSnapshot,
  NOTE_COLORS,
  NOTES_CHANGED_EVENT,
  NotesCloudValue,
  NotesSnapshot,
  normalizeNotes,
  Note,
  saveNotesSnapshot,
} from './noteStorage';

export default function NotesModule() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notesUpdatedAt, setNotesUpdatedAt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const activeIdRef = useRef(activeId);
  const notesUpdatedAtRef = useRef(0);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Load from IndexedDB
  useEffect(() => {
    loadNotesSnapshot().then((snapshot) => {
      notesUpdatedAtRef.current = snapshot.updatedAt;
      setNotes(snapshot.notes);
      setNotesUpdatedAt(snapshot.updatedAt);
      setLoaded(true);
    });
  }, [notesUpdatedAtRef]);

  useEffect(() => {
    if (!loaded) return undefined;

    return subscribeModuleCloudData<NotesCloudValue>('notes', 'notes', {
      onData: (remote) => {
        if (remote.updatedAt <= notesUpdatedAtRef.current) return;

        const remoteNotes = normalizeNotes(remote.value.notes);
        applyingRemoteRef.current = true;
        notesUpdatedAtRef.current = remote.updatedAt;
        setNotes(remoteNotes);
        setNotesUpdatedAt(remote.updatedAt);
        saveNotesSnapshot(remoteNotes, remote.updatedAt);
        if (activeIdRef.current && !remoteNotes.some((note) => note.id === activeIdRef.current)) {
          setActiveId(null);
        }

        window.setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      },
      onReady: () => setCloudReady(true),
    });
  }, [loaded]);

  useEffect(() => {
    const handleExternalNotesChange = (event: Event) => {
      const snapshot = (event as CustomEvent<NotesSnapshot>).detail;
      if (!snapshot || snapshot.updatedAt <= notesUpdatedAtRef.current) return;

      notesUpdatedAtRef.current = snapshot.updatedAt;
      setNotes(normalizeNotes(snapshot.notes));
      setNotesUpdatedAt(snapshot.updatedAt);
    };

    window.addEventListener(NOTES_CHANGED_EVENT, handleExternalNotesChange);
    return () => window.removeEventListener(NOTES_CHANGED_EVENT, handleExternalNotesChange);
  }, [notesUpdatedAtRef]);

  // Persist on change
  useEffect(() => {
    if (!loaded) return;
    saveNotesSnapshot(notes, notesUpdatedAt);
    if (!cloudReady || applyingRemoteRef.current || notesUpdatedAt <= 0) return;

    const syncTimer = window.setTimeout(() => {
      saveModuleCloudData<NotesCloudValue>('notes', 'notes', {
        value: { notes },
        updatedAt: notesUpdatedAt,
      }).catch((error) => {
        console.error('Failed to sync Notes', error);
      });
    }, 600);

    return () => window.clearTimeout(syncTimer);
  }, [notes, notesUpdatedAt, loaded, cloudReady, applyingRemoteRef]);

  const activeNote = notes.find((n) => n.id === activeId) ?? null;

  const commitNotes = useCallback(
    (updater: Note[] | ((current: Note[]) => Note[])) => {
      const updatedAt = Date.now();
      notesUpdatedAtRef.current = updatedAt;
      setNotes((current) => {
        const next = typeof updater === 'function' ? updater(current) : updater;
        emitNotesChanged({ notes: next, updatedAt });
        return next;
      });
      setNotesUpdatedAt(updatedAt);
    },
    [notesUpdatedAtRef],
  );

  const createNote = useCallback(() => {
    const note = createBlankNote();
    commitNotes((prev) => [note, ...prev]);
    setActiveId(note.id);
  }, [commitNotes]);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    commitNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n)),
    );
  }, [commitNotes]);

  const deleteNote = useCallback(
    (id: string) => {
      commitNotes((prev) => prev.filter((n) => n.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId, commitNotes],
  );

  return (
    <div className="flex h-full">
      {/* Note list sidebar */}
      <div className="w-64 border-r border-[var(--color-border-subtle)] flex flex-col bg-[var(--color-surface-subtle)]">
        <div className="p-3 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Notes</span>
          <button
            onClick={createNote}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] transition-colors cursor-pointer"
            title="New note"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs text-[var(--color-text-tertiary)]">No notes yet</p>
              <button
                onClick={createNote}
                className="mt-2 text-xs text-[var(--color-accent)] hover:underline cursor-pointer"
              >
                Create your first note
              </button>
            </div>
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                onClick={() => setActiveId(note.id)}
                className={`
                  w-full text-left px-4 py-3 border-b border-[var(--color-border-subtle)]
                  transition-colors cursor-pointer
                  ${activeId === note.id ? 'bg-white' : 'hover:bg-white/60'}
                `}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: note.color === '#ffffff' ? 'var(--color-border)' : note.color }}
                  />
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {note.title || 'Untitled'}
                  </p>
                </div>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1 truncate pl-4">
                  {note.content || 'Empty note'}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Note editor */}
      <div className="flex-1 flex flex-col">
        {activeNote ? (
          <>
            {/* Editor toolbar */}
            <div className="px-6 py-3 border-b border-[var(--color-border-subtle)] flex items-center gap-3">
              <div className="flex gap-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateNote(activeNote.id, { color: c })}
                    className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                      activeNote.color === c ? 'border-[var(--color-accent)] scale-110' : 'border-[var(--color-border)]'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex-1" />
              <span className="text-[10px] text-[var(--color-text-tertiary)]">
                {new Date(activeNote.updatedAt).toLocaleString()}
              </span>
              <button
                onClick={() => deleteNote(activeNote.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-red-50 transition-colors cursor-pointer"
                title="Delete note"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* Title */}
            <input
              value={activeNote.title}
              onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
              placeholder="Note title…"
              className="px-6 pt-6 pb-2 text-xl font-semibold text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none bg-transparent"
            />

            {/* Content */}
            <textarea
              value={activeNote.content}
              onChange={(e) => updateNote(activeNote.id, { content: e.target.value })}
              placeholder="Start writing…"
              className="flex-1 px-6 pb-6 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none resize-none bg-transparent leading-relaxed"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[var(--color-surface-subtle)] flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-text-tertiary)]">Select a note or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
