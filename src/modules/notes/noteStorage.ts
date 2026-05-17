import { get, set } from 'idb-keyval';

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  color: string;
}

export interface NotesCloudValue {
  notes: Note[];
}

export interface NotesSnapshot {
  notes: Note[];
  updatedAt: number;
}

export const NOTES_STORAGE_KEY = 'lu:module:notes';
export const NOTES_UPDATED_AT_STORAGE_KEY = 'lu:module:notes:updatedAt';
export const NOTES_CHANGED_EVENT = 'lu:notes-changed';
export const NOTE_COLORS = ['#ffffff', '#fff3e0', '#e8f5e9', '#e3f2fd', '#fce4ec', '#f3e5f5', '#fff8e1'];

export function normalizeNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isNote);
}

export async function loadNotesSnapshot(): Promise<NotesSnapshot> {
  const notes = normalizeNotes(await get(NOTES_STORAGE_KEY));
  const storedUpdatedAt = Number(await get(NOTES_UPDATED_AT_STORAGE_KEY));
  return {
    notes,
    updatedAt: Number.isFinite(storedUpdatedAt) && storedUpdatedAt > 0
      ? storedUpdatedAt
      : notes.length
        ? Date.now()
        : 0,
  };
}

export async function saveNotesSnapshot(notes: Note[], updatedAt: number) {
  await set(NOTES_STORAGE_KEY, notes);
  await set(NOTES_UPDATED_AT_STORAGE_KEY, updatedAt);
}

export function createBlankNote(): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: '',
    content: '',
    createdAt: now,
    updatedAt: now,
    color: NOTE_COLORS[0],
  };
}

export function createNoteFromContent(content: string): Note {
  const now = Date.now();
  const trimmed = content.trim();
  const firstLine = trimmed.split(/\r?\n/).find(Boolean) ?? 'Quick note';
  return {
    id: crypto.randomUUID(),
    title: firstLine.slice(0, 80),
    content: trimmed,
    createdAt: now,
    updatedAt: now,
    color: NOTE_COLORS[0],
  };
}

export function emitNotesChanged(snapshot: NotesSnapshot) {
  window.dispatchEvent(new CustomEvent<NotesSnapshot>(NOTES_CHANGED_EVENT, { detail: snapshot }));
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== 'object') return false;
  const note = value as Note;
  return (
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.content === 'string' &&
    typeof note.createdAt === 'number' &&
    typeof note.updatedAt === 'number' &&
    typeof note.color === 'string'
  );
}
