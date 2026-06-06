import type { ExperienceEntry } from '../models/profile.model';
import type { UserDto } from './user.interface';

export interface ProfileRow {
  label: string;
  value: string;
  privacy: 'Public' | 'Friends' | 'Hosts' | 'Private';
}

export interface ProfileGroup {
  title: string;
  rows: ProfileRow[];
}

export interface ProfileViewData {
  user: UserDto | null;
  experiences: ExperienceEntry[];
}
