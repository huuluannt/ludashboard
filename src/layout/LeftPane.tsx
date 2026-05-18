import { useState, useRef, useEffect, useMemo } from 'react';
import type { DragEvent, KeyboardEvent, SyntheticEvent } from 'react';
import { useSidebarStore } from '@/state/sidebarStore';
import { useTabStore } from '@/state/tabStore';
import { useUserStore } from '@/state/userStore';
import { moduleRegistry } from '@/modules/moduleRegistry';
import { useModuleStore } from '@/state/moduleStore';
import type { ImportedModule } from '@/state/moduleStore';
import Icon from '@/components/Icon';
import ImportModuleModal from '@/components/ImportModuleModal';
import MiniMusicPlayer from '@/components/lumusic/MiniMusicPlayer';
import LuVideoMiniPlayer from '@/components/luvideo/LuVideoMiniPlayer';
import type { EditableModule } from '@/components/ImportModuleModal';
import { openModuleFromShell } from '@/modules/openModule';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { app } from '@/firebase/config';

const HOME_URL = 'https://ludashboard.vercel.app/';
const SIDEBAR_EXPANDED_WIDTH = 264;
const SIDEBAR_COLLAPSED_WIDTH = 56;
const VIETNAMESE_DAYS = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export default function LeftPane() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const searchQuery = useSidebarStore((s) => s.searchQuery);
  const setSearchQuery = useSidebarStore((s) => s.setSearchQuery);
  const pinnedModuleIds = useSidebarStore((s) => s.pinnedModuleIds);
  const moduleOrderIds = useSidebarStore((s) => s.moduleOrderIds);
  const togglePin = useSidebarStore((s) => s.togglePin);
  const setModuleOrder = useSidebarStore((s) => s.setModuleOrder);
  const removeModuleReferences = useSidebarStore((s) => s.removeModuleReferences);

  const openTab = useTabStore((s) => s.openTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const tabs = useTabStore((s) => s.tabs);

  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const setUser = useUserStore((s) => s.setUser);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<EditableModule | null>(null);
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [showAllModules, setShowAllModules] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);

  const importedModules = useModuleStore((s) => s.importedModules);
  const registryVersion = useModuleStore((s) => s.registryVersion);
  const removeModule = useModuleStore((s) => s.removeModule);

  const [time, setTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const yy = now.getFullYear().toString().slice(-2);
      const mm = (now.getMonth() + 1).toString().padStart(2, '0');
      const dd = now.getDate().toString().padStart(2, '0');
      const hh = now.getHours().toString().padStart(2, '0');
      const min = now.getMinutes().toString().padStart(2, '0');
      setTime(`${yy}${mm}${dd} ${VIETNAMESE_DAYS[now.getDay()]} ${hh}:${min}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (searchAreaRef.current && !searchAreaRef.current.contains(event.target as Node)) {
        setSearchOverlayOpen(false);
      }
    };

    if (searchOverlayOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOverlayOpen]);

  const allModules = useMemo(() => moduleRegistry.getAll(), [registryVersion]);
  const hasLuMusicTab = tabs.some((tab) => tab.moduleId === 'lumusic');
  const hasLuVideoTab = tabs.some((tab) => tab.moduleId === 'luvideo');

  const importedModuleMap = useMemo(
    () => new Map(importedModules.map((m) => [m.id, m])),
    [importedModules],
  );

  const orderedModules = useMemo(() => {
    const orderIndex = new Map(moduleOrderIds.map((id, index) => [id, index]));
    return [...allModules].sort((a, b) => {
      const aIndex = orderIndex.get(a.manifest.id);
      const bIndex = orderIndex.get(b.manifest.id);

      if (aIndex != null && bIndex != null) return aIndex - bIndex;
      if (aIndex != null) return -1;
      if (bIndex != null) return 1;
      return 0;
    });
  }, [allModules, moduleOrderIds]);

  const pinnedModules = useMemo(
    () => orderedModules.filter((mod) => pinnedModuleIds.includes(mod.manifest.id)),
    [orderedModules, pinnedModuleIds],
  );

  const unpinnedModules = useMemo(
    () => orderedModules.filter((mod) => !pinnedModuleIds.includes(mod.manifest.id)),
    [orderedModules, pinnedModuleIds],
  );

  const sidebarModules = useMemo(() => {
    if (collapsed) return pinnedModules.length > 0 ? pinnedModules : orderedModules;
    return showAllModules ? [...pinnedModules, ...unpinnedModules] : pinnedModules;
  }, [collapsed, orderedModules, pinnedModules, showAllModules, unpinnedModules]);

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

  useEffect(() => {
    setSelectedSearchIndex(0);
  }, [searchQuery, searchResults.length]);

  const searchOverlayVisible = searchOverlayOpen && searchQuery.trim().length > 0;

  const handleLogoReload = () => {
    if (window.location.href === HOME_URL) {
      window.location.reload();
      return;
    }
    window.location.assign(HOME_URL);
  };

  const handleOpenModule = (mod: (typeof allModules)[0]) => {
    openModuleFromShell(mod, importedModules, openTab);
  };

  const handleOpenSearchResult = (mod: (typeof allModules)[0]) => {
    handleOpenModule(mod);
    setSearchOverlayOpen(false);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOverlayOpen(false);
      setSearchQuery('');
      searchInputRef.current?.blur();
    }
  };

  const handleEditModule = (mod: (typeof allModules)[0], importedMod: ImportedModule | null) => {
    setEditingModule(
      importedMod
        ? {
            ...importedMod,
            isImported: true,
          }
        : {
            ...mod.manifest,
            isImported: false,
          },
    );
    setImportModalOpen(true);
  };

  const handleDeleteModule = (id: string) => {
    removeModule(id);
    moduleRegistry.unregister(id);
    closeTab(id);
    removeModuleReferences(id);
  };

  const handleReorderModules = (targetModuleId: string) => {
    if (!draggedModuleId || draggedModuleId === targetModuleId) return;

    const draggedIsPinned = pinnedModuleIds.includes(draggedModuleId);
    const targetIsPinned = pinnedModuleIds.includes(targetModuleId);
    if (draggedIsPinned !== targetIsPinned) return;

    const currentOrder = orderedModules.map((mod) => mod.manifest.id);
    const from = currentOrder.indexOf(draggedModuleId);
    const to = currentOrder.indexOf(targetModuleId);
    if (from === -1 || to === -1) return;

    const nextOrder = [...currentOrder];
    const [moved] = nextOrder.splice(from, 1);
    nextOrder.splice(to, 0, moved);
    setModuleOrder(nextOrder);
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const auth = getAuth(app);
      const userCredential = await signInWithPopup(auth, provider);
      const fbUser = userCredential.user;

      setUser({
        id: fbUser.uid,
        name: fbUser.displayName || 'Lu User',
        email: fbUser.email || '',
        picture: fbUser.photoURL || '',
      });
    } catch (err) {
      console.error('Failed to authenticate with Firebase', err);
    }
  };

  return (
    <aside
      className={`
        sidebar-transition flex flex-col h-full
        bg-[var(--color-surface-subtle)] border-r border-[var(--color-border-subtle)]
        select-none overflow-hidden flex-shrink-0
      `}
      style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
    >
      {/* ─── Brand Area ─── */}
      <div className={`flex items-center h-14 px-3 gap-2.5 flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        {!collapsed ? (
          <>
            <button
              type="button"
              onClick={handleLogoReload}
              className="flex items-center gap-2.5 min-w-0 rounded-xl -ml-1 px-1 py-1 hover:bg-[var(--color-surface-muted)] active:scale-[0.98] transition-all cursor-pointer"
              title="Reload LuDashboard"
            >
              <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
                <Icon name="boxes" size={21} className="text-white" strokeWidth={2.35} />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-sm font-semibold text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden">
                  LuDashboard
                </span>
                <span className="text-[10px] text-[var(--color-accent)] tracking-widest font-mono">
                  {time}
                </span>
              </div>
            </button>
            <div className="flex-1" />
            <button
              onClick={toggleCollapsed}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-muted)] transition-colors cursor-pointer flex-shrink-0"
              title="Collapse sidebar"
            >
              <Icon name="chevron-left" size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={toggleCollapsed}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-white border border-[var(--color-border)] shadow-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)] transition-all cursor-pointer flex-shrink-0"
            title="Expand sidebar"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        )}
      </div>

      {/* ─── Search ─── */}
      {!collapsed && (
        <div className="px-3 pb-2 flex-shrink-0">
          <div className="relative" ref={searchAreaRef}>
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOverlayOpen(Boolean(e.target.value.trim()));
              }}
              onFocus={(e) => {
                e.currentTarget.select();
                if (e.currentTarget.value.trim()) setSearchOverlayOpen(true);
              }}
              onClick={(e) => {
                e.currentTarget.select();
                if (e.currentTarget.value.trim()) setSearchOverlayOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              className="
                w-full h-8 pl-8 pr-7 rounded-lg
                bg-[var(--color-surface-muted)] border border-black/35
                text-xs text-[var(--color-text-primary)]
                placeholder:text-[var(--color-text-tertiary)]
                focus:outline-none focus:border-black focus:bg-white
                transition-colors shadow-sm
              "
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOverlayOpen(false);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
                title="Clear search"
              >
                <Icon name="x" size={12} />
              </button>
            )}
            {searchOverlayVisible && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[50vh] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white p-1.5 shadow-xl">
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
        </div>
      )}

      {/* ─── Module Card List ─── */}
      {!collapsed && (
        <div className="px-3 pb-2 flex-shrink-0">
          <button
            onClick={() => {
              setEditingModule(null);
              setImportModalOpen(true);
            }}
            className="
              w-full h-9 px-3 rounded-xl
              flex items-center gap-2.5
              border border-dashed border-[var(--color-border)]
              bg-white text-xs font-medium text-[var(--color-text-secondary)]
              hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]
              hover:bg-[var(--color-surface-muted)] transition-colors
              cursor-pointer
            "
          >
            <Icon name="plus" size={14} />
            <span>Import Module</span>
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        {!collapsed && (
          <div className="flex items-center px-2 pt-4 pb-2">
            <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              {showAllModules ? 'All Modules' : 'Pinned'}
            </span>
            <button
              type="button"
              onClick={() => setShowAllModules((value) => !value)}
              className="ml-auto rounded-md px-1.5 py-1 text-[11px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-white"
            >
              {showAllModules ? 'Pinned' : 'View All'}
            </button>
          </div>
        )}

        {sidebarModules.length === 0 && !collapsed ? (
          <div className="mx-2 rounded-xl border border-dashed border-[var(--color-border)] px-3 py-5 text-center">
            <p className="text-[11px] leading-5 text-[var(--color-text-tertiary)]">
              No pinned modules yet. Use View All and pin your favorites.
            </p>
          </div>
        ) : null}

        {sidebarModules.map((mod) => (
          <ModuleCard
            key={mod.manifest.id}
            mod={mod}
            collapsed={collapsed}
            isPinned={pinnedModuleIds.includes(mod.manifest.id)}
            importedMod={importedModuleMap.get(mod.manifest.id) ?? null}
            isDragging={draggedModuleId === mod.manifest.id}
            onOpen={() => handleOpenModule(mod)}
            onTogglePin={() => togglePin(mod.manifest.id)}
            onDragStart={() => setDraggedModuleId(mod.manifest.id)}
            onDragEnd={() => setDraggedModuleId(null)}
            onDrop={() => handleReorderModules(mod.manifest.id)}
            onEdit={(importedMod) => handleEditModule(mod, importedMod)}
            onDelete={handleDeleteModule}
          />
        ))}
      </div>

      {/* ─── Account Area ─── */}
      {hasLuMusicTab && !collapsed && <MiniMusicPlayer />}
      {hasLuVideoTab && !collapsed && <LuVideoMiniPlayer />}

      <div className="flex-shrink-0 border-t border-[var(--color-border-subtle)] relative" ref={dropdownRef}>
        {/* Upward dropdown */}
        {dropdownOpen && !collapsed && (
          <div className="dropdown-up-enter absolute bottom-full left-2 right-2 mb-1 bg-white rounded-xl border border-[var(--color-border)] shadow-lg z-50 py-1">
            <DropdownItem icon="settings" label="Settings" onClick={() => setDropdownOpen(false)} />
            <DropdownItem icon="palette" label="Theme" onClick={() => setDropdownOpen(false)} />
            <DropdownItem icon="keyboard" label="Keyboard Shortcuts" onClick={() => setDropdownOpen(false)} />
            <div className="mx-2 my-1 border-b border-[var(--color-border-subtle)]" />
            <DropdownItem
              icon="log-out"
              label="Sign Out"
              onClick={() => {
                signOut();
                firebaseSignOut(getAuth(app)).catch(console.error);
                setDropdownOpen(false);
              }}
              danger
            />
          </div>
        )}

        <button
          onClick={() => {
            if (!user) {
              handleGoogleLogin();
            } else {
              setDropdownOpen((p) => !p);
            }
          }}
          className="
            w-full flex items-center gap-2.5 px-3 py-3
            hover:bg-[var(--color-surface-muted)] transition-colors
            cursor-pointer
          "
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-[var(--color-surface-muted)] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-full h-full object-cover" />
            ) : (
              <Icon name="user" size={15} className="text-[var(--color-text-tertiary)]" />
            )}
          </div>
          {!collapsed && (
            <div className="flex-1 text-left overflow-hidden">
              {user ? (
                <>
                  <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{user.name}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{user.email}</p>
                </>
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)]">Sign in with Google</p>
              )}
            </div>
          )}
        </button>
      </div>

      {importModalOpen && (
        <ImportModuleModal
          onClose={() => setImportModalOpen(false)}
          editingModule={editingModule}
        />
      )}
    </aside>
  );
}

/* ─── Module Card subcomponent ─── */

interface ModuleCardProps {
  mod: ReturnType<typeof moduleRegistry.getAll>[0];
  collapsed: boolean;
  isPinned: boolean;
  importedMod: ImportedModule | null;
  isDragging: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onEdit: (mod: ImportedModule | null) => void;
  onDelete: (id: string) => void;
}

function ModuleCard({
  mod,
  collapsed,
  isPinned,
  importedMod,
  isDragging,
  onOpen,
  onTogglePin,
  onDragStart,
  onDragEnd,
  onDrop,
  onEdit,
  onDelete,
}: ModuleCardProps) {
  const [hovering, setHovering] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isImported = importedMod != null;

  const stopCardAction = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  const isCardAction = (target: EventTarget | null) => {
    return target instanceof HTMLElement && target.closest('[data-card-action]') != null;
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleDragStart = (e: DragEvent) => {
    if (isCardAction(e.target)) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', mod.manifest.id);
    onDragStart();
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    onDrop();
    onDragEnd();
  };

  const handleDragEnd = () => {
    setDragOver(false);
    onDragEnd();
  };

  if (collapsed) {
    return (
      <button
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onClick={onOpen}
        title={mod.manifest.title}
        className={`
          w-full flex items-center justify-center py-2
          rounded-xl module-card cursor-grab active:cursor-grabbing
          ${isDragging ? 'opacity-45' : ''}
          ${dragOver ? 'bg-[var(--color-surface-muted)]' : ''}
        `}
      >
        <div className="w-8 h-8 rounded-lg bg-white border border-[var(--color-border-subtle)] flex items-center justify-center">
          <Icon name={mod.manifest.icon} size={20} className="text-[var(--color-text-secondary)]" />
        </div>
      </button>
    );
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      className={`
        module-card flex items-center gap-2.5 px-2 py-1.5 rounded-xl
        cursor-grab active:cursor-grabbing group transition-all
        ${isDragging ? 'opacity-45' : ''}
        ${dragOver ? 'bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-accent)]/25' : ''}
      `}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={(e) => {
        if (!isCardAction(e.target)) onOpen();
      }}
    >
      <div className="w-8 h-8 rounded-lg bg-white border border-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <Icon name={mod.manifest.icon} size={20} className="text-[var(--color-text-secondary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{mod.manifest.title}</p>
        <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{mod.manifest.description}</p>
      </div>
      {/* More button (visible on hover) */}
      <div
        className={`flex items-center gap-0.5 flex-shrink-0 transition-opacity ${
          hovering ? 'opacity-100' : 'opacity-0'
        }`}
        data-card-action
        onMouseDown={stopCardAction}
        onPointerDown={stopCardAction}
      >
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen(p => !p);
            }}
            onMouseDown={stopCardAction}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
            title="More options"
          >
            <Icon name="more-horizontal" size={12} />
          </button>
          {dropdownOpen && (
            <div
              className="absolute top-full right-0 mt-1 w-36 bg-white rounded-xl border border-[var(--color-border)] shadow-lg z-50 py-1"
              onMouseDown={stopCardAction}
              onClick={stopCardAction}
            >
              <DropdownItem
                icon="pin"
                label={isPinned ? 'Unpin' : 'Pin'}
                onClick={() => {
                  setDropdownOpen(false);
                  onTogglePin();
                }}
              />
              <DropdownItem
                icon="edit"
                label="Edit"
                onClick={() => {
                  onEdit(importedMod);
                  setDropdownOpen(false);
                }}
              />
              {isImported && (
                <>
                  <div className="mx-2 my-1 border-b border-[var(--color-border-subtle)]" />
                  <DropdownItem
                    icon="trash"
                    label="Delete"
                    danger
                    onClick={() => {
                      setDropdownOpen(false);
                      onDelete(mod.manifest.id);
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Dropdown item subcomponent ─── */

function DropdownItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        w-full flex items-center gap-2.5 px-3 py-2 text-xs
        transition-colors cursor-pointer
        ${
          danger
            ? 'text-[var(--color-danger)] hover:bg-red-50'
            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]'
        }
      `}
    >
      <Icon name={icon} size={14} className={danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'} />
      {label}
    </button>
  );
}

function normalizeForSearch(value: string) {
  return value
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSearchTerms(value: string) {
  return value.split(' ').map((term) => term.trim()).filter(Boolean);
}

function getSearchScore(text: string, query: string) {
  const originalText = text.toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
  const originalQuery = query.toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
  const normalizedText = normalizeForSearch(text);
  const normalizedQuery = normalizeForSearch(query);

  if (!normalizedQuery) return 1;

  let score = 0;
  const exactPhraseIndex = originalText.indexOf(originalQuery);
  const foldedPhraseIndex = normalizedText.indexOf(normalizedQuery);

  if (exactPhraseIndex >= 0) {
    score = Math.max(score, 1000 - exactPhraseIndex);
  }

  if (foldedPhraseIndex >= 0) {
    score = Math.max(score, 800 - foldedPhraseIndex);
  }

  const originalTerms = getSearchTerms(originalQuery);
  const normalizedTerms = getSearchTerms(normalizedQuery);
  const exactTermMatches = originalTerms.filter((term) => originalText.includes(term)).length;
  const foldedTermMatches = normalizedTerms.filter((term) => normalizedText.includes(term)).length;

  if (originalTerms.length > 0 && exactTermMatches === originalTerms.length) {
    score = Math.max(score, 650 + exactTermMatches * 10);
  }

  if (normalizedTerms.length > 0 && foldedTermMatches === normalizedTerms.length) {
    score = Math.max(score, 500 + foldedTermMatches * 10);
  }

  if (foldedTermMatches > 0) {
    score = Math.max(score, foldedTermMatches * 100);
  }

  return score;
}
