export type RateRecordMode = 'individual' | 'pair';
export type RateRecordDirection = 'given' | 'received' | 'mutual' | 'met';
export type RateRecordSocialContext = 'separated-friends' | 'friends-in-common';

export interface RateRecord {
  id: string;
  userId: string;
  secondaryUserId?: string;
  mode: RateRecordMode;
  direction: RateRecordDirection;
  socialContext?: RateRecordSocialContext;
  bridgeUserId?: string;
  bridgeCount?: number;
  scoreGiven: number;
  scoreReceived: number;
  eventName: string;
  happenedAt: string;
  distanceMetersExact?: number;
}
