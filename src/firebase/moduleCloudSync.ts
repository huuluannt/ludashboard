import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { app, db } from './config';

export interface ModuleCloudEnvelope<T> {
  value: T;
  updatedAt: number;
}

interface ModuleCloudHandlers<T> {
  onData: (data: ModuleCloudEnvelope<T>) => void;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

export function subscribeModuleCloudData<T>(
  moduleId: string,
  key: string,
  handlers: ModuleCloudHandlers<T>,
) {
  const auth = getAuth(app);
  let unsubscribeSnapshot: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
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

    const docRef = doc(db, 'users', user.uid, 'workspace', 'config');
    unsubscribeSnapshot = onSnapshot(
      docRef,
      (snapshot) => {
        const value = snapshot.data()?.moduleData?.[moduleId]?.[key];
        if (isModuleCloudEnvelope<T>(value)) {
          handlers.onData(value);
        }
        markReady();
      },
      (error) => {
        console.error(`Failed to sync ${moduleId}/${key} from cloud`, error);
        handlers.onError?.(error);
        markReady();
      },
    );
  });

  return () => {
    unsubscribeSnapshot?.();
    unsubscribeAuth();
  };
}

export async function saveModuleCloudData<T>(
  moduleId: string,
  key: string,
  data: ModuleCloudEnvelope<T>,
) {
  const user = getAuth(app).currentUser;
  if (!user || (typeof navigator !== 'undefined' && !navigator.onLine)) return;

  const docRef = doc(db, 'users', user.uid, 'workspace', 'config');
  await setDoc(
    docRef,
    {
      moduleData: {
        [moduleId]: {
          [key]: data,
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

function isModuleCloudEnvelope<T>(value: unknown): value is ModuleCloudEnvelope<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'value' in value &&
      typeof (value as ModuleCloudEnvelope<T>).updatedAt === 'number',
  );
}
