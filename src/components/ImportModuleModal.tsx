import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, ClipboardEvent as ReactClipboardEvent, FormEvent } from 'react';
import { useModuleStore } from '@/state/moduleStore';
import type { ImportedModule, ImportedModuleType, ModuleOverride } from '@/state/moduleStore';
import { useTabStore } from '@/state/tabStore';
import { useSidebarStore } from '@/state/sidebarStore';
import { moduleRegistry } from '@/modules/moduleRegistry';
import type { ModuleManifest } from '@/modules/moduleTypes';
import { applyModuleOverride, registerImportedModule } from '@/modules/registryRuntime';
import { getCustomIconLibrary, svgToDataUrl } from '@/lib/customIconLibrary';
import Icon, { availableIcons, resolveLucideIconName } from './Icon';

const MAX_ICON_SOURCE_SIZE = 5 * 1024 * 1024;
const MAX_STORED_ICON_SIZE = 96 * 1024;
const ICON_CANVAS_SIZE = 96;
const ICON_WEBP_QUALITY = 0.82;
const PANEL_MODULE_DEFAULTS = {
  title: 'Panel-',
  id: 'panel',
  icon: 'layout-panel-top',
  category: 'panel',
  description: 'panel',
  url: 'https://lupanel.vercel.app/',
} satisfies Pick<ImportedModule, 'title' | 'id' | 'icon' | 'category' | 'description' | 'url'>;
const URL_MODULE_DEFAULTS = {
  title: '',
  id: '',
  icon: 'globe',
  category: 'Imported',
  description: '',
  url: '',
} satisfies Pick<ImportedModule, 'title' | 'id' | 'icon' | 'category' | 'description' | 'url'>;

export type EditableModule = ModuleManifest & {
  url?: string;
  isImported?: boolean;
  moduleType?: ImportedModuleType;
};

export type ImportModulePreset = ImportedModuleType;

interface ImportModuleModalProps {
  onClose: () => void;
  editingModule?: EditableModule | null;
  importPreset?: ImportModulePreset;
}

export default function ImportModuleModal({ onClose, editingModule, importPreset = 'url' }: ImportModuleModalProps) {
  const importModule = useModuleStore((s) => s.importModule);
  const removeModule = useModuleStore((s) => s.removeModule);
  const saveModuleOverride = useModuleStore((s) => s.saveModuleOverride);
  const updateTab = useTabStore((s) => s.updateTab);
  const replaceTab = useTabStore((s) => s.replaceTab);
  const replaceModuleId = useSidebarStore((s) => s.replaceModuleId);

  const isEditing = editingModule != null;
  const isImportedEdit = editingModule?.isImported ?? false;
  const hasUrlField = !isEditing || isImportedEdit;
  const moduleIdLocked = isEditing && !isImportedEdit;
  const moduleType = editingModule?.moduleType ?? importPreset;
  const defaults = importPreset === 'panel' ? PANEL_MODULE_DEFAULTS : URL_MODULE_DEFAULTS;

  const [title, setTitle] = useState(editingModule?.title || defaults.title);
  const [moduleId, setModuleId] = useState(editingModule?.id || defaults.id);
  const [icon, setIcon] = useState(editingModule?.icon || defaults.icon);
  const [category, setCategory] = useState(editingModule?.category || defaults.category);
  const [description, setDescription] = useState(editingModule?.description || defaults.description);
  const [url, setUrl] = useState(editingModule?.url || defaults.url);
  const [offline, setOffline] = useState(editingModule?.offline || false);
  const [openInNewWindow, setOpenInNewWindow] = useState(editingModule?.openInNewWindow || false);
  const [formError, setFormError] = useState('');

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconUploadError, setIconUploadError] = useState('');
  const [showLucideIconInput, setShowLucideIconInput] = useState(false);
  const [lucideIconName, setLucideIconName] = useState('');
  const [lucideIconError, setLucideIconError] = useState('');
  const [customIcons, setCustomIcons] = useState(() => getCustomIconLibrary());
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);
  const lucideIconInputRef = useRef<HTMLInputElement>(null);

  const commitIconDataUrl = (dataUrl: string, source: 'selected' | 'pasted') => {
    if (getByteSize(dataUrl) > MAX_STORED_ICON_SIZE) {
      setIconUploadError(`${source === 'pasted' ? 'Pasted icon' : 'Icon file'} is too large after optimization.`);
      return false;
    }

    setIcon(dataUrl);
    setIconUploadError('');
    setLucideIconError('');
    setShowLucideIconInput(false);
    setShowIconPicker(false);
    return true;
  };

  const applyIconDataUrl = async (dataUrl: string, source: 'selected' | 'pasted') => {
    if (getByteSize(dataUrl) > MAX_ICON_SOURCE_SIZE) {
      setIconUploadError(`${source === 'pasted' ? 'Pasted image' : 'Icon file'} must be under 5 MB.`);
      return;
    }

    const mimeType = getDataUrlMimeType(dataUrl);
    if (mimeType && isRasterIconMimeType(mimeType)) {
      try {
        commitIconDataUrl(await optimizeIconDataUrl(dataUrl), source);
      } catch {
        setIconUploadError(`Could not optimize that ${source === 'pasted' ? 'pasted' : 'selected'} icon.`);
      }
      return;
    }

    commitIconDataUrl(dataUrl, source);
  };

  const applyIconFile = async (file: File, source: 'selected' | 'pasted') => {
    if (!file.type.startsWith('image/')) {
      setIconUploadError(source === 'pasted' ? 'Clipboard does not contain an image icon.' : 'Please choose an image file.');
      return;
    }

    if (file.size > MAX_ICON_SOURCE_SIZE) {
      setIconUploadError(`${source === 'pasted' ? 'Pasted image' : 'Icon file'} must be under 5 MB.`);
      return;
    }

    if (isRasterIconMimeType(file.type)) {
      try {
        commitIconDataUrl(await optimizeIconFile(file), source);
      } catch {
        setIconUploadError(`Could not optimize that ${source === 'pasted' ? 'pasted' : 'selected'} icon.`);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void applyIconDataUrl(reader.result, source);
      }
    };
    reader.onerror = () => setIconUploadError(`Could not read that ${source === 'pasted' ? 'pasted' : 'selected'} icon.`);
    reader.readAsDataURL(file);
  };

  const pasteIconFromClipboard = (clipboardData: DataTransfer | null, preventDefault: () => void) => {
    if (!clipboardData) return false;

    const payload = getClipboardIconPayload(clipboardData);
    if (!payload) return false;

    preventDefault();
    if (payload.kind === 'file') {
      void applyIconFile(payload.file, 'pasted');
      return true;
    }

    void applyIconDataUrl(payload.dataUrl, 'pasted');
    return true;
  };

  const handleIconPasteCapture = (event: ReactClipboardEvent<HTMLDivElement>) => {
    pasteIconFromClipboard(event.clipboardData, () => {
      event.preventDefault();
      event.stopPropagation();
    });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setShowIconPicker(false);
      }
    };
    if (showIconPicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showIconPicker]);

  useEffect(() => {
    const handler = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target instanceof Node ? event.target : null;
      const activeElement = document.activeElement;
      const isIconFieldTarget =
        (target != null && iconPickerRef.current?.contains(target)) ||
        (activeElement != null && iconPickerRef.current?.contains(activeElement));

      if (!showIconPicker && !isIconFieldTarget) return;
      pasteIconFromClipboard(event.clipboardData, () => event.preventDefault());
    };

    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [showIconPicker]);

  useEffect(() => {
    const refreshCustomIcons = () => setCustomIcons(getCustomIconLibrary());
    window.addEventListener('storage', refreshCustomIcons);
    window.addEventListener('ludashboard:custom-icons-changed', refreshCustomIcons);
    return () => {
      window.removeEventListener('storage', refreshCustomIcons);
      window.removeEventListener('ludashboard:custom-icons-changed', refreshCustomIcons);
    };
  }, []);

  const handleIconUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void applyIconFile(file, 'selected');
  };

  const openLucideIconInput = () => {
    setShowLucideIconInput(true);
    setIconUploadError('');
    setLucideIconError('');
    window.setTimeout(() => lucideIconInputRef.current?.focus(), 0);
  };

  const handleLucideIconAdd = () => {
    const nextIcon = resolveLucideIconName(lucideIconName);
    if (!nextIcon) {
      setLucideIconError('Lucide icon not found.');
      return;
    }

    setIcon(nextIcon);
    setLucideIconName(nextIcon);
    setLucideIconError('');
    setIconUploadError('');
    setShowIconPicker(false);
  };

  const handleImport = (e: FormEvent) => {
    e.preventDefault();
    const nextId = moduleIdLocked && editingModule ? editingModule.id : moduleId.trim();
    const nextTitle = title.trim();
    const nextCategory = category.trim();
    const nextDescription = description.trim();

    setFormError('');
    if (!nextTitle || !nextId || (hasUrlField && !url.trim())) return;
    if ((!isEditing || editingModule?.id !== nextId) && moduleRegistry.has(nextId)) {
      setFormError('Module ID already exists.');
      return;
    }

    if (isEditing && !hasUrlField && editingModule) {
      const override: ModuleOverride = {
        id: editingModule.id,
        title: nextTitle,
        icon,
        version: editingModule.version,
        category: nextCategory,
        description: nextDescription,
        offline,
        openInNewWindow,
        permissions: editingModule.permissions,
      };

      saveModuleOverride(override);
      applyModuleOverride(override);
      updateTab(editingModule.id, { title: override.title, icon: override.icon });
      onClose();
      return;
    }

    const newModule: ImportedModule = {
      id: nextId,
      title: nextTitle,
      icon,
      version: '1.0.0',
      category: nextCategory,
      description: nextDescription,
      offline,
      openInNewWindow,
      url: url.trim(),
      moduleType,
    };

    if (isEditing && editingModule && editingModule.id !== newModule.id) {
      removeModule(editingModule.id);
      moduleRegistry.unregister(editingModule.id);
      replaceModuleId(editingModule.id, newModule.id);
      replaceTab(editingModule.id, {
        moduleId: newModule.id,
        title: newModule.title,
        icon: newModule.icon,
      });
    } else if (isEditing) {
      updateTab(newModule.id, { title: newModule.title, icon: newModule.icon });
    }

    importModule(newModule);
    registerImportedModule(newModule);

    onClose();
  };

  const iconLabel = icon.startsWith('data:image/') ? 'custom icon' : icon;
  const lucideIconPreview = resolveLucideIconName(lucideIconName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {isEditing ? 'Edit Module' : importPreset === 'panel' ? 'Import Panel Module' : 'Import Online Module'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer">
            <Icon name="x" size={16} />
          </button>
        </div>

        <form onSubmit={handleImport} className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Title</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Lufast" className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-sm focus:border-[var(--color-accent)] focus:bg-white transition-colors outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Module ID</label>
              <input
                required
                value={moduleId}
                onChange={e => setModuleId(e.target.value)}
                placeholder="e.g. lufast"
                disabled={moduleIdLocked}
                className={`w-full h-9 px-3 rounded-lg border border-[var(--color-border-subtle)] text-sm transition-colors outline-none font-mono ${
                  moduleIdLocked
                    ? 'bg-[var(--color-surface-muted)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                    : 'bg-[var(--color-surface-subtle)] focus:border-[var(--color-accent)] focus:bg-white'
                }`}
              />
              {formError && (
                <p className="text-[10px] text-[var(--color-danger)]">{formError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 relative" ref={iconPickerRef} onPasteCapture={handleIconPasteCapture}>
              <label className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Icon</label>
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-sm focus:border-[var(--color-accent)] focus:bg-white transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name={icon} size={16} className="text-[var(--color-text-secondary)]" />
                  <span className="font-mono text-xs truncate">{iconLabel}</span>
                </div>
                <Icon name="chevron-right" size={14} className={`text-[var(--color-text-tertiary)] transition-transform ${showIconPicker ? 'rotate-90' : ''}`} />
              </button>
              
              {showIconPicker && (
                <div className="absolute top-full left-0 mt-1 w-[340px] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-[var(--color-border)] p-2 z-10 grid grid-cols-8 gap-1 max-h-72 overflow-y-auto">
                  <div className="col-span-8 pb-1 mb-1 border-b border-[var(--color-border-subtle)]">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setLucideIconError('');
                          iconFileInputRef.current?.click();
                        }}
                        className="h-9 min-w-0 rounded-lg flex items-center justify-center gap-1.5 px-2 text-[11px] font-semibold tracking-wide text-[var(--color-accent)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
                      >
                        <Icon name="plus" size={14} />
                        <span className="truncate">ADD ICON</span>
                      </button>
                      <button
                        type="button"
                        onClick={openLucideIconInput}
                        className="h-9 min-w-0 rounded-lg flex items-center justify-center gap-1.5 px-2 text-[11px] font-semibold tracking-wide text-[var(--color-accent)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
                      >
                        <Icon name="sparkles" size={14} />
                        <span className="truncate">ADD ICON LUCIDE</span>
                      </button>
                    </div>
                    <input
                      ref={iconFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleIconUpload}
                    />
                    {showLucideIconInput && (
                      <div className="mt-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]">
                            <Icon name={lucideIconPreview ?? 'search'} size={16} />
                          </div>
                          <input
                            ref={lucideIconInputRef}
                            type="text"
                            value={lucideIconName}
                            onChange={(event) => {
                              setLucideIconName(event.currentTarget.value);
                              setLucideIconError('');
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                handleLucideIconAdd();
                              }
                            }}
                            placeholder="layout-panel-top"
                            className="h-8 min-w-0 flex-1 rounded-md border border-[var(--color-border-subtle)] bg-white px-2 font-mono text-xs text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
                          />
                          <button
                            type="button"
                            onClick={handleLucideIconAdd}
                            className="h-8 flex-shrink-0 rounded-md bg-[var(--color-text-primary)] px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-black"
                          >
                            Add
                          </button>
                        </div>
                        {lucideIconError && (
                          <p className="mt-1 text-[10px] text-[var(--color-danger)]">
                            {lucideIconError}
                          </p>
                        )}
                      </div>
                    )}
                    {iconUploadError && (
                      <p className="mt-1 text-[10px] text-[var(--color-danger)] text-center">
                        {iconUploadError}
                      </p>
                    )}
                  </div>
                  {icon.startsWith('data:image/') && (
                    <button
                      type="button"
                      className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer bg-[var(--color-accent)] text-white"
                      title="Custom uploaded icon"
                    >
                      <Icon name={icon} size={20} />
                    </button>
                  )}
                  {customIcons.length > 0 && (
                    <div className="col-span-8 grid grid-cols-8 gap-1 border-b border-[var(--color-border-subtle)] pb-1 mb-1">
                      {customIcons.map((customIcon) => (
                        <button
                          key={customIcon.id}
                          type="button"
                          onClick={() => {
                            setIcon(customIcon.dataUrl);
                            setShowIconPicker(false);
                          }}
                          className={`
                            w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors border
                            ${icon === customIcon.dataUrl ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]' : 'hover:bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]'}
                          `}
                          title={customIcon.name}
                        >
                          <Icon name={customIcon.dataUrl} size={20} />
                        </button>
                      ))}
                    </div>
                  )}
                  {availableIcons.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setIcon(i);
                        setShowIconPicker(false);
                      }}
                      className={`
                        w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors
                        ${icon === i ? 'bg-[var(--color-accent)] text-white' : 'hover:bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]'}
                      `}
                      title={i}
                    >
                      <Icon name={i} size={18} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Category</label>
              <input required value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Productivity" className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-sm focus:border-[var(--color-accent)] focus:bg-white transition-colors outline-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Description</label>
            <input required value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-sm focus:border-[var(--color-accent)] focus:bg-white transition-colors outline-none" />
          </div>

          {hasUrlField && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Iframe URL</label>
              <input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://lufast.vercel.app" className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-sm focus:border-[var(--color-accent)] focus:bg-white transition-colors outline-none" />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" checked={offline} onChange={e => setOffline(e.target.checked)} className="w-4 h-4 rounded text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">Module supports offline mode</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={openInNewWindow} onChange={e => setOpenInNewWindow(e.target.checked)} className="w-4 h-4 rounded text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">Open module in New Window</span>
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-text-primary)] text-white hover:bg-black transition-colors cursor-pointer shadow-sm">
              {isEditing ? 'Save Changes' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ClipboardIconPayload =
  | { kind: 'file'; file: File }
  | { kind: 'data-url'; dataUrl: string };

function getClipboardIconPayload(clipboardData: DataTransfer): ClipboardIconPayload | null {
  for (const item of Array.from(clipboardData.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return { kind: 'file', file };
    }
  }

  for (const file of Array.from(clipboardData.files)) {
    if (file.type.startsWith('image/')) return { kind: 'file', file };
  }

  const text = clipboardData.getData('text/plain').trim();
  if (!text) return null;

  if (text.toLowerCase().startsWith('data:image/')) {
    return { kind: 'data-url', dataUrl: text };
  }

  if (looksLikeSvg(text)) {
    return { kind: 'data-url', dataUrl: svgToDataUrl(text) };
  }

  return null;
}

function looksLikeSvg(value: string) {
  const normalized = value.replace(/^\uFEFF/, '').trim();
  return /^<svg[\s>]/i.test(normalized) || /^<\?xml[\s\S]*<svg[\s>]/i.test(normalized);
}

function getByteSize(value: string) {
  return new Blob([value]).size;
}

function getDataUrlMimeType(dataUrl: string) {
  return /^data:([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase() ?? '';
}

function isRasterIconMimeType(mimeType: string) {
  return /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(mimeType);
}

function optimizeIconFile(file: File) {
  const objectUrl = URL.createObjectURL(file);
  return optimizeIconSource(objectUrl).finally(() => URL.revokeObjectURL(objectUrl));
}

function optimizeIconDataUrl(dataUrl: string) {
  return optimizeIconSource(dataUrl);
}

function optimizeIconSource(source: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      if (!sourceWidth || !sourceHeight) {
        reject(new Error('Invalid image dimensions'));
        return;
      }

      const scale = Math.min(1, ICON_CANVAS_SIZE / Math.max(sourceWidth, sourceHeight));
      const width = Math.max(1, Math.round(sourceWidth * scale));
      const height = Math.max(1, Math.round(sourceHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas unavailable'));
        return;
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const webpDataUrl = canvas.toDataURL('image/webp', ICON_WEBP_QUALITY);
      if (getByteSize(webpDataUrl) <= MAX_STORED_ICON_SIZE) {
        resolve(webpDataUrl);
        return;
      }

      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Image load failed'));
    image.src = source;
  });
}
