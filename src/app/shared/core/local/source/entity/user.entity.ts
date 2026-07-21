import type {
  DetailPrivacy,
  ProfileStatus,
  UserGender
} from '../../../common/constants';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const USERS_TABLE_NAME = APP_INDEXED_DB_KEYS.users;


export interface UserLocationCoordinatesRecord {
  latitude: number;
  longitude: number;
}

export interface UserProfileDetailRowRecord {
  labelKey: string;
  value: string;
  privacy: DetailPrivacy;
  options: string[];
}

export interface UserProfileDetailGroupRecord {
  title: string;
  rows: UserProfileDetailRowRecord[];
}

export interface UserPersonalityTraitRecord {
  id: string;
  label: string;
  percent?: number;
  evidenceCount?: number;
  lastRatedAtIso?: string | null;
}

export interface UserImpressionsSectionRecord {
  unreadCount?: number;
  averageRating?: number;
  peopleMet?: number;
  totalEvents?: number;
  repeatCount?: number;
  noShowCount?: number;
  vibeBadges?: string[];
  personalityBadges?: string[];
  personalityTraits?: UserPersonalityTraitRecord[];
  categoryBadges?: string[];
}

export interface UserImpressionsRecord {
  host?: UserImpressionsSectionRecord;
  member?: UserImpressionsSectionRecord;
}

export interface UserEventCountersRecord {
  all?: number;
  active?: number;
  pending?: number;
  invitations?: number;
  hosting?: number;
  drafts?: number;
  trash?: number;
}

export interface UserChatCountersRecord {
  all?: number;
  event?: number;
  subEvent?: number;
  group?: number;
  service?: number;
  appSupport?: number;
}

export interface UserAssetCountersRecord {
  cars?: number;
  accommodation?: number;
  supplies?: number;
  tickets?: number;
}

export interface UserEventFeedbackCountersRecord {
  ownEvents?: number;
  pending?: number;
  feedbacked?: number;
  removed?: number;
}

export interface UserRecord {
  id: string;
  name: string;
  age: number;
  birthday: string;
  city: string;
  height: string;
  physique: string;
  languages: string[];
  horoscope: string;
  initials: string;
  gender: UserGender;
  statusText: string;
  hostTier: string;
  traitLabel: string;
  completion: number;
  profileFormVersion?: number;
  headline: string;
  about: string;
  affinity?: number;
  locationCoordinates?: UserLocationCoordinatesRecord;
  partitionKey?: string;
  images?: string[];
  profileDetails?: UserProfileDetailGroupRecord[];
  impressions?: UserImpressionsRecord;
  profileStatus: ProfileStatus;
  previousProfileStatus?: ProfileStatus | null;
  deletedAtIso?: string | null;
  admin?: boolean;
  activities: {
    game: number;
    chats: number;
    invitations: number;
    events: number;
    hosting: number;
    cars?: number;
    accommodation?: number;
    supplies?: number;
    tickets?: number;
    contacts?: number;
    feedback?: number;
    chat?: UserChatCountersRecord;
    event?: UserEventCountersRecord;
    asset?: UserAssetCountersRecord;
    eventFeedback?: UserEventFeedbackCountersRecord;
    adminJobs?: number;
    adminMetrics?: number;
  };
}

export interface UsersRecordCollection {
  byId: Record<string, UserRecord>;
  ids: string[];
}

export type UsersMemorySchema = Record<typeof USERS_TABLE_NAME, UsersRecordCollection>;
