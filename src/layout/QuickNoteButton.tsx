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
import { useFixedPopoverPosition } from './useFixedPopoverPosition';

export default function QuickNoteButton() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelStyle = useFixedPopoverPosition({
    anchorRef: containerRef,
    open,
    panelMaxWidth: 280,
  });

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
        <div
          className="fixed z-[70] rounded-xl border border-[var(--color-border)] bg-white p-2 shadow-xl shadow-black/10"
          style={panelStyle}
        >
          <div className="mb-1.5 flex h-7 items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Icon name="sticky-note" size={13} className="text-[var(--color-accent)]" />
              <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">Quick note</p>
            </div>
            <button
              type="button"
              onClick={saveQuickNote}
              disabled={!content.trim() || saving}
              className="h-7 rounded-lg bg-[var(--color-text-primary)] px-2.5 text-[11px] font-semibold leading-none text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? 'Saving' : 'Save'}
            </button>
          </div>

          <div className="relative">
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
              className="h-24 w-full resize-none rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2.5 py-2 pr-8 text-xs leading-5 text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white"
              placeholder="Write something..."
            />
            {content && (
              <button
                type="button"
                onClick={() => {
                  setContent('');
                  textareaRef.current?.focus();
                }}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-white hover:text-[var(--color-text-primary)]"
                title="Clear note"
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </div>

          <div className="mt-1.5 flex items-center justify-between text-[9px] text-[var(--color-text-tertiary)]">
            <span>Ctrl+Enter to save</span>
            <span>{content.length.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
