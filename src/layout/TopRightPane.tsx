import { useRef, useState } from 'react';
import { useModuleStore } from '@/state/moduleStore';
import { useRightCornerSidebarStore } from '@/state/rightCornerSidebarStore';
import { useRightSidebarStore } from '@/state/rightSidebarStore';
import { useSidebarStore } from '@/state/sidebarStore';
import { useTabStore } from '@/state/tabStore';
import Icon from '@/components/Icon';
import GlobalModuleSearch from '@/layout/GlobalModuleSearch';
import QuickNoteButton from '@/layout/QuickNoteButton';
import QuickTools from '@/layout/QuickTools';
import { moduleRegistry } from '@/modules/moduleRegistry';
import { openModuleFromShell } from '@/modules/openModule';

export default function TopRightPane() {
  const openTab = useTabStore((s) => s.openTab);
  const importedModules = useModuleStore((s) => s.importedModules);
  const registryVersion = useModuleStore((s) => s.registryVersion);
  const pinnedModuleIds = useSidebarStore((s) => s.pinnedModuleIds);
  const rightSidebarVisible = useRightSidebarStore((s) => s.visible);
  const toggleRightSidebar = useRightSidebarStore((s) => s.toggleVisible);
  const rightCornerVisible = useRightCornerSidebarStore((s) => s.visible);
  const toggleRightCorner = useRightCornerSidebarStore((s) => s.toggleVisible);

  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pinnedModules = pinnedModuleIds
    .map((id) => moduleRegistry.get(id))
    .filter((mod): mod is NonNullable<typeof mod> => Boolean(mod));
  void registryVersion;

  return (
    <div className="h-10 min-h-[40px] flex items-center gap-1.5 bg-[var(--color-surface-subtle)] border-b border-[var(--color-border-subtle)] px-3 select-none relative">
      <GlobalModuleSearch />

      <div className="flex-shrink-0 relative" ref={pickerRef}>
        <button
          onClick={() => setShowPicker((p) => !p)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          title="Open a module"
        >
          <Icon name="plus" size={14} />
        </button>

        {showPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-[var(--color-border)] shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
              {pinnedModules.length > 0 ? (
                pinnedModules.map((mod) => (
                  <button
                    key={mod.manifest.id}
                    onClick={() => {
                      openModuleFromShell(mod, importedModules, openTab);
                      setShowPicker(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
                  >
                    <Icon name={mod.manifest.icon} size={14} className="text-[var(--color-text-secondary)]" />
                    <span className="text-xs text-[var(--color-text-primary)] font-medium">{mod.manifest.title}</span>
                    {!mod.manifest.offline && (
                      <span className="ml-auto text-[9px] text-[var(--color-text-tertiary)] bg-[var(--color-surface-muted)] rounded px-1.5 py-0.5">
                        Online
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-[11px] leading-5 text-[var(--color-text-tertiary)]">
                  Pin modules from the sidebar to show them here.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={toggleRightCorner}
        className={`
          w-7 h-7 rounded-lg flex flex-shrink-0 items-center justify-center transition-colors cursor-pointer
          ${
            rightCornerVisible
              ? 'bg-white text-[var(--color-accent)] border border-[var(--color-border-subtle)] shadow-sm'
              : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)]'
          }
        `}
        title={rightCornerVisible ? 'Hide right corner sidebar' : 'Show right corner sidebar'}
      >
        <Icon name="zap" size={15} />
      </button>

      <QuickTools />
      <QuickNoteButton />

      <button
        type="button"
        onClick={toggleRightSidebar}
        className={`
          w-7 h-7 rounded-lg flex flex-shrink-0 items-center justify-center transition-colors cursor-pointer
          ${
            rightSidebarVisible
              ? 'bg-white text-[var(--color-accent)] border border-[var(--color-border-subtle)] shadow-sm'
              : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)]'
          }
        `}
        title={rightSidebarVisible ? 'Hide right sidebar' : 'Show right sidebar'}
      >
        <Icon name={rightSidebarVisible ? 'panel-right-close' : 'panel-right-open'} size={15} />
      </button>
    </div>
  );
}
