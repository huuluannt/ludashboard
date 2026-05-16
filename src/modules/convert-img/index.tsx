import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import Icon from '@/components/Icon';

type OutputFormat = 'jpg' | 'png' | 'ico';

interface SelectedImage {
  file: File;
  url: string;
  width: number;
  height: number;
}

interface ConvertedImage {
  url: string;
  fileName: string;
  label: string;
}

const OUTPUT_OPTIONS: Array<{ value: OutputFormat; label: string }> = [
  { value: 'jpg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'ico', label: 'ICO' },
];

export default function ConvertImgModule() {
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [format, setFormat] = useState<OutputFormat>('jpg');
  const [converted, setConverted] = useState<ConvertedImage | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.url);
    };
  }, [image]);

  useEffect(() => {
    return () => {
      if (converted) URL.revokeObjectURL(converted.url);
    };
  }, [converted]);

  const setSelectedFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      setImage((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { file, url, width: img.width, height: img.height };
      });
      setConverted((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return null;
      });
      setError('');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('Could not load that image.');
    };
    img.src = url;
  }, []);

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) setSelectedFile(file);
    },
    [setSelectedFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) setSelectedFile(file);
    },
    [setSelectedFile],
  );

  const convertImage = useCallback(async () => {
    if (!image) return;

    try {
      const source = await loadImage(image.url);
      const baseName = image.file.name.replace(/\.[^.]+$/, '') || 'converted-image';
      const canvas = document.createElement('canvas');

      if (format === 'ico') {
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas is not available.');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawContainedImage(ctx, source, canvas.width, canvas.height);
        const pngBlob = await canvasToBlob(canvas, 'image/png');
        const icoBlob = await pngBlobToIcoBlob(pngBlob);
        const url = URL.createObjectURL(icoBlob);
        setConverted((current) => {
          if (current) URL.revokeObjectURL(current.url);
          return { url, fileName: `${baseName}.ico`, label: 'ICO 256 x 256' };
        });
        return;
      }

      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available.');

      if (format === 'jpg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(source, 0, 0);
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const blob = await canvasToBlob(canvas, mimeType, 0.92);
      const url = URL.createObjectURL(blob);
      setConverted((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return {
          url,
          fileName: `${baseName}.${format}`,
          label: `${format.toUpperCase()} ${canvas.width} x ${canvas.height}`,
        };
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.');
    }
  }, [format, image]);

  const download = useCallback(() => {
    if (!converted) return;
    const anchor = document.createElement('a');
    anchor.href = converted.url;
    anchor.download = converted.fileName;
    anchor.click();
  }, [converted]);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Convert IMG</h2>
          <p className="text-sm text-[var(--color-text-tertiary)]">Local image conversion for JPG, PNG, and ICO.</p>
        </div>

        {!image ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-border)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]"
          >
            <Icon name="image" size={40} className="text-[var(--color-text-tertiary)]" strokeWidth={1.5} />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Drop an image here or <span className="font-medium text-[var(--color-accent)]">browse</span>
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Supports common local image files</p>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
              <img src={image.url} alt="Selected preview" className="mx-auto max-h-[360px] rounded-lg object-contain" />
              <div className="mt-3 text-center text-xs text-[var(--color-text-tertiary)]">
                {image.file.name} - {image.width} x {image.height}px - {(image.file.size / 1024).toFixed(1)} KB
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-2 block text-xs font-medium text-[var(--color-text-secondary)]">Output format</label>
                <div className="grid grid-cols-3 gap-2">
                  {OUTPUT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormat(option.value)}
                      className={`h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                        format === option.value
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={convertImage}
                className="h-10 rounded-lg bg-[var(--color-accent)] text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] cursor-pointer"
              >
                Convert
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 rounded-lg border border-[var(--color-border)] bg-white text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] cursor-pointer"
              >
                Choose another image
              </button>

              {converted && (
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-3">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">{converted.label}</p>
                  <button
                    type="button"
                    onClick={download}
                    className="mt-3 h-9 w-full rounded-lg border border-[var(--color-accent)] text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-subtle)] cursor-pointer"
                  >
                    Download
                  </button>
                </div>
              )}

              {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image for conversion.'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not export image.'));
    }, type, quality);
  });
}

function drawContainedImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) {
  const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
  const drawWidth = img.naturalWidth * scale;
  const drawHeight = img.naturalHeight * scale;
  ctx.drawImage(img, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function pngBlobToIcoBlob(pngBlob: Blob) {
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
  const header = new ArrayBuffer(22);
  const view = new DataView(header);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  view.setUint8(6, 0);
  view.setUint8(7, 0);
  view.setUint8(8, 0);
  view.setUint8(9, 0);
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, pngBytes.length, true);
  view.setUint32(18, 22, true);

  return new Blob([header, pngBytes], { type: 'image/x-icon' });
}
