import { useEffect, useMemo } from 'react';
import Icon from '@/components/Icon';
import { moduleRegistry } from '@/modules/moduleRegistry';
import { useModuleStore } from '@/state/moduleStore';
import { useRightCornerSidebarStore } from '@/state/rightCornerSidebarStore';
import { ModuleSurfaceProvider } from './ModuleSurfaceContext';

const PANEL_WIDTH = 'clamp(320px, 26vw, 420px)';
const CHAT_CLEAR_EVENT = 'lu:right-sidebar:clear-chat';

export default function RightCornerSidebar() {
  const enabled = useRightCornerSidebarStore((s) => s.enabled);
  const visible = useRightCornerSidebarStore((s) => s.visible);
  const moduleId = useRightCornerSidebarStore((s) => s.moduleId);
  const closeFully = useRightCornerSidebarStore((s) => s.closeFully);
  const setModuleId = useRightCornerSidebarStore((s) => s.setModuleId);
  const registryVersion = useModuleStore((s) => s.registryVersion);

  const modules = useMemo(
    () => moduleRegistry.getAll().filter((mod) => !mod.manifest.openInNewWindow),
    [registryVersion],
  );

  const selectedModule = useMemo(() => {
    return (
      moduleRegistry.get(moduleId) ??
      moduleRegistry.get('lufast') ??
      moduleRegistry.get('luchat') ??
      modules[0] ??
      null
    );
  }, [moduleId, modules, registryVersion]);

  useEffect(() => {
    if (selectedModule && selectedModule.manifest.id !== moduleId) {
      setModuleId(selectedModule.manifest.id);
    }
  }, [moduleId, selectedModule, setModuleId]);

  if (!enabled) return null;

  const ActiveComponent = selectedModule?.component ?? null;
  const supportsChatClear = selectedModule
    ? ['luchat', 'lugemini'].includes(selectedModule.manifest.id)
    : false;

  const clearActiveChat = () => {
    window.dispatchEvent(new CustomEvent(CHAT_CLEAR_EVENT));
  };

  return (
    <aside
      aria-hidden={!visible}
      className={`
        h-full flex-shrink-0 overflow-hidden border-l border-[var(--color-border-subtle)]
        bg-white transition-[width] duration-300 ease-out
      `}
      style={{ width: visible ? PANEL_WIDTH : 0 }}
    >
      <div className="flex h-full flex-col overflow-hidden" style={{ width: PANEL_WIDTH }}>
        <header className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-[var(--color-border-subtle)] bg-white px-2.5">
          <div
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]"
            title={selectedModule?.manifest.title ?? 'Right corner module'}
          >
            <Icon name={selectedModule?.manifest.icon ?? 'zap'} size={15} />
          </div>

          <select
            value={selectedModule?.manifest.id ?? ''}
            onChange={(event) => setModuleId(event.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)] focus:bg-white"
            title="Choose right corner module"
          >
            {modules.map((mod) => (
              <option key={mod.manifest.id} value={mod.manifest.id}>
                {mod.manifest.title}
              </option>
            ))}
          </select>

          {supportsChatClear && (
            <button
              type="button"
              onClick={clearActiveChat}
              className="flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-danger)]"
              title="Clear chat"
            >
              <Icon name="trash" size={13} />
              Clear
            </button>
          )}

          <button
            type="button"
            onClick={closeFully}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
            title="Close right corner sidebar"
          >
            <Icon name="x" size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden bg-white">
          {ActiveComponent ? (
            <ModuleSurfaceProvider surface="right-sidebar">
              <ActiveComponent />
            </ModuleSurfaceProvider>
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-text-tertiary)]">
                  <Icon name="boxes" size={22} />
                </div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">No module selected</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
