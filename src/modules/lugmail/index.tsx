import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';
import Icon from '@/components/Icon';
import { app } from '@/firebase/config';
import {
  fetchGmailAccounts,
  fetchGmailLabels,
  fetchGmailMessage,
  fetchGmailMessages,
  removeGmailAccount,
  startGmailConnection,
  updateGmailMessage,
} from './gmailApi';
import type { GmailLabel, GmailMessage, GoogleWorkspaceAccount } from './types';

const DEFAULT_LABELS: GmailLabel[] = [
  { id: 'INBOX', name: 'Inbox', type: 'system' },
  { id: 'UNREAD', name: 'Unread', type: 'system' },
  { id: 'STARRED', name: 'Starred', type: 'system' },
  { id: 'SENT', name: 'Sent', type: 'system' },
  { id: 'IMPORTANT', name: 'Important', type: 'system' },
  { id: 'all', name: 'All mail', type: 'system' },
];

export default function LuGmailModule() {
  const [dashboardUser, setDashboardUser] = useState<User | null>(() => getAuth(app).currentUser);
  const [accounts, setAccounts] = useState<GoogleWorkspaceAccount[]>([]);
  const [labels, setLabels] = useState<GmailLabel[]>(DEFAULT_LABELS);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [activeMessage, setActiveMessage] = useState<GmailMessage | null>(null);
  const [accountFilter, setAccountFilter] = useState('all');
  const [labelId, setLabelId] = useState('INBOX');
  const [query, setQuery] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const reconnectAccounts = accounts.filter((account) => account.needsReconnect);
  const selectedAccount = accounts.find((account) => account.accountId === accountFilter) || null;

  const visibleLabels = useMemo(() => {
    const merged = [...DEFAULT_LABELS];
    for (const label of labels) {
      if (!merged.some((item) => item.id === label.id)) merged.push(label);
    }
    return merged;
  }, [labels]);

  const loadAccounts = useCallback(async () => {
    if (!getAuth(app).currentUser) return;
    setLoadingAccounts(true);
    setError('');
    try {
      const { accounts: nextAccounts } = await fetchGmailAccounts();
      setAccounts(nextAccounts);
      setAccountFilter((current) => {
        if (current === 'all' || nextAccounts.some((account) => account.accountId === current)) return current;
        return 'all';
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load LuGmail accounts.');
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const loadLabels = useCallback(async () => {
    if (accountFilter === 'all') {
      setLabels(DEFAULT_LABELS);
      return;
    }
    const account = accounts.find((item) => item.accountId === accountFilter);
    if (!account || account.needsReconnect) return;
    try {
      const { labels: nextLabels } = await fetchGmailLabels(account.accountId);
      setLabels(nextLabels);
    } catch {
      setLabels(DEFAULT_LABELS);
    }
  }, [accountFilter, accounts]);

  const loadMessages = useCallback(async () => {
    if (!getAuth(app).currentUser || accounts.length === 0) return;
    setLoadingMessages(true);
    setError('');
    try {
      const { messages: nextMessages, errors } = await fetchGmailMessages({
        accountId: accountFilter,
        labelId,
        q: query.trim(),
        maxResults: 24,
      });
      setMessages(nextMessages);
      setActiveMessage((current) => {
        if (current && nextMessages.some((message) => message.id === current.id && message.accountId === current.accountId)) return current;
        return null;
      });
      if (errors?.length) {
        setStatus(errors.map((item) => `${item.email}: ${item.error}`).join(' | '));
      } else {
        setStatus('');
      }
    } catch (messageError) {
      setError(messageError instanceof Error ? messageError.message : 'Unable to load Gmail messages.');
    } finally {
      setLoadingMessages(false);
    }
  }, [accountFilter, accounts.length, labelId, query]);

  useEffect(() => {
    const auth = getAuth(app);
    return onAuthStateChanged(auth, (user) => {
      setDashboardUser(user);
      if (user) void loadAccounts();
    });
  }, [loadAccounts]);

  useEffect(() => {
    void loadLabels();
  }, [loadLabels]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'ludashboard-gmail-connected') {
        setConnecting(false);
        setStatus('Gmail account connected.');
        void loadAccounts();
      }
      if (event.data?.type === 'ludashboard-gmail-error') {
        setConnecting(false);
        setError('LuGmail connection failed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadAccounts]);

  const connectAccount = async () => {
    setConnecting(true);
    setError('');
    try {
      const { authUrl } = await startGmailConnection();
      const popup = window.open(authUrl, 'lugmail-google-oauth', 'width=520,height=720');
      if (!popup) {
        setConnecting(false);
        setError('Popup was blocked. Allow popups and try again.');
        return;
      }

      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          setConnecting(false);
          void loadAccounts();
        }
      }, 900);
    } catch (connectError) {
      setConnecting(false);
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect LuGmail.');
    }
  };

  const openMessage = async (message: GmailMessage) => {
    setActiveMessage(message);
    setLoadingDetail(true);
    setError('');
    try {
      const { message: detail } = await fetchGmailMessage(message.accountId, message.id);
      setActiveMessage(detail);
      if (detail.unread) await runAction(detail, 'markRead', { silent: true });
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Unable to open Gmail message.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const runAction = async (
    message: GmailMessage,
    action: 'archive' | 'markRead' | 'markUnread' | 'star' | 'unstar',
    options: { silent?: boolean } = {},
  ) => {
    const previousMessages = messages;
    const previousActive = activeMessage;
    if (action === 'archive') {
      setMessages((current) => current.filter((item) => !(item.id === message.id && item.accountId === message.accountId)));
      setActiveMessage(null);
    }

    try {
      const { message: updated } = await updateGmailMessage({
        accountId: message.accountId,
        messageId: message.id,
        action,
      });
      const labelPatch = {
        labelIds: updated.labelIds,
        unread: updated.unread,
        starred: updated.starred,
      };
      if (action !== 'archive') {
        setMessages((current) =>
          current.map((item) => (item.id === updated.id && item.accountId === updated.accountId ? { ...item, ...labelPatch } : item)),
        );
        setActiveMessage((current) =>
          current?.id === updated.id && current.accountId === updated.accountId ? { ...current, ...labelPatch } : current,
        );
      }
      if (!options.silent) setStatus(action === 'archive' ? 'Message archived.' : 'Message updated.');
    } catch (actionError) {
      setMessages(previousMessages);
      setActiveMessage(previousActive);
      setError(actionError instanceof Error ? actionError.message : 'Unable to update Gmail message.');
    }
  };

  const removeSelectedAccount = async () => {
    if (!selectedAccount) return;
    if (!window.confirm(`Remove ${selectedAccount.email} from LuGmail? Messages stay in Gmail.`)) return;
    await removeGmailAccount(selectedAccount.accountId);
    setAccounts((current) => current.filter((account) => account.accountId !== selectedAccount.accountId));
    setAccountFilter('all');
    setMessages((current) => current.filter((message) => message.accountId !== selectedAccount.accountId));
    setActiveMessage(null);
  };

  if (!dashboardUser) {
    return (
      <div className="flex h-full items-center justify-center bg-white p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="mail" size={26} />
          </div>
          <h2 className="text-lg font-semibold">Sign in to use LuGmail</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
            LuGmail connects Gmail accounts separately, while your LuDashboard login protects the API routes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-white text-[var(--color-text-primary)]">
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border-subtle)] px-3 py-2">
        <div className="flex min-w-[210px] flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
            <Icon name="mail" size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">LuGmail</h2>
            <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
              {loadingAccounts ? 'Loading accounts...' : `${accounts.length} Gmail accounts`} | {messages.length} messages
            </p>
          </div>
        </div>

        <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="h-8 min-w-[180px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] focus:bg-white">
          <option value="all">All connected Gmail</option>
          {accounts.map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.email}{account.needsReconnect ? ' (Reconnect)' : ''}
            </option>
          ))}
        </select>

        <select value={labelId} onChange={(event) => setLabelId(event.target.value)} className="h-8 min-w-[120px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 text-xs font-medium outline-none focus:border-[var(--color-accent)] focus:bg-white">
          {visibleLabels.map((label) => (
            <option key={label.id} value={label.id}>{label.name}</option>
          ))}
        </select>

        <label className="relative flex h-8 min-w-[180px] flex-1 items-center lg:max-w-sm">
          <Icon name="search" size={13} className="pointer-events-none absolute left-2.5 text-[var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void loadMessages();
            }}
            className="h-full w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:bg-white"
            placeholder="Search Gmail..."
          />
        </label>

        {selectedAccount && (
          <button type="button" onClick={removeSelectedAccount} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-red-50 hover:text-[var(--color-danger)]">
            <Icon name="trash" size={13} />
            Remove
          </button>
        )}

        <button type="button" onClick={connectAccount} disabled={connecting} className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-text-primary)] px-3 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">
          <Icon name="plus" size={13} />
          {connecting ? 'Connecting' : 'Connect account'}
        </button>
      </header>

      {(status || error || reconnectAccounts.length > 0) && (
        <div className="flex-shrink-0 border-b border-[var(--color-border-subtle)] px-4 py-2">
          {reconnectAccounts.length > 0 && <p className="text-xs font-medium text-amber-700">Reconnect account: {reconnectAccounts.map((account) => account.email).join(', ')}</p>}
          {status && <p className="text-xs text-[var(--color-text-secondary)]">{status}</p>}
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        </div>
      )}

      {accounts.length === 0 && !loadingAccounts ? (
        <ConnectEmptyState connecting={connecting} onConnect={connectAccount} />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 bg-[var(--color-surface-muted)] lg:grid-cols-[minmax(300px,420px)_1fr]">
          <section className="min-h-0 overflow-y-auto border-r border-[var(--color-border-subtle)] bg-white">
            {loadingMessages ? (
              <div className="p-4 text-xs text-[var(--color-text-tertiary)]">Loading Gmail messages...</div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div>
                  <Icon name="mail" size={24} className="mx-auto text-[var(--color-text-tertiary)]" />
                  <p className="mt-2 text-sm font-medium">No messages found</p>
                  <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Try another label, account, or search query.</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <button
                  key={`${message.accountId}:${message.id}`}
                  type="button"
                  onClick={() => void openMessage(message)}
                  className={`group flex w-full gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3 text-left transition-colors ${
                    activeMessage?.id === message.id && activeMessage.accountId === message.accountId
                      ? 'bg-[var(--color-accent-subtle)]'
                      : 'hover:bg-[var(--color-surface-muted)]'
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${message.unread ? 'bg-[var(--color-accent)]' : 'bg-transparent'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className={`truncate text-xs ${message.unread ? 'font-bold' : 'font-semibold'}`}>{cleanAddress(message.from) || message.accountEmail}</p>
                      <span className="ml-auto flex-shrink-0 text-[10px] text-[var(--color-text-tertiary)]">{formatMessageDate(message)}</span>
                    </div>
                    <p className={`mt-1 truncate text-xs ${message.unread ? 'font-bold' : 'font-medium'}`}>{message.subject}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--color-text-tertiary)]">{message.snippet}</p>
                    <p className="mt-1 truncate text-[10px] text-[var(--color-text-tertiary)]">{message.accountEmail}</p>
                  </div>
                </button>
              ))
            )}
          </section>

          <section className="min-h-0 overflow-y-auto p-4">
            {activeMessage ? (
              <article className="mx-auto max-w-4xl rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
                    <Icon name="mail" size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-base font-semibold">{activeMessage.subject}</h3>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{activeMessage.from || activeMessage.accountEmail}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">To: {activeMessage.to || 'me'} | {activeMessage.accountEmail}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <IconButton title="Archive" icon="archive" onClick={() => void runAction(activeMessage, 'archive')} />
                    <IconButton title={activeMessage.unread ? 'Mark read' : 'Mark unread'} icon={activeMessage.unread ? 'eye' : 'mail'} onClick={() => void runAction(activeMessage, activeMessage.unread ? 'markRead' : 'markUnread')} />
                    <IconButton title={activeMessage.starred ? 'Unstar' : 'Star'} icon="star" onClick={() => void runAction(activeMessage, activeMessage.starred ? 'unstar' : 'star')} />
                  </div>
                </div>
                {loadingDetail ? (
                  <div className="mt-6 text-xs text-[var(--color-text-tertiary)]">Opening message...</div>
                ) : (
                  <div className="mt-5 whitespace-pre-wrap break-words rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm leading-7 text-[var(--color-text-primary)]">
                    {activeMessage.bodyText || activeMessage.snippet || 'This message has no readable plain text body.'}
                  </div>
                )}
              </article>
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white text-[var(--color-accent)]">
                    <Icon name="mail" size={26} />
                  </div>
                  <h3 className="text-base font-semibold">Select a message</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-tertiary)]">
                    Read Gmail messages natively and archive, mark read, or star without leaving LuDashboard.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ConnectEmptyState({ connecting, onConnect }: { connecting: boolean; onConnect: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-accent)]">
          <Icon name="mail" size={25} />
        </div>
        <h3 className="text-base font-semibold">Connect Gmail</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
          LuGmail stores OAuth tokens server-side and supports multiple Gmail accounts inside one native module.
        </p>
        <button type="button" onClick={onConnect} disabled={connecting} className="mt-4 h-9 rounded-lg bg-[var(--color-text-primary)] px-4 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-50">
          Connect Gmail
        </button>
      </div>
    </div>
  );
}

function IconButton({ title, icon, onClick }: { title: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-accent)]"
    >
      <Icon name={icon} size={14} />
    </button>
  );
}

function cleanAddress(value: string) {
  return value.replace(/<[^>]+>/g, '').replace(/"/g, '').trim();
}

function formatMessageDate(message: GmailMessage) {
  const raw = Number(message.internalDate);
  const date = Number.isFinite(raw) && raw > 0 ? new Date(raw) : new Date(message.date);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
