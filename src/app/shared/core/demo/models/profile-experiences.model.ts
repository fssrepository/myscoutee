import type { ExperienceEntry } from '../../base/models/profile.model';
import { APP_INDEXED_DB_KEYS } from '../../base/storage-scope';

export const PROFILE_EXPERIENCES_TABLE_NAME = APP_INDEXED_DB_KEYS.profileExperiences;

export interface DemoProfileExperiencesRecordCollection {
  byUserId: Record<string, ExperienceEntry[]>;
  userIds: string[];
}

export type DemoProfileExperiencesMemorySchema = Record<typeof PROFILE_EXPERIENCES_TABLE_NAME, DemoProfileExperiencesRecordCollection>;
