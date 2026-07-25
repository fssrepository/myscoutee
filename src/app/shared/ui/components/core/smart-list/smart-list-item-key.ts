export type SmartListItemKey = string | number;

export interface SmartListIdentifiable {
  smartListKey?: SmartListItemKey | null;
}

export function smartListItemKeyFromItem(item: unknown): SmartListItemKey | null {
  if (!item || typeof item !== 'object' || !('smartListKey' in item)) {
    return null;
  }
  const key = (item as SmartListIdentifiable).smartListKey;
  if (key === null || key === undefined) {
    return null;
  }
  const normalized = `${key}`.trim();
  if (!normalized) {
    return null;
  }
  return typeof key === 'number' ? key : normalized;
}

export function smartListItemByIdentity<T>(
  items: readonly T[],
  identity: string,
  identityForItem: (item: T, index: number) => SmartListItemKey
): T | null {
  const normalizedIdentity = identity.trim();
  if (!normalizedIdentity) {
    return null;
  }
  return items.find((item, index) => (
    `${identityForItem(item, index)}`.trim() === normalizedIdentity
  )) ?? null;
}
