import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import Icon from '@/components/Icon';

type Orientation = 'horizontal' | 'vertical';

interface GalleryImage {
  file: File;
  url: string;
  width: number;
  height: number;
}

const GAP = 16;

export default function CollageImgModule() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      images.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, [images]);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const setSelectedFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) {
      setError('Please select at least two image files.');
      return;
    }

    try {
      const loaded = await Promise.all(files.map(loadLocalImage));
      setImages((current) => {
        current.forEach((image) => URL.revokeObjectURL(image.url));
        return loaded;
      });
      setResultUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setError(files.length < 2 ? 'Select one more image to create a collage.' : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load those images.');
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) setSelectedFiles(e.target.files);
      e.target.value = '';
    },
    [setSelectedFiles],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setSelectedFiles(e.dataTransfer.files);
    },
    [setSelectedFiles],
  );

  const createCollage = useCallback(async () => {
    if (images.length < 2) {
      setError('Please select at least two images.');
      return;
    }

    try {
      const loadedImages = await Promise.all(images.map((image) => loadImage(image.url)));
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available.');

      if (orientation === 'horizontal') {
        canvas.width = images.reduce((sum, image) => sum + image.width, 0) + GAP * (images.length - 1);
        canvas.height = Math.max(...images.map((image) => image.height));

        let x = 0;
        loadedImages.forEach((img, index) => {
          const y = (canvas.height - images[index].height) / 2;
          ctx.drawImage(img, x, y);
          x += images[index].width + GAP;
        });
      } else {
        canvas.width = Math.max(...images.map((image) => image.width));
        canvas.height = images.reduce((sum, image) => sum + image.height, 0) + GAP * (images.length - 1);

        let y = 0;
        loadedImages.forEach((img, index) => {
          const x = (canvas.width - images[index].width) / 2;
          ctx.drawImage(img, x, y);
          y += images[index].height + GAP;
        });
      }

      const blob = await canvasToBlob(canvas, 'image/png');
      const url = URL.createObjectURL(blob);
      setResultUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create collage.');
    }
  }, [images, orientation]);

  const download = useCallback(() => {
    if (!resultUrl) return;
    const anchor = document.createElement('a');
    anchor.href = resultUrl;
    anchor.download = `collage-${orientation}.png`;
    anchor.click();
  }, [orientation, resultUrl]);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Collage IMG</h2>
          <p className="text-sm text-[var(--color-text-tertiary)]">Select two or more local images and combine them.</p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--color-border)] px-4 py-6 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]"
        >
          <Icon name="images" size={40} className="text-[var(--color-text-tertiary)]" strokeWidth={1.5} />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Drop images here or <span className="font-medium text-[var(--color-accent)]">browse</span>
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">Choose at least 2 images</p>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
        </div>

        {images.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((image) => (
                <div key={`${image.file.name}-${image.url}`} className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-white">
                  <div className="flex aspect-square items-center justify-center bg-[var(--color-surface-subtle)]">
                    <img src={image.url} alt={image.file.name} className="h-full w-full object-contain" />
                  </div>
                  <div className="px-3 py-2">
                    <p className="truncate text-xs font-medium text-[var(--color-text-primary)]">{image.file.name}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)]">
                      {image.width} x {image.height}px
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrientation('horizontal')}
                  className={`h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                    orientation === 'horizontal'
                      ? 'border-[var(--color-accent)] bg-white text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-white/70 text-[var(--color-text-secondary)] hover:bg-white'
                  }`}
                >
                  Ngang
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('vertical')}
                  className={`h-10 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                    orientation === 'vertical'
                      ? 'border-[var(--color-accent)] bg-white text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] bg-white/70 text-[var(--color-text-secondary)] hover:bg-white'
                  }`}
                >
                  Dọc
                </button>
              </div>

              <button
                type="button"
                onClick={createCollage}
                disabled={images.length < 2}
                className="h-10 rounded-lg bg-[var(--color-accent)] text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                Collage
              </button>
            </div>
          </>
        )}

        {resultUrl && (
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-4">
            <img src={resultUrl} alt="Collage result" className="mx-auto max-h-[520px] rounded-lg object-contain" />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={download}
                className="h-10 rounded-lg border border-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-subtle)] cursor-pointer"
              >
                Download
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
    </div>
  );
}

function loadLocalImage(file: File) {
  return new Promise<GalleryImage>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => resolve({ file, url, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load ${file.name}.`));
    };
    img.src = url;
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image for collage.'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not export collage.'));
    }, type);
  });
}
