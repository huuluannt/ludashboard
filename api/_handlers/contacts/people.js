import { requireDashboardUser } from '../../_lib/dashboardAuth.js';
import { GoogleWorkspaceAuthError, googleWorkspaceFetch } from '../../_lib/googleWorkspace.js';
import { allowCors, getQuery, requireMethod, sendJson } from '../../_lib/http.js';
import { resolveGoogleAccounts } from '../googleApp/resolveAccounts.js';

const APP_ID = 'contacts';

export default async function handler(req, res) {
  if (allowCors(req, res, ['GET', 'OPTIONS'])) return;
  if (!requireMethod(req, res, ['GET'])) return;

  const user = await requireDashboardUser(req, res, 'LuDanhba');
  if (!user) return;

  try {
    const query = getQuery(req);
    const accountId = String(query.get('accountId') || 'all');
    const search = String(query.get('q') || '').trim().toLowerCase();
    const pageSize = clampNumber(Number(query.get('pageSize') || 120), 10, 200);
    const accounts = await resolveGoogleAccounts(APP_ID, user.id, accountId);
    const people = [];
    const errors = [];

    for (const account of accounts) {
      try {
        people.push(...(await listPeopleForAccount(user.id, account, pageSize)));
      } catch (error) {
        errors.push({
          accountId: account.accountId,
          email: account.email,
          error: error instanceof Error ? error.message : 'Unable to load Google Contacts.',
          needsReconnect: error instanceof GoogleWorkspaceAuthError,
        });
      }
    }

    const filtered = search
      ? people.filter((person) => `${person.displayName} ${person.emailAddresses.join(' ')} ${person.phoneNumbers.join(' ')} ${person.organization} ${person.sourceLabel}`.toLowerCase().includes(search))
      : people;
    filtered.sort((a, b) => a.displayName.localeCompare(b.displayName));
    sendJson(res, 200, { people: filtered, errors });
  } catch (error) {
    if (error instanceof GoogleWorkspaceAuthError) {
      sendJson(res, error.status, { error: error.message, needsReconnect: true });
      return;
    }
    sendJson(res, 500, { error: error instanceof Error ? error.message : 'LuDanhba contacts request failed.' });
  }
}

async function listPeopleForAccount(ownerId, account, pageSize) {
  const [connections, otherContacts] = await Promise.all([
    listPagedPeople({
      ownerId,
      account,
      baseUrl: 'https://people.googleapis.com/v1/people/me/connections',
      pageSize,
      responseKey: 'connections',
      maskParam: 'personFields',
      maskValue: 'names,emailAddresses,phoneNumbers,photos,organizations,metadata',
      source: 'contacts',
    }),
    listPagedPeople({
      ownerId,
      account,
      baseUrl: 'https://people.googleapis.com/v1/otherContacts',
      pageSize,
      responseKey: 'otherContacts',
      maskParam: 'readMask',
      maskValue: 'names,emailAddresses,phoneNumbers,photos,metadata',
      source: 'otherContacts',
    }),
  ]);

  return dedupePeople([...connections, ...otherContacts]);
}

async function listPagedPeople({ ownerId, account, baseUrl, pageSize, responseKey, maskParam, maskValue, source }) {
  const people = [];
  let pageToken = '';

  for (let page = 0; page < 5; page += 1) {
    const url = new URL(baseUrl);
    url.searchParams.set('pageSize', String(pageSize));
    url.searchParams.set(maskParam, maskValue);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const data = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
    people.push(...(data[responseKey] || []).map((person) => normalizePerson(person, account, source)));
    pageToken = data.nextPageToken || '';
    if (!pageToken || people.length >= pageSize) break;
  }

  return people.slice(0, pageSize);
}

function dedupePeople(people) {
  const seen = new Set();
  return people.filter((person) => {
    const identity = person.resourceName || `${person.displayName}:${person.emailAddresses[0] || ''}:${person.phoneNumbers[0] || ''}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function normalizePerson(person, account, source) {
  const names = person.names || [];
  const emails = person.emailAddresses || [];
  const phones = person.phoneNumbers || [];
  const organizations = person.organizations || [];
  const photos = person.photos || [];
  const sourceLabel = source === 'otherContacts' ? 'Other Contacts' : 'Contacts';

  return {
    resourceName: person.resourceName || '',
    displayName: names[0]?.displayName || names[0]?.unstructuredName || '(Unnamed contact)',
    emailAddresses: emails.map((item) => item.value).filter(Boolean),
    phoneNumbers: phones.map((item) => item.value).filter(Boolean),
    photoUrl: photos.find((photo) => photo.url)?.url || '',
    organization: organizations.find((item) => item.name)?.name || '',
    source,
    sourceLabel,
    accountId: account.accountId,
    accountEmail: account.email,
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
