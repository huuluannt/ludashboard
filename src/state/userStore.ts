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
