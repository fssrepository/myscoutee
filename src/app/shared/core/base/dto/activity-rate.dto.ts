import type { UserDto } from '../../contracts/user.interface';

export type ActivityRateDTOMode = 'individual' | 'pair';
export type ActivityRateDTODirection = 'given' | 'received' | 'mutual' | 'met';
export type ActivityRateDTOSocialContext = 'separated-friends' | 'friends-in-common';

export interface ActivityRateDTO {
  id: string;
  userId: string;
  secondaryUserId?: string;
  mode: ActivityRateDTOMode;
  direction: ActivityRateDTODirection;
  socialContext?: ActivityRateDTOSocialContext;
  bridgeUserId?: string;
  bridgeCount?: number;
  scoreGiven: number;
  scoreReceived: number;
  eventName: string;
  happenedAt: string;
  distanceMetersExact?: number;
}

export interface ActivityRatePageResultDTO {
  items: ActivityRateDTO[];
  total: number;
  nextCursor?: string | null;
  users?: UserDto[];
}
