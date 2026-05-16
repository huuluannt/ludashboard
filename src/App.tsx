import { useEffect, useState } from 'react';
import { setupModules } from '@/modules/setup';
import { useTabStore } from '@/state/tabStore';
import { useSidebarStore } from '@/state/sidebarStore';
import { useUserStore } from '@/state/userStore';
import { useModuleStore } from '@/state/moduleStore';
import { initSyncManager } from '@/firebase/syncManager';
import { moduleRegistry } from '@/modules/moduleRegistry';
import IframeModule from '@/modules/IframeModule';
import AppShell from '@/app/AppShell';
import InstallPrompt from '@/components/InstallPrompt';
import OfflineIndicator from '@/components/OfflineIndicator';
import UpdatePrompt from '@/components/UpdatePrompt';
import SyncIndicator from '@/components/SyncIndicator';

/**
 * Root App component.
 *
 * 1. Registers all modules into the registry
 * 2. Hydrates persisted state from IndexedDB
 * 3. Renders the AppShell + PWA overlays once ready
 */
export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Register built-in modules
    setupModules();

    // Init sync manager listeners
    initSyncManager();

    // Hydrate stores from IndexedDB
    Promise.all([
      useTabStore.getState().hydrate(),
      useSidebarStore.getState().hydrate(),
      useUserStore.getState().hydrate(),
      useModuleStore.getState().hydrate(),
    ]).then(() => {
      // Register imported modules dynamically
      const imported = useModuleStore.getState().importedModules;
      imported.forEach((mod) => {
        if (!moduleRegistry.has(mod.id)) {
          moduleRegistry.register({
            manifest: mod,
            component: () => <IframeModule url={mod.url} />,
          });
        }
      });
      setReady(true);
    });
  }, []);

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
      <InstallPrompt />
      <OfflineIndicator />
      <SyncIndicator />
    </>
  );
}
