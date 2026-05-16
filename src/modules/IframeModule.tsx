import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

export default function IframeModule({ url }: { url: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.focus();
    }
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]">
        <Icon name="cloud" size={48} className="mb-4 text-[var(--color-text-tertiary)] opacity-50" />
        <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Failed to load</h3>
        <p className="text-sm mt-1">This module could not be loaded. You may be offline or the URL is blocked.</p>
        <p className="text-xs mt-4 font-mono bg-[var(--color-surface-muted)] px-2 py-1 rounded">{url}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white relative">
      {!navigator.onLine && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-[10px] text-center py-0.5 border-b border-yellow-200 z-10 font-medium">
          You are offline. Features may be limited.
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={url}
        className="w-full h-full border-none flex-1"
        allow="clipboard-write; clipboard-read"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        onError={() => setError(true)}
      />
    </div>
  );
}
