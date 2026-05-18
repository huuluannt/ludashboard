import { useEffect } from 'react';
import { useGlobalSearchStore } from '@/state/globalSearchStore';

export function useGlobalHotkeys() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const searchStore = useGlobalSearchStore.getState();
      const target = event.target;
      const isSearchTarget = searchStore.containsSearchTarget(target);
      const isEditableTarget = isTypingTarget(target);
      const key = event.key.toLowerCase();
      const ctrlOrMeta = event.ctrlKey || event.metaKey;

      if (ctrlOrMeta && !event.altKey && !event.shiftKey && key === 'k') {
        if (isEditableTarget && !isSearchTarget) return;

        event.preventDefault();
        searchStore.focusSearch({
          select: isSearchTarget || searchStore.isSearchFocused(),
          source: 'ctrl-k',
        });
        return;
      }

      if (event.key === '/' && !ctrlOrMeta && !event.altKey && !event.metaKey && !isEditableTarget) {
        event.preventDefault();
        searchStore.focusSearch({ source: 'slash' });
        return;
      }

      if (event.key === 'Escape' && (searchStore.isSearchFocused() || searchStore.isSearchOpen())) {
        if (isEditableTarget && !isSearchTarget) return;

        event.preventDefault();
        searchStore.blurSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.closest('[contenteditable="true"]')) return true;

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}
