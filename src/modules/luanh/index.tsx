import ConnectedGoogleModule from '@/modules/google-workspace/ConnectedGoogleModule';

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
  accountId: string;
  accountEmail: string;
}

export default function LuAnhModule() {
  return (
    <ConnectedGoogleModule<GooglePhoto>
      appId="photos"
      apiBasePath="/api/photos"
      title="LuAnh"
      icon="images"
      accountLabel="Photos"
      itemLabel="photo"
      endpointPath="/api/photos/media"
      responseKey="mediaItems"
      searchPlaceholder="Search Google Photos..."
      connectTitle="Connect Google Photos"
      connectDescription="LuAnh reads your Google Photos library metadata and previews through the Photos Library API."
      emptyTitle="No photos found"
      emptyHint="Try another account or search term."
      loadingText="Loading Google Photos..."
      getItemKey={getPhotoKey}
      getItemTitle={(photo) => photo.filename || 'Google Photos item'}
      getItemIcon={(photo) => (photo.mimeType.startsWith('video/') ? 'film' : 'image')}
      renderItemContent={(photo) => (
        <div className="flex items-center gap-3">
          {photo.baseUrl ? (
            <img src={`${photo.baseUrl}=w96-h96-c`} alt="" className="h-12 w-12 flex-shrink-0 rounded-xl object-cover" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{photo.filename || 'Google Photos item'}</p>
            <p className="mt-1 truncate text-[11px] text-[var(--color-text-tertiary)]">
              {formatDate(photo.creationTime)} | {photo.accountEmail}
            </p>
          </div>
        </div>
      )}
      renderDetail={(photo) => (
        <div className="space-y-4">
          {photo.baseUrl && (
            <img
              src={`${photo.baseUrl}=w1200-h800`}
              alt={photo.filename}
              className="max-h-[520px] w-full rounded-2xl border border-[var(--color-border-subtle)] object-contain"
            />
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <InfoRow label="Created" value={formatDate(photo.creationTime)} />
            <InfoRow label="Type" value={photo.mimeType || 'Unknown'} />
            <InfoRow label="Size" value={photo.width && photo.height ? `${photo.width} x ${photo.height}` : 'Unknown'} />
            <InfoRow label="Account" value={photo.accountEmail} />
          </div>
          {photo.description && (
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm leading-6">
              {photo.description}
            </div>
          )}
          {photo.productUrl && (
            <button type="button" onClick={() => window.open(photo.productUrl, '_blank', 'noopener,noreferrer')} className="flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black">
              Open in Google Photos
            </button>
          )}
        </div>
      )}
    />
  );
}

function getPhotoKey(photo: GooglePhoto) {
  return `${photo.accountId}:${photo.id}`;
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
