import type { AnnouncementFields, AnnouncementStatus, VoteChoice } from '../../../contracts/community-announcement.interface';
export const COMMUNITY_ANNOUNCEMENTS_TABLE_NAME = 'communityAnnouncements' as const;
export interface CommunityBallot { voterAccountId: string; choice: VoteChoice; castAtIso: string; }
export interface CommunityAnnouncementRecord extends AnnouncementFields {
  id: string; authorAccountId: string; status: AnnouncementStatus; closedAtIso: string | null; closureNotifiedAtIso: string | null;
  ballots: CommunityBallot[]; publishedAtIso: string | null; createdAtIso: string; updatedAtIso: string; version: number;
}
export interface CommunityAnnouncementsMemorySchema {
  [COMMUNITY_ANNOUNCEMENTS_TABLE_NAME]: { ids: string[]; byId: Record<string, CommunityAnnouncementRecord> };
}
