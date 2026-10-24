export interface OwnerRecordCollection<T> {
  byId: Record<string, T>;
  ids: string[];
  idsByOwnerKey: Record<string, string[]>;
}

export function copyOwnerIdIndex(
  raw: unknown,
  normalizeKey: (key: string) => string | null = key => key,
  acceptId: (id: string) => boolean = () => true,
  keepInvalidBuckets = false
): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object') return index;
  for (const [rawKey, ids] of Object.entries(raw)) {
    const key = normalizeKey(rawKey);
    if (key === null) continue;
    if (!Array.isArray(ids)) {
      if (keepInvalidBuckets) index[key] = [];
      continue;
    }
    index[key] = ids.map(id => String(id)).filter(acceptId);
  }
  return index;
}

export function appendOwnerIds<T>(
  byId: Record<string, T>, ids: readonly string[], index: Record<string, string[]>,
  ownerKey: (record: T | undefined) => string
): Record<string, string[]> {
  for (const id of ids) {
    const key = ownerKey(byId[id]);
    if (!key) continue;
    const bucket = index[key] ?? [];
    if (!bucket.includes(id)) bucket.push(id);
    index[key] = bucket;
  }
  return index;
}

export function normalizeOwnerCollection<T extends { ownerKey: string; ownerId?: string }>(
  value: unknown, rebuildIndex = false
): OwnerRecordCollection<T> {
  const source = value as Partial<OwnerRecordCollection<T>> | null | undefined;
  const byId = source?.byId && typeof source.byId === 'object' ? { ...source.byId } : {};
  const ids = Array.isArray(source?.ids)
    ? rebuildIndex ? source.ids.map(id => `${id ?? ''}`.trim()).filter(id => Boolean(byId[id])) : source.ids.map(id => `${id}`)
    : Object.keys(byId);
  const index = rebuildIndex ? {} : copyOwnerIdIndex(source?.idsByOwnerKey, undefined, undefined, true);
  const idsByOwnerKey = appendOwnerIds(byId, ids, index, record =>
    `${record?.ownerKey ?? (rebuildIndex ? record?.ownerId : '') ?? ''}`.trim());
  return { byId, ids, idsByOwnerKey };
}

export function upsertOwnerCollection<T extends { id: string; ownerKey: string }>(
  table: OwnerRecordCollection<T>, record: T, copyRecord = false
): OwnerRecordCollection<T> {
  const byId = { ...table.byId, [record.id]: copyRecord ? { ...record } : record };
  const ids = table.ids.includes(record.id) ? [...table.ids] : [...table.ids, record.id];
  const idsByOwnerKey = { ...table.idsByOwnerKey };
  const ownerKey = copyRecord ? record.ownerKey.trim() : record.ownerKey;
  if (!copyRecord || ownerKey) {
    const bucket = idsByOwnerKey[ownerKey] ?? [];
    if (copyRecord || !bucket.includes(record.id)) {
      idsByOwnerKey[ownerKey] = bucket.includes(record.id) ? [...bucket] : [...bucket, record.id];
    }
  }
  return { byId, ids, idsByOwnerKey };
}

export function copyIdCollection<T>(source: Partial<{ byId: Record<string, T>; ids: unknown[] }> | null | undefined, missingIdsAsEmpty = false): { byId: Record<string, T>; ids: string[] } {
  const byId = source?.byId && typeof source.byId === 'object' ? { ...source.byId } : {};
  const ids = Array.isArray(source?.ids) ? source.ids.map(id => String(id)) : missingIdsAsEmpty ? [] : Object.keys(byId);
  return { byId, ids };
}

export function subEventDeletionSelection(parentEventId: string, subEventIds: readonly string[]) {
 const normalizedParentEventId = String(parentEventId ?? '').trim();const normalizedSubEventIds = new Set((subEventIds ?? []).map(id => String(id ?? '').trim()).filter(Boolean));
 if (!normalizedParentEventId || normalizedSubEventIds.size === 0) return null;
 const nowMs = Date.now();return {normalizedParentEventId, normalizedSubEventIds, nowMs, nowIso: new Date(nowMs).toISOString()};
}
export function updateCollectionRecords<T>(table: {byId: Record<string, T>;ids: string[]}, matches: (record: T) => boolean, update: (record: T) => T) {
 const byId = {...table.byId};let changedCount = 0;
 for (const id of table.ids) {const record = byId[id];if (!record || !matches(record)) continue;byId[id] = update(record);changedCount += 1;}
 return {byId, changedCount};
}
