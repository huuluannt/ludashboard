import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';

export interface GoogleDropdownAccount {
  accountId: string;
  email: string;
  needsReconnect?: boolean;
}

interface GoogleAccountDropdownProps<TAccount extends GoogleDropdownAccount> {
  accounts: TAccount[];
  value: string;
  allLabel: string;
  connecting: boolean;
  onChange: (value: string) => void;
  onConnect: () => void | Promise<void>;
  className?: string;
}

export default function GoogleAccountDropdown<TAccount extends GoogleDropdownAccount>({
  accounts,
  value,
  allLabel,
  connecting,
  onChange,
  onConnect,
  className = '',
}: GoogleAccountDropdownProps<TAccount>) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedAccount = accounts.find((account) => account.accountId === value);
  const selectedLabel = selectedAccount
    ? `${selectedAccount.email}${selectedAccount.needsReconnect ? ' (Reconnect)' : ''}`
    : allLabel;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (event.target instanceof Node && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const chooseAccount = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 min-w-[190px] max-w-[280px] items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium text-[var(--color-text-primary)] outline-none transition-colors hover:bg-white focus:border-[var(--color-accent)] focus:bg-white"
      >
        <span className="truncate">{selectedLabel}</span>
        <Icon name="chevron-right" size={14} className={`flex-shrink-0 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-40 w-72 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white py-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => chooseAccount('all')}
            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors ${
              value === 'all'
                ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]'
            }`}
          >
            <span>{allLabel}</span>
            {value === 'all' && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </button>

          {accounts.map((account) => {
            const selected = account.accountId === value;
            return (
              <button
                key={account.accountId}
                type="button"
                role="menuitem"
                onClick={() => chooseAccount(account.accountId)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{account.email}</span>
                  {account.needsReconnect && (
                    <span className="mt-0.5 block text-[10px] font-semibold text-amber-600">Reconnect needed</span>
                  )}
                </span>
                {selected && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current" />}
              </button>
            );
          })}

          <div className="my-1 border-t border-[var(--color-border-subtle)]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void onConnect();
            }}
            disabled={connecting}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="plus" size={13} />
            {connecting ? 'Connecting...' : 'Connect account'}
          </button>
        </div>
      )}
    </div>
  );
}
