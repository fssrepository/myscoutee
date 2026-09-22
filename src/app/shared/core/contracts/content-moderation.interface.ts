import type { PageResult } from './list.interface';
export type ModerationCategory = 'asset' | 'event' | 'feed';
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
export interface ContentModerationDecision {
  adminUserId: string; commandId: string; expectedVersion: number; status: ModerationStatus; message: string;
}
export const MODERATION_CATEGORIES: readonly ModerationCategory[] = ['asset', 'event', 'feed'];
export const MODERATION_STATUSES: readonly ModerationStatus[] = ['under-review', 'accepted', 'rejected', 'blocked'];
