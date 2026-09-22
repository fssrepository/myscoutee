import type { ActivityMemberDTO } from './activity.interface';
export interface FollowingState {
  organizerIds: string[];
  eventCount: number;
  nextExpiryAtIso?: string | null;
}
export interface FollowingChangeResult extends FollowingState {
  eventCountDelta: number;
}
export interface IFollowingService {
  change(userId: string, organizerId: string, followed: boolean): Promise<FollowingChangeResult>;
  members(userId: string): Promise<ActivityMemberDTO[]>;
}
