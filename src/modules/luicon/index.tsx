import { useCallback, useMemo, useRef, useState } from 'react';
import { CreatePaletteMode, FillStyle, ImageTracer, InterpolationMode, TrimMode } from '@image-tracer-ts/core';
import Icon from '@/components/Icon';
import { saveCustomIconToLibrary, svgToDataUrl } from '@/lib/customIconLibrary';

type SourceKind = 'empty' | 'svg' | 'image';

interface SourceAsset {
  kind: SourceKind;
  name: string;
  previewUrl: string;
  svgText?: string;
}

const DEFAULT_ICON_NAME = 'custom-icon';
const TRACE_CANVAS_SIZE = 256;
const TRACE_PADDING = 24;

export default function LuIconModule() {
  const [sourceAsset, setSourceAsset] = useState<SourceAsset>({ kind: 'empty', name: '', previewUrl: '' });
  const [convertedSvg, setConvertedSvg] = useState('');
  const [iconName, setIconName] = useState(DEFAULT_ICON_NAME);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convertedDataUrl = useMemo(() => (convertedSvg ? svgToDataUrl(convertedSvg) : ''), [convertedSvg]);
  const reactSnippet = useMemo(() => createReactComponentSnippet(iconName, convertedSvg), [convertedSvg, iconName]);

  const loadFile = useCallback(async (file: File) => {
    setError('');
    setStatus('');
    setConvertedSvg('');
    const nextName = toIconName(file.name.replace(/\.[^.]+$/, ''));
    setIconName(nextName || DEFAULT_ICON_NAME);

    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      const svgText = await file.text();
      setSourceAsset({
        kind: 'svg',
        name: file.name,
        previewUrl: svgToDataUrl(svgText),
        svgText,
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please add an image or SVG file.');
      return;
    }

    setSourceAsset({
      kind: 'image',
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    });
  }, []);

  const loadSvgText = useCallback((svgText: string, name = 'pasted-svg') => {
    setError('');
    setStatus('');
    setConvertedSvg('');
    setIconName(toIconName(name) || DEFAULT_ICON_NAME);
    setSourceAsset({
      kind: 'svg',
      name,
      previewUrl: svgToDataUrl(svgText),
      svgText,
    });
  }, []);

  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/'));
    if (file) {
      event.preventDefault();
      await loadFile(file);
      return;
    }

    const text = event.clipboardData.getData('text/plain');
    if (text.trim().startsWith('<svg')) {
      event.preventDefault();
      loadSvgText(text, 'pasted-icon');
    }
  };

  const convert = async () => {
    setError('');
    setStatus('');
    if (sourceAsset.kind === 'empty') {
      setError('Add an image or SVG first.');
      return;
    }

    try {
      const nextSvg = sourceAsset.kind === 'svg'
        ? sanitizeSvgToIcon(sourceAsset.svgText || '')
        : await vectorizeBitmapToIconSvg(sourceAsset.previewUrl);
      setConvertedSvg(nextSvg);
      setStatus('Converted to clean SVG vector icon with a free local tracer.');
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : 'Could not convert this asset.');
    }
  };

  const downloadSvg = () => {
    if (!convertedSvg) return;
    downloadText(`${toIconName(iconName) || DEFAULT_ICON_NAME}.svg`, convertedSvg, 'image/svg+xml');
  };

  const addToIconLibrary = async () => {
    if (!convertedSvg) return;
    const name = toIconName(iconName) || DEFAULT_ICON_NAME;
    const saved = saveCustomIconToLibrary({
      name,
      svg: convertedSvg,
      dataUrl: svgToDataUrl(convertedSvg),
    });
    await copyTextToClipboard(reactSnippet || convertedSvg);
    setStatus(`Added "${saved.name}" to LuIcon library and copied React component snippet.`);
  };

  return (
    <div
      className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]"
      onPaste={handlePaste}
    >
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2">
        <div className="flex min-w-[180px] flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="pen-tool" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">LuIcon</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">Image/SVG to icon component</p>
          </div>
        </div>

        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-semibold transition-colors hover:bg-[var(--color-surface-subtle)]">
          <Icon name="upload" size={13} />
          Add
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void loadFile(file);
          }}
        />
        <button type="button" onClick={convert} disabled={sourceAsset.kind === 'empty'} className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-45">
          <Icon name="sparkles" size={13} />
          Convert
        </button>
        <button type="button" onClick={downloadSvg} disabled={!convertedSvg} className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 text-xs font-semibold transition-colors hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-45">
          <Icon name="download" size={13} />
          Download
        </button>
        <button type="button" onClick={() => void addToIconLibrary()} disabled={!convertedSvg} className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 text-xs font-semibold text-white transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45">
          <Icon name="plus" size={13} />
          Add to icon library
        </button>
      </header>

      {(status || error) && (
        <div className="flex-shrink-0 border-b border-[var(--color-border-subtle)] px-3 py-2 text-xs">
          {status && <span className="text-[var(--color-text-secondary)]">{status}</span>}
          {error && <span className="text-[var(--color-danger)]">{error}</span>}
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 bg-[var(--color-surface-muted)] p-3 lg:grid-cols-[0.9fr_1fr_0.85fr]">
        <section
          className={`flex min-h-[260px] flex-col rounded-2xl border bg-white shadow-sm transition-colors ${
            dragActive ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20' : 'border-[var(--color-border)]'
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void loadFile(file);
          }}
        >
          <PanelTitle title="Original" meta={sourceAsset.name || 'Drop, paste, or add'} />
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            {sourceAsset.kind === 'empty' ? (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-center transition-colors hover:bg-white">
                <Icon name="upload" size={28} className="text-[var(--color-text-tertiary)]" />
                <span className="text-xs font-semibold">Add / Drag & Drop / Paste</span>
                <span className="text-[11px] text-[var(--color-text-tertiary)]">PNG, JPG, WebP, SVG</span>
              </button>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0] p-4">
                <img src={sourceAsset.previewUrl} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-[260px] flex-col rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
          <PanelTitle title="Converted" meta={convertedSvg ? 'SVG vector preview' : 'Waiting for convert'} />
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            {convertedSvg ? (
              <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                <PreviewSwatch label="24" svg={convertedDataUrl} sizeClass="h-24" iconSize={24} />
                <PreviewSwatch label="48" svg={convertedDataUrl} sizeClass="h-24" iconSize={48} />
                <div className="col-span-2 flex h-32 items-center justify-center rounded-xl border border-[var(--color-border-subtle)] bg-white text-black">
                  <img src={convertedDataUrl} alt="" className="h-20 w-20" />
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-40 w-full items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-xs text-[var(--color-text-tertiary)]">
                Convert result will appear here.
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-[260px] flex-col rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
          <PanelTitle title="Library" meta="Name, export, snippet" />
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Icon name</span>
              <input
                value={iconName}
                onChange={(event) => setIconName(toIconName(event.currentTarget.value))}
                className="h-9 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 font-mono text-xs outline-none transition-colors focus:border-[var(--color-accent)] focus:bg-white"
                placeholder={DEFAULT_ICON_NAME}
              />
            </label>

            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">React component</p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-[10px] leading-4 text-[var(--color-text-secondary)]">
                {reactSnippet || 'Convert an icon to generate a React component snippet.'}
              </pre>
            </div>

            <button
              type="button"
              onClick={() => void copyTextToClipboard(reactSnippet || convertedSvg)}
              disabled={!convertedSvg}
              className="flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-white text-xs font-semibold transition-colors hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Icon name="copy" size={13} />
              Copy snippet
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function PanelTitle({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3">
      <h3 className="text-xs font-semibold text-[var(--color-text-secondary)]">{title}</h3>
      <span className="min-w-0 truncate text-[10px] text-[var(--color-text-tertiary)]">{meta}</span>
    </div>
  );
}

function PreviewSwatch({ label, svg, sizeClass, iconSize }: { label: string; svg: string; sizeClass: string; iconSize: number }) {
  return (
    <div className={`flex ${sizeClass} flex-col items-center justify-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]`}>
      <img src={svg} alt="" style={{ width: iconSize, height: iconSize }} />
      <span className="text-[10px] text-[var(--color-text-tertiary)]">{label}px</span>
    </div>
  );
}

function sanitizeSvgToIcon(svgText: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const parseError = doc.querySelector('parsererror');
  const sourceSvg = doc.querySelector('svg');
  if (parseError || !sourceSvg) throw new Error('Invalid SVG.');

  sourceSvg.querySelectorAll('script, style, foreignObject, iframe, object, embed, audio, video, canvas').forEach((node) => node.remove());
  sourceSvg.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || name === 'href' || name === 'xlink:href' || name === 'src') {
        node.removeAttribute(attribute.name);
      }
    });

    if (node instanceof SVGElement) {
      const fill = node.getAttribute('fill');
      const stroke = node.getAttribute('stroke');
      if (fill && fill !== 'none') node.setAttribute('fill', 'currentColor');
      if (stroke && stroke !== 'none') {
        node.setAttribute('stroke', 'currentColor');
        node.setAttribute('stroke-linecap', node.getAttribute('stroke-linecap') || 'round');
        node.setAttribute('stroke-linejoin', node.getAttribute('stroke-linejoin') || 'round');
      }
      if (!fill && !stroke && isRenderableSvgElement(node)) {
        node.setAttribute('fill', 'currentColor');
      }
      node.removeAttribute('class');
      node.removeAttribute('style');
    }
  });

  const viewBox = sourceSvg.getAttribute('viewBox') || `0 0 ${sourceSvg.getAttribute('width') || 24} ${sourceSvg.getAttribute('height') || 24}`;
  const content = Array.from(sourceSvg.childNodes).map((node) => new XMLSerializer().serializeToString(node)).join('');
  return wrapSvg(content, viewBox);
}

async function vectorizeBitmapToIconSvg(sourceUrl: string) {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement('canvas');
  canvas.width = TRACE_CANVAS_SIZE;
  canvas.height = TRACE_CANVAS_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is not available.');

  context.clearRect(0, 0, TRACE_CANVAS_SIZE, TRACE_CANVAS_SIZE);
  const scale = Math.min((TRACE_CANVAS_SIZE - TRACE_PADDING * 2) / image.width, (TRACE_CANVAS_SIZE - TRACE_PADDING * 2) / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const x = Math.round((TRACE_CANVAS_SIZE - width) / 2);
  const y = Math.round((TRACE_CANVAS_SIZE - height) / 2);
  context.drawImage(image, x, y, width, height);

  const imageData = context.getImageData(0, 0, TRACE_CANVAS_SIZE, TRACE_CANVAS_SIZE);
  const coverage = new Uint8ClampedArray(TRACE_CANVAS_SIZE * TRACE_CANVAS_SIZE);
  for (let index = 0; index < coverage.length; index += 1) {
    const dataIndex = index * 4;
    const alpha = imageData.data[dataIndex + 3];
    const red = imageData.data[dataIndex];
    const green = imageData.data[dataIndex + 1];
    const blue = imageData.data[dataIndex + 2];
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    coverage[index] = Math.round((alpha * (255 - luminance)) / 255);
  }

  const threshold = Math.max(22, Math.min(180, computeOtsuThreshold(coverage)));
  for (let index = 0; index < coverage.length; index += 1) {
    const dataIndex = index * 4;
    const foreground = coverage[index] >= threshold;
    imageData.data[dataIndex] = foreground ? 0 : 255;
    imageData.data[dataIndex + 1] = foreground ? 0 : 255;
    imageData.data[dataIndex + 2] = foreground ? 0 : 255;
    imageData.data[dataIndex + 3] = foreground ? 255 : 0;
  }

  const tracedSvg = new ImageTracer({
    colorSamplingMode: CreatePaletteMode.PALETTE,
    palette: [
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 255, g: 255, b: 255, a: 0 },
    ],
    numberOfColors: 2,
    colorClusteringCycles: 1,
    fillStyle: FillStyle.FILL,
    interpolation: InterpolationMode.INTERPOLATE,
    enhanceRightAngles: false,
    lineErrorMargin: 1,
    curveErrorMargin: 1.4,
    minShapeOutline: 8,
    lineFilter: true,
    decimalPlaces: 1,
    trim: TrimMode.KEEP_RATIO,
    viewBox: true,
  }).traceImageToSvg(imageData);

  return normalizeTracedSvgToIcon(tracedSvg);
}

function wrapSvg(content: string, viewBox: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${escapeAttribute(viewBox)}" fill="currentColor" stroke="none">${content}</svg>`;
}

function normalizeTracedSvgToIcon(svgText: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const sourceSvg = doc.querySelector('svg');
  if (!sourceSvg) throw new Error('Could not trace this bitmap.');

  const paths = Array.from(sourceSvg.querySelectorAll('path'))
    .filter((path) => {
      const fill = path.getAttribute('fill') || '';
      const opacity = Number(path.getAttribute('opacity') || '1');
      return Boolean(path.getAttribute('d')) && opacity > 0.05 && !isWhiteFill(fill);
    })
    .map((path) => {
      path.setAttribute('fill', 'currentColor');
      path.setAttribute('fill-rule', 'evenodd');
      path.setAttribute('clip-rule', 'evenodd');
      path.removeAttribute('stroke');
      path.removeAttribute('stroke-width');
      path.removeAttribute('opacity');
      path.removeAttribute('desc');
      return new XMLSerializer().serializeToString(path);
    });

  if (paths.length === 0) throw new Error('Could not find a strong foreground shape. Try a darker logo or transparent PNG.');
  const viewBox = sourceSvg.getAttribute('viewBox') || `0 0 ${TRACE_CANVAS_SIZE} ${TRACE_CANVAS_SIZE}`;
  return wrapSvg(paths.join(''), viewBox);
}

function computeOtsuThreshold(values: Uint8ClampedArray) {
  const histogram = new Array<number>(256).fill(0);
  let total = 0;
  let weightedTotal = 0;

  for (const value of values) {
    histogram[value] += 1;
    total += 1;
    weightedTotal += value;
  }

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = 0;
  let threshold = 64;

  for (let value = 0; value < histogram.length; value += 1) {
    backgroundWeight += histogram[value];
    if (backgroundWeight === 0) continue;

    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;

    backgroundSum += value * histogram[value];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (weightedTotal - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;

    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = value;
    }
  }

  return threshold;
}

function isWhiteFill(fill: string) {
  const match = fill.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
  if (!match) return false;
  const [, red, green, blue] = match.map(Number);
  return red > 245 && green > 245 && blue > 245;
}

function isRenderableSvgElement(node: SVGElement) {
  return ['path', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'rect'].includes(node.tagName.toLowerCase());
}

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load image.'));
    image.src = sourceUrl;
  });
}

function createReactComponentSnippet(name: string, svg: string) {
  if (!svg) return '';
  const componentName = toPascalCase(name || DEFAULT_ICON_NAME);
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] || '0 0 64 64';
  const inner = svg
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '')
    .trim();
  return `import type { SVGProps } from 'react';\n\nconst iconMarkup = \`${escapeTemplateLiteral(inner)}\`;\n\nexport function ${componentName}(props: SVGProps<SVGSVGElement>) {\n  return (\n    <svg\n      xmlns="http://www.w3.org/2000/svg"\n      viewBox="${viewBox}"\n      fill="currentColor"\n      stroke="none"\n      dangerouslySetInnerHTML={{ __html: iconMarkup }}\n      {...props}\n    />\n  );\n}`;
}

function toIconName(value: string) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function toPascalCase(value: string) {
  const words = toIconName(value).split('-').filter(Boolean);
  const pascal = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  return pascal || 'CustomIcon';
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeTemplateLiteral(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(text: string) {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
