import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import Icon from '@/components/Icon';
import { app } from '@/firebase/config';
import {
  fetchOneDriveAccounts,
  fetchOneDriveContent,
  fetchOneDriveFiles,
  removeOneDriveAccount,
  startOneDriveConnection,
} from './onedriveApi';
import type { OneDriveAccount, OneDriveFile } from './types';

interface FolderCrumb {
  id: string;
  name: string;
  accountId: string;
}

type PreviewState =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'blob'; url: string; mimeType: string }
  | { kind: 'text'; text: string; mimeType: string };

export default function LuOnedriveModule() {
  const [dashboardUser, setDashboardUser] = useState<User | null>(() => getAuth(app).currentUser);
  const [accounts, setAccounts] = useState<OneDriveAccount[]>([]);
  const [files, setFiles] = useState<OneDriveFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<OneDriveFile | null>(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([]);
  const [preview, setPreview] = useState<PreviewState>({ kind: 'empty' });
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const currentFolder = folderStack[folderStack.length - 1] || null;
  const reconnectAccounts = accounts.filter((account) => account.needsReconnect);
  const selectedAccount = accounts.find((account) => account.accountId === accountFilter) || null;

  const stats = useMemo(() => {
    const folderCount = files.filter((file) => file.isFolder).length;
    return { folderCount, fileCount: files.length - folderCount };
  }, [files]);

  const loadAccounts = useCallback(async () => {
    if (!getAuth(app).currentUser) return;
    setLoadingAccounts(true);
    setError('');
    try {
      const { accounts: nextAccounts } = await fetchOneDriveAccounts();
      setAccounts(nextAccounts);
      setAccountFilter((current) => {
        if (current === 'all' || nextAccounts.some((account) => account.accountId === current)) return current;
        return 'all';
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load LuOnedrive accounts.');
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
      const { files: nextFiles, errors } = await fetchOneDriveFiles({
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
      setError(filesError instanceof Error ? filesError.message : 'Unable to load OneDrive files.');
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
      if (event.data?.type === 'ludashboard-onedrive-connected') {
        setConnecting(false);
        setStatus('OneDrive account connected.');
        void loadAccounts();
      }
      if (event.data?.type === 'ludashboard-onedrive-error') {
        setConnecting(false);
        setError('LuOnedrive connection failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadAccounts]);

  useEffect(() => {
    let disposed = false;
    let objectUrl = '';

    async function loadPreview(file: OneDriveFile) {
      if (file.isFolder) {
        setPreview({ kind: 'empty' });
        return;
      }
      if (!canPreview(file)) {
        setPreview({ kind: 'empty' });
        return;
      }

      setPreview({ kind: 'loading' });
      try {
        const blob = await fetchOneDriveContent(file.accountId, file.id);
        if (disposed) return;
        const mimeType = blob.type || file.mimeType || inferMimeType(file.name);
        if (isTextLike(mimeType, file.name)) {
          const text = await blob.text();
          if (!disposed) setPreview({ kind: 'text', text, mimeType });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setPreview({ kind: 'blob', url: objectUrl, mimeType });
      } catch (previewError) {
        if (!disposed) {
          setPreview({
            kind: 'error',
            message: previewError instanceof Error ? previewError.message : 'Unable to preview this file.',
          });
        }
      }
    }

    if (selectedFile) void loadPreview(selectedFile);
    else setPreview({ kind: 'empty' });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  const connectAccount = async () => {
    setConnecting(true);
    setError('');
    try {
      const { authUrl } = await startOneDriveConnection();
      const popup = window.open(authUrl, 'luonedrive-microsoft-oauth', 'width=520,height=720');
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
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect LuOnedrive.');
    }
  };

  const openFolder = (file: OneDriveFile) => {
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
    if (!window.confirm(`Remove ${selectedAccount.email} from LuOnedrive? Files stay in OneDrive.`)) return;
    await removeOneDriveAccount(selectedAccount.accountId);
    setAccounts((current) => current.filter((account) => account.accountId !== selectedAccount.accountId));
    setAccountFilter('all');
    setFolderStack([]);
    setFiles((current) => current.filter((file) => file.accountId !== selectedAccount.accountId));
    setSelectedFile(null);
  };

  const downloadSelectedFile = async () => {
    if (!selectedFile || selectedFile.isFolder) return;
    try {
      const blob = await fetchOneDriveContent(selectedFile.accountId, selectedFile.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = selectedFile.name;
      anchor.rel = 'noopener noreferrer';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download OneDrive file.');
    }
  };

  if (!dashboardUser) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="cloud" size={26} />
          </div>
          <h2 className="text-lg font-semibold">Sign in to use LuOnedrive</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
            LuOnedrive connects Microsoft accounts separately, while LuDashboard protects its server APIs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="cloud" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">LuOnedrive</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
              {loadingAccounts ? 'Loading accounts...' : `${accounts.length} OneDrive accounts`} | {stats.folderCount} folders | {stats.fileCount} files
            </p>
          </div>
        </div>

        <select value={accountFilter} onChange={(event) => {
          setAccountFilter(event.target.value);
          setFolderStack([]);
        }} className="h-8 min-w-[190px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] focus:bg-white">
          <option value="all">All connected OneDrive</option>
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
            placeholder="Search OneDrive files..."
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
        <div className="grid min-h-0 flex-1 grid-cols-1 bg-[var(--color-surface-muted)] xl:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)]">
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
                <div className="p-4 text-xs text-[var(--color-text-tertiary)]">Loading OneDrive files...</div>
              ) : files.length === 0 ? (
                <div className="flex h-full items-center justify-center p-6 text-center">
                  <div>
                    <Icon name="folder" size={26} className="mx-auto text-[var(--color-text-tertiary)]" />
                    <p className="mt-2 text-sm font-medium">No files found</p>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Try another account, folder, or search query.</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border-subtle)]">
                  {files.map((file) => (
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
                        <Icon name={file.isFolder ? 'folder' : getFileIcon(file)} size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">{file.name}</p>
                        <p className="mt-1 truncate text-[11px] text-[var(--color-text-tertiary)]">
                          {file.accountEmail} | {formatDate(file.lastModifiedDateTime)} | {file.isFolder ? 'Folder' : formatBytes(file.size)}
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
              <div className="flex min-h-full flex-col">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
                    <Icon name={selectedFile.isFolder ? 'folder' : getFileIcon(selectedFile)} size={23} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-sm font-semibold">{selectedFile.name}</h3>
                    <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{selectedFile.accountEmail}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <InfoTile label="Type" value={selectedFile.isFolder ? 'Folder' : selectedFile.mimeType || 'File'} />
                  <InfoTile label="Modified" value={formatDate(selectedFile.lastModifiedDateTime)} />
                  <InfoTile label="Size" value={selectedFile.isFolder ? 'Folder' : formatBytes(selectedFile.size)} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedFile.isFolder && (
                    <button type="button" onClick={() => openFolder(selectedFile)} className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black">
                      <Icon name="folder" size={14} />
                      Open folder
                    </button>
                  )}
                  {!selectedFile.isFolder && (
                    <button type="button" onClick={downloadSelectedFile} className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black">
                      <Icon name="download" size={14} />
                      Download
                    </button>
                  )}
                  {selectedFile.webUrl && (
                    <button type="button" onClick={() => window.open(selectedFile.webUrl, '_blank', 'noopener,noreferrer')} className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-3 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
                      <Icon name="external-link" size={14} />
                      Open in OneDrive
                    </button>
                  )}
                </div>

                <div className="mt-4 min-h-[320px] flex-1 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                  <Preview file={selectedFile} preview={preview} />
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
                    <Icon name="cloud" size={26} />
                  </div>
                  <h3 className="text-base font-semibold">Select a OneDrive item</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
                    Browse folders, preview images and readable files, or open the item in OneDrive.
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
          <Icon name="cloud" size={25} />
        </div>
        <h3 className="text-base font-semibold">Connect OneDrive</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
          LuOnedrive uses Microsoft Graph with read-only file access. Tokens stay server-side in encrypted Redis storage.
        </p>
        <button type="button" onClick={onConnect} disabled={connecting} className="mt-4 h-9 rounded-lg bg-[var(--color-text-primary)] px-4 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-50">
          Connect OneDrive
        </button>
      </div>
    </div>
  );
}

function Preview({ file, preview }: { file: OneDriveFile; preview: PreviewState }) {
  if (file.isFolder) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-center">
        <div>
          <Icon name="folder" size={28} className="mx-auto text-[var(--color-accent)]" />
          <p className="mt-2 text-sm font-semibold">Folder selected</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Double click or use Open folder to browse inside.</p>
        </div>
      </div>
    );
  }

  if (!canPreview(file)) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-center">
        <div>
          <Icon name={getFileIcon(file)} size={28} className="mx-auto text-[var(--color-text-tertiary)]" />
          <p className="mt-2 text-sm font-semibold">Preview unavailable</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Download or open this file in OneDrive.</p>
        </div>
      </div>
    );
  }

  if (preview.kind === 'loading') {
    return <div className="flex h-full min-h-[320px] items-center justify-center text-xs text-[var(--color-text-tertiary)]">Loading preview...</div>;
  }

  if (preview.kind === 'error') {
    return <div className="flex h-full min-h-[320px] items-center justify-center p-6 text-center text-xs text-[var(--color-danger)]">{preview.message}</div>;
  }

  if (preview.kind === 'text') {
    return <pre className="h-full min-h-[320px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-[var(--color-text-primary)]">{preview.text}</pre>;
  }

  if (preview.kind === 'blob') {
    if (preview.mimeType.startsWith('image/')) {
      return <img src={preview.url} alt={file.name} className="h-full min-h-[320px] w-full object-contain" />;
    }
    if (preview.mimeType === 'application/pdf') {
      return <iframe src={preview.url} title={file.name} className="h-full min-h-[520px] w-full border-0" />;
    }
    if (preview.mimeType.startsWith('video/')) {
      return <video src={preview.url} controls className="h-full min-h-[320px] w-full bg-black object-contain" />;
    }
    if (preview.mimeType.startsWith('audio/')) {
      return (
        <div className="flex h-full min-h-[320px] items-center justify-center p-6">
          <audio src={preview.url} controls className="w-full max-w-md" />
        </div>
      );
    }
  }

  return null;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 break-words text-xs font-medium">{value}</p>
    </div>
  );
}

function canPreview(file: OneDriveFile) {
  if (file.isFolder) return false;
  return (
    file.isImage ||
    file.isVideo ||
    file.mimeType === 'application/pdf' ||
    file.mimeType.startsWith('text/') ||
    file.mimeType.startsWith('audio/') ||
    isTextLike(file.mimeType, file.name)
  );
}

function isTextLike(mimeType: string, name: string) {
  const extension = name.split('.').pop()?.toLowerCase() || '';
  return (
    mimeType.startsWith('text/') ||
    ['json', 'md', 'csv', 'tsv', 'txt', 'log', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx'].includes(extension)
  );
}

function inferMimeType(name: string) {
  const extension = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg'].includes(extension)) return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'mp3') return 'audio/mpeg';
  if (['json', 'md', 'csv', 'tsv', 'txt', 'log', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx'].includes(extension)) return 'text/plain';
  return 'application/octet-stream';
}

function getFileIcon(file: OneDriveFile) {
  if (file.isImage) return 'image';
  if (file.isVideo) return 'film';
  if (file.mimeType.startsWith('audio/')) return 'music';
  if (file.mimeType === 'application/pdf' || file.mimeType.includes('document') || file.mimeType.startsWith('text/')) return 'file-text';
  return 'file';
}

function formatDate(value: string) {
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
