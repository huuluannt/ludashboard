export const MAX_MODULE_ICON_SOURCE_BYTES = 5 * 1024 * 1024;
export const MAX_MODULE_ICON_BYTES = 24 * 1024;

const ICON_RENDER_ATTEMPTS = [
  { size: 64, quality: 0.78 },
  { size: 48, quality: 0.7 },
  { size: 32, quality: 0.62 },
] as const;

const normalizedIconCache = new Map<string, Promise<string>>();

export function isEmbeddedModuleIcon(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\//i.test(value);
}

export function getUtf8ByteSize(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function getModuleIconFallback(moduleType?: string) {
  if (moduleType === 'panel') return 'layout-panel-top';
  if (moduleType === 'url') return 'globe';
  return 'package';
}

/**
 * Turns an embedded image into a small thumbnail suitable for workspace metadata.
 * Small existing data URLs are kept as-is; legacy oversized raster/SVG icons are
 * rasterized so they cannot consume most of Firestore's per-document budget.
 */
export async function normalizeModuleIcon(
  icon: unknown,
  fallback = 'package',
  options: { preserveSourceOnFailure?: boolean } = {},
): Promise<string> {
  if (typeof icon !== 'string' || !icon.trim()) return fallback;
  if (!isEmbeddedModuleIcon(icon)) return icon;

  try {
    if (getUtf8ByteSize(icon) > MAX_MODULE_ICON_SOURCE_BYTES * 1.5) {
      return options.preserveSourceOnFailure ? icon : fallback;
    }
    if (getUtf8ByteSize(icon) <= MAX_MODULE_ICON_BYTES) return icon;
    return await rasterizeCachedModuleIcon(icon);
  } catch {
    return options.preserveSourceOnFailure ? icon : fallback;
  }
}

export async function normalizeModuleIconFile(file: File, fallback = 'package') {
  if (!file.type.startsWith('image/')) return fallback;
  if (file.size > MAX_MODULE_ICON_SOURCE_BYTES) return fallback;

  const objectUrl = URL.createObjectURL(file);
  try {
    return await rasterizeModuleIcon(objectUrl);
  } catch {
    return fallback;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function rasterizeCachedModuleIcon(source: string) {
  const cached = normalizedIconCache.get(source);
  if (cached) return cached;
  const normalized = rasterizeModuleIcon(source).catch((error) => {
    normalizedIconCache.delete(source);
    throw error;
  });
  normalizedIconCache.set(source, normalized);
  return normalized;
}

async function rasterizeModuleIcon(source: string) {
  const image = await loadImage(source);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) throw new Error('Invalid module icon dimensions');

  for (const attempt of ICON_RENDER_ATTEMPTS) {
    const scale = Math.min(1, attempt.size / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const webp = canvas.toDataURL('image/webp', attempt.quality);
    if (isEmbeddedModuleIcon(webp) && getUtf8ByteSize(webp) <= MAX_MODULE_ICON_BYTES) {
      return webp;
    }
  }

  throw new Error('Module icon could not be reduced below the cloud size limit');
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Invalid module icon image'));
    image.src = source;
  });
}
