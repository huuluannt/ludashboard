import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent, SyntheticEvent } from 'react';
import Icon from '@/components/Icon';
import ImportModuleModal from '@/components/ImportModuleModal';
import type { EditableModule } from '@/components/ImportModuleModal';
import LuVideoMiniPlayer from '@/components/luvideo/LuVideoMiniPlayer';
import MiniMusicPlayer from '@/components/lumusic/MiniMusicPlayer';
import { app } from '@/firebase/config';
import { getSearchScore } from '@/lib/moduleSearch';
import { moduleRegistry } from '@/modules/moduleRegistry';
import type { ModuleManifest, RegisteredModule, TabItem } from '@/modules/moduleTypes';
import { getDashboardModuleUrl, getExternalModuleUrl, openModuleFromShell } from '@/modules/openModule';
import { useModuleStore } from '@/state/moduleStore';
import type { ImportedModule } from '@/state/moduleStore';
import { useSidebarStore } from '@/state/sidebarStore';
import { useTabStore } from '@/state/tabStore';
import { useUserStore } from '@/state/userStore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';

const HOME_URL = 'https://ludashboard.vercel.app/';
const SIDEBAR_EXPANDED_WIDTH = 264;
const SIDEBAR_COLLAPSED_WIDTH = 56;
const VIETNAMESE_DAYS = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

type SidebarModule = RegisteredModule;

export default function LeftPane() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const pinnedModuleIds = useSidebarStore((s) => s.pinnedModuleIds);
  const moduleOrderIds = useSidebarStore((s) => s.moduleOrderIds);
  const togglePin = useSidebarStore((s) => s.togglePin);
  const setModuleOrder = useSidebarStore((s) => s.setModuleOrder);
  const removeModuleReferences = useSidebarStore((s) => s.removeModuleReferences);

  const activeTabId = useTabStore((s) => s.activeTabId);
  const closeTab = useTabStore((s) => s.closeTab);
  const openTab = useTabStore((s) => s.openTab);
  const reorderTabs = useTabStore((s) => s.reorderTabs);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const tabs = useTabStore((s) => s.tabs);

  const importedModules = useModuleStore((s) => s.importedModules);
  const registryVersion = useModuleStore((s) => s.registryVersion);
  const removeModule = useModuleStore((s) => s.removeModule);

  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const signOut = useUserStore((s) => s.signOut);

  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const allFilterInputRef = useRef<HTMLInputElement>(null);

  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [allFilterQuery, setAllFilterQuery] = useState('');
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<EditableModule | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedFilterIndex, setSelectedFilterIndex] = useState(0);
  const [showAllModules, setShowAllModules] = useState(false);
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
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setAccountDropdownOpen(false);
      }
    };

    if (accountDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [accountDropdownOpen]);

  const allModules = useMemo(() => moduleRegistry.getAll(), [registryVersion]);
  const importedModuleMap = useMemo(() => new Map(importedModules.map((mod) => [mod.id, mod])), [importedModules]);
  const hasLuMusicTab = tabs.some((tab) => tab.moduleId === 'lumusic');
  const hasLuVideoTab = tabs.some((tab) => tab.moduleId === 'luvideo');

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

  const allModulesForSidebar = useMemo(() => {
    const combined = [...pinnedModules, ...unpinnedModules];
    const query = allFilterQuery.trim();
    if (!query) return combined;

    return combined
      .map((mod, index) => ({
        mod,
        index,
        score: getSearchScore(`${mod.manifest.title} ${mod.manifest.category} ${mod.manifest.description}`, query),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.mod);
  }, [allFilterQuery, pinnedModules, unpinnedModules]);

  const openTabItems = useMemo(
    () =>
      tabs.map((tab) => ({
        tab,
        manifest: moduleRegistry.get(tab.moduleId)?.manifest,
      })),
    [registryVersion, tabs],
  );

  useEffect(() => {
    setSelectedFilterIndex(0);
  }, [allFilterQuery, allModulesForSidebar.length, showAllModules]);

  const handleLogoReload = () => {
    if (window.location.href === HOME_URL) {
      window.location.reload();
      return;
    }

    window.location.assign(HOME_URL);
  };

  const handleOpenModule = (mod: SidebarModule) => {
    openModuleFromShell(mod, importedModules, openTab);
  };

  const handleOpenModuleInNewWindow = (mod: SidebarModule) => {
    const url = getExternalModuleUrl(mod, importedModules) ?? getDashboardModuleUrl(mod.manifest.id);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleAllFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedFilterIndex((index) => Math.min(index + 1, Math.max(0, allModulesForSidebar.length - 1)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedFilterIndex((index) => Math.max(0, index - 1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selectedModule = allModulesForSidebar[selectedFilterIndex] ?? allModulesForSidebar[0];
      if (selectedModule) handleOpenModule(selectedModule);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setAllFilterQuery('');
      allFilterInputRef.current?.blur();
    }
  };

  const handleEditModule = (mod: SidebarModule, importedMod: ImportedModule | null) => {
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

  const handleReorderTabs = (targetModuleId: string) => {
    if (!draggedTabId || draggedTabId === targetModuleId) return;

    const from = tabs.findIndex((tab) => tab.moduleId === draggedTabId);
    const to = tabs.findIndex((tab) => tab.moduleId === targetModuleId);
    if (from === -1 || to === -1) return;

    reorderTabs(from, to);
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

  const openModuleBrowser = () => {
    setShowAllModules(true);
    window.setTimeout(() => allFilterInputRef.current?.focus(), 0);
  };

  return (
    <aside
      className="
        sidebar-transition flex flex-col h-full
        bg-[var(--color-surface-subtle)] border-r border-[var(--color-border-subtle)]
        select-none overflow-hidden flex-shrink-0
      "
      style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
    >
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

      {!collapsed && (
        <div className="flex-shrink-0 px-1.5 py-1">
          <div className="flex items-center px-2 pb-2 pt-2">
            <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              {showAllModules ? 'Modules' : 'Open'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (showAllModules) {
                  setShowAllModules(false);
                  setAllFilterQuery('');
                } else {
                  openModuleBrowser();
                }
              }}
              className="ml-auto rounded-md px-1.5 py-1 text-[11px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-white"
            >
              {showAllModules ? 'Open' : 'Modules'}
            </button>
          </div>

          {showAllModules && (
            <div className="px-2 pb-2">
            <div className="relative">
              <Icon
                name="search"
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
              />
              <input
                ref={allFilterInputRef}
                type="text"
                value={allFilterQuery}
                onChange={(event) => setAllFilterQuery(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onClick={(event) => event.currentTarget.select()}
                onKeyDown={handleAllFilterKeyDown}
                placeholder="Filter modules..."
                className="
                  h-8 w-full rounded-lg border border-black/35
                  bg-[var(--color-surface-muted)] pl-8 pr-7
                  text-xs text-[var(--color-text-primary)]
                  placeholder:text-[var(--color-text-tertiary)]
                  shadow-sm transition-colors
                  focus:border-black focus:bg-white focus:outline-none
                "
              />
              {allFilterQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setAllFilterQuery('');
                    allFilterInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
                  title="Clear filter"
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        {collapsed ? (
          openTabItems.map(({ tab, manifest }) => (
            <OpenModuleCard
              key={tab.moduleId}
              tab={tab}
              manifest={manifest}
              collapsed
              active={tab.moduleId === activeTabId}
              isDragging={draggedTabId === tab.moduleId}
              onOpen={() => setActiveTab(tab.moduleId)}
              onClose={() => closeTab(tab.moduleId)}
              onDragStart={() => setDraggedTabId(tab.moduleId)}
              onDragEnd={() => setDraggedTabId(null)}
              onDrop={() => handleReorderTabs(tab.moduleId)}
            />
          ))
        ) : showAllModules ? (
          <>
            {allModulesForSidebar.length === 0 ? (
              <div className="mx-2 rounded-xl border border-dashed border-[var(--color-border)] px-3 py-5 text-center">
                <p className="text-[11px] leading-5 text-[var(--color-text-tertiary)]">
                  No modules match this filter.
                </p>
              </div>
            ) : null}

            {allModulesForSidebar.map((mod) => (
              <ModuleCard
                key={mod.manifest.id}
                mod={mod}
                collapsed={false}
                isPinned={pinnedModuleIds.includes(mod.manifest.id)}
                isSelected={allModulesForSidebar[selectedFilterIndex]?.manifest.id === mod.manifest.id}
                importedMod={importedModuleMap.get(mod.manifest.id) ?? null}
                isDragging={draggedModuleId === mod.manifest.id}
                onOpen={() => handleOpenModule(mod)}
                onOpenNewWindow={() => handleOpenModuleInNewWindow(mod)}
                onTogglePin={() => togglePin(mod.manifest.id)}
                onDragStart={() => setDraggedModuleId(mod.manifest.id)}
                onDragEnd={() => setDraggedModuleId(null)}
                onDrop={() => handleReorderModules(mod.manifest.id)}
                onEdit={(importedMod) => handleEditModule(mod, importedMod)}
                onDelete={handleDeleteModule}
              />
            ))}
          </>
        ) : (
          <>
            {openTabItems.length === 0 ? (
              <div className="mx-2 rounded-xl border border-dashed border-[var(--color-border)] px-3 py-5 text-center">
                <p className="text-[11px] leading-5 text-[var(--color-text-tertiary)]">
                  No open modules. Use search or Modules to open one.
                </p>
              </div>
            ) : null}

            {openTabItems.map(({ tab, manifest }) => (
              <OpenModuleCard
                key={tab.moduleId}
                tab={tab}
                manifest={manifest}
                active={tab.moduleId === activeTabId}
                isDragging={draggedTabId === tab.moduleId}
                onOpen={() => setActiveTab(tab.moduleId)}
                onClose={() => closeTab(tab.moduleId)}
                onDragStart={() => setDraggedTabId(tab.moduleId)}
                onDragEnd={() => setDraggedTabId(null)}
                onDrop={() => handleReorderTabs(tab.moduleId)}
              />
            ))}
          </>
        )}
      </div>

      {hasLuMusicTab && !collapsed && <MiniMusicPlayer onClose={() => closeTab('lumusic')} />}
      {hasLuVideoTab && !collapsed && <LuVideoMiniPlayer onClose={() => closeTab('luvideo')} />}

      <div className="flex-shrink-0 border-t border-[var(--color-border-subtle)] relative" ref={accountDropdownRef}>
        {accountDropdownOpen && !collapsed && (
          <div className="dropdown-up-enter absolute bottom-full left-2 right-2 mb-1 bg-white rounded-xl border border-[var(--color-border)] shadow-lg z-50 py-1">
            <DropdownItem icon="settings" label="Settings" onClick={() => setAccountDropdownOpen(false)} />
            <DropdownItem icon="palette" label="Theme" onClick={() => setAccountDropdownOpen(false)} />
            <DropdownItem icon="keyboard" label="Keyboard Shortcuts" onClick={() => setAccountDropdownOpen(false)} />
            <div className="mx-2 my-1 border-b border-[var(--color-border-subtle)]" />
            <DropdownItem
              icon="log-out"
              label="Sign Out"
              onClick={() => {
                signOut();
                firebaseSignOut(getAuth(app)).catch(console.error);
                setAccountDropdownOpen(false);
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
              setAccountDropdownOpen((open) => !open);
            }
          }}
          className="
            w-full flex items-center gap-2.5 px-3 py-3
            hover:bg-[var(--color-surface-muted)] transition-colors
            cursor-pointer
          "
        >
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

interface OpenModuleCardProps {
  tab: TabItem;
  manifest?: ModuleManifest;
  active: boolean;
  collapsed?: boolean;
  isDragging: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

function OpenModuleCard({
  tab,
  manifest,
  active,
  collapsed = false,
  isDragging,
  onOpen,
  onClose,
  onDragStart,
  onDragEnd,
  onDrop,
}: OpenModuleCardProps) {
  const [dragOver, setDragOver] = useState(false);

  const isCardAction = (target: EventTarget | null) => {
    return target instanceof HTMLElement && target.closest('[data-open-card-action]') != null;
  };

  const handleDragStart = (event: DragEvent) => {
    if (isCardAction(event.target)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tab.moduleId);
    onDragStart();
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
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
        type="button"
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onClick={onOpen}
        title={tab.title}
        className={`w-full flex items-center justify-center py-2 rounded-xl module-card cursor-grab active:cursor-grabbing ${
          isDragging ? 'opacity-45' : ''
        } ${dragOver ? 'bg-[var(--color-surface-muted)]' : ''}`}
      >
        <div
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
            active
              ? 'bg-[var(--color-text-primary)] border-[var(--color-text-primary)] text-white'
              : 'bg-white border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]'
          }`}
        >
          <Icon name={tab.icon} size={20} />
        </div>
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`module-card flex items-center gap-2.5 px-2 py-1.5 rounded-xl cursor-grab active:cursor-grabbing group transition-all ${
        active ? 'bg-white ring-1 ring-black/10 shadow-sm' : 'hover:bg-white/70'
      } ${isDragging ? 'opacity-45' : ''} ${dragOver ? 'ring-1 ring-[var(--color-accent)]/25 bg-[var(--color-surface-muted)]' : ''}`}
    >
      <div className="w-8 h-8 rounded-lg bg-white border border-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <Icon name={tab.icon} size={20} className="text-[var(--color-text-secondary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{tab.title}</p>
        <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">
          {manifest?.description ?? 'Open module'}
        </p>
      </div>
      <button
        type="button"
        data-open-card-action
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className={`w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)] transition-all cursor-pointer ${
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        title="Close module"
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

interface ModuleCardProps {
  mod: SidebarModule;
  collapsed: boolean;
  isPinned: boolean;
  isSelected?: boolean;
  importedMod: ImportedModule | null;
  isDragging: boolean;
  onOpen: () => void;
  onOpenNewWindow: () => void;
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
  isSelected = false,
  importedMod,
  isDragging,
  onOpen,
  onOpenNewWindow,
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

  const stopCardAction = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const isCardAction = (target: EventTarget | null) => {
    return target instanceof HTMLElement && target.closest('[data-card-action]') != null;
  };

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const handleDragStart = (event: DragEvent) => {
    if (isCardAction(event.target)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', mod.manifest.id);
    onDragStart();
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
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
      role="button"
      tabIndex={0}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !isCardAction(event.target)) {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`
        module-card flex items-center gap-2.5 px-2 py-1.5 rounded-xl
        cursor-grab active:cursor-grabbing group transition-all
        ${isDragging ? 'opacity-45' : ''}
        ${isSelected ? 'bg-white ring-1 ring-black/15 shadow-sm' : ''}
        ${dragOver ? 'bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-accent)]/25' : ''}
      `}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={(event) => {
        if (!isCardAction(event.target)) onOpen();
      }}
    >
      <div className="w-8 h-8 rounded-lg bg-white border border-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <Icon name={mod.manifest.icon} size={20} className="text-[var(--color-text-secondary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{mod.manifest.title}</p>
        <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{mod.manifest.description}</p>
      </div>
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
            onClick={(event) => {
              event.stopPropagation();
              setDropdownOpen((open) => !open);
            }}
            onMouseDown={stopCardAction}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
            title="More options"
          >
            <Icon name="more-horizontal" size={12} />
          </button>
          {dropdownOpen && (
            <div
              className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl border border-[var(--color-border)] shadow-lg z-50 py-1"
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
                icon="external-link"
                label="Open in New Window"
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenNewWindow();
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
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
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
      <Icon
        name={icon}
        size={14}
        className={danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]'}
      />
      {label}
    </button>
  );
}
