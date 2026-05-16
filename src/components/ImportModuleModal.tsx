import { useState } from 'react';
import { useModuleStore } from '@/state/moduleStore';
import { moduleRegistry } from '@/modules/moduleRegistry';
import IframeModule from '@/modules/IframeModule';
import Icon from './Icon';

interface ImportModuleModalProps {
  onClose: () => void;
}

export default function ImportModuleModal({ onClose }: ImportModuleModalProps) {
  const importModule = useModuleStore((s) => s.importModule);

  const [title, setTitle] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [icon, setIcon] = useState('globe');
  const [category, setCategory] = useState('Imported');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [offline, setOffline] = useState(false);

  const handleImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !moduleId || !url) return;

    const newModule = {
      id: moduleId,
      title,
      icon,
      version: '1.0.0',
      category,
      description,
      offline,
      url,
    };

    importModule(newModule);
    
    // Register it immediately
    moduleRegistry.register({
      manifest: newModule,
      component: () => <IframeModule url={newModule.url} />
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Import Online Module</h2>
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
              <input required value={moduleId} onChange={e => setModuleId(e.target.value)} placeholder="e.g. lufast" className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-sm focus:border-[var(--color-accent)] focus:bg-white transition-colors outline-none font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Icon</label>
              <input required value={icon} onChange={e => setIcon(e.target.value)} placeholder="e.g. globe" className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-sm focus:border-[var(--color-accent)] focus:bg-white transition-colors outline-none font-mono" />
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

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Iframe URL</label>
            <input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://lufast.vercel.app" className="w-full h-9 px-3 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border-subtle)] text-sm focus:border-[var(--color-accent)] focus:bg-white transition-colors outline-none" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer mt-1">
            <input type="checkbox" checked={offline} onChange={e => setOffline(e.target.checked)} className="w-4 h-4 rounded text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">Module supports offline mode</span>
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-text-primary)] text-white hover:bg-black transition-colors cursor-pointer shadow-sm">Import</button>
          </div>
        </form>
      </div>
    </div>
  );
}
