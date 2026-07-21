import { create } from 'zustand';
import { offlineStorage } from '@/storage/offlineStorage';

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  picture: string;
}

interface UserStore {
  user: UserInfo | null;
  _hydrated: boolean;

  hydrate: () => Promise<void>;
  setUser: (user: UserInfo | null) => void;
  signOut: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  _hydrated: false,

  async hydrate() {
    const user = (await offlineStorage.getUser()) as UserInfo | null;
    // One-time migration for installs created before workspace ownership was
    // tracked: the persisted signed-in user is the only safe owner candidate.
    if (user && user.id !== 'demo-user' && !(await offlineStorage.getWorkspaceOwner())) {
      await offlineStorage.setWorkspaceOwner(user.id);
    }
    set({ user, _hydrated: true });
  },

  setUser(user: UserInfo | null) {
    set({ user });
    offlineStorage.setUser(user);
  },

  signOut() {
    set({ user: null });
    offlineStorage.setUser(null);
  },
}));
