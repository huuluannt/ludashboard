import { get, set } from 'idb-keyval';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useSyncStore } from '@/state/syncStore';
import { app, db } from './config';
import {
  estimateFirestoreDocumentBytes,
  MAX_CONFIG_ESTIMATED_BYTES,
  normalizeFirestoreData,
  setModuleDataEntry,
} from './cloudDocumentBudget';
import { assertWorkspaceOwnership, WorkspaceOwnershipError } from './workspaceOwnership';

export interface ModuleCloudEnvelope<T> {
  value: T;
  updatedAt: number;
}

interface ModuleCloudHandlers<T> {
  onData: (data: ModuleCloudEnvelope<T>) => void;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

type PendingFailureKind = 'local-only' | 'retryable';

interface PendingModuleWrite {
  moduleId: string;
  key: string;
  data: ModuleCloudEnvelope<unknown>;
  targetUserId: string | null;
  revision: number;
  queuedAt: number;
  lastError?: string;
  lastFailureKind?: PendingFailureKind;
}

interface ActiveModuleFailure {
  message: string;
  targetUserId: string | null;
}

const PENDING_WRITES_STORAGE_KEY = 'lu:pending-module-cloud-writes';
const INITIAL_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 80_000;
const MAX_AUTOMATIC_RETRIES = 5;

const pendingWrites = new Map<string, PendingModuleWrite>();
const activeModuleFailures = new Map<string, ActiveModuleFailure>();
let pendingWritesLoaded: Promise<void> | null = null;
let persistenceChain: Promise<void> = Promise.resolve();
let flushPromise: Promise<void> | null = null;
let retryTimer: number | null = null;
let retryDelayMs = INITIAL_RETRY_DELAY_MS;
let automaticRetryCount = 0;
let retryHooksInitialized = false;
let nextRevision = 0;
let lastModuleErrorMessage: string | null = null;

class ModuleCloudWriteError extends Error {
  constructor(
    readonly kind: 'capacity' | 'validation' | 'conflict',
    message: string,
  ) {
    super(message);
    this.name = 'ModuleCloudWriteError';
  }
}

class AuthChangedError extends Error {}
class SupersededWriteError extends Error {}

export function subscribeModuleCloudData<T>(
  moduleId: string,
  key: string,
  handlers: ModuleCloudHandlers<T>,
) {
  initializeRetryHooks();
  const auth = getAuth(app);
  let unsubscribeSnapshot: (() => void) | null = null;
  let authGeneration = 0;
  let snapshotGeneration = 0;
  let disposed = false;

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    const generation = ++authGeneration;
    unsubscribeSnapshot?.();
    unsubscribeSnapshot = null;

    let ready = false;
    const markReady = () => {
      if (ready) return;
      ready = true;
      handlers.onReady?.();
    };

    if (!user) {
      markReady();
      return;
    }

    void (async () => {
      try {
        await assertWorkspaceOwnership(user.uid, true);
      } catch (error) {
        if (disposed || generation !== authGeneration) return;
        const message = error instanceof Error ? error.message : new WorkspaceOwnershipError().message;
        reportLocalOnly(getPendingId(moduleId, key, user.uid), user.uid, message);
        handlers.onError?.(error);
        markReady();
        return;
      }
      if (disposed || generation !== authGeneration || auth.currentUser?.uid !== user.uid) return;

      const docRef = doc(db, 'users', user.uid, 'workspace', 'config');
      unsubscribeSnapshot = onSnapshot(
        docRef,
        (snapshot) => {
          if (disposed || generation !== authGeneration || auth.currentUser?.uid !== user.uid) return;
          const currentSnapshotGeneration = ++snapshotGeneration;
          void (async () => {
            await ensurePendingWritesLoaded();
            if (
              disposed ||
              generation !== authGeneration ||
              currentSnapshotGeneration !== snapshotGeneration ||
              auth.currentUser?.uid !== user.uid
            ) return;

            // A durable local edit is authoritative until its transaction
            // succeeds or the user resolves a cloud conflict. Do not let an
            // older/future-skewed snapshot overwrite the accessible local copy.
            if (!hasPendingModuleValue(user.uid, moduleId, key)) {
              const value = snapshot.data()?.moduleData?.[moduleId]?.[key];
              if (isModuleCloudEnvelope<T>(value)) handlers.onData(value);
            }
            markReady();
          })().catch((error) => {
            if (disposed || generation !== authGeneration) return;
            handlers.onError?.(error);
            markReady();
          });
        },
        (error) => {
          if (disposed || generation !== authGeneration) return;
          console.error(`Failed to sync ${moduleId}/${key} from cloud`, error);
          handlers.onError?.(error);
          markReady();
        },
      );
    })();
  });

  return () => {
    disposed = true;
    authGeneration += 1;
    unsubscribeSnapshot?.();
    unsubscribeAuth();
  };
}

/**
 * Queue the newest value before attempting the transaction. The queue lives in
 * IndexedDB, so an offline edit survives reload and is retried after reconnect
 * or after the user signs in. Only the newest pending value for a module/key is
 * retained; no existing cloud moduleData entry is ever pruned to make room.
 */
export async function saveModuleCloudData<T>(
  moduleId: string,
  key: string,
  data: ModuleCloudEnvelope<T>,
) {
  initializeRetryHooks();
  await ensurePendingWritesLoaded();

  const user = getAuth(app).currentUser;
  const targetUserId = user?.uid ?? null;
  const pendingId = getPendingId(moduleId, key, targetUserId);
  if (user) {
    try {
      await assertWorkspaceOwnership(user.uid, true);
    } catch (error) {
      const ownershipError = error instanceof WorkspaceOwnershipError
        ? error
        : new WorkspaceOwnershipError();
      reportLocalOnly(pendingId, user.uid, ownershipError.message);
      throw ownershipError;
    }
  }
  let normalizedData: ModuleCloudEnvelope<T>;
  try {
    normalizedData = normalizeFirestoreData(data);
  } catch (error) {
    // Do not let an older queued value overwrite a newer local value that is
    // invalid for Firestore. The module's own local copy remains untouched.
    pendingWrites.delete(pendingId);
    await persistPendingWrites();
    const validationError = createValidationError(moduleId, key, error);
    reportLocalOnly(pendingId, targetUserId, validationError.message);
    throw validationError;
  }

  activeModuleFailures.delete(pendingId);
  resetRetryBackoff();
  const entry: PendingModuleWrite = {
    moduleId,
    key,
    data: normalizedData as ModuleCloudEnvelope<unknown>,
    targetUserId,
    revision: ++nextRevision,
    queuedAt: Date.now(),
  };
  pendingWrites.set(pendingId, entry);
  await persistPendingWrites();

  // Remaining queued is intentional while offline or signed out. Auth and
  // online hooks below will retry without requiring another user edit.
  if (!user || !isOnline()) return;

  await requestFlush();
  const remaining = pendingWrites.get(pendingId);
  if (remaining?.revision === entry.revision && remaining.lastError) {
    throw new Error(remaining.lastError);
  }
}

async function writePendingEntry(
  pendingId: string,
  entry: PendingModuleWrite,
  userId: string,
) {
  const docRef = doc(db, 'users', userId, 'workspace', 'config');
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (getAuth(app).currentUser?.uid !== userId) throw new AuthChangedError();
    if (pendingWrites.get(pendingId)?.revision !== entry.revision) {
      throw new SupersededWriteError();
    }

    const currentDocument = snapshot.data() ?? {};
    const { moduleData: currentModuleData, ...workspaceFields } = currentDocument;
    const currentEnvelope = getModuleDataEnvelope(
      currentModuleData,
      entry.moduleId,
      entry.key,
    );
    if (currentEnvelope && currentEnvelope.updatedAt > entry.data.updatedAt) {
      // Client clocks are not reliable enough to discard this local edit as
      // stale. Keep it in the durable queue and surface a resolvable local-only
      // conflict instead of silently overwriting either copy.
      throw new ModuleCloudWriteError(
        'conflict',
        `Cloud has a newer version of ${entry.moduleId}/${entry.key}. ` +
          'This local version remains saved on this device and was not discarded.',
      );
    }
    if (
      currentEnvelope?.updatedAt === entry.data.updatedAt &&
      areEquivalentCloudEnvelopes(currentEnvelope, entry.data)
    ) {
      // The exact value is already committed, so this is an idempotent retry.
      return 'remote-newer' as const;
    }

    let candidate: Record<string, unknown>;
    try {
      // Normalize the complete moduleData field, rather than only the new
      // envelope, so dynamic module/key field names and actual document nesting
      // depth are validated before Firestore sees them.
      candidate = normalizeFirestoreData(
        setModuleDataEntry(currentModuleData, entry.moduleId, entry.key, entry.data),
      );
    } catch (error) {
      throw createValidationError(entry.moduleId, entry.key, error);
    }

    const estimatedDocument = {
      ...workspaceFields,
      moduleData: candidate,
      updatedAt: new Date(),
    };
    if (estimateFirestoreDocumentBytes(estimatedDocument) > MAX_CONFIG_ESTIMATED_BYTES) {
      throw new ModuleCloudWriteError(
        'capacity',
        `Module data ${entry.moduleId}/${entry.key} would make workspace/config too large. ` +
          'The newest value remains saved locally.',
      );
    }

    const nextState = {
      moduleData: candidate,
      updatedAt: serverTimestamp(),
    };
    transaction.set(docRef, nextState, { mergeFields: Object.keys(nextState) });
    return 'written' as const;
  });
}

function requestFlush() {
  if (flushPromise) return flushPromise;

  flushPromise = flushPendingWrites().finally(() => {
    flushPromise = null;
    const userId = getAuth(app).currentUser?.uid;
    if (userId && isOnline() && hasFreshPendingWrite(userId)) {
      // A newer value may have arrived while an older transaction was in
      // flight. Give it its own pass without recursively growing the stack.
      void Promise.resolve().then(requestFlush);
    }
  });
  return flushPromise;
}

async function flushPendingWrites() {
  await ensurePendingWritesLoaded();
  const auth = getAuth(app);
  const user = auth.currentUser;
  if (!user || !isOnline()) return;
  try {
    await assertWorkspaceOwnership(user.uid, true);
  } catch (error) {
    await markOwnershipBlockedWrites(user.uid, error);
    return;
  }

  let queueChanged = false;
  let completedWrite = false;
  let failedWrite = false;

  for (const storedPendingId of [...pendingWrites.keys()]) {
    let pendingId = storedPendingId;
    let entry = pendingWrites.get(pendingId);
    if (!entry || entry.lastError) continue;
    if (entry.targetUserId && entry.targetUserId !== user.uid) continue;
    if (!isOnline() || auth.currentUser?.uid !== user.uid) break;

    if (!entry.targetUserId) {
      const assignedPendingId = getPendingId(entry.moduleId, entry.key, user.uid);
      const assignedEntry = { ...entry, targetUserId: user.uid };
      const existingAssignedEntry = pendingWrites.get(assignedPendingId);
      const previousFailure = activeModuleFailures.get(pendingId);

      pendingWrites.delete(pendingId);
      activeModuleFailures.delete(pendingId);
      queueChanged = true;

      if (
        existingAssignedEntry &&
        comparePendingWrites(existingAssignedEntry, assignedEntry) >= 0
      ) {
        continue;
      }

      pendingId = assignedPendingId;
      entry = assignedEntry;
      activeModuleFailures.delete(pendingId);
      pendingWrites.set(pendingId, entry);
      if (previousFailure) {
        activeModuleFailures.set(pendingId, {
          ...previousFailure,
          targetUserId: user.uid,
        });
      }
      queueChanged = true;
    }

    try {
      await writePendingEntry(pendingId, entry, user.uid);
      if (pendingWrites.get(pendingId)?.revision === entry.revision) {
        pendingWrites.delete(pendingId);
        activeModuleFailures.delete(pendingId);
        queueChanged = true;
        completedWrite = true;
      }
    } catch (error) {
      if (error instanceof AuthChangedError || error instanceof SupersededWriteError) {
        continue;
      }

      const current = pendingWrites.get(pendingId);
      if (!current || current.revision !== entry.revision) continue;

      const failureKind = classifyFailure(error);
      const message = getModuleFailureMessage(entry, error);
      pendingWrites.set(pendingId, {
        ...current,
        lastError: message,
        lastFailureKind: failureKind,
      });
      queueChanged = true;
      failedWrite = true;
      reportLocalOnly(pendingId, entry.targetUserId, message);
      if (failureKind === 'retryable') scheduleRetry();
    }
  }

  if (queueChanged) await persistPendingWrites();
  if (completedWrite && !failedWrite && !hasFailedPendingWrite(user.uid)) {
    clearModuleLocalOnlyStatus();
  }
}

async function markOwnershipBlockedWrites(userId: string, error: unknown) {
  const message = error instanceof Error ? error.message : new WorkspaceOwnershipError().message;
  let changed = false;
  for (const [pendingId, entry] of pendingWrites) {
    if (entry.targetUserId && entry.targetUserId !== userId) continue;
    pendingWrites.set(pendingId, {
      ...entry,
      lastError: message,
      lastFailureKind: 'local-only',
    });
    reportLocalOnly(pendingId, entry.targetUserId, message);
    changed = true;
  }
  if (changed) await persistPendingWrites();
}

function initializeRetryHooks() {
  if (retryHooksInitialized) return;
  retryHooksInitialized = true;

  const auth = getAuth(app);
  onAuthStateChanged(auth, (user) => {
    if (user) {
      void retryEligibleWrites(user.uid, false).then(() => reassertActiveFailure(user.uid));
    }
  });

  useSyncStore.subscribe((state) => {
    if (state.status !== 'synced') return;
    const userId = auth.currentUser?.uid ?? null;
    const failure = findActiveFailure(userId);
    if (!failure) return;
    void Promise.resolve().then(async () => {
      const pending = pendingWrites.get(failure.pendingId);
      if (userId && pending?.lastError) {
        // A successful workspace sync may have freed capacity. Give blocked
        // module data one fresh attempt before restoring the local-only badge.
        await retryEligibleWrites(userId, false);
      }
      if (useSyncStore.getState().status === 'synced') reassertActiveFailure(userId);
    });
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      const userId = auth.currentUser?.uid;
      if (userId) void retryEligibleWrites(userId, false);
    });
  }
}

async function retryEligibleWrites(userId: string, retryOnly: boolean) {
  await ensurePendingWritesLoaded();
  if (!retryOnly) resetRetryBackoff();
  let changed = false;
  for (const [pendingId, entry] of pendingWrites) {
    if (entry.targetUserId && entry.targetUserId !== userId) continue;
    if (!entry.lastError || (retryOnly && entry.lastFailureKind !== 'retryable')) continue;
    pendingWrites.set(pendingId, {
      ...entry,
      lastError: undefined,
      lastFailureKind: undefined,
    });
    changed = true;
  }
  if (changed) await persistPendingWrites();
  if (isOnline() && getAuth(app).currentUser?.uid === userId) await requestFlush();
}

function scheduleRetry() {
  if (
    typeof window === 'undefined' ||
    retryTimer !== null ||
    automaticRetryCount >= MAX_AUTOMATIC_RETRIES
  ) return;
  const delayMs = retryDelayMs;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    automaticRetryCount += 1;
    retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
    const userId = getAuth(app).currentUser?.uid;
    if (userId && isOnline()) void retryEligibleWrites(userId, true);
  }, delayMs);
}

function resetRetryBackoff() {
  automaticRetryCount = 0;
  retryDelayMs = INITIAL_RETRY_DELAY_MS;
}

function ensurePendingWritesLoaded() {
  if (pendingWritesLoaded) return pendingWritesLoaded;
  pendingWritesLoaded = (async () => {
    try {
      const stored = await get<unknown>(PENDING_WRITES_STORAGE_KEY);
      if (!Array.isArray(stored)) return;
      for (const value of stored) {
        if (!isPendingModuleWrite(value)) continue;
        const pendingId = getPendingId(value.moduleId, value.key, value.targetUserId);
        const current = pendingWrites.get(pendingId);
        if (!current || value.revision > current.revision) pendingWrites.set(pendingId, value);
        if (value.lastError) {
          activeModuleFailures.set(pendingId, {
            message: value.lastError,
            targetUserId: value.targetUserId,
          });
        }
        nextRevision = Math.max(nextRevision, value.revision);
      }
    } catch (error) {
      console.error('Failed to restore pending module cloud writes', error);
    }
  })();
  return pendingWritesLoaded;
}

function persistPendingWrites() {
  const snapshot = [...pendingWrites.values()];
  persistenceChain = persistenceChain
    .catch(() => undefined)
    .then(() => set(PENDING_WRITES_STORAGE_KEY, snapshot))
    .catch((error) => {
      console.error('Failed to persist pending module cloud writes', error);
    });
  return persistenceChain;
}

function reportLocalOnly(
  pendingId: string,
  targetUserId: string | null,
  message: string,
) {
  activeModuleFailures.set(pendingId, { message, targetUserId });
  lastModuleErrorMessage = message;
  useSyncStore.getState().setStatus('local-only', message);
}

function clearModuleLocalOnlyStatus() {
  const state = useSyncStore.getState();
  const replacement = findActiveFailure(getAuth(app).currentUser?.uid ?? null);
  if (replacement) {
    reportLocalOnly(replacement.pendingId, replacement.targetUserId, replacement.message);
    return;
  }
  if (
    lastModuleErrorMessage &&
    state.status === 'local-only' &&
    state.errorMessage === lastModuleErrorMessage
  ) {
    lastModuleErrorMessage = null;
    state.setStatus('synced');
  }
}

function reassertActiveFailure(userId: string | null) {
  const failure = findActiveFailure(userId);
  if (failure) {
    reportLocalOnly(failure.pendingId, failure.targetUserId, failure.message);
  }
}

function findActiveFailure(userId: string | null) {
  for (const [pendingId, failure] of activeModuleFailures) {
    if (!failure.targetUserId || failure.targetUserId === userId) {
      return { pendingId, ...failure };
    }
  }
  return null;
}

function createValidationError(moduleId: string, key: string, error: unknown) {
  return new ModuleCloudWriteError(
    'validation',
    `Module data ${moduleId}/${key} cannot be represented safely in Firestore. ` +
      `The newest value remains saved locally. ${getErrorText(error)}`,
  );
}

function getModuleFailureMessage(entry: PendingModuleWrite, error: unknown) {
  if (error instanceof ModuleCloudWriteError) return error.message;
  return (
    `Module data ${entry.moduleId}/${entry.key} could not sync right now. ` +
    `The newest value remains saved locally. ${getErrorText(error)}`
  );
}

function classifyFailure(error: unknown): PendingFailureKind {
  if (error instanceof ModuleCloudWriteError) return 'local-only';
  const code = getErrorCode(error);
  const message = getErrorText(error);
  if (
    code === 'invalid-argument' ||
    code === 'permission-denied' ||
    /document.*(?:too large|maximum|exceed)|(?:too large|maximum).*document|not.*serializ/i.test(message)
  ) {
    return 'local-only';
  }
  return 'retryable';
}

function hasFreshPendingWrite(userId: string) {
  return [...pendingWrites.values()].some(
    (entry) =>
      (!entry.targetUserId || entry.targetUserId === userId) &&
      !entry.lastError,
  );
}

function hasPendingModuleValue(userId: string, moduleId: string, key: string) {
  return Boolean(
    pendingWrites.get(getPendingId(moduleId, key, userId)) ||
    pendingWrites.get(getPendingId(moduleId, key, null)),
  );
}

function hasFailedPendingWrite(userId: string) {
  return [...pendingWrites.values()].some(
    (entry) =>
      (!entry.targetUserId || entry.targetUserId === userId) &&
      Boolean(entry.lastError),
  );
}

function isPendingModuleWrite(value: unknown): value is PendingModuleWrite {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PendingModuleWrite>;
  return Boolean(
    typeof candidate.moduleId === 'string' &&
      typeof candidate.key === 'string' &&
      isModuleCloudEnvelope(candidate.data) &&
      (candidate.targetUserId === null || typeof candidate.targetUserId === 'string') &&
      typeof candidate.revision === 'number' &&
      Number.isFinite(candidate.revision) &&
      typeof candidate.queuedAt === 'number',
  );
}

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function getPendingId(moduleId: string, key: string, targetUserId: string | null) {
  return JSON.stringify([targetUserId, moduleId, key]);
}

function comparePendingWrites(left: PendingModuleWrite, right: PendingModuleWrite) {
  return left.revision - right.revision;
}

function getModuleDataEnvelope(
  moduleData: unknown,
  moduleId: string,
  key: string,
): ModuleCloudEnvelope<unknown> | null {
  if (!moduleData || typeof moduleData !== 'object' || Array.isArray(moduleData)) return null;
  const moduleValue = (moduleData as Record<string, unknown>)[moduleId];
  if (!moduleValue || typeof moduleValue !== 'object' || Array.isArray(moduleValue)) return null;
  const envelope = (moduleValue as Record<string, unknown>)[key];
  return isModuleCloudEnvelope(envelope) ? envelope : null;
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  return String((error as { code?: unknown }).code ?? '').replace(/^firestore\//, '');
}

function getErrorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 300 ? `${message.slice(0, 297)}...` : message;
}

function areEquivalentCloudEnvelopes(
  left: ModuleCloudEnvelope<unknown>,
  right: ModuleCloudEnvelope<unknown>,
) {
  try {
    return JSON.stringify(left.value) === JSON.stringify(right.value);
  } catch {
    return false;
  }
}

function isModuleCloudEnvelope<T>(value: unknown): value is ModuleCloudEnvelope<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'value' in value &&
      typeof (value as ModuleCloudEnvelope<T>).updatedAt === 'number' &&
      Number.isFinite((value as ModuleCloudEnvelope<T>).updatedAt),
  );
}
