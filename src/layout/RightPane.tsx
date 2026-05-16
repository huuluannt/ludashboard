import { useMemo } from 'react';
import { useTabStore } from '@/state/tabStore';
import { moduleRegistry } from '@/modules/moduleRegistry';
import Icon from '@/components/Icon';

export default function RightPane() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabs = useTabStore((s) => s.tabs);
  const openTab = useTabStore((s) => s.openTab);

  // Memoize the active module's component
  const ActiveComponent = useMemo(() => {
    if (!activeTabId) return null;
    const mod = moduleRegistry.get(activeTabId);
    return mod?.component ?? null;
  }, [activeTabId]);

  // Empty state
  if (!activeTabId || !ActiveComponent) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[var(--color-surface-subtle)] flex items-center justify-center">
            <Icon name="boxes" size={28} className="text-[var(--color-text-tertiary)]" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Welcome to LuDashboard
          </h2>
          <p className="text-sm text-[var(--color-text-tertiary)] mb-6 leading-relaxed">
            Open a module from the sidebar or use the <strong>+</strong> button to get started.
            Each module runs independently in its own tab.
          </p>
          {/* Quick-start chips */}
          <div className="flex flex-wrap gap-2 justify-center">
            {moduleRegistry
              .getAll()
              .filter((m) => m.manifest.version !== '0.0.0')
              .map((mod) => (
                <button
                  key={mod.manifest.id}
                  onClick={() =>
                    openTab({
                      moduleId: mod.manifest.id,
                      title: mod.manifest.title,
                      icon: mod.manifest.icon,
                    })
                  }
                  className="
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                    border border-[var(--color-border)] bg-white
                    text-xs font-medium text-[var(--color-text-secondary)]
                    hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]
                    transition-colors cursor-pointer
                  "
                >
                  <Icon name={mod.manifest.icon} size={13} />
                  {mod.manifest.title}
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  }

  // Render all open modules, only show the active one.
  // This preserves internal state when switching tabs.
  return (
    <div className="flex-1 relative bg-white overflow-hidden">
      {tabs.map((tab) => {
        const mod = moduleRegistry.get(tab.moduleId);
        if (!mod) return null;
        const Comp = mod.component;
        return (
          <div
            key={tab.moduleId}
            className="absolute inset-0 overflow-auto"
            style={{ display: tab.moduleId === activeTabId ? 'block' : 'none' }}
          >
            <Comp />
          </div>
        );
      })}
    </div>
  );
}
