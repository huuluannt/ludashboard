import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db, app } from './config';
import { useUserStore } from '@/state/userStore';
import { getViewportSidebarCollapsed, useSidebarStore } from '@/state/sidebarStore';
import { useTabStore } from '@/state/tabStore';
import { useModuleStore } from '@/state/moduleStore';
import type { ImportedModule, ModuleOverride } from '@/state/moduleStore';
import { useRightSidebarStore } from '@/state/rightSidebarStore';
import { useRightCornerSidebarStore } from '@/state/rightCornerSidebarStore';
import { isThemeMode, useThemeStore } from '@/state/themeStore';
import { useSyncStore } from '@/state/syncStore';
import { offlineStorage } from '@/storage/offlineStorage';
import { syncRegistryWithModuleStore } from '@/modules/registryRuntime';
import { moduleRegistry } from '@/modules/moduleRegistry';
import type { TabItem } from '@/modules/moduleTypes';
import {
  getModuleIconFallback,
  getUtf8ByteSize,
  isEmbeddedModuleIcon,
  normalizeModuleIcon,
} from '@/lib/moduleIcon';
import {
  estimateFirestoreDocumentBytes,
  estimateFirestoreValueBytes,
  MAX_CONFIG_ESTIMATED_BYTES,
  MAX_WORKSPACE_STATE_BYTES,
  normalizeFirestoreData,
} from './cloudDocumentBudget';
import { assertWorkspaceOwnership, WorkspaceOwnershipError } from './workspaceOwnership';
import { rebaseWorkspaceState, toWorkspaceBase } from './workspaceMerge';

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let isInitialSync = true;
let syncInFlight: Promise<void> | null = null;
let syncRequestedWhileRunning = false;
let managerCleanup: (() => void) | null = null;
let changeRevision = 0;
let syncedRevision = 0;
let latestFetchAttempt = 0;
let initialSyncReadyPromise: Promise<void> = Promise.resolve();
let remoteApplyDepth = 0;
let syncRetryTimeout: ReturnType<typeof setTimeout> | null = null;
let syncRetryDelayMs = 5_000;
let syncRetryAttemptCount = 0;
let workspaceDirtyPersistence: Promise<void> = Promise.resolve();
let workspaceRevisionPersistence: Promise<void> = Promise.resolve();
let workspaceBasePersistence: Promise<void> = Promise.resolve();
let lastKnownWorkspaceRevision: string | null = null;
let requestWorkspaceConflictRecovery: ((userId: string) => void) | null = null;

type CloudImportedModule = ImportedModule & { iconLocalOnly?: boolean };
type CloudModuleOverride = ModuleOverride & { iconLocalOnly?: boolean };
type FetchContext = { userId: string; attempt: number; baselineRevision: number };
type MergeStrategy = 'remote' | 'union' | 'local';
type WriteWorkspaceOptions = {
  context?: FetchContext;
  expectedRevision?: string | null;
};
type WorkspaceBudgetState = {
  importedModules: CloudImportedModule[];
  moduleOverrides: CloudModuleOverride[];
  pinnedModuleIds: string[];
  moduleOrderIds: string[];
  openTabs: TabItem[];
  [key: string]: unknown;
};

export function waitForInitialCloudSync() {
  return initialSyncReadyPromise;
}

const mergeState = async (
  remote: Record<string, unknown>,
  mergeStrategy: MergeStrategy | (() => MergeStrategy) = 'remote',
  context?: FetchContext,
) => {
  const isCurrent = () => !context || isFetchContextCurrent(context);
  const getMergeStrategy = () => typeof mergeStrategy === 'function'
    ? mergeStrategy()
    : mergeStrategy;
  let moduleStateChanged = false;

  if (Array.isArray(remote.importedModules)) {
    const normalizedModules = await normalizeImportedModules(remote.importedModules);
    if (!isCurrent()) return false;
    const strategy = getMergeStrategy();
    const localModules = useModuleStore.getState().importedModules;
    const importedModules = strategy === 'local'
      ? localModules
      : strategy === 'union'
        ? mergeRecordsById(normalizedModules, localModules)
        : normalizedModules;
    applyRemoteStateMutation(() => {
      useModuleStore.setState((state) => ({
        importedModules,
        registryVersion: state.registryVersion + 1,
      }));
    });
    await offlineStorage.setImportedModules(importedModules);
    if (!isCurrent()) return false;
    moduleStateChanged = true;
  }

  if (Array.isArray(remote.moduleOverrides)) {
    const normalizedOverrides = await normalizeModuleOverrides(remote.moduleOverrides);
    if (!isCurrent()) return false;
    const strategy = getMergeStrategy();
    const localOverrides = useModuleStore.getState().moduleOverrides;
    const moduleOverrides = strategy === 'local'
      ? localOverrides
      : strategy === 'union'
        ? mergeRecordsById(normalizedOverrides, localOverrides)
        : normalizedOverrides;
    applyRemoteStateMutation(() => {
      useModuleStore.setState((state) => ({
        moduleOverrides,
        registryVersion: state.registryVersion + 1,
      }));
    });
    await offlineStorage.setModuleOverrides(moduleOverrides);
    if (!isCurrent()) return false;
    moduleStateChanged = true;
  }

  if (moduleStateChanged) {
    const moduleState = useModuleStore.getState();
    syncRegistryWithModuleStore(moduleState.importedModules, moduleState.moduleOverrides);
  }

  if (Array.isArray(remote.pinnedModuleIds)) {
    const remotePinnedIds = normalizeIdList(remote.pinnedModuleIds);
    const strategy = getMergeStrategy();
    const localPinnedIds = useSidebarStore.getState().pinnedModuleIds;
    const pinnedModuleIds = strategy === 'local'
      ? localPinnedIds
      : strategy === 'union'
        ? mergeIdLists(localPinnedIds, remotePinnedIds)
        : remotePinnedIds;
    if (!isCurrent()) return false;
    applyRemoteStateMutation(() => useSidebarStore.setState({ pinnedModuleIds }));
    await offlineStorage.setPinned(pinnedModuleIds);
    if (!isCurrent()) return false;
  }
  if (Array.isArray(remote.moduleOrderIds)) {
    const remoteOrderIds = normalizeIdList(remote.moduleOrderIds);
    const strategy = getMergeStrategy();
    const localOrderIds = useSidebarStore.getState().moduleOrderIds;
    const moduleOrderIds = strategy === 'local'
      ? localOrderIds
      : strategy === 'union'
        ? mergeIdLists(localOrderIds, remoteOrderIds)
        : remoteOrderIds;
    if (!isCurrent()) return false;
    applyRemoteStateMutation(() => useSidebarStore.setState({ moduleOrderIds }));
    await offlineStorage.setModuleOrder(moduleOrderIds);
    if (!isCurrent()) return false;
  }
  if (Array.isArray(remote.openTabs)) {
    const remoteTabs = normalizeCloudTabs(remote.openTabs).map((tab) => {
      const manifest = moduleRegistry.get(tab.moduleId)?.manifest;
      return manifest ? { ...tab, title: manifest.title, icon: manifest.icon } : tab;
    });
    const strategy = getMergeStrategy();
    const localTabs = useTabStore.getState().tabs;
    const openTabs = strategy === 'local'
      ? localTabs
      : strategy === 'union'
        ? mergeTabs(localTabs, remoteTabs)
        : remoteTabs;
    if (!isCurrent()) return false;
    applyRemoteStateMutation(() => useTabStore.setState({ tabs: openTabs }));
    await offlineStorage.setTabs(openTabs);
    if (!isCurrent()) return false;
  }
  const activeTabMergeStrategy = getMergeStrategy();
  if (
    (
      activeTabMergeStrategy === 'remote' ||
      (activeTabMergeStrategy === 'union' && useTabStore.getState().activeTabId === null)
    ) &&
    (remote.activeTabId === null || typeof remote.activeTabId === 'string')
  ) {
    if (!isCurrent()) return false;
    applyRemoteStateMutation(() => useTabStore.setState({ activeTabId: remote.activeTabId as string | null }));
    await offlineStorage.setActiveTab(remote.activeTabId);
    if (!isCurrent()) return false;
  }
  if (getMergeStrategy() === 'remote' && typeof remote.sidebarCollapsed === 'boolean') {
    const collapsed = getViewportSidebarCollapsed(remote.sidebarCollapsed);
    if (!isCurrent()) return false;
    applyRemoteStateMutation(() => useSidebarStore.setState({ collapsed }));
    await offlineStorage.setSidebarCollapsed(collapsed);
    if (!isCurrent()) return false;
  }
  const remoteRightSidebar = remote.rightSidebar;
  if (getMergeStrategy() === 'remote' && isRecord(remoteRightSidebar)) {
    if (!isCurrent()) return false;
    applyRemoteStateMutation(() => useRightSidebarStore.getState().syncFromCloud(remoteRightSidebar));
  }
  const remoteRightCornerSidebar = remote.rightCornerSidebar;
  if (getMergeStrategy() === 'remote' && isRecord(remoteRightCornerSidebar)) {
    if (!isCurrent()) return false;
    applyRemoteStateMutation(() => useRightCornerSidebarStore.getState().syncFromCloud(remoteRightCornerSidebar));
  }
  const remoteThemeMode = remote.themeMode;
  if (getMergeStrategy() === 'remote' && isThemeMode(remoteThemeMode)) {
    if (!isCurrent()) return false;
    applyRemoteStateMutation(() => useThemeStore.getState().setMode(remoteThemeMode));
  }
  return isCurrent();
};

async function buildCloudWorkspaceState() {
  const moduleState = useModuleStore.getState();
  const [importedModules, moduleOverrides] = await Promise.all([
    prepareImportedModulesForCloud(moduleState.importedModules),
    prepareModuleOverridesForCloud(moduleState.moduleOverrides),
  ]);

  const state = {
    syncSchemaVersion: 2,
    importedModules,
    moduleOverrides,
    pinnedModuleIds: normalizeIdList(useSidebarStore.getState().pinnedModuleIds),
    moduleOrderIds: normalizeIdList(useSidebarStore.getState().moduleOrderIds),
    // Module metadata is the canonical source for custom icons. Keeping only a
    // compact fallback in tabs avoids storing every embedded icon twice.
    openTabs: useTabStore.getState().tabs.map(sanitizeTabForCloud),
    activeTabId: normalizeNullableId(useTabStore.getState().activeTabId),
    sidebarCollapsed: useSidebarStore.getState().collapsed,
    rightSidebar: {
      enabled: useRightSidebarStore.getState().enabled,
      visible: useRightSidebarStore.getState().visible,
      moduleId: useRightSidebarStore.getState().moduleId,
    },
    rightCornerSidebar: {
      enabled: useRightCornerSidebarStore.getState().enabled,
      visible: useRightCornerSidebarStore.getState().visible,
      moduleId: useRightCornerSidebarStore.getState().moduleId,
    },
    themeMode: useThemeStore.getState().mode,
  };

  enforceWorkspaceBudget(state);
  return state;
}

async function writeWorkspaceDocument(userId: string, options: WriteWorkspaceOptions = {}) {
  const { context } = options;
  const isCurrent = () => context ? isFetchContextCurrent(context) : isCurrentSyncUser(userId);
  if (!isCurrent()) return false;
  await assertWorkspaceOwnership(userId, true);
  if (!isCurrent()) return false;
  const hasExpectedRevision = Object.prototype.hasOwnProperty.call(options, 'expectedRevision');
  const expectedRevision = hasExpectedRevision
    ? options.expectedRevision ?? null
    : lastKnownWorkspaceRevision ?? await offlineStorage.getWorkspaceRevision();
  if (!isCurrent()) return false;
  const nextRevision = crypto.randomUUID();
  const workspaceState = {
    ...await buildCloudWorkspaceState(),
    syncRevision: nextRevision,
  };
  if (!isCurrent()) return false;
  const docRef = doc(db, 'users', userId, 'workspace', 'config');
  let wroteDocument = false;

  await runTransaction(db, async (transaction) => {
    wroteDocument = false;
    const snapshot = await transaction.get(docRef);
    if (!isCurrent()) return;
    const currentDocument = snapshot.data() ?? {};
    const currentRevision = typeof currentDocument.syncRevision === 'string'
      ? currentDocument.syncRevision
      : null;
    if (currentRevision !== expectedRevision) throw new WorkspaceConflictError();
    const moduleData = normalizeFirestoreData(currentDocument.moduleData ?? {});
    fitWorkspaceIconsToDocumentBudget(workspaceState, moduleData);
    const documentState = {
      ...workspaceState,
      moduleData,
      updatedAt: serverTimestamp(),
    };
    const estimatedDocument = {
      ...workspaceState,
      moduleData,
      updatedAt: new Date(),
    };
    if (estimateFirestoreDocumentBytes(estimatedDocument) > MAX_CONFIG_ESTIMATED_BYTES) {
      throw new CloudCapacityError();
    }
    // Replace with the canonical schema so stale legacy blob fields cannot keep
    // an otherwise compact document above Firestore's size limit.
    transaction.set(docRef, documentState);
    wroteDocument = true;
  });
  if (wroteDocument) {
    lastKnownWorkspaceRevision = nextRevision;
    await Promise.all([
      persistWorkspaceRevision(nextRevision),
      persistWorkspaceBase(toWorkspaceBase(workspaceState)),
    ]);
  }
  return wroteDocument;
}

async function performSyncToCloud() {
  const user = useUserStore.getState().user;
  if (!user || !navigator.onLine || !isCurrentSyncUser(user.id)) return;
  const revisionToSync = changeRevision;

  useSyncStore.getState().setStatus('syncing');
  try {
    const wroteDocument = await writeWorkspaceDocument(user.id);
    if (wroteDocument && isCurrentSyncUser(user.id)) {
      syncedRevision = Math.max(syncedRevision, revisionToSync);
      clearSyncRetry();
      if (changeRevision <= syncedRevision) {
        await persistWorkspaceDirty(false);
        if (changeRevision <= syncedRevision) {
          useSyncStore.getState().setStatus('synced');
        } else {
          syncRequestedWhileRunning = true;
        }
      } else {
        syncRequestedWhileRunning = true;
      }
    }
  } catch (error) {
    if (!isCurrentSyncUser(user.id)) return;
    if (error instanceof WorkspaceConflictError) {
      // A different device won the optimistic transaction. Refetch its state,
      // rebase the pending local changes, and retry instead of permanently
      // parking an otherwise syncable workspace in local-only mode.
      useSyncStore.getState().setStatus('syncing');
      requestWorkspaceConflictRecovery?.(user.id);
      return;
    }
    console.error('Failed to sync to cloud', error);
    if (
      error instanceof CloudCapacityError ||
      error instanceof WorkspaceOwnershipError ||
      isFirestoreCapacityError(error)
    ) {
      useSyncStore.getState().setStatus(
        'local-only',
        error instanceof Error ? error.message : 'Cloud workspace is at capacity. Changes remain stored locally.',
      );
    } else {
      useSyncStore.getState().setStatus('error', error instanceof Error ? error.message : 'Unknown error');
      scheduleSyncRetry();
    }
  }
}

export const syncToCloud = async () => {
  if (syncInFlight) {
    syncRequestedWhileRunning = true;
    await syncInFlight;
    return;
  }

  do {
    syncRequestedWhileRunning = false;
    const currentSync = performSyncToCloud();
    syncInFlight = currentSync;
    try {
      await currentSync;
    } finally {
      if (syncInFlight === currentSync) syncInFlight = null;
    }
  } while (syncRequestedWhileRunning);
};

const fetchCloudConfig = async (context: FetchContext, hasPendingLocalChanges: boolean) => {
  const { userId } = context;
  if (!navigator.onLine || !isFetchContextCurrent(context)) return false;

  useSyncStore.getState().setStatus('syncing');
  try {
    await assertWorkspaceOwnership(userId);
    if (!isFetchContextCurrent(context)) return false;
    const persistedWorkspaceDirty = await offlineStorage.getWorkspaceDirty();
    if (!isFetchContextCurrent(context)) return false;
    const localWorkspaceRevision = lastKnownWorkspaceRevision ?? await offlineStorage.getWorkspaceRevision();
    lastKnownWorkspaceRevision = localWorkspaceRevision;
    if (!isFetchContextCurrent(context)) return false;
    const docRef = doc(db, 'users', userId, 'workspace', 'config');
    const snapshot = await getDoc(docRef);
    if (!isFetchContextCurrent(context)) return false;
    const snapshotData = snapshot.data();
    const remoteWorkspaceRevision = typeof snapshotData?.syncRevision === 'string'
      ? snapshotData.syncRevision
      : null;
    const needsRebase =
      (hasPendingLocalChanges || persistedWorkspaceDirty) &&
      remoteWorkspaceRevision !== localWorkspaceRevision &&
      (remoteWorkspaceRevision !== null || localWorkspaceRevision !== null);
    let remoteIsCanonical = false;
    const remoteState = snapshotData ?? {};
    if (snapshot.exists()) {
      const isLegacyDocument = remoteState.syncSchemaVersion !== 2;
      remoteIsCanonical = !isLegacyDocument && remoteWorkspaceRevision !== null;
      let stateToMerge = remoteState;
      let mergeStrategy: MergeStrategy | (() => MergeStrategy) = () => {
        if (
          hasPendingLocalChanges ||
          persistedWorkspaceDirty ||
          changeRevision > context.baselineRevision
        ) return 'local';
        if (isLegacyDocument && hasMeaningfulLocalWorkspace()) return 'union';
        return 'remote';
      };

      if (needsRebase) {
        const localState = await buildCloudWorkspaceState();
        if (!isFetchContextCurrent(context)) return false;
        const workspaceBase = await offlineStorage.getWorkspaceBase();
        if (!isFetchContextCurrent(context)) return false;
        stateToMerge = rebaseWorkspaceState(workspaceBase, localState, remoteState);
        mergeStrategy = 'remote';
      }
      const merged = await mergeState(
        stateToMerge,
        mergeStrategy,
        context,
      );
      if (!merged) return false;
    }
    if (!isFetchContextCurrent(context)) return false;

    const hasLocalChangesNow =
      hasPendingLocalChanges ||
      persistedWorkspaceDirty ||
      changeRevision > context.baselineRevision;
    if (remoteIsCanonical && !hasLocalChangesNow && remoteWorkspaceRevision) {
      const cleanHydrationRevision = changeRevision;
      // A clean schema-v2 hydration is already canonical. Rewriting it would
      // rotate the revision on every page load and make concurrent clean tabs
      // conflict with each other for no reason.
      lastKnownWorkspaceRevision = remoteWorkspaceRevision;
      await Promise.all([
        persistWorkspaceRevision(remoteWorkspaceRevision),
        persistWorkspaceBase(toWorkspaceBase(remoteState)),
      ]);
      if (changeRevision === cleanHydrationRevision) {
        await persistWorkspaceDirty(false);
      }
      if (!isFetchContextCurrent(context)) return false;
      syncedRevision = Math.max(syncedRevision, cleanHydrationRevision);
      useSyncStore.getState().setStatus(
        changeRevision <= syncedRevision ? 'synced' : 'syncing',
      );
      return true;
    }

    // Rewrite migrations, new workspaces, and genuinely dirty local state.
    // This replaces legacy base64 icons and removes stale blob-bearing fields.
    const revisionToSync = changeRevision;
    const wroteDocument = await writeWorkspaceDocument(userId, {
      context,
      expectedRevision: remoteWorkspaceRevision,
    });
    if (wroteDocument && isFetchContextCurrent(context)) {
      syncedRevision = Math.max(syncedRevision, revisionToSync);
      clearSyncRetry();
      if (changeRevision <= syncedRevision) await persistWorkspaceDirty(false);
      if (!isFetchContextCurrent(context)) return false;
      useSyncStore.getState().setStatus(changeRevision <= syncedRevision ? 'synced' : 'syncing');
      return true;
    }
    return false;
  } catch (error) {
    if (error instanceof WorkspaceConflictError && isFetchContextCurrent(context)) {
      // Whether the conflict came from a clean migration or a dirty rebase,
      // another writer merely won this round. The fetch retry will rebase on
      // that winning revision; no user data needs to become local-only.
      useSyncStore.getState().setStatus('syncing');
      return false;
    }
    console.error('Failed to fetch or migrate cloud config', error);
    if (!isFetchContextCurrent(context)) return false;
    if (
      error instanceof CloudCapacityError ||
      error instanceof WorkspaceOwnershipError ||
      isFirestoreCapacityError(error)
    ) {
      useSyncStore.getState().setStatus(
        'local-only',
        error instanceof Error ? error.message : 'Cloud workspace is at capacity. Changes remain stored locally.',
      );
    } else {
      useSyncStore.getState().setStatus('error', error instanceof Error ? error.message : 'Unknown error');
    }
    return false;
  }
};

export const queueSync = () => {
  if (remoteApplyDepth > 0) return;
  changeRevision += 1;
  void persistWorkspaceDirty(true);
  clearSyncRetry();
  if (isInitialSync || !navigator.onLine) return;
  schedulePendingSync(2_000);
};

function persistWorkspaceDirty(dirty: boolean) {
  workspaceDirtyPersistence = workspaceDirtyPersistence
    .catch(() => undefined)
    .then(() => offlineStorage.setWorkspaceDirty(dirty))
    .catch((error) => {
      console.error('Failed to persist workspace sync state', error);
    });
  return workspaceDirtyPersistence;
}

function persistWorkspaceRevision(revision: string) {
  workspaceRevisionPersistence = workspaceRevisionPersistence
    .catch(() => undefined)
    .then(() => offlineStorage.setWorkspaceRevision(revision))
    .catch((error) => {
      console.error('Failed to persist workspace revision', error);
    });
  return workspaceRevisionPersistence;
}

function persistWorkspaceBase(workspaceBase: Record<string, unknown>) {
  workspaceBasePersistence = workspaceBasePersistence
    .catch(() => undefined)
    .then(() => offlineStorage.setWorkspaceBase(workspaceBase))
    .catch((error) => {
      console.error('Failed to persist workspace merge base', error);
    });
  return workspaceBasePersistence;
}

function applyRemoteStateMutation(mutate: () => void) {
  remoteApplyDepth += 1;
  try {
    mutate();
  } finally {
    remoteApplyDepth -= 1;
  }
}

function clearPendingSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = null;
}

function schedulePendingSync(delayMs: number) {
  if (isInitialSync || !navigator.onLine || changeRevision <= syncedRevision) return;
  clearPendingSync();
  syncTimeout = setTimeout(() => {
    syncTimeout = null;
    void syncToCloud();
  }, delayMs);
}

function clearSyncRetry() {
  if (syncRetryTimeout) clearTimeout(syncRetryTimeout);
  syncRetryTimeout = null;
  syncRetryDelayMs = 5_000;
  syncRetryAttemptCount = 0;
}

function scheduleSyncRetry() {
  if (
    syncRetryTimeout ||
    syncRetryAttemptCount >= 5 ||
    !managerCleanup ||
    isInitialSync ||
    !navigator.onLine ||
    changeRevision <= syncedRevision
  ) return;

  const delayMs = syncRetryDelayMs;
  syncRetryDelayMs = Math.min(syncRetryDelayMs * 2, 60_000);
  syncRetryTimeout = setTimeout(() => {
    syncRetryTimeout = null;
    syncRetryAttemptCount += 1;
    void syncToCloud();
  }, delayMs);
}

export const initSyncManager = () => {
  if (managerCleanup) return managerCleanup;

  let hydrated = false;
  let authReady = false;
  let disposed = false;
  let activeFetchUserId: string | null = null;
  let activeFetchPromise: Promise<boolean> | null = null;
  let fetchRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  let fetchAttemptCount = 0;
  let automaticFetchRetryCount = 0;
  let fetchRetryDelayMs = 5_000;
  let initialReadySettled = false;
  let resolveInitialReady: (() => void) | null = null;
  let unsubscribeWorkspaceSnapshot: (() => void) | null = null;
  let workspaceSnapshotUserId: string | null = null;
  let workspaceSnapshotGeneration = 0;
  let workspaceSnapshotChain: Promise<void> = Promise.resolve();
  const auth = getAuth(app);
  initialSyncReadyPromise = new Promise<void>((resolve) => {
    resolveInitialReady = resolve;
  });

  const settleInitialReady = () => {
    if (initialReadySettled) return;
    initialReadySettled = true;
    resolveInitialReady?.();
    resolveInitialReady = null;
  };

  const clearFetchRetry = () => {
    if (fetchRetryTimeout) clearTimeout(fetchRetryTimeout);
    fetchRetryTimeout = null;
  };

  const resetFetchRetryBackoff = () => {
    automaticFetchRetryCount = 0;
    fetchRetryDelayMs = 5_000;
  };

  const scheduleFetchRetry = (userId: string, delayOverrideMs?: number) => {
    if (
      disposed ||
      fetchRetryTimeout ||
      automaticFetchRetryCount >= 5 ||
      !navigator.onLine ||
      !isCurrentSyncUser(userId)
    ) return;
    const delayMs = delayOverrideMs ?? fetchRetryDelayMs;
    fetchRetryTimeout = setTimeout(() => {
      fetchRetryTimeout = null;
      automaticFetchRetryCount += 1;
      fetchRetryDelayMs = Math.min(fetchRetryDelayMs * 2, 80_000);
      beginInitialFetch(userId, true);
    }, delayMs);
  };

  const stopWorkspaceSubscription = () => {
    workspaceSnapshotGeneration += 1;
    workspaceSnapshotUserId = null;
    unsubscribeWorkspaceSnapshot?.();
    unsubscribeWorkspaceSnapshot = null;
  };

  const processWorkspaceSnapshot = async (
    userId: string,
    generation: number,
    remoteState: Record<string, unknown> | null,
  ) => {
    const isCurrent = () =>
      !disposed &&
      generation === workspaceSnapshotGeneration &&
      workspaceSnapshotUserId === userId &&
      isCurrentSyncUser(userId);
    if (!isCurrent()) return;

    // Our own transaction can emit its snapshot before writeWorkspaceDocument
    // has persisted the winning revision. Let that transaction settle first so
    // its acknowledgement is not mistaken for a competing device.
    const activeSync = syncInFlight;
    if (activeSync) await activeSync.catch(() => undefined);
    if (!isCurrent() || isInitialSync || activeFetchPromise) return;

    const remoteWorkspaceRevision = typeof remoteState?.syncRevision === 'string'
      ? remoteState.syncRevision
      : null;
    if (remoteWorkspaceRevision && remoteWorkspaceRevision === lastKnownWorkspaceRevision) return;

    if (!remoteState || !remoteWorkspaceRevision || remoteState.syncSchemaVersion !== 2) {
      useSyncStore.getState().setStatus('syncing');
      requestWorkspaceConflictRecovery?.(userId);
      return;
    }

    const persistedWorkspaceDirty = await offlineStorage.getWorkspaceDirty();
    if (!isCurrent()) return;
    if (persistedWorkspaceDirty || changeRevision > syncedRevision) {
      // A remote writer advanced while this device also has edits. The normal
      // fetch path performs a deletion-aware three-way rebase, then retries the
      // transaction against this newest revision.
      useSyncStore.getState().setStatus('syncing');
      requestWorkspaceConflictRecovery?.(userId);
      return;
    }

    const baselineRevision = changeRevision;
    const context: FetchContext = {
      userId,
      attempt: ++latestFetchAttempt,
      baselineRevision,
    };
    const merged = await mergeState(
      remoteState,
      () => changeRevision > baselineRevision ? 'local' : 'remote',
      context,
    );
    if (!merged || !isCurrent()) return;

    if (changeRevision > baselineRevision) {
      useSyncStore.getState().setStatus('syncing');
      requestWorkspaceConflictRecovery?.(userId);
      return;
    }

    lastKnownWorkspaceRevision = remoteWorkspaceRevision;
    await Promise.all([
      persistWorkspaceRevision(remoteWorkspaceRevision),
      persistWorkspaceBase(toWorkspaceBase(remoteState)),
      persistWorkspaceDirty(false),
    ]);
    if (!isCurrent()) return;
    syncedRevision = Math.max(syncedRevision, baselineRevision);
    clearSyncRetry();
    useSyncStore.getState().setStatus('synced');
  };

  const startWorkspaceSubscription = (userId: string) => {
    if (
      disposed ||
      !isCurrentSyncUser(userId) ||
      (workspaceSnapshotUserId === userId && unsubscribeWorkspaceSnapshot)
    ) return;

    stopWorkspaceSubscription();
    workspaceSnapshotUserId = userId;
    const generation = workspaceSnapshotGeneration;
    const docRef = doc(db, 'users', userId, 'workspace', 'config');
    unsubscribeWorkspaceSnapshot = onSnapshot(
      docRef,
      (snapshot) => {
        const remoteState = snapshot.exists() ? snapshot.data() : null;
        workspaceSnapshotChain = workspaceSnapshotChain
          .catch(() => undefined)
          .then(() => processWorkspaceSnapshot(userId, generation, remoteState))
          .catch((error) => {
            if (!disposed && generation === workspaceSnapshotGeneration) {
              console.error('Failed to apply realtime workspace update', error);
              useSyncStore.getState().setStatus(
                'error',
                error instanceof Error ? error.message : 'Failed to apply realtime workspace update.',
              );
            }
          });
      },
      (error) => {
        if (
          disposed ||
          generation !== workspaceSnapshotGeneration ||
          !isCurrentSyncUser(userId)
        ) return;
        console.error('Workspace realtime listener failed', error);
        unsubscribeWorkspaceSnapshot = null;
        workspaceSnapshotUserId = null;
        isInitialSync = true;
        useSyncStore.getState().setStatus(
          navigator.onLine ? 'error' : 'offline',
          error instanceof Error ? error.message : 'Workspace realtime listener failed.',
        );
        scheduleFetchRetry(userId);
      },
    );
  };

  const beginInitialFetch = (userId: string, force = false) => {
    if (disposed || !hydrated || !isCurrentSyncUser(userId)) return;
    if (activeFetchPromise && activeFetchUserId === userId) return;
    if (activeFetchUserId === userId && !force && fetchAttemptCount > 0) return;
    clearFetchRetry();
    activeFetchUserId = userId;
    isInitialSync = true;
    const context = {
      userId,
      attempt: ++latestFetchAttempt,
      baselineRevision: changeRevision,
    };
    const hasPendingLocalChanges = changeRevision > syncedRevision;
    fetchAttemptCount += 1;
    activeFetchPromise = fetchCloudConfig(context, hasPendingLocalChanges);
    void activeFetchPromise.then((synced) => {
      if (disposed || !isFetchContextCurrent(context)) return;
      activeFetchPromise = null;
      settleInitialReady();
      if (synced) {
        isInitialSync = false;
        clearFetchRetry();
        resetFetchRetryBackoff();
        startWorkspaceSubscription(userId);
        if (changeRevision > syncedRevision) schedulePendingSync(0);
      } else {
        isInitialSync = true;
        if (useSyncStore.getState().status !== 'local-only') scheduleFetchRetry(userId);
      }
    });
  };

  requestWorkspaceConflictRecovery = (userId: string) => {
    if (disposed || !hydrated || !isCurrentSyncUser(userId)) return;
    isInitialSync = true;
    resetFetchRetryBackoff();
    beginInitialFetch(userId, true);
  };

  const checkHydrated = () => {
    const allHydrated =
      useUserStore.getState()._hydrated &&
      useSidebarStore.getState()._hydrated &&
      useTabStore.getState()._hydrated &&
      useModuleStore.getState()._hydrated &&
      useRightSidebarStore.getState()._hydrated &&
      useRightCornerSidebarStore.getState()._hydrated &&
      useThemeStore.getState()._hydrated;

    if (!allHydrated || !authReady || hydrated) return;
    hydrated = true;
    const firebaseUser = auth.currentUser;
    const localUser = useUserStore.getState().user;
    if (
      localUser &&
      (
        (!firebaseUser && localUser.id !== 'demo-user') ||
        (firebaseUser && localUser.id !== firebaseUser.uid)
      )
    ) {
      // Never silently reassign a hydrated workspace to a different Firebase
      // account. The explicit login flow will set the matching local user.
      useUserStore.getState().signOut();
    }

    const user = useUserStore.getState().user;
    if (user && user.id !== 'demo-user' && auth.currentUser?.uid === user.id) {
      beginInitialFetch(user.id);
    } else {
      isInitialSync = false;
      settleInitialReady();
      useSyncStore.getState().setStatus(navigator.onLine ? 'synced' : 'offline');
    }
  };

  const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
    authReady = true;
    if (hydrated) {
      const localUser = useUserStore.getState().user;
      if (
        localUser &&
        (
          (!firebaseUser && localUser.id !== 'demo-user') ||
          (firebaseUser && localUser.id !== firebaseUser.uid)
        )
      ) {
        useUserStore.getState().signOut();
      }
    }
    checkHydrated();
  });

  const handleOnline = () => {
    const user = useUserStore.getState().user;
    clearSyncRetry();
    if (!hydrated || !user || user.id === 'demo-user' || !isCurrentSyncUser(user.id)) {
      useSyncStore.getState().setStatus('synced');
      return;
    }
    resetFetchRetryBackoff();
    if (isInitialSync) beginInitialFetch(user.id, true);
    else if (changeRevision > syncedRevision) schedulePendingSync(0);
    else useSyncStore.getState().setStatus('synced');
  };
  window.addEventListener('online', handleOnline);

  const handleWorkspaceChange = () => {
    const wasHydrated = hydrated;
    checkHydrated();
    if (!wasHydrated || remoteApplyDepth > 0) return;
    queueSync();
    const user = useUserStore.getState().user;
    if (isInitialSync && user && user.id !== 'demo-user') {
      if (!fetchRetryTimeout && !activeFetchPromise) resetFetchRetryBackoff();
      scheduleFetchRetry(user.id, 2_000);
    }
  };

  const unsubscribers = [
    useUserStore.subscribe((state, prevState) => {
      checkHydrated();
      if (!hydrated || state.user?.id === prevState.user?.id) return;
      stopWorkspaceSubscription();
      latestFetchAttempt += 1;
      activeFetchPromise = null;
      activeFetchUserId = null;
      fetchAttemptCount = 0;
      resetFetchRetryBackoff();
      clearFetchRetry();
      clearPendingSync();
      clearSyncRetry();
      if (state.user && state.user.id !== 'demo-user' && auth.currentUser?.uid === state.user.id) {
        beginInitialFetch(state.user.id);
      } else {
        isInitialSync = false;
        settleInitialReady();
        useSyncStore.getState().setStatus(navigator.onLine ? 'synced' : 'offline');
      }
    }),
    useSidebarStore.subscribe((state, prevState) => {
      if (
        state.collapsed !== prevState.collapsed ||
        state.pinnedModuleIds !== prevState.pinnedModuleIds ||
        state.moduleOrderIds !== prevState.moduleOrderIds
      ) handleWorkspaceChange();
    }),
    useTabStore.subscribe((state, prevState) => {
      if (state.tabs !== prevState.tabs || state.activeTabId !== prevState.activeTabId) {
        handleWorkspaceChange();
      }
    }),
    useModuleStore.subscribe((state, prevState) => {
      if (
        state.importedModules !== prevState.importedModules ||
        state.moduleOverrides !== prevState.moduleOverrides
      ) handleWorkspaceChange();
    }),
    useRightSidebarStore.subscribe((state, prevState) => {
      if (
        state.enabled !== prevState.enabled ||
        state.visible !== prevState.visible ||
        state.moduleId !== prevState.moduleId
      ) handleWorkspaceChange();
    }),
    useRightCornerSidebarStore.subscribe((state, prevState) => {
      if (
        state.enabled !== prevState.enabled ||
        state.visible !== prevState.visible ||
        state.moduleId !== prevState.moduleId
      ) handleWorkspaceChange();
    }),
    useThemeStore.subscribe((state, prevState) => {
      if (state.mode !== prevState.mode) handleWorkspaceChange();
    }),
  ];

  const cleanup = () => {
    if (managerCleanup !== cleanup) return;
    disposed = true;
    unsubscribeAuth();
    window.removeEventListener('online', handleOnline);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    stopWorkspaceSubscription();
    latestFetchAttempt += 1;
    clearFetchRetry();
    clearPendingSync();
    clearSyncRetry();
    if (requestWorkspaceConflictRecovery) requestWorkspaceConflictRecovery = null;
    settleInitialReady();
    isInitialSync = true;
    managerCleanup = null;
  };
  managerCleanup = cleanup;
  return cleanup;
};

async function normalizeImportedModules(value: unknown[]): Promise<ImportedModule[]> {
  const iconCache = new Map<string, Promise<string>>();
  const localModules = new Map(useModuleStore.getState().importedModules.map((module) => [module.id, module]));
  return Promise.all(
    value.filter(isRecord).map(async (item) => {
      const cloudRecord = { ...item };
      const iconLocalOnly = cloudRecord.iconLocalOnly === true;
      const module = cloudRecord as unknown as ImportedModule;
      const fallback = getModuleIconFallback(module.moduleType);
      const localIcon = localModules.get(module.id)?.icon;
      return {
        ...module,
        icon: iconLocalOnly && typeof localIcon === 'string'
          ? localIcon
          : await normalizeIconWithCache(module.icon, fallback, iconCache),
      };
    }),
  );
}

async function normalizeModuleOverrides(value: unknown[]): Promise<ModuleOverride[]> {
  const iconCache = new Map<string, Promise<string>>();
  const localOverrides = new Map(useModuleStore.getState().moduleOverrides.map((module) => [module.id, module]));
  return Promise.all(
    value.filter(isRecord).map(async (item) => {
      const cloudRecord = { ...item };
      const iconLocalOnly = cloudRecord.iconLocalOnly === true;
      const module = cloudRecord as unknown as ModuleOverride;
      const registeredIcon = moduleRegistry.get(module.id)?.manifest.icon;
      const fallback = registeredIcon && !isEmbeddedModuleIcon(registeredIcon) ? registeredIcon : 'package';
      const localIcon = localOverrides.get(module.id)?.icon;
      return {
        ...module,
        icon: iconLocalOnly && typeof localIcon === 'string'
          ? localIcon
          : await normalizeIconWithCache(module.icon, fallback, iconCache),
      };
    }),
  );
}

async function prepareImportedModulesForCloud(value: ImportedModule[]): Promise<CloudImportedModule[]> {
  const iconCache = new Map<string, Promise<string>>();
  return Promise.all(value.map(async (module) => {
    const fallback = getModuleIconFallback(module.moduleType);
    const normalizedIcon = await normalizeIconWithCache(module.icon, fallback, iconCache);
    const cloudModule: CloudImportedModule = sanitizeImportedModule({ ...module, icon: normalizedIcon });
    if (
      (isEmbeddedModuleIcon(module.icon) && !isEmbeddedModuleIcon(normalizedIcon)) ||
      (!isEmbeddedModuleIcon(module.icon) && module.iconLocalOnly)
    ) {
      cloudModule.iconLocalOnly = true;
    }
    return cloudModule;
  }));
}

async function prepareModuleOverridesForCloud(value: ModuleOverride[]): Promise<CloudModuleOverride[]> {
  const iconCache = new Map<string, Promise<string>>();
  return Promise.all(value.map(async (module) => {
    const registeredIcon = moduleRegistry.get(module.id)?.manifest.icon;
    const fallback = registeredIcon && !isEmbeddedModuleIcon(registeredIcon) ? registeredIcon : 'package';
    const normalizedIcon = await normalizeIconWithCache(module.icon, fallback, iconCache);
    const cloudModule: CloudModuleOverride = sanitizeModuleOverride({ ...module, icon: normalizedIcon });
    if (
      (isEmbeddedModuleIcon(module.icon) && !isEmbeddedModuleIcon(normalizedIcon)) ||
      (!isEmbeddedModuleIcon(module.icon) && module.iconLocalOnly)
    ) {
      cloudModule.iconLocalOnly = true;
    }
    return cloudModule;
  }));
}

function normalizeIconWithCache(icon: unknown, fallback: string, cache: Map<string, Promise<string>>) {
  if (typeof icon !== 'string') return Promise.resolve(fallback);
  const cached = cache.get(icon);
  if (cached) return cached;
  const normalized = normalizeModuleIcon(icon, fallback);
  cache.set(icon, normalized);
  return normalized;
}

function sanitizeImportedModule(module: ImportedModule): CloudImportedModule {
  return {
    id: module.id,
    title: module.title,
    icon: module.icon,
    version: module.version,
    category: module.category,
    description: module.description,
    offline: module.offline,
    ...(module.openInNewWindow === undefined ? {} : { openInNewWindow: module.openInNewWindow }),
    ...(Array.isArray(module.permissions) ? { permissions: [...module.permissions] } : {}),
    url: module.url,
    ...(module.moduleType === 'panel' || module.moduleType === 'url' ? { moduleType: module.moduleType } : {}),
  };
}

function sanitizeModuleOverride(module: ModuleOverride): CloudModuleOverride {
  return {
    id: module.id,
    title: module.title,
    icon: module.icon,
    ...(module.version === undefined ? {} : { version: module.version }),
    category: module.category,
    description: module.description,
    offline: module.offline,
    ...(module.openInNewWindow === undefined ? {} : { openInNewWindow: module.openInNewWindow }),
    ...(Array.isArray(module.permissions) ? { permissions: [...module.permissions] } : {}),
  };
}

function sanitizeTabForCloud(tab: TabItem): TabItem {
  return {
    moduleId: tab.moduleId,
    title: tab.title,
    icon: isEmbeddedModuleIcon(tab.icon) ? 'package' : tab.icon,
  };
}

function normalizeCloudTabs(value: unknown[]): TabItem[] {
  return value.filter(isRecord).map((item) => {
    const tab = item as Partial<TabItem>;
    return {
      moduleId: typeof tab.moduleId === 'string' ? tab.moduleId : '',
      title: typeof tab.title === 'string' ? tab.title : '',
      icon: typeof tab.icon === 'string' && !isEmbeddedModuleIcon(tab.icon) ? tab.icon : 'package',
    };
  }).filter((tab) => Boolean(tab.moduleId));
}

function getEmbeddedIconSlots(state: WorkspaceBudgetState) {
  return [
    ...state.importedModules.map((module) => ({ module, fallback: getModuleIconFallback(module.moduleType) })),
    ...state.moduleOverrides.map((module) => ({ module, fallback: 'package' })),
  ]
    .filter(({ module }) => isEmbeddedModuleIcon(module.icon))
    .sort((a, b) => getUtf8ByteSize(b.module.icon) - getUtf8ByteSize(a.module.icon));
}

function stripEmbeddedIconsUntil(state: WorkspaceBudgetState, fitsBudget: () => boolean) {
  const iconSlots = getEmbeddedIconSlots(state);

  let removedIcons = 0;
  for (const slot of iconSlots) {
    if (fitsBudget()) break;
    slot.module.icon = slot.fallback;
    slot.module.iconLocalOnly = true;
    removedIcons += 1;
  }

  return removedIcons;
}

function enforceWorkspaceBudget(state: WorkspaceBudgetState) {
  const removedIcons = stripEmbeddedIconsUntil(
    state,
    () => estimateFirestoreValueBytes(state) <= MAX_WORKSPACE_STATE_BYTES,
  );

  if (removedIcons) {
    console.warn(
      `[CloudSync] ${removedIcons} embedded icon(s) exceeded the shared cloud budget and will remain local on this device.`,
    );
  }
}

function fitWorkspaceIconsToDocumentBudget(state: WorkspaceBudgetState, moduleData: unknown) {
  const fitsBudget = () => estimateFirestoreDocumentBytes({
    ...state,
    moduleData,
    updatedAt: new Date(),
  }) <= MAX_CONFIG_ESTIMATED_BYTES;

  const removedIcons = stripEmbeddedIconsUntil(state, fitsBudget);
  if (removedIcons) {
    console.warn(
      `[CloudSync] ${removedIcons} additional embedded icon(s) remain local so module data can fit in Firestore.`,
    );
  }
}

function normalizeIdList(value: unknown[]) {
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(item))));
}

function mergeRecordsById<T extends { id: string }>(remote: T[], local: T[]) {
  const merged = new Map(remote.map((item) => [item.id, item]));
  local.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

function mergeIdLists(primary: string[], secondary: string[]) {
  return Array.from(new Set([...primary, ...secondary]));
}

function mergeTabs(primary: TabItem[], secondary: TabItem[]) {
  const primaryIds = new Set(primary.map((tab) => tab.moduleId));
  return [...primary, ...secondary.filter((tab) => !primaryIds.has(tab.moduleId))];
}

function normalizeNullableId(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function hasMeaningfulLocalWorkspace() {
  return Boolean(
    useModuleStore.getState().importedModules.length ||
    useModuleStore.getState().moduleOverrides.length ||
    useTabStore.getState().tabs.length ||
    useSidebarStore.getState().pinnedModuleIds.length ||
    useSidebarStore.getState().moduleOrderIds.length,
  );
}

function isCurrentSyncUser(userId: string) {
  return useUserStore.getState().user?.id === userId && getAuth(app).currentUser?.uid === userId;
}

function isFetchContextCurrent(context: FetchContext) {
  return context.attempt === latestFetchAttempt && isCurrentSyncUser(context.userId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isFirestoreCapacityError(error: unknown) {
  const record = isRecord(error) ? error : {};
  const code = typeof record.code === 'string' ? record.code.replace(/^firestore\//, '') : '';
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === 'resource-exhausted' ||
    /document.*(?:too large|maximum|exceed)|(?:too large|maximum).*document/i.test(message)
  );
}

class CloudCapacityError extends Error {
  constructor() {
    super('Cloud workspace is at capacity. Changes remain safely stored on this device.');
    this.name = 'CloudCapacityError';
  }
}

class WorkspaceConflictError extends Error {
  constructor() {
    super(
      'Cloud workspace changed on another device while this device had local edits. ' +
        'Both copies were preserved; automatic overwrite was blocked.',
    );
    this.name = 'WorkspaceConflictError';
  }
}
