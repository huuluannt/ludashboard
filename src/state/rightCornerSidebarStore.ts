import { create } from 'zustand';
import { offlineStorage } from '@/storage/offlineStorage';

interface RightCornerSidebarState {
  enabled: boolean;
  visible: boolean;
  moduleId: string;
}

interface RightCornerSidebarStore extends RightCornerSidebarState {
  _hydrated: boolean;
  hydrate: () => Promise<void>;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  closeFully: () => void;
  setModuleId: (moduleId: string) => void;
  syncFromCloud: (state: Partial<RightCornerSidebarState>) => void;
}

const DEFAULT_STATE: RightCornerSidebarState = {
  enabled: true,
  visible: false,
  moduleId: 'luchat',
};

function normalizeRightCornerSidebarState(value: unknown): RightCornerSidebarState {
  if (!value || typeof value !== 'object') return DEFAULT_STATE;
  const data = value as Partial<RightCornerSidebarState>;

  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_STATE.enabled,
    visible: typeof data.visible === 'boolean' ? data.visible : DEFAULT_STATE.visible,
    moduleId: typeof data.moduleId === 'string' && data.moduleId ? data.moduleId : DEFAULT_STATE.moduleId,
  };
}

function persist(state: RightCornerSidebarState) {
  offlineStorage.setRightCornerSidebar(state);
}

export const useRightCornerSidebarStore = create<RightCornerSidebarStore>((set, get) => ({
  ...DEFAULT_STATE,
  _hydrated: false,

  async hydrate() {
    const stored = normalizeRightCornerSidebarState(await offlineStorage.getRightCornerSidebar());
    set({ ...stored, _hydrated: true });
  },

  setVisible(visible) {
    const next = { enabled: true, visible, moduleId: get().moduleId };
    set(next);
    persist(next);
  },

  toggleVisible() {
    const current = get();
    const next = { enabled: true, visible: !current.visible, moduleId: current.moduleId };
    set(next);
    persist(next);
  },

  closeFully() {
    const next = { enabled: false, visible: false, moduleId: get().moduleId };
    set(next);
    persist(next);
  },

  setModuleId(moduleId) {
    const current = get();
    const next = { enabled: current.enabled, visible: current.visible, moduleId };
    set(next);
    persist(next);
  },

  syncFromCloud(state) {
    const next = normalizeRightCornerSidebarState({
      enabled: state.enabled ?? get().enabled,
      visible: state.visible ?? get().visible,
      moduleId: state.moduleId ?? get().moduleId,
    });
    set(next);
    persist(next);
  },
}));
