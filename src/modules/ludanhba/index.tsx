import ConnectedGoogleModule from '@/modules/google-workspace/ConnectedGoogleModule';

interface ContactPerson {
  resourceName: string;
  displayName: string;
  emailAddresses: string[];
  phoneNumbers: string[];
  photoUrl: string;
  organization: string;
  accountId: string;
  accountEmail: string;
}

export default function LuDanhbaModule() {
  return (
    <ConnectedGoogleModule<ContactPerson>
      appId="contacts"
      apiBasePath="/api/contacts"
      title="LuDanhba"
      icon="user"
      accountLabel="contacts"
      itemLabel="contact"
      endpointPath="/api/contacts/people"
      responseKey="people"
      searchPlaceholder="Search Google contacts..."
      connectTitle="Connect Google Contacts"
      connectDescription="LuDanhba reads your Google Contacts through the People API."
      emptyTitle="No contacts found"
      emptyHint="Try another account or search term."
      loadingText="Loading Google contacts..."
      getItemKey={getPersonKey}
      getItemTitle={(person) => person.displayName || 'Unnamed contact'}
      getItemIcon={() => 'user'}
      renderItemContent={(person) => (
        <div className="flex items-center gap-3">
          {person.photoUrl ? (
            <img src={person.photoUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{person.displayName || 'Unnamed contact'}</p>
            <p className="mt-1 truncate text-[11px] text-[var(--color-text-tertiary)]">
              {person.emailAddresses[0] || person.phoneNumbers[0] || person.accountEmail}
            </p>
          </div>
        </div>
      )}
      renderDetail={(person) => (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {person.photoUrl ? (
              <img src={person.photoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
                {person.displayName.slice(0, 1).toUpperCase() || '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold">{person.displayName || 'Unnamed contact'}</p>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{person.organization || person.accountEmail}</p>
            </div>
          </div>
          <InfoList title="Emails" items={person.emailAddresses} />
          <InfoList title="Phones" items={person.phoneNumbers} />
          <InfoList title="Account" items={[person.accountEmail]} />
        </div>
      )}
    />
  );
}

function getPersonKey(person: ContactPerson) {
  return `${person.accountId}:${person.resourceName}`;
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
      <p className="text-[10px] font-semibold uppercase text-[var(--color-text-tertiary)]">{title}</p>
      <div className="mt-2 space-y-1 text-sm">
        {items.length > 0 ? items.map((item) => <p key={item} className="break-words">{item}</p>) : <p className="text-[var(--color-text-tertiary)]">None</p>}
      </div>
    </div>
  );
}
