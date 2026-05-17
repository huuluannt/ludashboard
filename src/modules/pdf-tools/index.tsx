import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import Icon from '@/components/Icon';

type ToolMode = 'merge' | 'extract' | 'rotate';
type RotationStep = 90 | 180 | 270;

interface PdfItem {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  arrayBuffer: ArrayBuffer;
  previewUrl: string;
  title?: string;
  author?: string;
  creator?: string;
  producer?: string;
}

interface PdfResult {
  url: string;
  fileName: string;
  size: number;
  pageCount: number;
}

const ROTATION_OPTIONS: RotationStep[] = [90, 180, 270];

export default function PdfToolsModule() {
  const [files, setFiles] = useState<PdfItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<ToolMode>('merge');
  const [pageRange, setPageRange] = useState('');
  const [rotationRange, setRotationRange] = useState('');
  const [rotation, setRotation] = useState<RotationStep>(90);
  const [result, setResult] = useState<PdfResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<PdfItem[]>([]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((file) => URL.revokeObjectURL(file.previewUrl));
    };
  }, []);

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeId) ?? files[0] ?? null,
    [activeId, files],
  );

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const picked = Array.from(fileList).filter(isPdfFile);
    if (picked.length === 0) {
      setError('Select one or more PDF files.');
      return;
    }

    setBusy(true);
    setError('');
    const parsed = await Promise.allSettled(picked.map(readPdfFile));
    const nextFiles = parsed.flatMap((entry) => (entry.status === 'fulfilled' ? [entry.value] : []));
    const failed = parsed.length - nextFiles.length;

    if (nextFiles.length > 0) {
      setFiles((current) => [...current, ...nextFiles]);
      setActiveId((current) => current ?? nextFiles[0].id);
      setResult(null);
    }

    setBusy(false);
    if (failed > 0) {
      setError(`${failed} PDF file${failed > 1 ? 's' : ''} could not be opened.`);
    }
  }, []);

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files;
      event.target.value = '';
      if (picked) addFiles(picked);
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      addFiles(event.dataTransfer.files);
    },
    [addFiles],
  );

  const removeFile = useCallback(
    (id: string) => {
      setFiles((current) => {
        const target = current.find((file) => file.id === id);
        if (target) URL.revokeObjectURL(target.previewUrl);
        const next = current.filter((file) => file.id !== id);
        if (activeId === id) setActiveId(next[0]?.id ?? null);
        return next;
      });
      setResult(null);
    },
    [activeId],
  );

  const clearFiles = useCallback(() => {
    setFiles((current) => {
      current.forEach((file) => URL.revokeObjectURL(file.previewUrl));
      return [];
    });
    setActiveId(null);
    setResult(null);
    setError('');
  }, []);

  const moveFile = useCallback((id: string, direction: -1 | 1) => {
    setFiles((current) => {
      const index = current.findIndex((file) => file.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  }, []);

  const saveResult = useCallback((bytes: Uint8Array, fileName: string, pageCount: number) => {
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    setResult((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { url, fileName, size: blob.size, pageCount };
    });
  }, []);

  const mergeFiles = useCallback(async () => {
    if (files.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const output = await PDFDocument.create();

      for (const file of files) {
        const source = await PDFDocument.load(file.arrayBuffer.slice(0), { ignoreEncryption: true });
        const pages = await output.copyPages(source, source.getPageIndices());
        pages.forEach((page) => output.addPage(page));
      }

      output.setTitle('Merged PDF');
      saveResult(await output.save(), `merged-${files.length}-files.pdf`, output.getPageCount());
    } catch (err) {
      setError(getErrorMessage(err, 'Merge failed.'));
    } finally {
      setBusy(false);
    }
  }, [files, saveResult]);

  const extractPages = useCallback(async () => {
    if (!activeFile) return;
    setBusy(true);
    setError('');
    try {
      const pageIndices = parsePageRanges(pageRange, activeFile.pageCount);
      const { PDFDocument } = await import('pdf-lib');
      const source = await PDFDocument.load(activeFile.arrayBuffer.slice(0), { ignoreEncryption: true });
      const output = await PDFDocument.create();
      const pages = await output.copyPages(source, pageIndices);
      pages.forEach((page) => output.addPage(page));
      output.setTitle(`${getBaseName(activeFile.name)} extracted pages`);
      saveResult(await output.save(), `${getBaseName(activeFile.name)}-pages.pdf`, output.getPageCount());
    } catch (err) {
      setError(getErrorMessage(err, 'Extract failed.'));
    } finally {
      setBusy(false);
    }
  }, [activeFile, pageRange, saveResult]);

  const rotatePages = useCallback(async () => {
    if (!activeFile) return;
    setBusy(true);
    setError('');
    try {
      const pageIndices = parsePageRanges(rotationRange, activeFile.pageCount);
      const { PDFDocument, degrees } = await import('pdf-lib');
      const source = await PDFDocument.load(activeFile.arrayBuffer.slice(0), { ignoreEncryption: true });

      pageIndices.forEach((pageIndex) => {
        const page = source.getPage(pageIndex);
        const nextAngle = normalizeRotation(page.getRotation().angle + rotation);
        page.setRotation(degrees(nextAngle));
      });

      saveResult(await source.save(), `${getBaseName(activeFile.name)}-rotated.pdf`, source.getPageCount());
    } catch (err) {
      setError(getErrorMessage(err, 'Rotate failed.'));
    } finally {
      setBusy(false);
    }
  }, [activeFile, rotation, rotationRange, saveResult]);

  const downloadResult = useCallback(() => {
    if (!result) return;
    const anchor = document.createElement('a');
    anchor.href = result.url;
    anchor.download = result.fileName;
    anchor.click();
  }, [result]);

  const currentAction = mode === 'merge' ? mergeFiles : mode === 'extract' ? extractPages : rotatePages;
  const actionDisabled = busy || (mode === 'merge' ? files.length === 0 : !activeFile);

  return (
    <div className="flex h-full min-w-0 bg-white text-[var(--color-text-primary)]">
      <aside className="flex w-[340px] min-w-[300px] flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]">
        <div className="flex h-14 items-center gap-2 border-b border-[var(--color-border-subtle)] px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
            <Icon name="file-text" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">PDF Tools</h2>
            <p className="text-[10px] text-[var(--color-text-tertiary)]">{files.length} files loaded</p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-accent)]"
            title="Add PDF files"
          >
            <Icon name="plus" size={16} />
          </button>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="m-3 flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-white transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]"
        >
          <Icon name="upload" size={22} className="text-[var(--color-text-tertiary)]" />
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">Drop PDFs or browse</p>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" multiple onChange={handleFileInput} className="hidden" />
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {files.length === 0 ? (
            <div className="flex h-full items-center justify-center px-8 text-center">
              <p className="text-sm text-[var(--color-text-tertiary)]">No PDF selected</p>
            </div>
          ) : (
            files.map((file, index) => (
              <div
                key={file.id}
                className={`mb-1 flex items-start gap-2 rounded-xl border px-3 py-3 transition-colors ${
                  activeFile?.id === file.id
                    ? 'border-[var(--color-border)] bg-white shadow-sm'
                    : 'border-transparent hover:bg-white/70'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveId(file.id)}
                  className="min-w-0 flex-1 text-left"
                  title={file.name}
                >
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {file.pageCount} pages - {formatBytes(file.size)}
                  </p>
                </button>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => moveFile(file.id, -1)}
                    disabled={index === 0}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-30"
                    title="Move up"
                  >
                    <Icon name="chevron-left" size={12} className="rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveFile(file.id, 1)}
                    disabled={index === files.length - 1}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-secondary)] disabled:opacity-30"
                    title="Move down"
                  >
                    <Icon name="chevron-left" size={12} className="-rotate-90" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-red-50 hover:text-[var(--color-danger)]"
                  title="Remove file"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {files.length > 0 && (
          <div className="border-t border-[var(--color-border-subtle)] p-3">
            <button
              type="button"
              onClick={clearFiles}
              className="h-9 w-full rounded-xl text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-white hover:text-[var(--color-danger)]"
            >
              Clear files
            </button>
          </div>
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-[var(--color-border-subtle)] px-4">
          <SegmentedButton active={mode === 'merge'} icon="archive" label="Merge" onClick={() => setMode('merge')} />
          <SegmentedButton active={mode === 'extract'} icon="scissors" label="Extract" onClick={() => setMode('extract')} />
          <SegmentedButton active={mode === 'rotate'} icon="refresh-cw" label="Rotate" onClick={() => setMode('rotate')} />
          <div className="ml-auto text-xs text-[var(--color-text-tertiary)]">Local processing</div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(360px,460px)_1fr]">
          <section className="overflow-y-auto border-r border-[var(--color-border-subtle)] p-5">
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold">
                  {mode === 'merge' ? 'Merge PDFs' : mode === 'extract' ? 'Extract pages' : 'Rotate pages'}
                </h3>
                <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
                  {mode === 'merge'
                    ? 'Output follows the file order on the left.'
                    : activeFile
                      ? activeFile.name
                      : 'Select a PDF file first.'}
                </p>
              </div>

              {activeFile && mode !== 'merge' && (
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{activeFile.name}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{activeFile.pageCount} pages</p>
                    </div>
                    <a
                      href={activeFile.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-white hover:text-[var(--color-accent)]"
                      title="Open source PDF"
                    >
                      <Icon name="eye" size={15} />
                    </a>
                  </div>
                </div>
              )}

              {mode === 'extract' && (
                <LabeledInput
                  label="Pages"
                  value={pageRange}
                  onChange={setPageRange}
                  placeholder="1-3, 5, 8"
                />
              )}

              {mode === 'rotate' && (
                <div className="space-y-4">
                  <LabeledInput
                    label="Pages"
                    value={rotationRange}
                    onChange={setRotationRange}
                    placeholder="Blank means all pages"
                  />
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                      Rotation
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {ROTATION_OPTIONS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRotation(value)}
                          className={`h-10 rounded-xl text-sm font-semibold transition-colors ${
                            rotation === value
                              ? 'bg-[var(--color-text-primary)] text-white'
                              : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]'
                          }`}
                        >
                          {value} deg
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={currentAction}
                disabled={actionDisabled}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-text-primary)] text-sm font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Processing...' : mode === 'merge' ? 'Create merged PDF' : mode === 'extract' ? 'Create extracted PDF' : 'Create rotated PDF'}
              </button>

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
                  {error}
                </div>
              )}

              {result && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--color-accent)]">
                      <Icon name="file-text" size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{result.fileName}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {result.pageCount} pages - {formatBytes(result.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={downloadResult}
                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-accent)]"
                  >
                    <Icon name="download" size={15} />
                    Download PDF
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 bg-[var(--color-surface-muted)]">
            {activeFile ? (
              <iframe
                key={activeFile.id}
                src={activeFile.previewUrl}
                title="PDF preview"
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[var(--color-text-tertiary)]">
                    <Icon name="file-text" size={22} />
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">PDF preview</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function SegmentedButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${
        active
          ? 'bg-[var(--color-text-primary)] text-white'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
      }`}
    >
      <Icon name={icon} size={15} />
      {label}
    </button>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {label}
      </label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-transparent bg-[var(--color-surface-subtle)] px-3 text-sm outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white"
      />
    </div>
  );
}

async function readPdfFile(file: File): Promise<PdfItem> {
  const arrayBuffer = await file.arrayBuffer();
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
  const previewUrl = URL.createObjectURL(file);

  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    pageCount: doc.getPageCount(),
    arrayBuffer,
    previewUrl,
    title: doc.getTitle(),
    author: doc.getAuthor(),
    creator: doc.getCreator(),
    producer: doc.getProducer(),
  };
}

function parsePageRanges(input: string, pageCount: number) {
  const trimmed = input.trim();
  if (!trimmed) return Array.from({ length: pageCount }, (_, index) => index);

  const selected = new Set<number>();
  for (const rawPart of trimmed.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;

    const range = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!range) throw new Error('Use page ranges like 1-3, 5, 8.');

    const start = Number(range[1]);
    const end = Number(range[2] ?? range[1]);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount || end < start) {
      throw new Error(`Page range must be between 1 and ${pageCount}.`);
    }

    for (let page = start; page <= end; page += 1) {
      selected.add(page - 1);
    }
  }

  const pageIndices = [...selected].sort((a, b) => a - b);
  if (pageIndices.length === 0) throw new Error('Select at least one page.');
  return pageIndices;
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function getBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '') || 'document';
}

function normalizeRotation(value: number) {
  return ((value % 360) + 360) % 360;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
