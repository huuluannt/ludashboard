import { useState, useRef, useEffect, useMemo } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useSidebarStore } from '@/state/sidebarStore';
import { useTabStore } from '@/state/tabStore';
import { useUserStore } from '@/state/userStore';
import { moduleRegistry } from '@/modules/moduleRegistry';
import { fetchGoogleUserInfo } from '@/auth/googleAuth';
import Icon from '@/components/Icon';
import ImportModuleModal from '@/components/ImportModuleModal';

export default function LeftPane() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const searchQuery = useSidebarStore((s) => s.searchQuery);
  const setSearchQuery = useSidebarStore((s) => s.setSearchQuery);
  const pinnedModuleIds = useSidebarStore((s) => s.pinnedModuleIds);
  const togglePin = useSidebarStore((s) => s.togglePin);

  const openTab = useTabStore((s) => s.openTab);

  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);
  const setUser = useUserStore((s) => s.setUser);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

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

  const allModules = moduleRegistry.getAll();

  // Filter & sort: pinned first, then search
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = allModules;
    if (q) {
      list = list.filter(
        (m) =>
          m.manifest.title.toLowerCase().includes(q) ||
          m.manifest.category.toLowerCase().includes(q) ||
          m.manifest.description.toLowerCase().includes(q),
      );
    }
    const pinned = list.filter((m) => pinnedModuleIds.includes(m.manifest.id));
    const unpinned = list.filter((m) => !pinnedModuleIds.includes(m.manifest.id));
    return { pinned, unpinned };
  }, [allModules, searchQuery, pinnedModuleIds]);

  const handleOpenModule = (mod: (typeof allModules)[0]) => {
    openTab({
      moduleId: mod.manifest.id,
      title: mod.manifest.title,
      icon: mod.manifest.icon,
    });
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const userInfo = await fetchGoogleUserInfo(tokenResponse.access_token);
        setUser(userInfo);
      } catch (err) {
        console.error('Failed to fetch user info', err);
        // Fallback to demo login if Google Auth is misconfigured
        setUser({ id: 'demo-user', name: 'Lu Dashboard', email: 'lu@dashboard.dev', picture: '' });
      }
    },
    onError: () => {
      console.error('Login Failed');
      // Fallback to demo login if it fails
      setUser({ id: 'demo-user', name: 'Lu Dashboard', email: 'lu@dashboard.dev', picture: '' });
    },
  });

  return (
    <aside
      className={`
        sidebar-transition flex flex-col h-full
        bg-[var(--color-surface-subtle)] border-r border-[var(--color-border-subtle)]
        select-none overflow-hidden flex-shrink-0
      `}
      style={{ width: collapsed ? 60 : 260 }}
    >
      {/* ─── Brand Area ─── */}
      <div className={`flex items-center h-14 px-3 gap-2.5 flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        {!collapsed ? (
          <>
            <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
              <Icon name="boxes" size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden">
              LuDashboard
            </span>
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
          <div className="relative">
            <Icon
              name="search"
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
            />
            <input
              type="text"
              placeholder="Search modules…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                w-full h-8 pl-8 pr-3 rounded-lg
                bg-[var(--color-surface-muted)] border border-transparent
                text-xs text-[var(--color-text-primary)]
                placeholder:text-[var(--color-text-tertiary)]
                focus:outline-none focus:border-[var(--color-accent)]
                transition-colors
              "
            />
          </div>
        </div>
      )}

      {/* ─── Module Card List ─── */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        {/* Pinned section */}
        {filtered.pinned.length > 0 && (
          <>
            {!collapsed && (
              <div className="px-2 pt-1 pb-1.5">
                <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  Pinned
                </span>
              </div>
            )}
            {filtered.pinned.map((mod) => (
              <ModuleCard
                key={mod.manifest.id}
                mod={mod}
                collapsed={collapsed}
                isPinned
                onOpen={() => handleOpenModule(mod)}
                onTogglePin={() => togglePin(mod.manifest.id)}
              />
            ))}
            {!collapsed && <div className="mx-2 my-1.5 border-b border-[var(--color-border-subtle)]" />}
          </>
        )}

        {/* Unpinned section */}
        {!collapsed && filtered.unpinned.length > 0 && filtered.pinned.length > 0 && (
          <div className="px-2 pt-1 pb-1.5">
            <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              All Modules
            </span>
          </div>
        )}
        {filtered.unpinned.map((mod) => (
          <ModuleCard
            key={mod.manifest.id}
            mod={mod}
            collapsed={collapsed}
            isPinned={false}
            onOpen={() => handleOpenModule(mod)}
            onTogglePin={() => togglePin(mod.manifest.id)}
          />
        ))}

        {/* Install Module button */}
        {!collapsed && (
          <button
            onClick={() => setImportModalOpen(true)}
            className="
              w-full mt-1 px-3 py-2 rounded-xl
              flex items-center gap-2.5
              text-xs text-[var(--color-text-tertiary)]
              hover:bg-[var(--color-surface-muted)] transition-colors
              cursor-pointer
            "
          >
            <div className="w-7 h-7 rounded-lg border border-dashed border-[var(--color-border)] flex items-center justify-center">
              <Icon name="plus" size={13} />
            </div>
            <span>Import Module</span>
          </button>
        )}
      </div>

      {/* ─── Account Area ─── */}
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

      {importModalOpen && <ImportModuleModal onClose={() => setImportModalOpen(false)} />}
    </aside>
  );
}

/* ─── Module Card subcomponent ─── */

interface ModuleCardProps {
  mod: ReturnType<typeof moduleRegistry.getAll>[0];
  collapsed: boolean;
  isPinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
}

function ModuleCard({ mod, collapsed, isPinned, onOpen, onTogglePin }: ModuleCardProps) {
  const [hovering, setHovering] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={onOpen}
        title={mod.manifest.title}
        className="
          w-full flex items-center justify-center py-2
          rounded-xl module-card cursor-pointer
        "
      >
        <div className="w-8 h-8 rounded-lg bg-white border border-[var(--color-border-subtle)] flex items-center justify-center">
          <Icon name={mod.manifest.icon} size={15} className="text-[var(--color-text-secondary)]" />
        </div>
      </button>
    );
  }

  return (
    <div
      className="module-card flex items-center gap-2.5 px-2 py-1.5 rounded-xl cursor-pointer group"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={onOpen}
    >
      <div className="w-8 h-8 rounded-lg bg-white border border-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <Icon name={mod.manifest.icon} size={15} className="text-[var(--color-text-secondary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{mod.manifest.title}</p>
        <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{mod.manifest.description}</p>
      </div>
      {/* Pin & more buttons (visible on hover) */}
      <div
        className={`flex items-center gap-0.5 flex-shrink-0 transition-opacity ${
          hovering ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
            isPinned
              ? 'text-[var(--color-accent)]'
              : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
          }`}
          title={isPinned ? 'Unpin' : 'Pin'}
        >
          <Icon name="pin" size={12} />
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer"
          title="More options"
        >
          <Icon name="more-horizontal" size={12} />
        </button>
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
      onClick={onClick}
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
