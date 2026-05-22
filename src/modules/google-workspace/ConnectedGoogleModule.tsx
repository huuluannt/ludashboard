import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import GoogleAccountDropdown from '@/components/GoogleAccountDropdown';
import Icon from '@/components/Icon';
import { app } from '@/firebase/config';
import {
  fetchGoogleAppAccounts,
  googleAppApi,
  removeGoogleAppAccount,
  startGoogleAppConnection,
} from './googleAppApi';
import type { GoogleWorkspaceAccount, GoogleWorkspaceListError } from './types';

interface ConnectedGoogleItem {
  accountId: string;
  accountEmail: string;
}

interface ConnectedGoogleModuleProps<TItem extends ConnectedGoogleItem> {
  appId: string;
  apiBasePath: string;
  title: string;
  icon: string;
  accountLabel: string;
  itemLabel: string;
  endpointPath: string;
  responseKey: string;
  searchPlaceholder: string;
  connectTitle: string;
  connectDescription: string;
  emptyTitle: string;
  emptyHint: string;
  loadingText: string;
  getItemKey: (item: TItem) => string;
  getItemTitle: (item: TItem) => string;
  renderItemContent: (item: TItem) => ReactNode;
  renderDetail: (item: TItem) => ReactNode;
  getItemIcon?: (item: TItem) => string;
}

export default function ConnectedGoogleModule<TItem extends ConnectedGoogleItem>({
  appId,
  apiBasePath,
  title,
  icon,
  accountLabel,
  itemLabel,
  endpointPath,
  responseKey,
  searchPlaceholder,
  connectTitle,
  connectDescription,
  emptyTitle,
  emptyHint,
  loadingText,
  getItemKey,
  getItemTitle,
  renderItemContent,
  renderDetail,
  getItemIcon,
}: ConnectedGoogleModuleProps<TItem>) {
  const [dashboardUser, setDashboardUser] = useState<User | null>(() => getAuth(app).currentUser);
  const [accounts, setAccounts] = useState<GoogleWorkspaceAccount[]>([]);
  const [items, setItems] = useState<TItem[]>([]);
  const [activeItem, setActiveItem] = useState<TItem | null>(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const reconnectAccounts = accounts.filter((account) => account.needsReconnect);
  const selectedAccount = accounts.find((account) => account.accountId === accountFilter) || null;

  const itemStats = useMemo(() => `${items.length} ${items.length === 1 ? itemLabel : `${itemLabel}s`}`, [itemLabel, items.length]);

  const loadAccounts = useCallback(async () => {
    if (!getAuth(app).currentUser) return;
    setLoadingAccounts(true);
    setError('');
    try {
      const { accounts: nextAccounts } = await fetchGoogleAppAccounts(apiBasePath, title);
      setAccounts(nextAccounts);
      setAccountFilter((current) => {
        if (current === 'all' || nextAccounts.some((account) => account.accountId === current)) return current;
        return 'all';
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `Unable to load ${title} accounts.`);
    } finally {
      setLoadingAccounts(false);
    }
  }, [apiBasePath, title]);

  const loadItems = useCallback(async () => {
    if (!getAuth(app).currentUser || accounts.length === 0) return;
    setLoadingItems(true);
    setError('');
    try {
      const data = await googleAppApi<Record<string, unknown> & { errors?: GoogleWorkspaceListError[] }>(endpointPath, title, {
        query: {
          accountId: accountFilter,
          q: query.trim(),
          pageSize: '80',
        },
      });
      const nextItems = Array.isArray(data[responseKey]) ? (data[responseKey] as TItem[]) : [];
      setItems(nextItems);
      setActiveItem((current) => {
        if (current && nextItems.some((item) => getItemKey(item) === getItemKey(current))) return current;
        return nextItems[0] || null;
      });
      if (data.errors?.length) {
        setStatus(data.errors.map((item) => `${item.email}: ${item.error}`).join(' | '));
      } else {
        setStatus('');
      }
    } catch (itemsError) {
      setError(itemsError instanceof Error ? itemsError.message : `Unable to load ${title} data.`);
    } finally {
      setLoadingItems(false);
    }
  }, [accountFilter, accounts.length, endpointPath, getItemKey, query, responseKey, title]);

  useEffect(() => {
    const auth = getAuth(app);
    return onAuthStateChanged(auth, (user) => {
      setDashboardUser(user);
      if (user) void loadAccounts();
    });
  }, [loadAccounts]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === `ludashboard-${appId}-connected`) {
        setConnecting(false);
        setStatus(`${title} account connected.`);
        void loadAccounts();
      }
      if (event.data?.type === `ludashboard-${appId}-error`) {
        setConnecting(false);
        setError(`${title} connection failed.`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [appId, loadAccounts, title]);

  const connectAccount = async () => {
    setConnecting(true);
    setError('');
    try {
      const { authUrl } = await startGoogleAppConnection(apiBasePath, title);
      const popup = window.open(authUrl, `ludashboard-${appId}-google-oauth`, 'width=520,height=720');
      if (!popup) {
        setConnecting(false);
        setError('Popup was blocked. Allow popups and try again.');
        return;
      }

      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          setConnecting(false);
          void loadAccounts();
        }
      }, 900);
    } catch (connectError) {
      setConnecting(false);
      setError(connectError instanceof Error ? connectError.message : `Unable to connect ${title}.`);
    }
  };

  const removeSelectedAccount = async () => {
    if (!selectedAccount) return;
    if (!window.confirm(`Remove ${selectedAccount.email} from ${title}?`)) return;
    await removeGoogleAppAccount(apiBasePath, title, selectedAccount.accountId);
    setAccounts((current) => current.filter((account) => account.accountId !== selectedAccount.accountId));
    setAccountFilter('all');
    setItems((current) => current.filter((item) => item.accountId !== selectedAccount.accountId));
    setActiveItem(null);
  };

  if (!dashboardUser) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name={icon} size={26} />
          </div>
          <h2 className="text-lg font-semibold">Sign in to use {title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
            {title} connects Google accounts separately, while LuDashboard protects its server APIs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2">
        <div className="flex min-w-[210px] flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name={icon} size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{title}</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
              {loadingAccounts ? 'Loading accounts...' : `${accounts.length} Google accounts`} | {itemStats}
            </p>
          </div>
        </div>

        <GoogleAccountDropdown
          accounts={accounts}
          value={accountFilter}
          allLabel={`All connected ${accountLabel}`}
          connecting={connecting}
          onChange={setAccountFilter}
          onConnect={connectAccount}
        />

        <label className="relative flex h-8 min-w-[180px] flex-1 items-center lg:max-w-sm">
          <Icon name="search" size={13} className="pointer-events-none absolute left-2.5 text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void loadItems();
            }}
            className="h-full w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white"
            placeholder={searchPlaceholder}
          />
        </label>

        {selectedAccount && (
          <button type="button" onClick={removeSelectedAccount} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-red-50 hover:text-[var(--color-danger)]">
            <Icon name="trash" size={13} />
            Remove
          </button>
        )}
      </header>

      {(status || error || reconnectAccounts.length > 0) && (
        <div className="flex-shrink-0 border-b border-[var(--color-border-subtle)] px-4 py-2">
          {reconnectAccounts.length > 0 && <p className="text-xs font-medium text-amber-700">Reconnect account: {reconnectAccounts.map((account) => account.email).join(', ')}</p>}
          {status && <p className="text-xs text-[var(--color-text-secondary)]">{status}</p>}
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        </div>
      )}

      {accounts.length === 0 && !loadingAccounts ? (
        <ConnectEmptyState icon={icon} title={connectTitle} description={connectDescription} connecting={connecting} onConnect={connectAccount} />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 bg-[var(--color-surface-muted)] lg:grid-cols-[minmax(300px,420px)_1fr]">
          <section className="min-h-0 overflow-y-auto border-r border-[var(--color-border-subtle)] bg-white">
            {loadingItems ? (
              <div className="p-4 text-xs text-[var(--color-text-tertiary)]">{loadingText}</div>
            ) : items.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div>
                  <Icon name={icon} size={24} className="mx-auto text-[var(--color-text-tertiary)]" />
                  <p className="mt-2 text-sm font-medium">{emptyTitle}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{emptyHint}</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-subtle)]">
                {items.map((item) => {
                  const itemKey = getItemKey(item);
                  const selected = activeItem ? getItemKey(activeItem) === itemKey : false;
                  return (
                    <button
                      key={itemKey}
                      type="button"
                      onClick={() => setActiveItem(item)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        selected ? 'bg-[var(--color-accent-subtle)]' : 'hover:bg-[var(--color-surface-muted)]'
                      }`}
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
                        <Icon name={getItemIcon?.(item) || icon} size={16} />
                      </div>
                      <div className="min-w-0 flex-1">{renderItemContent(item)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="min-h-0 overflow-y-auto p-4">
            {activeItem ? (
              <article className="mx-auto max-w-4xl rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
                    <Icon name={getItemIcon?.(activeItem) || icon} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-base font-semibold">{getItemTitle(activeItem)}</h3>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{activeItem.accountEmail}</p>
                  </div>
                </div>
                <div className="mt-5">{renderDetail(activeItem)}</div>
              </article>
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
                    <Icon name={icon} size={26} />
                  </div>
                  <h3 className="text-base font-semibold">Select an item</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-tertiary)]">{emptyHint}</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ConnectEmptyState({
  icon,
  title,
  description,
  connecting,
  onConnect,
}: {
  icon: string;
  title: string;
  description: string;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
          <Icon name={icon} size={25} />
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">{description}</p>
        <button type="button" onClick={onConnect} disabled={connecting} className="mt-4 h-9 rounded-lg bg-[var(--color-text-primary)] px-4 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-50">
          {connecting ? 'Connecting...' : 'Connect account'}
        </button>
      </div>
    </div>
  );
}
