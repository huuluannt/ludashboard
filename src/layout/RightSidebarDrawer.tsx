import { useEffect, useMemo } from 'react';
import Icon from '@/components/Icon';
import { moduleRegistry } from '@/modules/moduleRegistry';
import { useModuleStore } from '@/state/moduleStore';
import { useRightSidebarStore } from '@/state/rightSidebarStore';

const DRAWER_WIDTH = 'min(560px, calc(100vw - 28px))';
export default function RightSidebarDrawer() {
  const enabled = useRightSidebarStore((s) => s.enabled);
  const visible = useRightSidebarStore((s) => s.visible);
  const moduleId = useRightSidebarStore((s) => s.moduleId);
  const closeFully = useRightSidebarStore((s) => s.closeFully);
  const setModuleId = useRightSidebarStore((s) => s.setModuleId);
  const registryVersion = useModuleStore((s) => s.registryVersion);

  const modules = useMemo(
    () => moduleRegistry.getAll().filter((mod) => !mod.manifest.openInNewWindow),
    [registryVersion],
  );

  const selectedModule = useMemo(() => {
    return moduleRegistry.get(moduleId) ?? moduleRegistry.get('luchat') ?? modules[0] ?? null;
  }, [moduleId, modules, registryVersion]);

  useEffect(() => {
    if (selectedModule && selectedModule.manifest.id !== moduleId) {
      setModuleId(selectedModule.manifest.id);
    }
  }, [moduleId, selectedModule, setModuleId]);

  const ActiveComponent = selectedModule?.component ?? null;

  if (!enabled) {
    return null;
  }

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-0 z-[80]"
    >
      <div
        className={`absolute inset-0 bg-black/5 transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`}
      />

      <aside
        className={`
          pointer-events-auto absolute bottom-3 right-3 top-12 flex flex-col overflow-hidden rounded-2xl
          border border-[var(--color-border)] bg-white shadow-2xl
          transition-transform duration-300 ease-out
        `}
        style={{
          width: DRAWER_WIDTH,
          transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
        }}
      >
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-[var(--color-border-subtle)] bg-white px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name={selectedModule?.manifest.icon ?? 'panel-right'} size={16} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">Right Sidebar</p>
              {selectedModule && (
                <span className="rounded-md bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--color-text-tertiary)]">
                  {selectedModule.manifest.title}
                </span>
              )}
            </div>
          </div>

          <select
            value={selectedModule?.manifest.id ?? ''}
            onChange={(event) => setModuleId(event.target.value)}
            className="h-8 max-w-[210px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)] focus:bg-white"
            title="Choose quick module"
          >
            {modules.map((mod) => (
              <option key={mod.manifest.id} value={mod.manifest.id}>
                {mod.manifest.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={closeFully}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
            title="Close right sidebar"
          >
            <Icon name="x" size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden bg-white">
          {ActiveComponent ? (
            <ActiveComponent />
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
      </aside>
    </div>
  );
}
