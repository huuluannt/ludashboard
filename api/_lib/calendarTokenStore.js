import { createSign, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STATE_TTL_MS = 15 * 60 * 1000;
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';

let firestoreAccessToken = null;

function emptyStore() {
  return {
    version: 1,
    oauthStates: {},
    users: {},
  };
}

export function getTokenStorePath() {
  return getFileStorePath();
}

export function getCalendarTokenStoreBackend() {
  if (hasRedisConfig()) return 'redis';
  return hasFirestoreConfig() ? 'firestore' : 'file';
}

export async function readCalendarTokenStore() {
  assertFileStoreAllowed();
  try {
    const raw = await readFile(getFileStorePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  } catch {
    return emptyStore();
  }
}

export async function createOAuthState(ownerId) {
  const state = randomBytes(24).toString('base64url');
  const entry = {
    ownerId,
    createdAt: Date.now(),
  };

  if (hasRedisConfig()) {
    await redisSetJson(oauthStateKey(state), entry, Math.floor(STATE_TTL_MS / 1000));
    return state;
  }

  if (hasFirestoreConfig()) {
    await setFirestoreJsonDocument(['lucalendarOAuthStates', state], entry);
    return state;
  }

  const store = await readCalendarTokenStore();
  cleanupExpiredStates(store);
  store.oauthStates[state] = entry;
  await writeCalendarTokenStore(store);
  return state;
}

export async function consumeOAuthState(state) {
  if (hasRedisConfig()) {
    const entry = await redisGetJson(oauthStateKey(state));
    if (!entry) return null;
    await redisDelete(oauthStateKey(state));
    if (!entry.createdAt || Date.now() - entry.createdAt > STATE_TTL_MS) return null;
    return entry;
  }

  if (hasFirestoreConfig()) {
    const entry = await getFirestoreJsonDocument(['lucalendarOAuthStates', state]);
    if (!entry) return null;
    await deleteFirestoreDocument(['lucalendarOAuthStates', state]);
    if (!entry.createdAt || Date.now() - entry.createdAt > STATE_TTL_MS) return null;
    return entry;
  }

  const store = await readCalendarTokenStore();
  cleanupExpiredStates(store);
  const entry = store.oauthStates[state];
  if (!entry) return null;
  delete store.oauthStates[state];
  await writeCalendarTokenStore(store);
  return entry;
}

export async function listCalendarAccounts(ownerId) {
  if (hasRedisConfig()) {
    const accountIds = await redisGetJson(accountIdsKey(ownerId)) || [];
    const accounts = await Promise.all(accountIds.map((accountId) => getCalendarAccount(ownerId, accountId)));
    return accounts.filter(Boolean).map(publicAccount);
  }

  if (hasFirestoreConfig()) {
    const accounts = await listFirestoreJsonDocuments(['lucalendarUsers', ownerId, 'accounts']);
    return accounts.map(publicAccount);
  }

  const store = await readCalendarTokenStore();
  return Object.values(store.users[ownerId]?.accounts || {}).map(publicAccount);
}

export async function getCalendarAccount(ownerId, accountId) {
  if (hasRedisConfig()) {
    return redisGetJson(accountKey(ownerId, accountId));
  }

  if (hasFirestoreConfig()) {
    return getFirestoreJsonDocument(['lucalendarUsers', ownerId, 'accounts', accountId]);
  }

  const store = await readCalendarTokenStore();
  return store.users[ownerId]?.accounts?.[accountId] || null;
}

export async function upsertCalendarAccount(ownerId, account) {
  if (hasRedisConfig()) {
    const previous = await getCalendarAccount(ownerId, account.accountId);
    const next = {
      ...previous,
      ...account,
      refreshToken: account.refreshToken || previous?.refreshToken || '',
      updatedAt: Date.now(),
    };
    await redisSetJson(accountKey(ownerId, account.accountId), next);
    await addRedisAccountId(ownerId, account.accountId);
    return publicAccount(next);
  }

  if (hasFirestoreConfig()) {
    const previous = await getCalendarAccount(ownerId, account.accountId);
    const next = {
      ...previous,
      ...account,
      refreshToken: account.refreshToken || previous?.refreshToken || '',
      updatedAt: Date.now(),
    };
    await setFirestoreJsonDocument(['lucalendarUsers', ownerId, 'accounts', account.accountId], next);
    return publicAccount(next);
  }

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
  if (hasRedisConfig()) {
    const account = await getCalendarAccount(ownerId, accountId);
    if (!account) return null;
    const next = {
      ...account,
      ...patch,
      updatedAt: Date.now(),
    };
    await redisSetJson(accountKey(ownerId, accountId), next);
    await addRedisAccountId(ownerId, accountId);
    return next;
  }

  if (hasFirestoreConfig()) {
    const account = await getCalendarAccount(ownerId, accountId);
    if (!account) return null;
    const next = {
      ...account,
      ...patch,
      updatedAt: Date.now(),
    };
    await setFirestoreJsonDocument(['lucalendarUsers', ownerId, 'accounts', accountId], next);
    return next;
  }

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
  if (hasRedisConfig()) {
    await redisDelete(accountKey(ownerId, accountId));
    await removeRedisAccountId(ownerId, accountId);
    return true;
  }

  if (hasFirestoreConfig()) {
    await deleteFirestoreDocument(['lucalendarUsers', ownerId, 'accounts', accountId]);
    return true;
  }

  const store = await readCalendarTokenStore();
  if (!store.users[ownerId]?.accounts?.[accountId]) return false;
  delete store.users[ownerId].accounts[accountId];
  await writeCalendarTokenStore(store);
  return true;
}

function getFileStorePath() {
  if (process.env.LUCALENDAR_TOKEN_STORE_PATH) return process.env.LUCALENDAR_TOKEN_STORE_PATH;
  if (process.env.VERCEL) return path.join('/tmp', 'ludashboard', 'lucalendar-token-store.json');
  return path.join(process.cwd(), '.ludashboard', 'lucalendar-token-store.json');
}

function assertFileStoreAllowed() {
  if (!process.env.VERCEL || process.env.LUCALENDAR_ALLOW_TMP_TOKEN_STORE === 'true') return;
  throw new Error(
    'LuCalendar on Vercel requires KV_REST_API_URL and KV_REST_API_TOKEN, or FIREBASE_SERVICE_ACCOUNT_JSON, for server-side token storage. Vercel Functions cannot persist files under /var/task.',
  );
}

function normalizeStore(parsed) {
  return {
    ...emptyStore(),
    ...parsed,
    oauthStates: parsed?.oauthStates || {},
    users: parsed?.users || {},
  };
}

async function writeCalendarTokenStore(store) {
  assertFileStoreAllowed();
  const storePath = getFileStorePath();
  await mkdir(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, JSON.stringify(store, null, 2), 'utf8');
  await rename(tempPath, storePath);
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

function hasRedisConfig() {
  const config = getRedisConfig();
  return Boolean(config.url && config.token);
}

function getRedisConfig() {
  return {
    url: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, ''),
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
  };
}

function redisPrefix() {
  return process.env.LUCALENDAR_REDIS_PREFIX || 'ludashboard:lucalendar';
}

function oauthStateKey(state) {
  return `${redisPrefix()}:oauth-state:${state}`;
}

function accountIdsKey(ownerId) {
  return `${redisPrefix()}:user:${ownerId}:account-ids`;
}

function accountKey(ownerId, accountId) {
  return `${redisPrefix()}:user:${ownerId}:account:${accountId}`;
}

async function redisCommand(command) {
  const config = getRedisConfig();
  if (!config.url || !config.token) {
    throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN are required for LuCalendar Redis token storage.');
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error || 'Redis token storage request failed.');
  }
  return data.result;
}

async function redisGetJson(key) {
  const raw = await redisCommand(['GET', key]);
  if (!raw) return null;
  return JSON.parse(raw);
}

async function redisSetJson(key, value, ttlSeconds) {
  const payload = JSON.stringify(value);
  if (ttlSeconds) {
    await redisCommand(['SET', key, payload, 'EX', ttlSeconds]);
    return;
  }
  await redisCommand(['SET', key, payload]);
}

async function redisDelete(key) {
  await redisCommand(['DEL', key]);
}

async function addRedisAccountId(ownerId, accountId) {
  const key = accountIdsKey(ownerId);
  const accountIds = await redisGetJson(key) || [];
  if (!accountIds.includes(accountId)) {
    accountIds.push(accountId);
    await redisSetJson(key, accountIds);
  }
}

async function removeRedisAccountId(ownerId, accountId) {
  const key = accountIdsKey(ownerId);
  const accountIds = await redisGetJson(key) || [];
  await redisSetJson(key, accountIds.filter((item) => item !== accountId));
}

function hasFirestoreConfig() {
  const config = getFirestoreConfig();
  return Boolean(config.projectId && config.clientEmail && config.privateKey);
}

function getFirestoreConfig() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  let parsed = {};
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID || parsed.project_id || process.env.VITE_FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || parsed.client_email || '',
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || parsed.private_key || ''),
  };
}

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n');
}

async function getFirestoreAccessToken() {
  if (firestoreAccessToken && firestoreAccessToken.expiresAt - Date.now() > 60_000) {
    return firestoreAccessToken.token;
  }

  const config = getFirestoreConfig();
  if (!config.projectId || !config.clientEmail || !config.privateKey) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required for LuCalendar token storage on Vercel.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const payload = base64UrlJson({
    iss: config.clientEmail,
    scope: FIRESTORE_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsignedJwt = `${header}.${payload}`;
  const signature = createSign('RSA-SHA256').update(unsignedJwt).sign(config.privateKey, 'base64url');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'Unable to authenticate Firebase service account.');
  }

  firestoreAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  return firestoreAccessToken.token;
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function firestoreBaseUrl() {
  const { projectId } = getFirestoreConfig();
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
}

function firestoreDocumentUrl(segments) {
  return `${firestoreBaseUrl()}/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`;
}

async function firestoreFetch(url, options = {}) {
  const token = await getFirestoreAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Firestore token storage request failed.');
  }
  return data;
}

async function getFirestoreJsonDocument(segments) {
  const data = await firestoreFetch(firestoreDocumentUrl(segments));
  if (!data?.fields?.data?.stringValue) return null;
  return JSON.parse(data.fields.data.stringValue);
}

async function setFirestoreJsonDocument(segments, value) {
  const url = firestoreDocumentUrl(segments);
  await firestoreFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        data: { stringValue: JSON.stringify(value) },
        updatedAt: { integerValue: String(Date.now()) },
      },
    }),
  });
}

async function deleteFirestoreDocument(segments) {
  await firestoreFetch(firestoreDocumentUrl(segments), { method: 'DELETE' });
}

async function listFirestoreJsonDocuments(segments) {
  const data = await firestoreFetch(firestoreDocumentUrl(segments));
  if (!data?.documents) return [];
  return data.documents
    .map((document) => document.fields?.data?.stringValue)
    .filter(Boolean)
    .map((raw) => JSON.parse(raw));
}
