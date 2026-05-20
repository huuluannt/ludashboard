export interface OneDriveAccount {
  accountId: string;
  email: string;
  name: string;
  connectedAt: number;
  updatedAt: number;
  expiresAt: number;
  needsReconnect: boolean;
  scope?: string;
}

export interface OneDriveFile {
  id: string;
  name: string;
  size: number | null;
  mimeType: string;
  isFolder: boolean;
  isImage: boolean;
  isVideo: boolean;
  webUrl: string;
  lastModifiedDateTime: string;
  createdDateTime: string;
  parentId: string;
  driveId: string;
  path: string;
  accountId: string;
  accountEmail: string;
}
