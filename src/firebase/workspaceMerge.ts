const WORKSPACE_KEYS = [
  'syncSchemaVersion',
  'importedModules',
  'moduleOverrides',
  'pinnedModuleIds',
  'moduleOrderIds',
  'openTabs',
  'activeTabId',
  'sidebarCollapsed',
  'rightSidebar',
  'rightCornerSidebar',
  'themeMode',
] as const;

export function toWorkspaceBase(state: Record<string, unknown>) {
  return Object.fromEntries(WORKSPACE_KEYS.map((key) => [key, state[key]]));
}

/**
 * Replays local changes on the newest remote workspace. With a common base,
 * this is a deletion-aware three-way merge. Clients upgrading from an older
 * build do not have a base yet, so their first conflict uses a conservative
 * union that preserves both devices' modules, pins, ordering entries and tabs.
 */
export function rebaseWorkspaceState(
  base: Record<string, unknown> | null,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  const hasBase = base !== null;
  return {
    syncSchemaVersion: 2,
    importedModules: mergeEntityList(base?.importedModules, local.importedModules, remote.importedModules, 'id', hasBase),
    moduleOverrides: mergeEntityList(base?.moduleOverrides, local.moduleOverrides, remote.moduleOverrides, 'id', hasBase),
    pinnedModuleIds: mergeStringList(base?.pinnedModuleIds, local.pinnedModuleIds, remote.pinnedModuleIds, hasBase),
    moduleOrderIds: mergeStringList(base?.moduleOrderIds, local.moduleOrderIds, remote.moduleOrderIds, hasBase),
    openTabs: mergeEntityList(base?.openTabs, local.openTabs, remote.openTabs, 'moduleId', hasBase),
    activeTabId: mergeWorkspaceValue(base?.activeTabId, local.activeTabId, remote.activeTabId, hasBase),
    sidebarCollapsed: mergeWorkspaceValue(base?.sidebarCollapsed, local.sidebarCollapsed, remote.sidebarCollapsed, hasBase),
    rightSidebar: mergeWorkspaceValue(base?.rightSidebar, local.rightSidebar, remote.rightSidebar, hasBase),
    rightCornerSidebar: mergeWorkspaceValue(
      base?.rightCornerSidebar,
      local.rightCornerSidebar,
      remote.rightCornerSidebar,
      hasBase,
    ),
    themeMode: mergeWorkspaceValue(base?.themeMode, local.themeMode, remote.themeMode, hasBase),
  };
}

function mergeEntityList(
  baseValue: unknown,
  localValue: unknown,
  remoteValue: unknown,
  idKey: 'id' | 'moduleId',
  hasBase: boolean,
) {
  const base = recordsById(baseValue, idKey);
  const local = recordsById(localValue, idKey);
  const remote = recordsById(remoteValue, idKey);
  const order = Array.from(new Set([...local.keys(), ...remote.keys(), ...base.keys()]));

  if (!hasBase) {
    return order
      .map((id) => local.get(id) ?? remote.get(id))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  return order.flatMap((id) => {
    const merged = mergeOptionalRecord(base.get(id), local.get(id), remote.get(id));
    return merged ? [merged] : [];
  });
}

function mergeOptionalRecord(
  base: Record<string, unknown> | undefined,
  local: Record<string, unknown> | undefined,
  remote: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!base) {
    if (!local) return remote;
    if (!remote) return local;
    return mergeWorkspaceValue({}, local, remote, true) as Record<string, unknown>;
  }
  if (!local) return deepEqual(remote, base) ? undefined : remote;
  if (!remote) return deepEqual(local, base) ? undefined : local;
  return mergeWorkspaceValue(base, local, remote, true) as Record<string, unknown>;
}

function mergeStringList(baseValue: unknown, localValue: unknown, remoteValue: unknown, hasBase: boolean) {
  const base = normalizeStringList(baseValue);
  const local = normalizeStringList(localValue);
  const remote = normalizeStringList(remoteValue);
  if (!hasBase) return mergeIdLists(local, remote);
  if (deepEqual(local, base)) return remote;
  if (deepEqual(remote, base)) return local;

  const baseSet = new Set(base);
  const localSet = new Set(local);
  const remoteSet = new Set(remote);
  const order = Array.from(new Set([...local, ...remote, ...base]));
  return order.filter((id) => {
    const wasPresent = baseSet.has(id);
    const localPresent = localSet.has(id);
    const remotePresent = remoteSet.has(id);
    if (localPresent === wasPresent) return remotePresent;
    if (remotePresent === wasPresent) return localPresent;
    return localPresent || remotePresent;
  });
}

function mergeWorkspaceValue(base: unknown, local: unknown, remote: unknown, hasBase: boolean): unknown {
  if (!hasBase) return local;
  if (deepEqual(local, base)) return remote;
  if (deepEqual(remote, base) || deepEqual(local, remote)) return local;

  if (isRecord(base) && isRecord(local) && isRecord(remote)) {
    const result: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    keys.forEach((key) => {
      const localHasKey = Object.prototype.hasOwnProperty.call(local, key);
      const remoteHasKey = Object.prototype.hasOwnProperty.call(remote, key);
      const baseHasKey = Object.prototype.hasOwnProperty.call(base, key);
      if (!localHasKey && !remoteHasKey) return;
      if (!localHasKey) {
        if (!baseHasKey || !deepEqual(remote[key], base[key])) result[key] = remote[key];
        return;
      }
      if (!remoteHasKey) {
        if (!baseHasKey || !deepEqual(local[key], base[key])) result[key] = local[key];
        return;
      }
      result[key] = mergeWorkspaceValue(base[key], local[key], remote[key], baseHasKey);
    });
    return result;
  }

  // Two different values cannot occupy the same scalar field. The pending
  // value on this device wins that one field; all non-overlapping remote edits
  // have already been retained by the object/list merge above.
  return local;
}

function recordsById(value: unknown, idKey: 'id' | 'moduleId') {
  const records = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(value)) return records;
  value.filter(isRecord).forEach((record) => {
    const id = record[idKey];
    if (typeof id === 'string' && id) records.set(id, record);
  });
  return records;
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(item))));
}

function mergeIdLists(primary: string[], secondary: string[]) {
  return Array.from(new Set([...primary, ...secondary]));
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]));
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
