import { create } from 'zustand';
import { offlineStorage } from '@/storage/offlineStorage';

interface RightSidebarState {
  enabled: boolean;
  visible: boolean;
  moduleId: string;
}

interface RightSidebarStore extends RightSidebarState {
  _hydrated: boolean;
  hydrate: () => Promise<void>;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  closeFully: () => void;
  setModuleId: (moduleId: string) => void;
  syncFromCloud: (state: LegacyRightSidebarState) => void;
}

type LegacyRightSidebarState = Partial<RightSidebarState> & { open?: boolean; variant?: string };

const DEFAULT_STATE: RightSidebarState = {
  enabled: true,
  visible: false,
  moduleId: 'lufast',
};

function normalizeRightSidebarState(value: unknown): RightSidebarState {
  if (!value || typeof value !== 'object') return DEFAULT_STATE;
  const data = value as LegacyRightSidebarState;
  if (data.variant === 'corner') return DEFAULT_STATE;
  const legacyOpen = typeof data.open === 'boolean' ? data.open : undefined;

  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_STATE.enabled,
    visible: typeof data.visible === 'boolean' ? data.visible : legacyOpen ?? DEFAULT_STATE.visible,
    moduleId: typeof data.moduleId === 'string' && data.moduleId ? data.moduleId : DEFAULT_STATE.moduleId,
  };
}

function persist(state: RightSidebarState) {
  offlineStorage.setRightSidebar(state);
}

export const useRightSidebarStore = create<RightSidebarStore>((set, get) => ({
  ...DEFAULT_STATE,
  _hydrated: false,

  async hydrate() {
    const stored = normalizeRightSidebarState(await offlineStorage.getRightSidebar());
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
    const legacyOpen = typeof state.open === 'boolean' ? state.open : undefined;
    const next = normalizeRightSidebarState({
      enabled: state.enabled ?? (legacyOpen !== undefined ? DEFAULT_STATE.enabled : get().enabled),
      visible: state.visible ?? legacyOpen ?? get().visible,
      moduleId: state.moduleId ?? get().moduleId,
      variant: state.variant,
    });
    set(next);
    persist(next);
  },
}));
