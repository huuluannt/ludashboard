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
import { useFixedPopoverPosition } from './useFixedPopoverPosition';

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
  const pickerPanelStyle = useFixedPopoverPosition({
    anchorRef: pickerRef,
    open: showPicker,
    panelMaxWidth: 224,
  });
  const actionsScrollRef = useRef<HTMLDivElement>(null);
  const actionsDragRef = useRef<{
    moved: boolean;
    pointerId: number;
    scrollLeft: number;
    startX: number;
  } | null>(null);
  const suppressActionClickRef = useRef(false);
  const [actionsDragging, setActionsDragging] = useState(false);
  const pinnedModules = pinnedModuleIds
    .map((id) => moduleRegistry.get(id))
    .filter((mod): mod is NonNullable<typeof mod> => Boolean(mod));
  void registryVersion;

  const handleActionsPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const scroller = actionsScrollRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;

    actionsDragRef.current = {
      moved: false,
      pointerId: event.pointerId,
      scrollLeft: scroller.scrollLeft,
      startX: event.clientX,
    };
    setActionsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleActionsPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const scroller = actionsScrollRef.current;
    const drag = actionsDragRef.current;
    if (!scroller || !drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 3) drag.moved = true;
    if (drag.moved) event.preventDefault();

    scroller.scrollLeft = drag.scrollLeft - deltaX;
  };

  const finishActionsDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = actionsDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.moved) {
      suppressActionClickRef.current = true;
      window.setTimeout(() => {
        suppressActionClickRef.current = false;
      }, 0);
    }

    actionsDragRef.current = null;
    setActionsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleActionsWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scroller = actionsScrollRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    scroller.scrollLeft += event.deltaY;
    event.preventDefault();
  };

  return (
    <div className="h-10 min-h-[40px] flex items-center gap-1.5 bg-[var(--color-surface-subtle)] border-b border-[var(--color-border-subtle)] px-3 select-none relative">
      <GlobalModuleSearch />

      <div
        ref={actionsScrollRef}
        aria-label="Quick actions"
        className={`quick-actions-scroll -mr-1 flex min-w-[6.5rem] max-w-full flex-shrink overflow-x-auto ${
          actionsDragging ? 'is-dragging' : ''
        }`}
        onClickCapture={(event) => {
          if (!suppressActionClickRef.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerCancel={finishActionsDrag}
        onPointerDown={handleActionsPointerDown}
        onPointerMove={handleActionsPointerMove}
        onPointerUp={finishActionsDrag}
        onWheel={handleActionsWheel}
      >
        <div className="flex w-max items-center gap-1.5 px-0.5">
          <div className="relative flex-shrink-0" ref={pickerRef}>
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
                <div
                  className="fixed z-50 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-lg"
                  style={pickerPanelStyle}
                >
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
      </div>
    </div>
  );
}
