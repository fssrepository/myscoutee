import type { ExperienceEntry } from '../../contracts/profile.interface';
import { APP_INDEXED_DB_KEYS } from '../storage-scope';

export const PROFILE_EXPERIENCES_TABLE_NAME = APP_INDEXED_DB_KEYS.profileExperiences;

export interface ProfileExperiencesRecordCollection {
  byUserId: Record<string, ExperienceEntry[]>;
  userIds: string[];
}

export type ProfileExperiencesMemorySchema = Record<typeof PROFILE_EXPERIENCES_TABLE_NAME, ProfileExperiencesRecordCollection>;
