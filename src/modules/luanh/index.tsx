import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import GoogleAccountDropdown from '@/components/GoogleAccountDropdown';
import Icon from '@/components/Icon';
import { app } from '@/firebase/config';
import {
  fetchGoogleAppAccounts,
  googleAppApi,
  removeGoogleAppAccount,
  startGoogleAppConnection,
} from '@/modules/google-workspace/googleAppApi';
import type { GoogleWorkspaceAccount, GoogleWorkspaceListError } from '@/modules/google-workspace/types';

interface GooglePhoto {
  id: string;
  filename: string;
  description: string;
  baseUrl: string;
  mimeType: string;
  productUrl: string;
  creationTime: string;
  width: string;
  height: string;
  type: string;
  sessionId: string;
  accountId: string;
  accountEmail: string;
}

interface PhotosPickerSession {
  id: string;
  pickerUri: string;
  expireTime: string;
  mediaItemsSet: boolean;
  pollingConfig: {
    pollInterval?: string;
    timeoutIn?: string;
  } | null;
  accountId: string;
  accountEmail: string;
}

interface PhotosSessionResponse {
  session: PhotosPickerSession;
}

interface PhotosMediaResponse {
  mediaItems: GooglePhoto[];
  errors?: GoogleWorkspaceListError[];
}

const APP_ID = 'photos';
const API_BASE_PATH = '/api/photos';
const SESSION_STORAGE_PREFIX = 'ludashboard:luanh:picker-session:';

export default function LuAnhModule() {
  const [dashboardUser, setDashboardUser] = useState<User | null>(() => getAuth(app).currentUser);
  const [accounts, setAccounts] = useState<GoogleWorkspaceAccount[]>([]);
  const [accountFilter, setAccountFilter] = useState('all');
  const [session, setSession] = useState<PhotosPickerSession | null>(null);
  const [mediaItems, setMediaItems] = useState<GooglePhoto[]>([]);
  const [activeItem, setActiveItem] = useState<GooglePhoto | null>(null);
  const [query, setQuery] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const reconnectAccounts = accounts.filter((account) => account.needsReconnect);
  const selectedAccount = accounts.find((account) => account.accountId === accountFilter) || null;
  const pickerAccount = selectedAccount || accounts.find((account) => !account.needsReconnect) || accounts[0] || null;
  const itemStats = useMemo(() => `${mediaItems.length} ${mediaItems.length === 1 ? 'photo' : 'photos'}`, [mediaItems.length]);

  const loadAccounts = useCallback(async () => {
    if (!getAuth(app).currentUser) return;
    setLoadingAccounts(true);
    setError('');
    try {
      const { accounts: nextAccounts } = await fetchGoogleAppAccounts(API_BASE_PATH, 'LuAnh');
      setAccounts(nextAccounts);
      setAccountFilter((current) => {
        if (current === 'all' || nextAccounts.some((account) => account.accountId === current)) return current;
        return 'all';
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load LuAnh accounts.');
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const loadMediaItems = useCallback(async (targetSession: PhotosPickerSession | null) => {
    if (!targetSession?.id) return;

    setLoadingMedia(true);
    setError('');
    try {
      const data = await googleAppApi<PhotosMediaResponse>('/api/photos/media', 'LuAnh', {
        query: {
          accountId: targetSession.accountId,
          sessionId: targetSession.id,
          q: query.trim(),
          pageSize: '80',
        },
      });
      const nextItems = Array.isArray(data.mediaItems) ? data.mediaItems : [];
      setMediaItems(nextItems);
      setActiveItem((current) => {
        if (current && nextItems.some((item) => getPhotoKey(item) === getPhotoKey(current))) return current;
        return nextItems[0] || null;
      });
      setStatus(data.errors?.length ? data.errors.map((item) => `${item.email}: ${item.error}`).join(' | ') : '');
    } catch (mediaError) {
      setError(mediaError instanceof Error ? mediaError.message : 'Unable to load selected Google Photos.');
    } finally {
      setLoadingMedia(false);
    }
  }, [query]);

  const refreshSession = useCallback(async (targetSession: PhotosPickerSession | null = session) => {
    if (!targetSession?.id) return null;

    try {
      const data = await googleAppApi<PhotosSessionResponse>('/api/photos/sessions', 'LuAnh', {
        query: {
          accountId: targetSession.accountId,
          sessionId: targetSession.id,
        },
      });
      setSession(data.session);
      persistSession(data.session);
      if (data.session.mediaItemsSet) {
        setStatus('Photos selected. Loading previews...');
        await loadMediaItems(data.session);
      } else {
        setStatus('Waiting for Google Photos selection to finish.');
      }
      return data.session;
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to refresh Photos Picker session.');
      return null;
    }
  }, [loadMediaItems, session]);

  const createPickerSession = async () => {
    if (!pickerAccount) return;

    setCreatingSession(true);
    setStatus('');
    setError('');
    try {
      const data = await googleAppApi<PhotosSessionResponse>('/api/photos/sessions', 'LuAnh', {
        method: 'POST',
        body: JSON.stringify({ accountId: pickerAccount.accountId, maxItemCount: 200 }),
      });
      setSession(data.session);
      persistSession(data.session);
      setMediaItems([]);
      setActiveItem(null);
      setStatus('Choose photos in the Google Photos window, then return here.');
      if (data.session.pickerUri) {
        const popup = window.open(autoclosePickerUri(data.session.pickerUri), 'ludashboard-luanh-picker', 'width=900,height=760');
        if (!popup) setError('Popup was blocked. Allow popups, then use the Open picker button.');
      }
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to start Google Photos Picker.');
    } finally {
      setCreatingSession(false);
    }
  };

  const connectAccount = async () => {
    setConnecting(true);
    setError('');
    try {
      const { authUrl } = await startGoogleAppConnection(API_BASE_PATH, 'LuAnh');
      const popup = window.open(authUrl, 'ludashboard-photos-google-oauth', 'width=520,height=720');
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
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect LuAnh.');
    }
  };

  const removeSelectedAccount = async () => {
    if (!selectedAccount) return;
    if (!window.confirm(`Remove ${selectedAccount.email} from LuAnh?`)) return;
    await removeGoogleAppAccount(API_BASE_PATH, 'LuAnh', selectedAccount.accountId);
    setAccounts((current) => current.filter((account) => account.accountId !== selectedAccount.accountId));
    setAccountFilter('all');
    setSession(null);
    setMediaItems([]);
    setActiveItem(null);
  };

  useEffect(() => {
    const auth = getAuth(app);
    return onAuthStateChanged(auth, (user) => {
      setDashboardUser(user);
      if (user) void loadAccounts();
    });
  }, [loadAccounts]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === `ludashboard-${APP_ID}-connected`) {
        setConnecting(false);
        setStatus('LuAnh account connected.');
        void loadAccounts();
      }
      if (event.data?.type === `ludashboard-${APP_ID}-error`) {
        setConnecting(false);
        setError('LuAnh connection failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadAccounts]);

  useEffect(() => {
    if (!pickerAccount) {
      setSession(null);
      return;
    }

    const restored = restoreSession(pickerAccount.accountId);
    setSession(restored);
    setMediaItems([]);
    setActiveItem(null);
    if (restored?.mediaItemsSet) void loadMediaItems(restored);
  }, [pickerAccount?.accountId]);

  useEffect(() => {
    if (!session || session.mediaItemsSet) return;
    const interval = window.setInterval(() => {
      void refreshSession(session);
    }, parseDuration(session.pollingConfig?.pollInterval, 3000));
    return () => window.clearInterval(interval);
  }, [refreshSession, session]);

  if (!dashboardUser) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="images" size={26} />
          </div>
          <h2 className="text-lg font-semibold">Sign in to use LuAnh</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
            LuAnh connects Google accounts separately, while LuDashboard protects its server APIs.
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
            <Icon name="images" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">LuAnh</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
              {loadingAccounts ? 'Loading accounts...' : `${accounts.length} Google accounts`} | {itemStats}
            </p>
          </div>
        </div>

        <GoogleAccountDropdown
          accounts={accounts}
          value={accountFilter}
          allLabel="All connected Photos"
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
              if (event.key === 'Enter') void loadMediaItems(session);
            }}
            className="h-full w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white"
            placeholder="Search selected photos..."
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
        <ConnectEmptyState connecting={connecting} onConnect={connectAccount} />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 bg-[var(--color-surface-muted)] lg:grid-cols-[minmax(320px,460px)_1fr]">
          <section className="min-h-0 overflow-y-auto border-r border-[var(--color-border-subtle)] bg-white">
            <div className="border-b border-[var(--color-border-subtle)] p-4">
              <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
                <p className="text-sm font-semibold">Google Photos Picker</p>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-tertiary)]">
                  Google Photos now returns only photos selected in a Picker session. Reconnect LuAnh, choose photos, then load the selected items here.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void createPickerSession()}
                    disabled={!pickerAccount || creatingSession || pickerAccount.needsReconnect}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon name="images" size={14} />
                    {creatingSession ? 'Starting...' : 'Select photos'}
                  </button>
                  {session?.pickerUri && !session.mediaItemsSet && (
                    <button
                      type="button"
                      onClick={() => window.open(autoclosePickerUri(session.pickerUri), 'ludashboard-luanh-picker', 'width=900,height=760')}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 text-xs font-semibold transition-colors hover:bg-white"
                    >
                      <Icon name="external-link" size={14} />
                      Open picker
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void refreshSession()}
                    disabled={!session || loadingMedia}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 text-xs font-semibold transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon name="rotate-cw" size={14} />
                    Load selected
                  </button>
                </div>
              </div>
            </div>

            {loadingMedia ? (
              <div className="p-4 text-xs text-[var(--color-text-tertiary)]">Loading selected Google Photos...</div>
            ) : mediaItems.length === 0 ? (
              <div className="flex h-[calc(100%-160px)] items-center justify-center p-6 text-center">
                <div>
                  <Icon name="images" size={24} className="mx-auto text-[var(--color-text-tertiary)]" />
                  <p className="mt-2 text-sm font-medium">No selected photos</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Choose photos in the Picker, then load selected items.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                {mediaItems.map((photo) => {
                  const selected = activeItem ? getPhotoKey(activeItem) === getPhotoKey(photo) : false;
                  return (
                    <button
                      key={getPhotoKey(photo)}
                      type="button"
                      onClick={() => setActiveItem(photo)}
                      className={`overflow-hidden rounded-2xl border text-left transition-colors ${
                        selected ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)]' : 'border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border)]'
                      }`}
                    >
                      <div className="aspect-square bg-[var(--color-surface-subtle)]">
                        {photo.baseUrl ? (
                          <img src={`${photo.baseUrl}=w320-h320-c`} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[var(--color-accent)]">
                            <Icon name={photo.type === 'VIDEO' ? 'film' : 'image'} size={24} />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="truncate text-[11px] font-semibold">{photo.filename || 'Google Photos item'}</p>
                        <p className="mt-0.5 truncate text-[10px] text-[var(--color-text-tertiary)]">{formatDate(photo.creationTime)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="min-h-0 overflow-y-auto p-4">
            {activeItem ? (
              <PhotoDetail photo={activeItem} />
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
                    <Icon name="images" size={26} />
                  </div>
                  <h3 className="text-base font-semibold">Select a photo</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-tertiary)]">Choose an item from the selected Google Photos list.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function PhotoDetail({ photo }: { photo: GooglePhoto }) {
  return (
    <article className="mx-auto max-w-5xl rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
          <Icon name={photo.type === 'VIDEO' ? 'film' : 'image'} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-semibold">{photo.filename || 'Google Photos item'}</h3>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{photo.accountEmail}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {photo.baseUrl && (
          <img
            src={`${photo.baseUrl}=w1600-h1000`}
            alt={photo.filename}
            className="max-h-[560px] w-full rounded-2xl border border-[var(--color-border-subtle)] object-contain"
          />
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <InfoRow label="Created" value={formatDate(photo.creationTime)} />
          <InfoRow label="Type" value={photo.mimeType || photo.type || 'Unknown'} />
          <InfoRow label="Size" value={photo.width && photo.height ? `${photo.width} x ${photo.height}` : 'Unknown'} />
          <InfoRow label="Account" value={photo.accountEmail} />
        </div>
        {photo.description && (
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm leading-6">
            {photo.description}
          </div>
        )}
        {photo.baseUrl && (
          <button type="button" onClick={() => window.open(`${photo.baseUrl}=w2048-h2048`, '_blank', 'noopener,noreferrer')} className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black">
            <Icon name="external-link" size={13} />
            Open preview
          </button>
        )}
      </div>
    </article>
  );
}

function ConnectEmptyState({ connecting, onConnect }: { connecting: boolean; onConnect: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
          <Icon name="images" size={25} />
        </div>
        <h3 className="text-base font-semibold">Connect Google Photos</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
          LuAnh uses the Google Photos Picker API, so the account must grant the picker scope before photos can be selected.
        </p>
        <button type="button" onClick={onConnect} disabled={connecting} className="mt-4 h-9 rounded-lg bg-[var(--color-text-primary)] px-4 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-50">
          {connecting ? 'Connecting...' : 'Connect account'}
        </button>
      </div>
    </div>
  );
}

function getPhotoKey(photo: GooglePhoto) {
  return `${photo.accountId}:${photo.sessionId}:${photo.id}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 break-words text-xs font-medium">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseDuration(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const seconds = Number(String(value).replace(/s$/, ''));
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return Math.max(1200, seconds * 1000);
}

function persistSession(session: PhotosPickerSession) {
  try {
    window.localStorage.setItem(`${SESSION_STORAGE_PREFIX}${session.accountId}`, JSON.stringify(session));
  } catch {
    // Session restore is a convenience only.
  }
}

function restoreSession(accountId: string) {
  try {
    const raw = window.localStorage.getItem(`${SESSION_STORAGE_PREFIX}${accountId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PhotosPickerSession;
    if (parsed.expireTime && Date.parse(parsed.expireTime) < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function autoclosePickerUri(uri: string) {
  return uri.endsWith('/autoclose') ? uri : `${uri.replace(/\/$/, '')}/autoclose`;
}
