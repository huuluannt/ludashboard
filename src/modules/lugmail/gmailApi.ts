import { getAuth } from 'firebase/auth';
import { app } from '@/firebase/config';
import type { GmailLabel, GmailMessage, GoogleWorkspaceAccount } from './types';

interface ApiOptions extends RequestInit {
  query?: Record<string, string>;
}

export async function gmailApi<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const user = getAuth(app).currentUser;
  if (!user) throw new Error('Sign in to LuDashboard before using LuGmail.');

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
  if (!response.ok) throw new Error(data?.error || 'LuGmail request failed.');
  return data as T;
}

export async function startGmailConnection() {
  return gmailApi<{ authUrl: string; scopes: string[] }>('/api/gmail/connect', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchGmailAccounts() {
  return gmailApi<{ accounts: GoogleWorkspaceAccount[] }>('/api/gmail/accounts');
}

export async function removeGmailAccount(accountId: string) {
  return gmailApi<{ ok: true }>('/api/gmail/accounts', {
    method: 'DELETE',
    query: { accountId },
  });
}

export async function fetchGmailLabels(accountId: string) {
  return gmailApi<{ labels: GmailLabel[] }>('/api/gmail/labels', {
    query: { accountId },
  });
}

export async function fetchGmailMessages(input: {
  accountId: string;
  labelId: string;
  q: string;
  maxResults?: number;
}) {
  return gmailApi<{
    messages: GmailMessage[];
    errors?: Array<{ accountId: string; email: string; error: string; needsReconnect?: boolean }>;
  }>('/api/gmail/messages', {
    query: {
      accountId: input.accountId,
      labelId: input.labelId,
      q: input.q,
      maxResults: String(input.maxResults || 20),
    },
  });
}

export async function fetchGmailMessage(accountId: string, messageId: string) {
  return gmailApi<{ message: GmailMessage }>('/api/gmail/messages', {
    query: { accountId, messageId },
  });
}

export async function updateGmailMessage(input: {
  accountId: string;
  messageId: string;
  action: 'archive' | 'markRead' | 'markUnread' | 'star' | 'unstar';
}) {
  return gmailApi<{ ok: true; message: GmailMessage }>('/api/gmail/messages', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
