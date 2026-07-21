import { Bytes, DocumentReference, GeoPoint, Timestamp, VectorValue } from 'firebase/firestore';

// Firestore's hard document limit is 1,048,576 bytes. Leave room for encoding
// details while still allowing an already-valid legacy document to migrate.
export const MAX_CONFIG_ESTIMATED_BYTES = 1000 * 1024;
export const MAX_WORKSPACE_STATE_BYTES = 320 * 1024;

const MAX_DOCUMENT_NAME_BYTES = 6 * 1024;
const MAX_FIELD_NAME_BYTES = 1_500;
const OMIT = Symbol('omit-firestore-value');
const textEncoder = new TextEncoder();

type JsonRecord = Record<string, unknown>;

/** Conservative implementation of Firestore's documented value-size rules. */
export function estimateFirestoreValueBytes(value: unknown) {
  return estimateValue(value, new WeakSet<object>());
}

export function estimateFirestoreDocumentBytes(value: unknown) {
  return estimateFirestoreValueBytes(value) + MAX_DOCUMENT_NAME_BYTES;
}

export function setModuleDataEntry(
  current: unknown,
  moduleId: string,
  key: string,
  value: unknown,
) {
  validateFieldName(moduleId);
  validateFieldName(key);
  const result = cloneModuleData(current);
  if (result[moduleId] !== undefined && !isPlainRecord(result[moduleId])) {
    throw new Error(
      `Existing moduleData field ${moduleId} is not a map and was left unchanged.`,
    );
  }
  result[moduleId] = {
    ...(isPlainRecord(result[moduleId]) ? result[moduleId] : {}),
    [key]: value,
  };
  return result;
}

/**
 * Removes undefined map fields (Firestore rejects them) and turns undefined
 * array entries into null without changing array positions. Unsupported or
 * over-deep data fails before a network write, preserving the local copy.
 */
export function normalizeFirestoreData<T>(value: T): T {
  // The supplied value is written as a document field value, so a root map or
  // array already consumes one of Firestore's 20 permitted nesting levels.
  const normalized = normalizeValue(value, 1, false, new WeakSet<object>());
  if (normalized === OMIT) throw new Error('Cloud data is not Firestore-serializable.');
  return normalized as T;
}

function cloneModuleData(value: unknown): JsonRecord {
  if (!isPlainRecord(value)) return {};
  // Shallow-clone the map. Untouched module entries (including legacy shapes)
  // must be carried through byte-for-byte instead of being coerced or pruned.
  return Object.fromEntries(Object.entries(value));
}

function normalizeValue(
  value: unknown,
  depth: number,
  parentIsArray: boolean,
  seen: WeakSet<object>,
): unknown | typeof OMIT {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return parentIsArray ? null : OMIT;
  }
  if (typeof value === 'bigint') throw new Error('BigInt values cannot be synced to Firestore.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value !== 'object') return OMIT;
  if (seen.has(value)) throw new Error('Circular cloud data cannot be synced to Firestore.');
  if (
    value instanceof Date ||
    value instanceof Timestamp ||
    value instanceof GeoPoint ||
    value instanceof Bytes ||
    value instanceof DocumentReference ||
    value instanceof VectorValue
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth > 20) throw new Error('Cloud data exceeds Firestore\'s maximum nesting depth.');
    if (parentIsArray) throw new Error('Firestore does not support arrays nested directly inside arrays.');
    seen.add(value);
    const result = value.map((item) => normalizeValue(item, depth + 1, true, seen));
    seen.delete(value);
    return result.map((item) => item === OMIT ? null : item);
  }

  if (!isPlainRecord(value)) {
    throw new Error(`Unsupported cloud data type: ${value.constructor?.name || 'object'}.`);
  }
  if (depth > 20) throw new Error('Cloud data exceeds Firestore\'s maximum nesting depth.');
  seen.add(value);
  const result: JsonRecord = {};
  for (const [fieldName, fieldValue] of Object.entries(value)) {
    validateFieldName(fieldName);
    const normalized = normalizeValue(fieldValue, depth + 1, false, seen);
    if (normalized !== OMIT) result[fieldName] = normalized;
  }
  seen.delete(value);
  return result;
}

function estimateValue(value: unknown, seen: WeakSet<object>): number {
  if (value === null) return 1;
  if (typeof value === 'boolean') return 1;
  if (typeof value === 'number') return 8;
  if (typeof value === 'string') return stringSize(value);
  if (typeof value === 'undefined' || typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    return Number.POSITIVE_INFINITY;
  }
  if (value instanceof Date) return 8;
  if (value instanceof Timestamp) return 8;
  if (value instanceof GeoPoint) return 16;
  if (value instanceof Bytes) return value.toUint8Array().byteLength;
  if (value instanceof DocumentReference) {
    return value.path.split('/').reduce((total, segment) => total + stringSize(segment), 16);
  }
  if (value instanceof VectorValue) return value.toArray().length * 8;
  if (Array.isArray(value)) {
    if (seen.has(value)) return Number.POSITIVE_INFINITY;
    seen.add(value);
    const size = value.reduce((total, item) => total + estimateValue(item, seen), 0);
    seen.delete(value);
    return size;
  }
  if (typeof value !== 'object' || seen.has(value)) return Number.POSITIVE_INFINITY;
  if (!isPlainRecord(value)) return Number.POSITIVE_INFINITY;

  seen.add(value);
  let size = 32;
  for (const [fieldName, fieldValue] of Object.entries(value)) {
    size += stringSize(fieldName) + estimateValue(fieldValue, seen);
  }
  seen.delete(value);
  return size;
}

function stringSize(value: string) {
  return textEncoder.encode(value).byteLength + 1;
}

function validateFieldName(fieldName: string) {
  if (/^__.*__$/.test(fieldName)) {
    throw new Error(`Reserved Firestore field name: ${fieldName}`);
  }
  if (textEncoder.encode(fieldName).byteLength > MAX_FIELD_NAME_BYTES) {
    throw new Error('Cloud data contains a Firestore field name larger than 1,500 bytes.');
  }
}

function isPlainRecord(value: unknown): value is JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
