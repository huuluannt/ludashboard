export interface GoogleWorkspaceAccount {
  accountId: string;
  email: string;
  connectedAt: number;
  updatedAt: number;
  expiresAt: number;
  needsReconnect: boolean;
  scope?: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messageListVisibility?: string;
  labelListVisibility?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  accountId: string;
  accountEmail: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  internalDate: string;
  snippet: string;
  labelIds: string[];
  unread: boolean;
  starred: boolean;
  bodyText?: string;
}
