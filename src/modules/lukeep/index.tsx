import Icon from '@/components/Icon';

export default function LuKeepModule() {
  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
          <Icon name="sticky-note" size={17} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">LuKeep</h2>
          <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">Google Keep API access is limited</p>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center bg-[var(--color-surface-muted)] p-6">
        <article className="max-w-xl rounded-2xl border border-[var(--color-border)] bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
            <Icon name="sticky-note" size={26} />
          </div>
          <h3 className="text-base font-semibold">Google Keep cannot be opened from this OAuth flow</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
            Google Keep API is documented for enterprise Workspace use. Enabling the API in Google Cloud is not enough for a normal consumer Gmail OAuth consent screen, so Google blocks the Keep scope before LuDashboard receives a token.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => window.open('https://keep.google.com/', '_blank', 'noopener,noreferrer')}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black"
            >
              <Icon name="external-link" size={13} />
              Open Google Keep
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
