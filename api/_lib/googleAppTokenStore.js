import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Redis } from '@upstash/redis';

const STATE_TTL_SECONDS = 15 * 60;
const APP_PREFIX_ENV = {
  gmail: 'LUGMAIL_REDIS_PREFIX',
  drive: 'LUDRIVE_REDIS_PREFIX',
};
const APP_DEFAULT_PREFIX = {
  gmail: 'ludashboard:lugmail',
  drive: 'ludashboard:ludrive',
};

let redisClient = null;

export async function createGoogleOAuthState(appId, ownerId) {
  assertKnownApp(appId);
  const state = randomBytes(24).toString('base64url');
  await redis().set(oauthStateKey(appId, state), { ownerId, createdAt: Date.now() }, { ex: STATE_TTL_SECONDS });
  return state;
}

export async function consumeGoogleOAuthState(appId, state) {
  assertKnownApp(appId);
  const key = oauthStateKey(appId, state);
  const entry = await redis().get(key);
  if (!entry || typeof entry !== 'object') return null;
  await redis().del(key);
  if (!entry.createdAt || Date.now() - Number(entry.createdAt) > STATE_TTL_SECONDS * 1000) return null;
  return entry;
}

export async function listGoogleAccounts(appId, ownerId) {
  assertKnownApp(appId);
  const accountIds = await getAccountIds(appId, ownerId);
  const accounts = await Promise.all(accountIds.map((accountId) => getGoogleAccount(appId, ownerId, accountId)));
  return accounts.filter(Boolean).map(publicAccount);
}

export async function getGoogleAccount(appId, ownerId, accountId) {
  assertKnownApp(appId);
  const account = await redis().get(accountKey(appId, ownerId, accountId));
  if (!account || typeof account !== 'object') return null;
  return decryptStoredAccount(account);
}

export async function upsertGoogleAccount(appId, ownerId, account) {
  assertKnownApp(appId);
  const previous = await getGoogleAccount(appId, ownerId, account.accountId);
  const next = {
    ...previous,
    ...account,
    refreshToken: account.refreshToken || previous?.refreshToken || '',
    updatedAt: Date.now(),
  };

  await redis().set(accountKey(appId, ownerId, account.accountId), encryptStoredAccount(next));
  await addAccountId(appId, ownerId, account.accountId);
  return publicAccount(next);
}

export async function updateGoogleAccount(appId, ownerId, accountId, patch) {
  assertKnownApp(appId);
  const account = await getGoogleAccount(appId, ownerId, accountId);
  if (!account) return null;

  const next = {
    ...account,
    ...patch,
    updatedAt: Date.now(),
  };
  await redis().set(accountKey(appId, ownerId, accountId), encryptStoredAccount(next));
  await addAccountId(appId, ownerId, accountId);
  return next;
}

export async function removeGoogleAccount(appId, ownerId, accountId) {
  assertKnownApp(appId);
  await redis().del(accountKey(appId, ownerId, accountId));
  await removeAccountId(appId, ownerId, accountId);
  return true;
}

function redis() {
  if (redisClient) return redisClient;

  const { url, token } = getRedisConfig();
  if (!url || !token) {
    throw new Error(
      'LuGmail and LuDrive require KV_REST_API_URL and KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, for server-side token storage.',
    );
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function getRedisConfig() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
  };
}

function prefixForApp(appId) {
  const envName = APP_PREFIX_ENV[appId];
  return process.env[envName] || APP_DEFAULT_PREFIX[appId];
}

function oauthStateKey(appId, state) {
  return `${prefixForApp(appId)}:oauth-state:${state}`;
}

function accountIdsKey(appId, ownerId) {
  return `${prefixForApp(appId)}:user:${ownerId}:account-ids`;
}

function accountKey(appId, ownerId, accountId) {
  return `${prefixForApp(appId)}:user:${ownerId}:account:${accountId}`;
}

async function getAccountIds(appId, ownerId) {
  const accountIds = await redis().get(accountIdsKey(appId, ownerId));
  if (!Array.isArray(accountIds)) return [];
  return accountIds.filter((accountId) => typeof accountId === 'string');
}

async function addAccountId(appId, ownerId, accountId) {
  const key = accountIdsKey(appId, ownerId);
  const accountIds = await getAccountIds(appId, ownerId);
  if (accountIds.includes(accountId)) return;
  await redis().set(key, [...accountIds, accountId]);
}

async function removeAccountId(appId, ownerId, accountId) {
  const accountIds = await getAccountIds(appId, ownerId);
  await redis().set(accountIdsKey(appId, ownerId), accountIds.filter((item) => item !== accountId));
}

function publicAccount(account) {
  return {
    accountId: account.accountId,
    email: account.email,
    connectedAt: account.connectedAt,
    updatedAt: account.updatedAt,
    expiresAt: account.expiresAt,
    needsReconnect: Boolean(account.needsReconnect),
    scope: account.scope || '',
  };
}

function encryptStoredAccount(account) {
  const { accessToken = '', refreshToken = '', ...publicFields } = account;
  return {
    ...publicFields,
    tokenVersion: 1,
    secrets: encryptJson({ accessToken, refreshToken }),
  };
}

function decryptStoredAccount(account) {
  if (!account.secrets) return account;
  const { secrets, ...publicFields } = account;
  return {
    ...publicFields,
    ...decryptJson(secrets),
  };
}

function encryptionKey() {
  const source =
    process.env.GOOGLE_TOKEN_SECRET ||
    process.env.LUCALENDAR_TOKEN_SECRET ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    '';
  if (!source) {
    throw new Error('GOOGLE_TOKEN_SECRET, LUCALENDAR_TOKEN_SECRET, or the Upstash Redis token is required to protect Google OAuth tokens.');
  }
  return createHash('sha256').update(source).digest();
}

function encryptJson(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return {
    alg: 'A256GCM',
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: encrypted.toString('base64url'),
  };
}

function decryptJson(payload) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(payload.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

function assertKnownApp(appId) {
  if (!APP_DEFAULT_PREFIX[appId]) {
    throw new Error(`Unsupported Google app token store: ${appId}`);
  }
}
