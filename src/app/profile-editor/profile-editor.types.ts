export type ProfileStatus = 'public' | 'friends only' | 'host only' | 'inactive';
export type DetailPrivacy = 'Public' | 'Friends' | 'Hosts' | 'Private';

export interface ProfileEditorForm {
  fullName: string;
  birthday: Date | null;
  city: string;
  heightCm: number | null;
  physique: string;
  languages: string[];
  horoscope: string;
  profileStatus: ProfileStatus;
  hostTier: string;
  traitLabel: string;
  about: string;
}

export interface ProfileDetailFormRow {
  label: string;
  value: string;
  privacy: DetailPrivacy;
  options: string[];
}

export interface ProfileDetailFormGroup {
  title: string;
  rows: ProfileDetailFormRow[];
}

export interface ValuesOptionGroup {
  title: string;
  shortTitle: string;
  icon: string;
  toneClass: string;
  options: string[];
}

export interface InterestOptionGroup {
  title: string;
  shortTitle: string;
  icon: string;
  toneClass: string;
  options: string[];
}

export interface ExperienceEntry {
  id: string;
  type: 'Workspace' | 'School' | 'Online Session' | 'Additional Project';
  title: string;
  org: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  description: string;
}

export type ExperienceVisibilityMap = Record<'workspace' | 'school', DetailPrivacy>;

