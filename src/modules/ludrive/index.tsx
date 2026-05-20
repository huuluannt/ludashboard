import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import Icon from '@/components/Icon';
import { app } from '@/firebase/config';
import {
  fetchDriveAccounts,
  fetchDriveFiles,
  removeDriveAccount,
  startDriveConnection,
} from './driveApi';
import type { DriveFile, GoogleWorkspaceAccount } from './types';

interface FolderCrumb {
  id: string;
  name: string;
  accountId: string;
}

export default function LuDriveModule() {
  const [dashboardUser, setDashboardUser] = useState<User | null>(() => getAuth(app).currentUser);
  const [accounts, setAccounts] = useState<GoogleWorkspaceAccount[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const currentFolder = folderStack[folderStack.length - 1] || null;
  const reconnectAccounts = accounts.filter((account) => account.needsReconnect);
  const selectedAccount = accounts.find((account) => account.accountId === accountFilter) || null;

  const filteredFiles = useMemo(() => files, [files]);

  const loadAccounts = useCallback(async () => {
    if (!getAuth(app).currentUser) return;
    setLoadingAccounts(true);
    setError('');
    try {
      const { accounts: nextAccounts } = await fetchDriveAccounts();
      setAccounts(nextAccounts);
      setAccountFilter((current) => {
        if (current === 'all' || nextAccounts.some((account) => account.accountId === current)) return current;
        return 'all';
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load LuDrive accounts.');
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    if (!getAuth(app).currentUser || accounts.length === 0) return;
    setLoadingFiles(true);
    setError('');
    try {
      const folderAccount = currentFolder?.accountId;
      const accountId = folderAccount || accountFilter;
      const { files: nextFiles, errors } = await fetchDriveFiles({
        accountId,
        q: query.trim(),
        parentId: query.trim() ? '' : currentFolder?.id || '',
        pageSize: 80,
      });
      setFiles(nextFiles);
      setSelectedFile((current) => {
        if (current && nextFiles.some((file) => file.id === current.id && file.accountId === current.accountId)) return current;
        return nextFiles[0] || null;
      });
      if (errors?.length) {
        setStatus(errors.map((item) => `${item.email}: ${item.error}`).join(' | '));
      } else {
        setStatus('');
      }
    } catch (filesError) {
      setError(filesError instanceof Error ? filesError.message : 'Unable to load Drive files.');
    } finally {
      setLoadingFiles(false);
    }
  }, [accountFilter, accounts.length, currentFolder?.accountId, currentFolder?.id, query]);

  useEffect(() => {
    const auth = getAuth(app);
    return onAuthStateChanged(auth, (user) => {
      setDashboardUser(user);
      if (user) void loadAccounts();
    });
  }, [loadAccounts]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'ludashboard-drive-connected') {
        setConnecting(false);
        setStatus('Google Drive account connected.');
        void loadAccounts();
      }
      if (event.data?.type === 'ludashboard-drive-error') {
        setConnecting(false);
        setError('LuDrive connection failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadAccounts]);

  const connectAccount = async () => {
    setConnecting(true);
    setError('');
    try {
      const { authUrl } = await startDriveConnection();
      const popup = window.open(authUrl, 'ludrive-google-oauth', 'width=520,height=720');
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
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect LuDrive.');
    }
  };

  const openFolder = (file: DriveFile) => {
    if (!file.isFolder) return;
    setQuery('');
    setAccountFilter(file.accountId);
    setFolderStack((current) => [...current, { id: file.id, name: file.name, accountId: file.accountId }]);
  };

  const goToRoot = () => {
    setFolderStack([]);
    setQuery('');
  };

  const goToCrumb = (index: number) => {
    setFolderStack((current) => current.slice(0, index + 1));
    setQuery('');
  };

  const removeSelectedAccount = async () => {
    if (!selectedAccount) return;
    if (!window.confirm(`Remove ${selectedAccount.email} from LuDrive? Files stay in Google Drive.`)) return;
    await removeDriveAccount(selectedAccount.accountId);
    setAccounts((current) => current.filter((account) => account.accountId !== selectedAccount.accountId));
    setAccountFilter('all');
    setFolderStack([]);
    setFiles((current) => current.filter((file) => file.accountId !== selectedAccount.accountId));
    setSelectedFile(null);
  };

  if (!dashboardUser) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="hard-drive" size={26} />
          </div>
          <h2 className="text-lg font-semibold">Sign in to use LuDrive</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
            LuDrive connects Google Drive accounts separately, while LuDashboard protects its server APIs.
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
            <Icon name="hard-drive" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">LuDrive</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
              {loadingAccounts ? 'Loading accounts...' : `${accounts.length} Drive accounts`} | {files.length} items
            </p>
          </div>
        </div>

        <select value={accountFilter} onChange={(event) => {
          setAccountFilter(event.target.value);
          setFolderStack([]);
        }} className="h-8 min-w-[190px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] focus:bg-white">
          <option value="all">All connected Drive</option>
          {accounts.map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.email}{account.needsReconnect ? ' (Reconnect)' : ''}
            </option>
          ))}
        </select>

        <label className="relative flex h-8 min-w-[220px] flex-1 items-center lg:max-w-md">
          <Icon name="search" size={13} className="pointer-events-none absolute left-2.5 text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void loadFiles();
            }}
            className="h-full w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white"
            placeholder="Search Drive files..."
          />
        </label>

        {selectedAccount && (
          <button type="button" onClick={removeSelectedAccount} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-red-50 hover:text-[var(--color-danger)]">
            <Icon name="trash" size={13} />
            Remove
          </button>
        )}

        <button type="button" onClick={connectAccount} disabled={connecting} className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">
          <Icon name="plus" size={13} />
          {connecting ? 'Connecting' : 'Connect account'}
        </button>
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
        <div className="grid min-h-0 flex-1 grid-cols-1 bg-[var(--color-surface-muted)] lg:grid-cols-[1fr_320px]">
          <section className="flex min-h-0 flex-col p-3">
            <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white px-3 py-2 shadow-sm">
              <button type="button" onClick={goToRoot} className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]">
                <Icon name="folder" size={13} />
                Root
              </button>
              {folderStack.map((crumb, index) => (
                <button key={crumb.id} type="button" onClick={() => goToCrumb(index)} className="flex h-7 min-w-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]">
                  <Icon name="chevron-right" size={12} />
                  <span className="max-w-[150px] truncate">{crumb.name}</span>
                </button>
              ))}
              {query && <span className="rounded-lg bg-[var(--color-accent-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--color-accent)]">Search: {query}</span>}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
              {loadingFiles ? (
                <div className="p-4 text-xs text-[var(--color-text-tertiary)]">Loading Drive files...</div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex h-full items-center justify-center p-6 text-center">
                  <div>
                    <Icon name="folder" size={26} className="mx-auto text-[var(--color-text-tertiary)]" />
                    <p className="mt-2 text-sm font-medium">No files found</p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Try another account, folder, or search query.</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border-subtle)]">
                  {filteredFiles.map((file) => (
                    <button
                      key={`${file.accountId}:${file.id}`}
                      type="button"
                      onDoubleClick={() => openFolder(file)}
                      onClick={() => setSelectedFile(file)}
                      className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        selectedFile?.id === file.id && selectedFile.accountId === file.accountId
                          ? 'bg-[var(--color-accent-subtle)]'
                          : 'hover:bg-[var(--color-surface-muted)]'
                      }`}
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
                        <Icon name={file.isFolder ? 'folder' : getFileIcon(file.mimeType)} size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{file.name}</p>
                        <p className="mt-1 truncate text-[11px] text-[var(--color-text-tertiary)]">
                          {file.accountEmail} | {formatDriveDate(file.modifiedTime)} | {file.isFolder ? 'Folder' : formatBytes(file.size)}
                        </p>
                      </div>
                      {file.isFolder && (
                        <span className="rounded-lg bg-[var(--color-surface-subtle)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                          Open
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto border-l border-[var(--color-border-subtle)] bg-white p-4">
            {selectedFile ? (
              <div>
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
                    <Icon name={selectedFile.isFolder ? 'folder' : getFileIcon(selectedFile.mimeType)} size={23} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-semibold">{selectedFile.name}</h3>
                    <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{selectedFile.accountEmail}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <InfoRow label="Type" value={selectedFile.isFolder ? 'Folder' : selectedFile.mimeType || 'File'} />
                  <InfoRow label="Modified" value={formatDriveDate(selectedFile.modifiedTime)} />
                  <InfoRow label="Size" value={selectedFile.isFolder ? 'Folder' : formatBytes(selectedFile.size)} />
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {selectedFile.isFolder && (
                    <button type="button" onClick={() => openFolder(selectedFile)} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black">
                      <Icon name="folder" size={14} />
                      Open folder
                    </button>
                  )}
                  {selectedFile.webViewLink && (
                    <button type="button" onClick={() => window.open(selectedFile.webViewLink, '_blank', 'noopener,noreferrer')} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
                      <Icon name="external-link" size={14} />
                      Open in Google Drive
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
                    <Icon name="hard-drive" size={26} />
                  </div>
                  <h3 className="text-base font-semibold">Select a Drive item</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
                    Browse folders, search files, and open Google Drive items from LuDashboard.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function ConnectEmptyState({ connecting, onConnect }: { connecting: boolean; onConnect: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
          <Icon name="hard-drive" size={25} />
        </div>
        <h3 className="text-base font-semibold">Connect Google Drive</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
          LuDrive uses read-only Drive metadata access, so it can browse and open files without editing or deleting them.
        </p>
        <button type="button" onClick={onConnect} disabled={connecting} className="mt-4 h-9 rounded-lg bg-[var(--color-text-primary)] px-4 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-50">
          Connect Google Drive
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 break-words text-xs font-medium">{value}</p>
    </div>
  );
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'film';
  if (mimeType.includes('audio')) return 'music';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'file-text';
  return 'file';
}

function formatDriveDate(value: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatBytes(bytes: number | null) {
  if (!Number.isFinite(bytes || 0) || !bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
