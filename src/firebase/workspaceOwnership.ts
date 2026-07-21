import { offlineStorage } from '@/storage/offlineStorage';

export class WorkspaceOwnershipError extends Error {
  constructor() {
    super(
      'This browser profile contains local data for another account. ' +
        'Cloud upload is blocked so that data cannot be copied across accounts.',
    );
    this.name = 'WorkspaceOwnershipError';
  }
}

/**
 * LuDashboard's historical IndexedDB keys are shared by the browser profile.
 * Pin that cache to its first authenticated UID and fail closed on account
 * switches, rather than uploading one account's local workspace to another.
 */
export async function assertWorkspaceOwnership(userId: string, claimIfEmpty = false) {
  const owner = await offlineStorage.getWorkspaceOwner();
  if (owner && owner !== userId) throw new WorkspaceOwnershipError();
  if (!owner && claimIfEmpty) await offlineStorage.setWorkspaceOwner(userId);
}
