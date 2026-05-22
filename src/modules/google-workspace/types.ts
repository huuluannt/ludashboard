export interface GoogleWorkspaceAccount {
  accountId: string;
  email: string;
  connectedAt: number;
  updatedAt: number;
  expiresAt: number;
  needsReconnect: boolean;
  scope?: string;
}

export interface GoogleWorkspaceListError {
  accountId: string;
  email: string;
  error: string;
  needsReconnect?: boolean;
}
