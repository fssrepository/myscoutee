import type { PageResult } from './list.interface';
export type ModerationCategory = 'asset' | 'event' | 'feed';
export type ModerationCategoryFilter = ModerationCategory | 'all';
export type ModerationStatus = 'under-review' | 'accepted' | 'rejected' | 'blocked';
export interface ContentModerationSettings { autoApprove: boolean; delayMinutes: number; categories: ModerationCategory[]; }
export interface ContentModerationItem {
  id: string; category: ModerationCategory; sourceId: string; ownerUserId: string; title: string; imageUrl: string;
  submittedAtIso: string; status: ModerationStatus; version: number; commandId: string; reviewedBy: string; reviewedAtIso: string;
}
export interface ContentModerationSnapshot {
  revision: number; settings: ContentModerationSettings; counts: Record<string, Record<string, number>>; pendingCount: number;
}
export interface ContentModerationPage extends PageResult<ContentModerationItem> { snapshot: ContentModerationSnapshot; }
export interface ContentModerationDecisionResult { snapshot: ContentModerationSnapshot; item: ContentModerationItem; }
export interface ContentModerationDecision {
  adminUserId: string; commandId: string; expectedVersion: number; status: ModerationStatus; message: string;
}
export const MODERATION_CATEGORIES: readonly ModerationCategory[] = ['asset', 'event', 'feed'];
export const MODERATION_STATUSES: readonly ModerationStatus[] = ['under-review', 'accepted', 'rejected', 'blocked'];

/** Totals come exclusively from the compact counters maintained by writes. */
export function moderationCount(snapshot: ContentModerationSnapshot | null | undefined, category: ModerationCategoryFilter, status: ModerationStatus): number {
  return (category === 'all' ? MODERATION_CATEGORIES : [category]).reduce((total, key) => total + (snapshot?.counts[key]?.[status] ?? 0), 0);
}
