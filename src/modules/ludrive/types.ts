export interface GoogleWorkspaceAccount {
  accountId: string;
  email: string;
  connectedAt: number;
  updatedAt: number;
  expiresAt: number;
  needsReconnect: boolean;
  scope?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  modifiedTime: string;
  size: number | null;
  webViewLink: string;
  iconLink: string;
  parents: string[];
  starred: boolean;
  accountId: string;
  accountEmail: string;
}
