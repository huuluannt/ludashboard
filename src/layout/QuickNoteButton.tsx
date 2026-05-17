import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { saveModuleCloudData } from '@/firebase/moduleCloudSync';
import {
  createNoteFromContent,
  emitNotesChanged,
  loadNotesSnapshot,
  NotesCloudValue,
  saveNotesSnapshot,
} from '@/modules/notes/noteStorage';

export default function QuickNoteButton() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const saveQuickNote = async () => {
    const trimmed = content.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    try {
      const snapshot = await loadNotesSnapshot();
      const note = createNoteFromContent(trimmed);
      const updatedAt = Date.now();
      const nextNotes = [note, ...snapshot.notes];

      await saveNotesSnapshot(nextNotes, updatedAt);
      emitNotesChanged({ notes: nextNotes, updatedAt });
      await saveModuleCloudData<NotesCloudValue>('notes', 'notes', {
        value: { notes: nextNotes },
        updatedAt,
      }).catch((error) => {
        console.error('Failed to sync quick note', error);
      });

      setContent('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex-shrink-0 px-0.5 pb-1" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`
          flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors
          ${
            open
              ? 'border border-[var(--color-border-subtle)] bg-white text-[var(--color-accent)] shadow-sm'
              : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)]'
          }
        `}
        title="Quick note"
      >
        <Icon name="pencil" size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[70] mt-1 w-[min(310px,calc(100vw-1rem))] rounded-xl border-2 border-neutral-500 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center gap-2">
            <p className="flex-1 text-lg font-medium leading-none text-black">Notes</p>
            <button
              type="button"
              onClick={saveQuickNote}
              disabled={!content.trim() || saving}
              className="rounded-md bg-neutral-900 px-4 py-1 text-sm font-semibold leading-none text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Saving' : 'Save'}
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                saveQuickNote();
              }
            }}
            className="h-32 w-full resize-none rounded-lg border-2 border-neutral-400 bg-white px-3 py-2 text-base leading-6 text-black outline-none focus:border-neutral-700"
            placeholder=""
          />
        </div>
      )}
    </div>
  );
}
