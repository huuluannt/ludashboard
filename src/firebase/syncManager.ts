import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db, app } from './config';
import { useUserStore } from '@/state/userStore';
import { useSidebarStore } from '@/state/sidebarStore';
import { useTabStore } from '@/state/tabStore';
import { useModuleStore } from '@/state/moduleStore';
import { useSyncStore } from '@/state/syncStore';
import { offlineStorage } from '@/storage/offlineStorage';

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let isInitialSync = true;

const mergeState = (remote: any) => {
  if (remote.importedModules) {
    useModuleStore.setState({ importedModules: remote.importedModules });
    offlineStorage.setImportedModules(remote.importedModules);
  }
  if (remote.pinnedModuleIds) {
    useSidebarStore.setState({ pinnedModuleIds: remote.pinnedModuleIds });
    offlineStorage.setPinned(remote.pinnedModuleIds);
  }
  if (remote.openTabs) {
    useTabStore.setState({ tabs: remote.openTabs });
    offlineStorage.setTabs(remote.openTabs);
  }
  if (remote.activeTabId !== undefined) {
    useTabStore.setState({ activeTabId: remote.activeTabId });
    offlineStorage.setActiveTab(remote.activeTabId);
  }
  if (remote.sidebarCollapsed !== undefined) {
    useSidebarStore.setState({ collapsed: remote.sidebarCollapsed });
    offlineStorage.setSidebarCollapsed(remote.sidebarCollapsed);
  }
};

const getLocalState = () => {
  return {
    importedModules: useModuleStore.getState().importedModules,
    pinnedModuleIds: useSidebarStore.getState().pinnedModuleIds,
    openTabs: useTabStore.getState().tabs,
    activeTabId: useTabStore.getState().activeTabId,
    sidebarCollapsed: useSidebarStore.getState().collapsed,
    updatedAt: serverTimestamp(),
  };
};

export const syncToCloud = async () => {
  const user = useUserStore.getState().user;
  if (!user || !navigator.onLine) return;
  
  useSyncStore.getState().setStatus('syncing');
  try {
    const docRef = doc(db, 'users', user.id, 'workspace', 'config');
    await setDoc(docRef, getLocalState(), { merge: true });
    useSyncStore.getState().setStatus('synced');
  } catch (error) {
    console.error('Failed to sync to cloud', error);
    useSyncStore.getState().setStatus('error', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const fetchCloudConfig = async () => {
  const user = useUserStore.getState().user;
  if (!user || !navigator.onLine) return;

  useSyncStore.getState().setStatus('syncing');
  try {
    const docRef = doc(db, 'users', user.id, 'workspace', 'config');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      mergeState(snapshot.data());
    }
    useSyncStore.getState().setStatus('synced');
  } catch (error) {
    console.error('Failed to fetch from cloud', error);
    useSyncStore.getState().setStatus('error', error instanceof Error ? error.message : 'Unknown error');
  }
};

export const queueSync = () => {
  if (isInitialSync) return; // Don't sync up before we've downloaded
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    syncToCloud();
  }, 2000); // debounce 2s
};

export const initSyncManager = () => {
  let hydrated = false;
  let authReady = false;
  const auth = getAuth(app);

  const checkHydrated = () => {
    const u = useUserStore.getState()._hydrated;
    const s = useSidebarStore.getState()._hydrated;
    const t = useTabStore.getState()._hydrated;
    const m = useModuleStore.getState()._hydrated;
    
    // We must wait for ALL local stores to hydrate AND Firebase Auth to resolve
    if (u && s && t && m && authReady && !hydrated) {
      hydrated = true;
      if (useUserStore.getState().user) {
        fetchCloudConfig().then(() => {
          isInitialSync = false;
        });
      } else {
        isInitialSync = false;
      }
    }
  };

  onAuthStateChanged(auth, (firebaseUser) => {
    authReady = true;
    // If Firebase says we are logged out, but local storage says we are logged in,
    // we should clear local storage to prevent permission errors.
    const localUser = useUserStore.getState().user;
    if (!firebaseUser && localUser && localUser.id !== 'demo-user') {
      useUserStore.getState().signOut();
    }
    checkHydrated();
  });

  useUserStore.subscribe((state, prevState) => {
    checkHydrated();
    if (state.user?.id !== prevState.user?.id) {
      if (state.user) {
        isInitialSync = true;
        fetchCloudConfig().then(() => {
          isInitialSync = false;
        });
      }
    }
  });

  useSidebarStore.subscribe(() => { checkHydrated(); queueSync(); });
  useTabStore.subscribe(() => { checkHydrated(); queueSync(); });
  useModuleStore.subscribe(() => { checkHydrated(); queueSync(); });
};
