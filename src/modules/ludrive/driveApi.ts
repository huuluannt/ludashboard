import { getAuth } from 'firebase/auth';
import { app } from '@/firebase/config';
import type { DriveFile, GoogleWorkspaceAccount } from './types';

interface ApiOptions extends RequestInit {
  query?: Record<string, string>;
}

export async function driveApi<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const user = getAuth(app).currentUser;
  if (!user) throw new Error('Sign in to LuDashboard before using LuDrive.');

  const token = await user.getIdToken();
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(options.query || {})) {
    if (value) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'LuDrive request failed.');
  return data as T;
}

export async function startDriveConnection() {
  return driveApi<{ authUrl: string; scopes: string[] }>('/api/drive/connect', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchDriveAccounts() {
  return driveApi<{ accounts: GoogleWorkspaceAccount[] }>('/api/drive/accounts');
}

export async function removeDriveAccount(accountId: string) {
  return driveApi<{ ok: true }>('/api/drive/accounts', {
    method: 'DELETE',
    query: { accountId },
  });
}

export async function fetchDriveFiles(input: {
  accountId: string;
  q: string;
  parentId: string;
  pageSize?: number;
}) {
  return driveApi<{
    files: DriveFile[];
    errors?: Array<{ accountId: string; email: string; error: string; needsReconnect?: boolean }>;
  }>('/api/drive/files', {
    query: {
      accountId: input.accountId,
      q: input.q,
      parentId: input.parentId,
      pageSize: String(input.pageSize || 60),
    },
  });
}
