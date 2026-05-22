import ConnectedGoogleModule from '@/modules/google-workspace/ConnectedGoogleModule';

interface KeepNote {
  name: string;
  title: string;
  text: string;
  trashed: boolean;
  createTime: string;
  updateTime: string;
  accountId: string;
  accountEmail: string;
}

export default function LuKeepModule() {
  return (
    <ConnectedGoogleModule<KeepNote>
      appId="keep"
      apiBasePath="/api/keep"
      title="LuKeep"
      icon="sticky-note"
      accountLabel="Keep"
      itemLabel="note"
      endpointPath="/api/keep/notes"
      responseKey="notes"
      searchPlaceholder="Search Google Keep..."
      connectTitle="Connect Google Keep"
      connectDescription="LuKeep reads notes through the Google Keep API when that API is enabled for your account."
      emptyTitle="No notes found"
      emptyHint="Try another account or search term."
      loadingText="Loading Google Keep notes..."
      getItemKey={getNoteKey}
      getItemTitle={(note) => note.title || 'Untitled note'}
      getItemIcon={() => 'sticky-note'}
      renderItemContent={(note) => (
        <>
          <p className="truncate text-xs font-semibold">{note.title || 'Untitled note'}</p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--color-text-tertiary)]">
            {note.text || 'No readable note text'} | {note.accountEmail}
          </p>
        </>
      )}
      renderDetail={(note) => (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <InfoRow label="Created" value={formatDate(note.createTime)} />
            <InfoRow label="Updated" value={formatDate(note.updateTime)} />
          </div>
          <div className="min-h-[220px] whitespace-pre-wrap rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm leading-7">
            {note.text || 'This note has no readable text body.'}
          </div>
        </div>
      )}
    />
  );
}

function getNoteKey(note: KeepNote) {
  return `${note.accountId}:${note.name}`;
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
  return date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
