export type SmartListLocalSortValue = string | number | boolean | null | undefined;
export type SmartListLocalSortKey = SmartListLocalSortValue | readonly SmartListLocalSortValue[];

export interface SmartListLocalSortable {
  localSortKey?: SmartListLocalSortKey | null;
}

export function smartListLocalSortKeyFromItem(item: unknown): SmartListLocalSortKey | null {
  if (!item || typeof item !== 'object' || !('localSortKey' in item)) {
    return null;
  }
  const key = (item as SmartListLocalSortable).localSortKey;
  return key === undefined ? null : key;
}

export function compareSmartListLocalSortKeys(
  left: SmartListLocalSortKey | null | undefined,
  right: SmartListLocalSortKey | null | undefined
): number {
  const leftValues = smartListLocalSortKeyValues(left);
  const rightValues = smartListLocalSortKeyValues(right);
  const length = Math.max(leftValues.length, rightValues.length);
  for (let index = 0; index < length; index += 1) {
    const value = compareSmartListLocalSortValues(leftValues[index], rightValues[index]);
    if (value !== 0) {
      return value;
    }
  }
  return 0;
}

function smartListLocalSortKeyValues(key: SmartListLocalSortKey | null | undefined): readonly SmartListLocalSortValue[] {
  if (key === null || key === undefined) {
    return [];
  }
  return Array.isArray(key) ? key : [key as SmartListLocalSortValue];
}

function compareSmartListLocalSortValues(
  left: SmartListLocalSortValue,
  right: SmartListLocalSortValue
): number {
  const leftEmpty = left === null || left === undefined;
  const rightEmpty = right === null || right === undefined;
  if (leftEmpty || rightEmpty) {
    return leftEmpty === rightEmpty ? 0 : (leftEmpty ? 1 : -1);
  }
  if (typeof left === 'number' || typeof right === 'number') {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
  }
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return Number(left) - Number(right);
  }
  return String(left).localeCompare(String(right));
}
