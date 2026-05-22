import { getGoogleAccount, listGoogleAccounts } from '../../_lib/googleAppTokenStore.js';

export async function resolveGoogleAccounts(appId, ownerId, accountId) {
  const publicAccounts = await listGoogleAccounts(appId, ownerId);
  const accountIds = accountId === 'all' ? publicAccounts.map((account) => account.accountId) : [accountId];
  const accounts = await Promise.all(accountIds.map((id) => getGoogleAccount(appId, ownerId, id)));
  return accounts.filter(Boolean);
}
