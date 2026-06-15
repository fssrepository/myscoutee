import type { StoredContact } from '../../../contracts/contact.interface';
import type { ExperienceEntry } from '../../../contracts/profile.interface';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const CONTACTS_TABLE_NAME = APP_INDEXED_DB_KEYS.contacts;
export const PROFILE_EXPERIENCES_TABLE_NAME = APP_INDEXED_DB_KEYS.profileExperiences;

export interface ContactsRecordCollection {
  byOwnerUserId: Record<string, StoredContact[]>;
  ownerUserIds: string[];
}

export type ContactsMemorySchema = Record<typeof CONTACTS_TABLE_NAME, ContactsRecordCollection>;

export interface ProfileExperiencesRecordCollection {
  byUserId: Record<string, ExperienceEntry[]>;
  userIds: string[];
}

export type ProfileExperiencesMemorySchema = Record<
  typeof PROFILE_EXPERIENCES_TABLE_NAME,
  ProfileExperiencesRecordCollection
>;
