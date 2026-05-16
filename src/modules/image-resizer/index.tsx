import { useState, useRef, useCallback } from 'react';

interface ImageData {
  file: File;
  originalUrl: string;
  width: number;
  height: number;
}

export default function ImageResizerModule() {
  const [image, setImage] = useState<ImageData | null>(null);
  const [targetWidth, setTargetWidth] = useState(0);
  const [targetHeight, setTargetHeight] = useState(0);
  const [maintainRatio, setMaintainRatio] = useState(true);
  const [quality, setQuality] = useState(85);
  const [outputFormat, setOutputFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [resizedUrl, setResizedUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage({ file, originalUrl: url, width: img.width, height: img.height });
      setTargetWidth(img.width);
      setTargetHeight(img.height);
      setResizedUrl(null);
    };
    img.src = url;
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage({ file, originalUrl: url, width: img.width, height: img.height });
      setTargetWidth(img.width);
      setTargetHeight(img.height);
      setResizedUrl(null);
    };
    img.src = url;
  }, []);

  const updateWidth = (w: number) => {
    setTargetWidth(w);
    if (maintainRatio && image) {
      setTargetHeight(Math.round((w / image.width) * image.height));
    }
  };

  const updateHeight = (h: number) => {
    setTargetHeight(h);
    if (maintainRatio && image) {
      setTargetWidth(Math.round((h / image.height) * image.width));
    }
  };

  const resize = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const dataUrl = canvas.toDataURL(outputFormat, quality / 100);
      setResizedUrl(dataUrl);
    };
    img.src = image.originalUrl;
  }, [image, targetWidth, targetHeight, outputFormat, quality]);

  const download = useCallback(() => {
    if (!resizedUrl) return;
    const ext = outputFormat.split('/')[1];
    const a = document.createElement('a');
    a.href = resizedUrl;
    a.download = `resized-image.${ext}`;
    a.click();
  }, [resizedUrl, outputFormat]);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-2xl mx-auto">
        <canvas ref={canvasRef} className="hidden" />

        {/* Drop zone / File selector */}
        {!image ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="
              border-2 border-dashed border-[var(--color-border)] rounded-2xl
              flex flex-col items-center justify-center gap-3
              h-64 cursor-pointer
              transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]
            "
          >
            <svg className="w-10 h-10 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
            </svg>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Drop an image here or <span className="text-[var(--color-accent)] font-medium">browse</span>
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Supports JPG, PNG, WebP</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <>
            {/* Preview */}
            <div className="relative mb-6 bg-[var(--color-surface-subtle)] rounded-2xl p-4 border border-[var(--color-border-subtle)]">
              <img
                src={resizedUrl ?? image.originalUrl}
                alt="Preview"
                className="max-h-64 mx-auto rounded-lg object-contain"
              />
              <button
                onClick={() => { setImage(null); setResizedUrl(null); }}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
              >
                ✕
              </button>
              <div className="text-center mt-3 text-xs text-[var(--color-text-tertiary)]">
                Original: {image.width} × {image.height}px &middot; {(image.file.size / 1024).toFixed(1)} KB
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-5">
              {/* Dimensions */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Width</label>
                  <input
                    type="number"
                    value={targetWidth}
                    onChange={(e) => updateWidth(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
                <button
                  onClick={() => setMaintainRatio(!maintainRatio)}
                  className={`h-10 w-10 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                    maintainRatio
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-tertiary)]'
                  }`}
                  title="Lock aspect ratio"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={maintainRatio ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" : "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"} />
                  </svg>
                </button>
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Height</label>
                  <input
                    type="number"
                    value={targetHeight}
                    onChange={(e) => updateHeight(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Format & Quality */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">Format</label>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as typeof outputFormat)}
                    className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors cursor-pointer"
                  >
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/png">PNG</option>
                    <option value="image/webp">WebP</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1 block">
                    Quality: {quality}%
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="w-full mt-2 accent-[var(--color-accent)]"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={resize}
                  className="flex-1 h-10 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
                >
                  Resize
                </button>
                {resizedUrl && (
                  <button
                    onClick={download}
                    className="flex-1 h-10 rounded-lg border border-[var(--color-accent)] text-[var(--color-accent)] text-sm font-medium hover:bg-[var(--color-accent-subtle)] transition-colors cursor-pointer"
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
