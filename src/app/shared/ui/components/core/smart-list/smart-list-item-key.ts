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
