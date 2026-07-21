import { useEffect, useState } from 'react';
import { getAuth, signOut as firebaseSignOut } from 'firebase/auth';
import { setupModules } from '@/modules/setup';
import { useTabStore } from '@/state/tabStore';
import { useSidebarStore } from '@/state/sidebarStore';
import { useUserStore } from '@/state/userStore';
import { useModuleStore } from '@/state/moduleStore';
import { useRightCornerSidebarStore } from '@/state/rightCornerSidebarStore';
import { useRightSidebarStore } from '@/state/rightSidebarStore';
import { useThemeStore } from '@/state/themeStore';
import { initSyncManager, waitForInitialCloudSync } from '@/firebase/syncManager';
import { app } from '@/firebase/config';
import { offlineStorage } from '@/storage/offlineStorage';
import { moduleRegistry } from '@/modules/moduleRegistry';
import { createTabFromModule } from '@/modules/openModule';
import { syncRegistryWithModuleStore } from '@/modules/registryRuntime';
import AppShell from '@/app/AppShell';
import OfflineIndicator from '@/components/OfflineIndicator';
import UpdatePrompt from '@/components/UpdatePrompt';
import SyncIndicator from '@/components/SyncIndicator';
import Icon from '@/components/Icon';
import { useGlobalHotkeys } from '@/hooks/useGlobalHotkeys';

let storeHydrationPromise: Promise<void> | null = null;

/**
 * Root App component.
 *
 * 1. Registers all modules into the registry
 * 2. Hydrates persisted state from IndexedDB
 * 3. Renders the AppShell + PWA overlays once ready
 */
export default function App() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [ownershipBlocked, setOwnershipBlocked] = useState(false);
  useGlobalHotkeys();

  useEffect(() => {
    let cancelled = false;
    let ownershipCheck = 0;

    const refreshOwnershipBlock = async () => {
      const check = ++ownershipCheck;
      let owner: string | null;
      try {
        owner = await offlineStorage.getWorkspaceOwner();
      } catch (error) {
        console.error('Failed to verify local workspace ownership', error);
        if (!cancelled) setLoadError(true);
        return;
      }
      if (cancelled || check !== ownershipCheck) return;
      const user = useUserStore.getState().user;
      setOwnershipBlocked(Boolean(
        owner && user && user.id !== 'demo-user' && owner !== user.id,
      ));
    };

    // Register built-in modules
    setupModules();

    // Init sync manager listeners
    const disposeSyncManager = initSyncManager();
    const unsubscribeUser = useUserStore.subscribe(() => {
      // Fail closed during an account transition; IndexedDB ownership lookup is
      // asynchronous and the previous account's workspace must not stay editable.
      setOwnershipBlocked(true);
      void refreshOwnershipBlock();
    });

    // Hydrate stores from IndexedDB
    hydrateStores().then(async () => {
      // Do not make the workspace editable until the first cloud read finishes.
      // This prevents a slow remote hydration from overwriting a fresh local edit.
      await waitForInitialCloudSync();
      await refreshOwnershipBlock();
      if (cancelled) return;
      const moduleState = useModuleStore.getState();
      syncRegistryWithModuleStore(moduleState.importedModules, moduleState.moduleOverrides);
      pruneMissingModuleReferences();

      const requestedModuleId = new URLSearchParams(window.location.search).get('module');
      if (requestedModuleId) {
        const requestedModule = moduleRegistry.get(requestedModuleId);
        if (requestedModule) {
          useTabStore.getState().openTab(createTabFromModule(requestedModule));
          const url = new URL(window.location.href);
          url.searchParams.delete('module');
          window.history.replaceState(null, '', url);
        }
      }

      setReady(true);
    }).catch((error) => {
      console.error('Failed to hydrate workspace', error);
      if (!cancelled) setLoadError(true);
    });

    return () => {
      cancelled = true;
      ownershipCheck += 1;
      unsubscribeUser();
      disposeSyncManager();
    };
  }, []);

  if (ownershipBlocked) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3 text-center px-6 max-w-md">
          <Icon name="shield" size={26} className="text-[var(--color-warning)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Local workspace belongs to another account.</span>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Sign in with the original account in this browser profile. Cloud access is blocked to prevent mixing account data.
          </p>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium cursor-pointer"
            onClick={() => {
              useUserStore.getState().signOut();
              void firebaseSignOut(getAuth(app));
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <Icon name="hard-drive" size={24} className="text-[var(--color-danger)]" />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Could not load the local workspace.</span>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-xs font-medium cursor-pointer"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center animate-pulse">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="text-xs text-[var(--color-text-tertiary)]">Loading workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell />
      {/* PWA overlays */}
      <UpdatePrompt />
      <OfflineIndicator />
      <SyncIndicator />
    </>
  );
}

function hydrateStores() {
  if (!storeHydrationPromise) {
    const hydration = Promise.all([
      useTabStore.getState().hydrate(),
      useSidebarStore.getState().hydrate(),
      useUserStore.getState().hydrate(),
      useModuleStore.getState().hydrate(),
      useRightSidebarStore.getState().hydrate(),
      useRightCornerSidebarStore.getState().hydrate(),
      useThemeStore.getState().hydrate(),
    ]).then(() => undefined);
    storeHydrationPromise = hydration.catch((error) => {
      storeHydrationPromise = null;
      throw error;
    });
  }
  return storeHydrationPromise;
}

function pruneMissingModuleReferences() {
  const tabState = useTabStore.getState();
  const sidebarState = useSidebarStore.getState();
  const missingIds = new Set<string>();

  tabState.tabs.forEach((tab) => {
    if (!moduleRegistry.has(tab.moduleId)) missingIds.add(tab.moduleId);
  });
  sidebarState.pinnedModuleIds.forEach((id) => {
    if (!moduleRegistry.has(id)) missingIds.add(id);
  });
  sidebarState.moduleOrderIds.forEach((id) => {
    if (!moduleRegistry.has(id)) missingIds.add(id);
  });
  if (sidebarState.pickedModuleId && !moduleRegistry.has(sidebarState.pickedModuleId)) {
    missingIds.add(sidebarState.pickedModuleId);
  }

  missingIds.forEach((id) => {
    tabState.closeTab(id);
    sidebarState.removeModuleReferences(id);
  });
}
