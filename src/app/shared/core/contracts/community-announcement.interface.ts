import type { ListQuery, PageResult } from './list.interface';
export const VOTE_CHOICES = ['yes', 'no', 'abstain'] as const;
export type VoteChoice = typeof VOTE_CHOICES[number];
export type AnnouncementStatus = 'draft' | 'published' | 'trash';
import type { DocumentAttachment } from './document-attachment.interface';
export type AnnouncementAttachment = DocumentAttachment;
export interface AnnouncementFields { communityId: string; title: string; body: string; attachments: AnnouncementAttachment[]; voting: boolean; deadlineIso: string | null; }
export interface CommunityAnnouncement extends AnnouncementFields {
  id: string; authorAccountId: string; status: AnnouncementStatus; closed: boolean;
  canVote: boolean; myBallot: VoteChoice | null; results: Record<VoteChoice, number>;
  eligibleMembers: number; castVotes: number; canManage: boolean;
  publishedAtIso: string | null; createdAtIso: string; updatedAtIso: string; version: number;
}
export interface SaveAnnouncement extends AnnouncementFields { userId: string; id?: string; version?: number; }
export type AnnouncementAction = 'publish' | 'unpublish' | 'trash' | 'restore' | 'close' | 'vote';
export interface AnnouncementCommand { userId: string; action: AnnouncementAction; choice?: VoteChoice; version: number; }
export interface AnnouncementFilters { communityId: string; status: AnnouncementStatus; voting?: boolean; }
export interface ICommunityAnnouncementsService {
  page(userId: string, query: ListQuery<AnnouncementFilters>, signal?: AbortSignal): Promise<PageResult<CommunityAnnouncement>>;
  detail(userId: string, id: string, signal?: AbortSignal): Promise<CommunityAnnouncement>;
  save(request: SaveAnnouncement): Promise<CommunityAnnouncement>;
  action(id: string, request: AnnouncementCommand): Promise<CommunityAnnouncement>;
}
