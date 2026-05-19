import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import Icon from '@/components/Icon';
import { getSearchScore } from '@/lib/moduleSearch';
import { moduleRegistry } from '@/modules/moduleRegistry';
import { openModuleFromShell } from '@/modules/openModule';
import type { RegisteredModule } from '@/modules/moduleTypes';
import { useGlobalSearchStore, type GlobalSearchFocusOptions } from '@/state/globalSearchStore';
import { useModuleStore } from '@/state/moduleStore';
import { useSidebarStore } from '@/state/sidebarStore';
import { useTabStore } from '@/state/tabStore';

export default function GlobalModuleSearch() {
  const searchQuery = useSidebarStore((s) => s.searchQuery);
  const setSearchQuery = useSidebarStore((s) => s.setSearchQuery);
  const pinnedModuleIds = useSidebarStore((s) => s.pinnedModuleIds);
  const moduleOrderIds = useSidebarStore((s) => s.moduleOrderIds);
  const openTab = useTabStore((s) => s.openTab);
  const importedModules = useModuleStore((s) => s.importedModules);
  const registryVersion = useModuleStore((s) => s.registryVersion);

  const searchAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchOverlayOpenRef = useRef(false);
  const hotkeyPulseTimeoutRef = useRef<number | null>(null);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [searchHotkeyPulse, setSearchHotkeyPulse] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);

  const orderedModules = useMemo(() => {
    const orderIndex = new Map(moduleOrderIds.map((id, index) => [id, index]));
    return [...moduleRegistry.getAll()].sort((a, b) => {
      const aIndex = orderIndex.get(a.manifest.id);
      const bIndex = orderIndex.get(b.manifest.id);

      if (aIndex != null && bIndex != null) return aIndex - bIndex;
      if (aIndex != null) return -1;
      if (bIndex != null) return 1;
      return 0;
    });
  }, [moduleOrderIds, registryVersion]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];

    return orderedModules
      .map((mod, index) => ({
        mod,
        index,
        score: getSearchScore(
          `${mod.manifest.title} ${mod.manifest.category} ${mod.manifest.description}`,
          q,
        ),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.mod);
  }, [orderedModules, searchQuery]);

  const searchOverlayVisible = searchOverlayOpen && searchQuery.trim().length > 0;

  useEffect(() => {
    searchOverlayOpenRef.current = searchOverlayOpen;
  }, [searchOverlayOpen]);

  useEffect(() => {
    setSelectedSearchIndex(0);
  }, [searchQuery, searchResults.length]);

  useEffect(() => {
    const focusSearch = (options: GlobalSearchFocusOptions = {}) => {
      searchAreaRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      setSearchOverlayOpen(Boolean(useSidebarStore.getState().searchQuery.trim()));
      setSearchHotkeyPulse(true);

      if (hotkeyPulseTimeoutRef.current != null) {
        window.clearTimeout(hotkeyPulseTimeoutRef.current);
      }

      hotkeyPulseTimeoutRef.current = window.setTimeout(() => {
        setSearchHotkeyPulse(false);
        hotkeyPulseTimeoutRef.current = null;
      }, 700);

      window.requestAnimationFrame(() => {
        const input = searchInputRef.current;
        input?.focus({ preventScroll: true });
        if (options.select || input?.value.trim()) input?.select();
      });
    };

    const blurSearch = () => {
      setSearchOverlayOpen(false);
      setSearchHotkeyPulse(false);
      searchInputRef.current?.blur();
    };

    useGlobalSearchStore.getState().registerSearchController({
      focus: focusSearch,
      blur: blurSearch,
      containsTarget: (target: EventTarget | null) =>
        target instanceof Node ? Boolean(searchAreaRef.current?.contains(target)) : false,
      isFocused: () => document.activeElement === searchInputRef.current,
      isOpen: () => searchOverlayOpenRef.current,
    });

    return () => {
      useGlobalSearchStore.getState().registerSearchController(null);
      if (hotkeyPulseTimeoutRef.current != null) {
        window.clearTimeout(hotkeyPulseTimeoutRef.current);
        hotkeyPulseTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (searchAreaRef.current && !searchAreaRef.current.contains(event.target as Node)) {
        setSearchOverlayOpen(false);
      }
    };

    if (searchOverlayOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOverlayOpen]);

  const handleOpenSearchResult = (mod: RegisteredModule) => {
    openModuleFromShell(mod, importedModules, openTab);
    setSearchOverlayOpen(false);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOverlayOpen(false);
      setSearchHotkeyPulse(false);
      searchInputRef.current?.blur();
      return;
    }

    if (!searchQuery.trim()) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchOverlayOpen(true);
      setSelectedSearchIndex((index) => Math.min(index + 1, Math.max(0, searchResults.length - 1)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSearchOverlayOpen(true);
      setSelectedSearchIndex((index) => Math.max(0, index - 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selectedModule = searchResults[selectedSearchIndex] ?? searchResults[0];
      if (selectedModule) handleOpenSearchResult(selectedModule);
    }
  };

  return (
    <div
      ref={searchAreaRef}
      className={`relative min-w-[220px] max-w-[620px] flex-1 rounded-xl transition-shadow duration-200 ${
        searchHotkeyPulse ? 'ring-2 ring-[var(--color-accent)]/25 shadow-[0_0_0_4px_rgba(67,97,238,0.10)]' : ''
      }`}
    >
      <Icon
        name="search"
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
      />
      <input
        ref={searchInputRef}
        type="text"
        aria-label="Search modules"
        aria-controls="global-search-results"
        aria-expanded={searchOverlayVisible}
        aria-keyshortcuts="Control+K /"
        placeholder="Search modules..."
        value={searchQuery}
        onChange={(event) => {
          setSearchQuery(event.target.value);
          setSearchOverlayOpen(Boolean(event.target.value.trim()));
        }}
        onFocus={(event) => {
          event.currentTarget.select();
          if (event.currentTarget.value.trim()) setSearchOverlayOpen(true);
        }}
        onClick={(event) => {
          event.currentTarget.select();
          if (event.currentTarget.value.trim()) setSearchOverlayOpen(true);
        }}
        onBlur={() => setSearchHotkeyPulse(false)}
        onKeyDown={handleSearchKeyDown}
        className="
          h-8 w-full rounded-xl border border-black/25
          bg-white pl-9 pr-20 text-xs text-[var(--color-text-primary)]
          shadow-sm transition-colors
          placeholder:text-[var(--color-text-tertiary)]
          focus:border-black focus:outline-none
        "
      />
      {!searchQuery && (
        <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-1.5 py-0.5 text-[9px] font-medium leading-none text-[var(--color-text-tertiary)]">
            Ctrl K
          </kbd>
          <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-1.5 py-0.5 text-[9px] font-medium leading-none text-[var(--color-text-tertiary)]">
            /
          </kbd>
        </div>
      )}
      {searchQuery && (
        <button
          type="button"
          onClick={() => {
            setSearchQuery('');
            setSearchOverlayOpen(false);
            searchInputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-secondary)]"
          title="Clear search"
        >
          <Icon name="x" size={12} />
        </button>
      )}
      {searchOverlayVisible && (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[50vh] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-1.5 shadow-xl"
        >
          {searchResults.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-[var(--color-text-tertiary)]">
              No matching modules
            </div>
          ) : (
            searchResults.map((mod, index) => {
              const selected = index === selectedSearchIndex;
              return (
                <button
                  key={mod.manifest.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setSelectedSearchIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleOpenSearchResult(mod);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                    selected
                      ? 'bg-[var(--color-text-primary)] text-white'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${
                      selected
                        ? 'border-white/20 bg-white/10 text-white'
                        : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <Icon name={mod.manifest.icon} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{mod.manifest.title}</span>
                    <span className={`block truncate text-[10px] ${selected ? 'text-white/60' : 'text-[var(--color-text-tertiary)]'}`}>
                      {mod.manifest.description}
                    </span>
                  </span>
                  {pinnedModuleIds.includes(mod.manifest.id) && (
                    <Icon name="pin" size={12} className={selected ? 'text-white/55' : 'text-[var(--color-text-tertiary)]'} />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
