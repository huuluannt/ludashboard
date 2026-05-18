import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STATE_TTL_MS = 15 * 60 * 1000;
const STORE_PATH =
  process.env.LUCALENDAR_TOKEN_STORE_PATH ||
  path.join(process.cwd(), '.ludashboard', 'lucalendar-token-store.json');

function emptyStore() {
  return {
    version: 1,
    oauthStates: {},
    users: {},
  };
}

export function getTokenStorePath() {
  return STORE_PATH;
}

export async function readCalendarTokenStore() {
  try {
    const raw = await readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...emptyStore(),
      ...parsed,
      oauthStates: parsed.oauthStates || {},
      users: parsed.users || {},
    };
  } catch {
    return emptyStore();
  }
}

async function writeCalendarTokenStore(store) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  const tempPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(store, null, 2), 'utf8');
  await rename(tempPath, STORE_PATH);
}

export async function createOAuthState(ownerId) {
  const store = await readCalendarTokenStore();
  cleanupExpiredStates(store);
  const state = randomBytes(24).toString('base64url');
  store.oauthStates[state] = {
    ownerId,
    createdAt: Date.now(),
  };
  await writeCalendarTokenStore(store);
  return state;
}

export async function consumeOAuthState(state) {
  const store = await readCalendarTokenStore();
  cleanupExpiredStates(store);
  const entry = store.oauthStates[state];
  if (!entry) return null;
  delete store.oauthStates[state];
  await writeCalendarTokenStore(store);
  return entry;
}

export async function listCalendarAccounts(ownerId) {
  const store = await readCalendarTokenStore();
  return Object.values(store.users[ownerId]?.accounts || {}).map(publicAccount);
}

export async function getCalendarAccount(ownerId, accountId) {
  const store = await readCalendarTokenStore();
  return store.users[ownerId]?.accounts?.[accountId] || null;
}

export async function upsertCalendarAccount(ownerId, account) {
  const store = await readCalendarTokenStore();
  store.users[ownerId] ||= { accounts: {} };
  const previous = store.users[ownerId].accounts[account.accountId];
  store.users[ownerId].accounts[account.accountId] = {
    ...previous,
    ...account,
    refreshToken: account.refreshToken || previous?.refreshToken || '',
    updatedAt: Date.now(),
  };
  await writeCalendarTokenStore(store);
  return publicAccount(store.users[ownerId].accounts[account.accountId]);
}

export async function updateCalendarAccount(ownerId, accountId, patch) {
  const store = await readCalendarTokenStore();
  const account = store.users[ownerId]?.accounts?.[accountId];
  if (!account) return null;
  store.users[ownerId].accounts[accountId] = {
    ...account,
    ...patch,
    updatedAt: Date.now(),
  };
  await writeCalendarTokenStore(store);
  return store.users[ownerId].accounts[accountId];
}

export async function removeCalendarAccount(ownerId, accountId) {
  const store = await readCalendarTokenStore();
  if (!store.users[ownerId]?.accounts?.[accountId]) return false;
  delete store.users[ownerId].accounts[accountId];
  await writeCalendarTokenStore(store);
  return true;
}

function cleanupExpiredStates(store) {
  const now = Date.now();
  for (const [state, entry] of Object.entries(store.oauthStates || {})) {
    if (!entry?.createdAt || now - entry.createdAt > STATE_TTL_MS) {
      delete store.oauthStates[state];
    }
  }
}

function publicAccount(account) {
  return {
    accountId: account.accountId,
    email: account.email,
    connectedAt: account.connectedAt,
    updatedAt: account.updatedAt,
    expiresAt: account.expiresAt,
    needsReconnect: Boolean(account.needsReconnect),
  };
}

