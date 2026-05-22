import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useModuleStore } from '@/state/moduleStore';
import type { ImportedModule, ModuleOverride } from '@/state/moduleStore';
import { useTabStore } from '@/state/tabStore';
import { useSidebarStore } from '@/state/sidebarStore';
import { moduleRegistry } from '@/modules/moduleRegistry';
import type { ModuleManifest } from '@/modules/moduleTypes';
import { applyModuleOverride, registerImportedModule } from '@/modules/registryRuntime';
import { getCustomIconLibrary } from '@/lib/customIconLibrary';
import Icon, { availableIcons } from './Icon';

const MAX_ICON_SIZE = 512 * 1024;

export type EditableModule = ModuleManifest & {
  url?: string;
  isImported?: boolean;
};

interface ImportModuleModalProps {
  onClose: () => void;
  editingModule?: EditableModule | null;
}

export default function ImportModuleModal({ onClose, editingModule }: ImportModuleModalProps) {
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

  const [title, setTitle] = useState(editingModule?.title || '');
  const [moduleId, setModuleId] = useState(editingModule?.id || '');
  const [icon, setIcon] = useState(editingModule?.icon || 'globe');
  const [category, setCategory] = useState(editingModule?.category || 'Imported');
  const [description, setDescription] = useState(editingModule?.description || '');
  const [url, setUrl] = useState(editingModule?.url || '');
  const [offline, setOffline] = useState(editingModule?.offline || false);
  const [openInNewWindow, setOpenInNewWindow] = useState(editingModule?.openInNewWindow || false);
  const [formError, setFormError] = useState('');

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconUploadError, setIconUploadError] = useState('');
  const [customIcons, setCustomIcons] = useState(() => getCustomIconLibrary());
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);

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

    if (!file.type.startsWith('image/')) {
      setIconUploadError('Please choose an image file.');
      return;
    }

    if (file.size > MAX_ICON_SIZE) {
      setIconUploadError('Icon file must be under 512 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setIcon(reader.result);
        setIconUploadError('');
        setShowIconPicker(false);
      }
    };
    reader.onerror = () => setIconUploadError('Could not read that icon file.');
    reader.readAsDataURL(file);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {isEditing ? 'Edit Module' : 'Import Online Module'}
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
            <div className="flex flex-col gap-1.5 relative" ref={iconPickerRef}>
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
                    <button
                      type="button"
                      onClick={() => iconFileInputRef.current?.click()}
                      className="w-full h-9 rounded-lg flex items-center justify-center gap-2 text-[11px] font-semibold tracking-wide text-[var(--color-accent)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
                    >
                      <Icon name="plus" size={14} />
                      ADD ICON
                    </button>
                    <input
                      ref={iconFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleIconUpload}
                    />
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
