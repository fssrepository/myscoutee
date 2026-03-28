export type ProfileStatus = 'public' | 'friends only' | 'host only' | 'inactive' | 'deleted';
export type DetailPrivacy = 'Public' | 'Friends' | 'Hosts' | 'Private';

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

export type ExperienceFilter = 'All' | ExperienceEntry['type'];

export interface MobileProfileSelectorOption {
  value: string;
  label: string;
  icon: string;
  toneClass?: string;
  badge?: number;
  disabled?: boolean;
}

export interface MobileProfileSelectorSheet {
  title: string;
  selected: string;
  options: MobileProfileSelectorOption[];
  context:
    | { kind: 'profileStatus' }
    | { kind: 'physique' }
    | { kind: 'language' }
    | { kind: 'detailPrivacy'; groupIndex: number; rowIndex: number }
    | { kind: 'experiencePrivacy'; type: 'workspace' | 'school' }
    | { kind: 'detailValue'; groupIndex: number; rowIndex: number }
    | { kind: 'experienceType' }
    | { kind: 'assetFilter' }
    | { kind: 'subEventResourceFilter' }
    | { kind: 'eventFrequency' };
}
