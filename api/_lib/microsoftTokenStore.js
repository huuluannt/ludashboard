import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Redis } from '@upstash/redis';

const STATE_TTL_SECONDS = 15 * 60;
const TOKEN_PREFIX = process.env.LUONEDRIVE_REDIS_PREFIX || 'ludashboard:luonedrive';

let redisClient = null;

export async function createMicrosoftOAuthState(ownerId) {
  const state = randomBytes(24).toString('base64url');
  await redis().set(oauthStateKey(state), { ownerId, createdAt: Date.now() }, { ex: STATE_TTL_SECONDS });
  return state;
}

export async function consumeMicrosoftOAuthState(state) {
  const key = oauthStateKey(state);
  const entry = await redis().get(key);
  if (!entry || typeof entry !== 'object') return null;
  await redis().del(key);
  if (!entry.createdAt || Date.now() - Number(entry.createdAt) > STATE_TTL_SECONDS * 1000) return null;
  return entry;
}

export async function listMicrosoftAccounts(ownerId) {
  const accountIds = await getAccountIds(ownerId);
  const accounts = await Promise.all(accountIds.map((accountId) => getMicrosoftAccount(ownerId, accountId)));
  return accounts.filter(Boolean).map(publicAccount);
}

export async function getMicrosoftAccount(ownerId, accountId) {
  const account = await redis().get(accountKey(ownerId, accountId));
  if (!account || typeof account !== 'object') return null;
  return decryptStoredAccount(account);
}

export async function upsertMicrosoftAccount(ownerId, account) {
  const previous = await getMicrosoftAccount(ownerId, account.accountId);
  const next = {
    ...previous,
    ...account,
    refreshToken: account.refreshToken || previous?.refreshToken || '',
    updatedAt: Date.now(),
  };

  await redis().set(accountKey(ownerId, account.accountId), encryptStoredAccount(next));
  await addAccountId(ownerId, account.accountId);
  return publicAccount(next);
}

export async function updateMicrosoftAccount(ownerId, accountId, patch) {
  const account = await getMicrosoftAccount(ownerId, accountId);
  if (!account) return null;

  const next = {
    ...account,
    ...patch,
    updatedAt: Date.now(),
  };
  await redis().set(accountKey(ownerId, accountId), encryptStoredAccount(next));
  await addAccountId(ownerId, accountId);
  return next;
}

export async function removeMicrosoftAccount(ownerId, accountId) {
  await redis().del(accountKey(ownerId, accountId));
  await removeAccountId(ownerId, accountId);
  return true;
}

function redis() {
  if (redisClient) return redisClient;

  const { url, token } = getRedisConfig();
  if (!url || !token) {
    throw new Error(
      'LuOnedrive requires KV_REST_API_URL and KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, for server-side token storage.',
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

function oauthStateKey(state) {
  return `${TOKEN_PREFIX}:oauth-state:${state}`;
}

function accountIdsKey(ownerId) {
  return `${TOKEN_PREFIX}:user:${ownerId}:account-ids`;
}

function accountKey(ownerId, accountId) {
  return `${TOKEN_PREFIX}:user:${ownerId}:account:${accountId}`;
}

async function getAccountIds(ownerId) {
  const accountIds = await redis().get(accountIdsKey(ownerId));
  if (!Array.isArray(accountIds)) return [];
  return accountIds.filter((accountId) => typeof accountId === 'string');
}

async function addAccountId(ownerId, accountId) {
  const key = accountIdsKey(ownerId);
  const accountIds = await getAccountIds(ownerId);
  if (accountIds.includes(accountId)) return;
  await redis().set(key, [...accountIds, accountId]);
}

async function removeAccountId(ownerId, accountId) {
  const accountIds = await getAccountIds(ownerId);
  await redis().set(accountIdsKey(ownerId), accountIds.filter((item) => item !== accountId));
}

function publicAccount(account) {
  return {
    accountId: account.accountId,
    email: account.email,
    name: account.name || '',
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
    process.env.MICROSOFT_TOKEN_SECRET ||
    process.env.GOOGLE_TOKEN_SECRET ||
    process.env.LUCALENDAR_TOKEN_SECRET ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    '';
  if (!source) {
    throw new Error('MICROSOFT_TOKEN_SECRET, GOOGLE_TOKEN_SECRET, LUCALENDAR_TOKEN_SECRET, or the Upstash Redis token is required to protect Microsoft OAuth tokens.');
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
