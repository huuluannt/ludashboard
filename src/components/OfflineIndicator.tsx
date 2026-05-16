import { useState, useEffect } from 'react';

/**
 * Offline Indicator — shows a small toast when the user goes offline,
 * and a brief "back online" toast when connection is restored.
 */
export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setShowOnlineToast(true);
      // Auto-hide "back online" toast after 3 seconds
      setTimeout(() => setShowOnlineToast(false), 3000);
    };

    const goOffline = () => {
      setIsOnline(false);
      setShowOnlineToast(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Nothing to show when online and no toast
  if (isOnline && !showOnlineToast) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium
          shadow-lg border transition-all duration-300
          ${
            isOnline
              ? 'bg-white border-emerald-200 text-emerald-700'
              : 'bg-white border-amber-200 text-amber-700'
          }
        `}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
          }`}
        />
        {isOnline ? 'Back online' : 'You are offline — modules with offline support still work'}
      </div>
    </div>
  );
}
