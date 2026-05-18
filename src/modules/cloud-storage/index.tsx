import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { getAuth } from 'firebase/auth';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { del, get, set } from 'idb-keyval';
import Icon from '@/components/Icon';
import { app, storage } from '@/firebase/config';
import { saveModuleCloudData, subscribeModuleCloudData } from '@/firebase/moduleCloudSync';

type FileKind = 'all' | 'document' | 'image' | 'media' | 'archive' | 'other';

interface CloudFile {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: Exclude<FileKind, 'all'>;
  createdAt: number;
  updatedAt: number;
  storagePath?: string;
  downloadUrl?: string;
  localOnly: boolean;
  uploadError?: string;
}

interface CloudStorageValue {
  files: CloudFile[];
}

const MODULE_ID = 'cloud-storage';
const CLOUD_KEY = 'files';
const META_KEY = 'lu:module:cloud-storage:files';
const UPDATED_KEY = 'lu:module:cloud-storage:updatedAt';
const BLOB_PREFIX = 'lu:module:cloud-storage:blob:';
const FILTERS: Array<{ id: FileKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'document', label: 'Docs' },
  { id: 'image', label: 'Images' },
  { id: 'media', label: 'Media' },
  { id: 'archive', label: 'Archives' },
  { id: 'other', label: 'Other' },
];

export default function CloudStorageModule() {
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FileKind>('all');
  const [updatedAt, setUpdatedAt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<CloudFile[]>([]);
  const updatedAtRef = useRef(0);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    loadCloudStorageSnapshot().then((snapshot) => {
      filesRef.current = snapshot.files;
      updatedAtRef.current = snapshot.updatedAt;
      setFiles(snapshot.files);
      setUpdatedAt(snapshot.updatedAt);
      setActiveId(snapshot.files[0]?.id ?? null);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return undefined;

    return subscribeModuleCloudData<CloudStorageValue>(MODULE_ID, CLOUD_KEY, {
      onData: (remote) => {
        if (remote.updatedAt <= updatedAtRef.current) return;
        const remoteFiles = normalizeFiles(remote.value.files);
        applyingRemoteRef.current = true;
        filesRef.current = remoteFiles;
        updatedAtRef.current = remote.updatedAt;
        setFiles(remoteFiles);
        setUpdatedAt(remote.updatedAt);
        saveCloudStorageSnapshot(remoteFiles, remote.updatedAt);
        setActiveId((current) => {
          if (current && remoteFiles.some((file) => file.id === current)) return current;
          return remoteFiles[0]?.id ?? null;
        });
        window.setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      },
      onReady: () => setCloudReady(true),
      onError: () => setStatus('Cloud metadata sync is unavailable right now. Local files still work.'),
    });
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    saveCloudStorageSnapshot(files, updatedAt);
    if (!cloudReady || applyingRemoteRef.current || updatedAt <= 0) return;

    const timer = window.setTimeout(() => {
      saveModuleCloudData<CloudStorageValue>(MODULE_ID, CLOUD_KEY, {
        value: { files },
        updatedAt,
      }).catch((syncError) => {
        console.error('Failed to sync Cloud Storage metadata', syncError);
        setStatus('Cloud metadata sync failed. Your local file list is still saved.');
      });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [cloudReady, files, loaded, updatedAt]);

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeId) ?? files[0] ?? null,
    [activeId, files],
  );

  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return files.filter((file) => {
      const matchesFilter = filter === 'all' || file.kind === filter;
      const matchesQuery =
        !normalizedQuery ||
        file.name.toLowerCase().includes(normalizedQuery) ||
        file.type.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [files, filter, query]);

  const stats = useMemo(() => {
    const cloudCount = files.filter((file) => !file.localOnly).length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    return { cloudCount, localCount: files.length - cloudCount, totalSize };
  }, [files]);

  const commitFiles = useCallback((updater: CloudFile[] | ((current: CloudFile[]) => CloudFile[])) => {
    const nextUpdatedAt = Date.now();
    setFiles((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      filesRef.current = next;
      return next;
    });
    updatedAtRef.current = nextUpdatedAt;
    setUpdatedAt(nextUpdatedAt);
  }, []);

  const uploadPickedFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const picked = Array.from(fileList).filter((file) => file.size > 0);
      if (picked.length === 0) {
        setError('Choose one or more files to save.');
        return;
      }

      setError('');
      setStatus('');
      const now = Date.now();
      const newFiles = picked.map<CloudFile>((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        kind: getFileKind(file),
        createdAt: now,
        updatedAt: now,
        localOnly: true,
      }));

      await Promise.all(newFiles.map((file, index) => set(getBlobKey(file.id), picked[index])));
      commitFiles((current) => [...newFiles, ...current]);
      setActiveId(newFiles[0]?.id ?? null);

      const user = getAuth(app).currentUser;
      if (!user) {
        setStatus('Saved locally. Sign in to LuDashboard to upload files for cross-device access.');
        return;
      }

      await Promise.allSettled(newFiles.map((file, index) => uploadFileToCloud(file, picked[index], user.uid)));
    },
    [commitFiles],
  );

  const uploadFileToCloud = useCallback(
    async (fileRecord: CloudFile, blob: Blob, uid: string) => {
      markUploading(fileRecord.id, true);
      try {
        const storagePath = `users/${uid}/cloud-storage/${fileRecord.id}-${sanitizeStorageName(fileRecord.name)}`;
        const fileRef = ref(storage, storagePath);
        await uploadBytes(fileRef, blob, {
          contentType: fileRecord.type,
          customMetadata: { originalName: fileRecord.name },
        });
        const downloadUrl = await getDownloadURL(fileRef);
        commitFiles((current) =>
          current.map((file) =>
            file.id === fileRecord.id
              ? {
                  ...file,
                  storagePath,
                  downloadUrl,
                  localOnly: false,
                  uploadError: undefined,
                  updatedAt: Date.now(),
                }
              : file,
          ),
        );
        setStatus('Uploaded to cloud. File metadata and links will sync across signed-in devices.');
      } catch (uploadError) {
        console.error('Cloud file upload failed', uploadError);
        commitFiles((current) =>
          current.map((file) =>
            file.id === fileRecord.id
              ? {
                  ...file,
                  localOnly: true,
                  uploadError: 'Cloud upload failed. File remains local on this device.',
                  updatedAt: Date.now(),
                }
              : file,
          ),
        );
        setStatus('Some files stayed local because cloud upload failed.');
      } finally {
        markUploading(fileRecord.id, false);
      }
    },
    [commitFiles],
  );

  const syncLocalOnlyFiles = useCallback(async () => {
    const user = getAuth(app).currentUser;
    if (!user) {
      setStatus('Sign in to LuDashboard before syncing local-only files.');
      return;
    }

    const localFiles = filesRef.current.filter((file) => file.localOnly);
    if (localFiles.length === 0) {
      setStatus('All files are already cloud-backed.');
      return;
    }

    for (const file of localFiles) {
      const blob = await get<Blob>(getBlobKey(file.id));
      if (!blob) {
        setStatus(`Missing local copy for ${file.name}. Upload it again to sync this file.`);
        continue;
      }
      await uploadFileToCloud(file, blob, user.uid);
    }
  }, [uploadFileToCloud]);

  const deleteFile = useCallback(
    async (file: CloudFile) => {
      commitFiles((current) => current.filter((item) => item.id !== file.id));
      setActiveId((current) => {
        if (current !== file.id) return current;
        const remaining = filesRef.current.filter((item) => item.id !== file.id);
        return remaining[0]?.id ?? null;
      });
      await del(getBlobKey(file.id));

      const user = getAuth(app).currentUser;
      if (user && file.storagePath) {
        deleteObject(ref(storage, file.storagePath)).catch((deleteError) => {
          console.error('Failed to delete cloud file object', deleteError);
        });
      }
    },
    [commitFiles],
  );

  const openFile = useCallback(async (file: CloudFile) => {
    try {
      const url = await getFileOpenUrl(file);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Unable to open this file.');
    }
  }, []);

  const downloadFile = useCallback(async (file: CloudFile) => {
    try {
      const url = await getFileOpenUrl(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      anchor.rel = 'noopener noreferrer';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      if (!file.downloadUrl) window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download this file.');
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      uploadPickedFiles(event.dataTransfer.files);
    },
    [uploadPickedFiles],
  );

  const markUploading = (id: string, uploading: boolean) => {
    setUploadingIds((current) => {
      const next = new Set(current);
      if (uploading) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="cloud" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Cloud Storage</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
              {files.length} files | {formatBytes(stats.totalSize)} | {stats.cloudCount} cloud
            </p>
          </div>
        </div>

        <label className="relative flex h-8 min-w-[190px] flex-1 items-center md:max-w-xs">
          <Icon name="search" size={13} className="pointer-events-none absolute left-2.5 text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-full w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white"
            placeholder="Search files..."
          />
        </label>

        <button
          type="button"
          onClick={syncLocalOnlyFiles}
          disabled={!files.some((file) => file.localOnly)}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Icon name="cloud" size={13} />
          Sync local
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black"
        >
          <Icon name="upload" size={13} />
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const picked = event.target.files ? Array.from(event.target.files) : [];
            event.target.value = '';
            if (picked.length > 0) uploadPickedFiles(picked);
          }}
        />
      </header>

      {(status || error) && (
        <div className="border-b border-[var(--color-border-subtle)] px-4 py-2">
          {status && <p className="text-xs text-[var(--color-text-secondary)]">{status}</p>}
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 bg-[var(--color-surface-muted)] lg:grid-cols-[minmax(300px,380px)_1fr]">
        <section className="flex min-h-0 flex-col border-r border-[var(--color-border-subtle)] bg-white">
          <div className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-[var(--color-border-subtle)] px-3 py-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`h-7 rounded-lg px-2.5 text-[11px] font-medium transition-colors ${
                  filter === item.id
                    ? 'bg-[var(--color-text-primary)] text-white'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            className={`m-3 flex flex-shrink-0 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-3 transition-colors ${
              dragActive
                ? 'border-[var(--color-accent)] bg-white'
                : 'border-[var(--color-border)] bg-[var(--color-surface-subtle)] hover:border-[var(--color-accent)]'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[var(--color-accent)]">
              <Icon name="upload" size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold">Drop files here</p>
              <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">Browse or drag files into your vault</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredFiles.length === 0 ? (
              <div className="flex h-full items-center justify-center px-6 text-center">
                <div>
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-tertiary)]">
                    <Icon name="folder" size={22} />
                  </div>
                  <p className="text-sm font-medium">No files found</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Upload files or change the search/filter.</p>
                </div>
              </div>
            ) : (
              filteredFiles.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setActiveId(file.id)}
                  className={`group flex w-full items-center gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3 text-left transition-colors ${
                    activeFile?.id === file.id ? 'bg-[var(--color-surface-subtle)]' : 'hover:bg-[var(--color-surface-muted)]'
                  }`}
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
                    <Icon name={getKindIcon(file.kind)} size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{file.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)]">
                      <span>{formatBytes(file.size)}</span>
                      <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                      <span className={file.localOnly ? 'text-amber-600' : 'text-[var(--color-accent)]'}>
                        {uploadingIds.has(file.id) ? 'Uploading' : file.localOnly ? 'Local' : 'Cloud'}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto p-4">
          {activeFile ? (
            <div className="mx-auto max-w-3xl">
              <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
                    <Icon name={getKindIcon(activeFile.kind)} size={24} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-base font-semibold">{activeFile.name}</h3>
                    <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      {activeFile.type || 'Unknown type'} | {formatBytes(activeFile.size)}
                    </p>
                    {activeFile.uploadError && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">{activeFile.uploadError}</p>
                    )}
                  </div>
                  <span
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                      activeFile.localOnly
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-[var(--color-accent)]'
                    }`}
                  >
                    {activeFile.localOnly ? 'Local only' : 'Cloud synced'}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <InfoTile label="Created" value={new Date(activeFile.createdAt).toLocaleString()} />
                  <InfoTile label="Updated" value={new Date(activeFile.updatedAt).toLocaleString()} />
                  <InfoTile label="Access" value={activeFile.downloadUrl ? 'Cross-device link' : 'This device only'} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openFile(activeFile)}
                    className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black"
                  >
                    <Icon name="eye" size={14} />
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadFile(activeFile)}
                    className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  >
                    <Icon name="download" size={14} />
                    Download
                  </button>
                  {activeFile.localOnly && (
                    <button
                      type="button"
                      onClick={syncLocalOnlyFiles}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      <Icon name="cloud" size={14} />
                      Sync
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteFile(activeFile)}
                    className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-red-50 hover:text-[var(--color-danger)]"
                  >
                    <Icon name="trash" size={14} />
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-white p-4 text-xs leading-5 text-[var(--color-text-secondary)] shadow-sm">
                Files are stored locally first so uploads feel instant. When you are signed in and Firebase Storage is available,
                Cloud Storage uploads the file and syncs metadata through your LuDashboard account.
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
                  <Icon name="cloud" size={26} />
                </div>
                <h3 className="text-base font-semibold">Your file vault is empty</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-tertiary)]">
                  Upload files from this device, then sync them to your signed-in LuDashboard account.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 h-9 rounded-lg bg-[var(--color-text-primary)] px-4 text-xs font-semibold text-white transition-colors hover:bg-black"
                >
                  Upload files
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 truncate text-xs font-medium">{value}</p>
    </div>
  );
}

async function loadCloudStorageSnapshot() {
  const [files, updatedAt] = await Promise.all([
    get<CloudFile[]>(META_KEY),
    get<number>(UPDATED_KEY),
  ]);
  return {
    files: normalizeFiles(files),
    updatedAt: typeof updatedAt === 'number' ? updatedAt : 0,
  };
}

async function saveCloudStorageSnapshot(files: CloudFile[], updatedAt: number) {
  await Promise.all([
    set(META_KEY, normalizeFiles(files)),
    set(UPDATED_KEY, updatedAt),
  ]);
}

function normalizeFiles(value: unknown): CloudFile[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((file): file is CloudFile => {
      return Boolean(
        file &&
          typeof file === 'object' &&
          typeof (file as CloudFile).id === 'string' &&
          typeof (file as CloudFile).name === 'string' &&
          typeof (file as CloudFile).size === 'number',
      );
    })
    .map((file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      kind: file.kind || 'other',
      createdAt: file.createdAt || Date.now(),
      updatedAt: file.updatedAt || Date.now(),
      storagePath: file.storagePath,
      downloadUrl: file.downloadUrl,
      localOnly: file.localOnly !== false,
      uploadError: file.uploadError,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function getFileKind(file: File): Exclude<FileKind, 'all'> {
  const extension = getExtension(file.name);
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/') || file.type.startsWith('audio/')) return 'media';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'archive';
  if (
    file.type.includes('pdf') ||
    file.type.includes('text') ||
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'md', 'txt', 'pdf'].includes(extension)
  ) {
    return 'document';
  }
  return 'other';
}

function getKindIcon(kind: Exclude<FileKind, 'all'>) {
  if (kind === 'image') return 'image';
  if (kind === 'media') return 'film';
  if (kind === 'archive') return 'archive';
  if (kind === 'document') return 'file-text';
  return 'file';
}

function getExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() || '';
}

function getBlobKey(id: string) {
  return `${BLOB_PREFIX}${id}`;
}

async function getFileOpenUrl(file: CloudFile) {
  if (file.downloadUrl) return file.downloadUrl;
  const blob = await get<Blob>(getBlobKey(file.id));
  if (!blob) {
    throw new Error('This file is not available on this device yet.');
  }
  return URL.createObjectURL(blob);
}

function sanitizeStorageName(name: string) {
  return name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
