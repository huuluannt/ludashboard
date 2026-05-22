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
    const pageSize = clampNumber(Number(query.get('pageSize') || 80), 10, 100);
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
      ? people.filter((person) => `${person.displayName} ${person.emailAddresses.join(' ')} ${person.phoneNumbers.join(' ')}`.toLowerCase().includes(search))
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
  const url = new URL('https://people.googleapis.com/v1/people/me/connections');
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers,photos,organizations');
  const data = await googleWorkspaceFetch(APP_ID, ownerId, account, url.toString());
  return (data.connections || []).map((person) => normalizePerson(person, account));
}

function normalizePerson(person, account) {
  const names = person.names || [];
  const emails = person.emailAddresses || [];
  const phones = person.phoneNumbers || [];
  const organizations = person.organizations || [];
  const photos = person.photos || [];

  return {
    resourceName: person.resourceName || '',
    displayName: names[0]?.displayName || names[0]?.unstructuredName || '(Unnamed contact)',
    emailAddresses: emails.map((item) => item.value).filter(Boolean),
    phoneNumbers: phones.map((item) => item.value).filter(Boolean),
    photoUrl: photos.find((photo) => photo.url)?.url || '',
    organization: organizations.find((item) => item.name)?.name || '',
    accountId: account.accountId,
    accountEmail: account.email,
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
