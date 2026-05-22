import { getAuth } from 'firebase/auth';
import { app } from '@/firebase/config';
import type { GoogleWorkspaceAccount } from './types';

interface ApiOptions extends RequestInit {
  query?: Record<string, string>;
}

export async function googleAppApi<T>(path: string, appName: string, options: ApiOptions = {}): Promise<T> {
  const user = getAuth(app).currentUser;
  if (!user) throw new Error(`Sign in to LuDashboard before using ${appName}.`);

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
  if (!response.ok) throw new Error(data?.error || `${appName} request failed.`);
  return data as T;
}

export async function startGoogleAppConnection(apiBasePath: string, appName: string) {
  return googleAppApi<{ authUrl: string; scopes: string[] }>(`${apiBasePath}/connect`, appName, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchGoogleAppAccounts(apiBasePath: string, appName: string) {
  return googleAppApi<{ accounts: GoogleWorkspaceAccount[] }>(`${apiBasePath}/accounts`, appName);
}

export async function removeGoogleAppAccount(apiBasePath: string, appName: string, accountId: string) {
  return googleAppApi<{ ok: true }>(`${apiBasePath}/accounts`, appName, {
    method: 'DELETE',
    query: { accountId },
  });
}
