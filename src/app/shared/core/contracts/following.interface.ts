import type { ActivityMemberDTO } from './activity.interface';
export interface FollowingState {
  organizerIds: string[];
  eventCount: number;
  nextExpiryAtIso?: string | null;
}
export interface IFollowingService {
  change(userId: string, organizerId: string, followed: boolean): Promise<FollowingState>;
  members(userId: string): Promise<ActivityMemberDTO[]>;
}
