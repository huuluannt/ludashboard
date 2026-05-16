import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * SW Update Prompt — appears when a new version of the app is available.
 * User can reload to update or dismiss.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for updates every 60 minutes
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
      console.info('[SW] Registered:', swUrl);
    },
    onRegisterError(error) {
      console.error('[SW] Registration error:', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-lg p-4 max-w-[280px]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Update Available</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
              A new version of LuDashboard is ready
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => updateServiceWorker(true)}
            className="flex-1 h-8 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            Reload & Update
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="h-8 px-3 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] transition-colors cursor-pointer"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
