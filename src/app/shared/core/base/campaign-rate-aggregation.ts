import type { ActivityRateDTO } from '../contracts/activity.interface';
import type { UserRateRecord } from '../local/source/entity/rate.entity';

/** Materialized at the memory/IndexedDB write boundary, never while reading a list. */
export function projectCampaignRateRecords(records: readonly UserRateRecord[]): Record<string, UserRateRecord[]> {
  const pairs = new Map<string, UserRateRecord[]>();
  for (const record of records) {
    if (record.mode !== 'single' || !record.ownerUserId) continue;
    const ids = [record.fromUserId, record.toUserId].sort();
    if (!ids[0] || !ids[1] || ids[0] === ids[1]) continue;
    const key = ids.join('\n');
    const rows = pairs.get(key) ?? []; rows.push(record); pairs.set(key, rows);
  }
  const byUser: Record<string, UserRateRecord[]> = {};
  for (const rows of pairs.values()) {
    if (!rows.some(row => row.campaignId)) continue;
    rows.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
    const latest = rows[0];
    const [left, right] = [latest.fromUserId, latest.toUserId].sort();
    const average = (actor: string) => {
      const values = new Map<string, number>();
      for (const row of rows) if (row.ownerUserId === actor && (row.scoreGiven ?? row.rate) > 0)
        if (!values.has(row.campaignId ?? '')) values.set(row.campaignId ?? '', row.scoreGiven ?? row.rate);
      for (const row of rows) if (row.ownerUserId !== actor && (row.scoreReceived ?? 0) > 0)
        if (!values.has(row.campaignId ?? '')) values.set(row.campaignId ?? '', row.scoreReceived!);
      return values.size ? [...values.values()].reduce((sum, n) => sum + n, 0) / values.size : 0;
    };
    const scoreGiven = average(left), scoreReceived = average(right);
    const summary: UserRateRecord = { ...latest, ratingDomain: 'campaign', id: `campaign-average:${left}:${right}`, campaignId: null,
      fromUserId: left, toUserId: right, ownerUserId: left, displayId: undefined, displayDirection: undefined,
      scoreGiven, scoreReceived, rate: scoreGiven, ratingSnapshot: undefined, ratingSnapshots: undefined,
      met: rows.some(row => row.met), happenedAtIso: latest.happenedAtIso ?? latest.updatedAtIso };
    (byUser[left] ??= []).push(summary); (byUser[right] ??= []).push(summary);
  }
  return byUser;
}

/** One person row, with each campaign carrying equal weight in each direction. */
export function aggregateCampaignRatings(items: readonly ActivityRateDTO[], viewerId: string, campaignId?: string | null): ActivityRateDTO[] {
  const filtered = campaignId ? items.filter(item => item.campaignId === campaignId) : [...items];
  const campaignPeople = new Set(filtered.filter(item => item.campaignId && item.mode === 'individual').map(item => item.userId));
  const groups = new Map<string, ActivityRateDTO[]>();
  const result: ActivityRateDTO[] = [];
  for (const item of filtered) {
    if (item.mode !== 'individual' || !campaignPeople.has(item.userId)) { result.push(item); continue; }
    const rows = groups.get(item.userId) ?? []; rows.push(item); groups.set(item.userId, rows);
  }
  for (const [personId, rows] of groups) {
    // A stored pair can be projected from either participant. Keep the newest
    // value per campaign and direction before averaging across campaigns.
    rows.sort((a, b) => b.happenedAt.localeCompare(a.happenedAt));
    const average = (field: 'scoreGiven' | 'scoreReceived'): number => {
      const scores = new Map<string, number>();
      for (const row of rows) if (row[field] > 0 && !scores.has(row.campaignId ?? '')) scores.set(row.campaignId ?? '', row[field]);
      return scores.size ? Math.round([...scores.values()].reduce((sum, n) => sum + n, 0) / scores.size * 100) / 100 : 0;
    };
    const scoreGiven = average('scoreGiven'); const scoreReceived = average('scoreReceived');
    const met = rows.some(row => row.met);
    result.push({ ...rows[0], id: `game-card:${viewerId}:${personId}${campaignId ? `:campaign:${campaignId}` : ''}`,
      campaignId: campaignId ?? null, scoreGiven, scoreReceived,
      direction: met ? 'met' : scoreGiven > 0 && scoreReceived > 0 ? 'mutual' : scoreGiven > 0 ? 'given' : 'received',
      met, ratingSnapshot: campaignId ? rows.find(row => row.ratingSnapshot)?.ratingSnapshot : undefined });
  }
  return result;
}
