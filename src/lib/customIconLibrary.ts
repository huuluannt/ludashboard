export interface CustomIconEntry {
  id: string;
  name: string;
  svg: string;
  dataUrl: string;
  createdAt: number;
}

const CUSTOM_ICON_LIBRARY_KEY = 'ludashboard.customIconLibrary.v1';

export function getCustomIconLibrary(): CustomIconEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_ICON_LIBRARY_KEY) || '[]') as CustomIconEntry[];
    return Array.isArray(parsed) ? parsed.filter(isCustomIconEntry) : [];
  } catch {
    return [];
  }
}

export function saveCustomIconToLibrary(entry: Omit<CustomIconEntry, 'id' | 'createdAt'>) {
  const nextEntry: CustomIconEntry = {
    ...entry,
    id: createCustomIconId(entry.name),
    createdAt: Date.now(),
  };
  const existing = getCustomIconLibrary().filter((item) => item.name !== nextEntry.name);
  const nextLibrary = [nextEntry, ...existing].slice(0, 60);
  localStorage.setItem(CUSTOM_ICON_LIBRARY_KEY, JSON.stringify(nextLibrary));
  window.dispatchEvent(new CustomEvent('ludashboard:custom-icons-changed'));
  return nextEntry;
}

export function removeCustomIconFromLibrary(id: string) {
  const nextLibrary = getCustomIconLibrary().filter((item) => item.id !== id);
  localStorage.setItem(CUSTOM_ICON_LIBRARY_KEY, JSON.stringify(nextLibrary));
  window.dispatchEvent(new CustomEvent('ludashboard:custom-icons-changed'));
}

export function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createCustomIconId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'icon';
  return `${slug}-${Date.now().toString(36)}`;
}

function isCustomIconEntry(value: unknown): value is CustomIconEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as CustomIconEntry;
  return (
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.svg === 'string' &&
    typeof entry.dataUrl === 'string' &&
    Number.isFinite(entry.createdAt)
  );
}
