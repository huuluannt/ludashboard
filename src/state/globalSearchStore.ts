import { create } from 'zustand';

export type GlobalSearchSource = 'ctrl-k' | 'slash' | 'programmatic';

export interface GlobalSearchFocusOptions {
  select?: boolean;
  source?: GlobalSearchSource;
}

interface GlobalSearchController {
  focus: (options?: GlobalSearchFocusOptions) => void;
  blur: () => void;
  containsTarget: (target: EventTarget | null) => boolean;
  isFocused: () => boolean;
  isOpen: () => boolean;
}

interface GlobalSearchStore {
  controller: GlobalSearchController | null;
  registerSearchController: (controller: GlobalSearchController | null) => void;
  focusSearch: (options?: GlobalSearchFocusOptions) => void;
  blurSearch: () => void;
  containsSearchTarget: (target: EventTarget | null) => boolean;
  isSearchFocused: () => boolean;
  isSearchOpen: () => boolean;
}

export const useGlobalSearchStore = create<GlobalSearchStore>((set, get) => ({
  controller: null,

  registerSearchController(controller) {
    set({ controller });
  },

  focusSearch(options) {
    get().controller?.focus(options);
  },

  blurSearch() {
    get().controller?.blur();
  },

  containsSearchTarget(target) {
    return get().controller?.containsTarget(target) ?? false;
  },

  isSearchFocused() {
    return get().controller?.isFocused() ?? false;
  },

  isSearchOpen() {
    return get().controller?.isOpen() ?? false;
  },
}));
