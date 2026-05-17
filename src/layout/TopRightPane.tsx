import { useRef, useState, useCallback } from 'react';
import { useTabStore } from '@/state/tabStore';
import { useModuleStore } from '@/state/moduleStore';
import { useRightSidebarStore } from '@/state/rightSidebarStore';
import Icon from '@/components/Icon';
import QuickNoteButton from '@/layout/QuickNoteButton';
import { moduleRegistry } from '@/modules/moduleRegistry';
import { openModuleFromShell } from '@/modules/openModule';

export default function TopRightPane() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const reorderTabs = useTabStore((s) => s.reorderTabs);
  const openTab = useTabStore((s) => s.openTab);
  const importedModules = useModuleStore((s) => s.importedModules);
  const registryVersion = useModuleStore((s) => s.registryVersion);
  const rightSidebarVisible = useRightSidebarStore((s) => s.visible);
  const toggleRightSidebar = useRightSidebarStore((s) => s.toggleVisible);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      if (dragIdx !== null && dragIdx !== idx) {
        reorderTabs(dragIdx, idx);
        setDragIdx(idx);
      }
    },
    [dragIdx, reorderTabs],
  );

  const handleDragEnd = useCallback(() => {
    setDragIdx(null);
  }, []);

  const allModules = moduleRegistry.getAll();
  void registryVersion;

  return (
    <div className="h-10 min-h-[40px] flex items-end bg-[var(--color-surface-subtle)] border-b border-[var(--color-border-subtle)] select-none relative">
      {/* Tabs */}
      <div className="flex items-end flex-1 overflow-x-auto px-1 gap-0.5 scrollbar-none">
        {tabs.map((tab, idx) => {
          const isActive = tab.moduleId === activeTabId;
          return (
            <div
              key={tab.moduleId}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => setActiveTab(tab.moduleId)}
              className={`
                flex items-center gap-1.5 pl-3 pr-1 h-[34px] rounded-t-lg cursor-pointer
                transition-colors text-xs shrink-0 max-w-[180px] group
                ${
                  isActive
                    ? 'bg-white text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] border-b-white -mb-px z-10'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]'
                }
                ${dragIdx === idx ? 'opacity-50' : ''}
              `}
            >
              <Icon name={tab.icon} size={13} className="flex-shrink-0 text-[var(--color-text-tertiary)]" />
              <span className="truncate font-medium">{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.moduleId);
                }}
                className={`
                  w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ml-1
                  text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]
                  hover:bg-[var(--color-surface-muted)] transition-colors cursor-pointer
                  ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                `}
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add tab button */}
      <div className="flex-shrink-0 px-1 pb-1 relative" ref={pickerRef}>
        <button
          onClick={() => setShowPicker((p) => !p)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          title="Open a module"
        >
          <Icon name="plus" size={14} />
        </button>

        {/* Module picker dropdown */}
        {showPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-[var(--color-border)] shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
              {allModules.map((mod) => (
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
              ))}
            </div>
          </>
        )}
      </div>

      <QuickNoteButton />

      {/* Quick right sidebar */}
      <div className="flex-shrink-0 px-0.5 pb-1">
        <button
          type="button"
          onClick={toggleRightSidebar}
          className={`
            w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer
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
    </div>
  );
}
