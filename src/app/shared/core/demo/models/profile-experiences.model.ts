import type { ExperienceEntry } from '../../base/models/profile.model';

export const PROFILE_EXPERIENCES_TABLE_NAME = 'profileExperiences' as const;

export interface DemoProfileExperiencesRecordCollection {
  byUserId: Record<string, ExperienceEntry[]>;
  userIds: string[];
}

export type DemoProfileExperiencesMemorySchema = Record<typeof PROFILE_EXPERIENCES_TABLE_NAME, DemoProfileExperiencesRecordCollection>;
