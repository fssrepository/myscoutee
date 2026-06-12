import type { UserDto } from './user.interface';

export type ProfileStatus = 'public' | 'friends only' | 'host only' | 'inactive' | 'blocked' | 'deleted' | 'onboarding';
export type DetailPrivacy = 'Public' | 'Friends' | 'Hosts' | 'Private';

export interface ProfileDetailFormRow {
  labelKey: string;
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

export interface UserExperiencesQueryResponseDto {
  userId: string;
  entries: ExperienceEntry[];
}

export interface UserExperiencesSaveRequestDto {
  userId: string;
  entries: ExperienceEntry[];
}

export interface ParsedExperienceImportEntry {
  type: ExperienceEntry['type'];
  title: string;
  org: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  description: string;
}

export interface UserExperienceImportParseResult {
  entries: ParsedExperienceImportEntry[];
  warnings: string[];
}

export interface ExperienceImportProgressState {
  stage: 'reading' | 'extracting' | 'analyzing' | 'ready' | 'saving';
  percent: number;
  label: string;
}

export type ExperienceImportProgressCallback = (state: ExperienceImportProgressState) => void;

export interface ExperienceImportStatistics {
  detectedCount: number;
  importedCount: number;
  duplicateCount: number;
  countsByType: Record<ExperienceEntry['type'], number>;
}

export interface UserExperienceImportDraft {
  nextEntries: ExperienceEntry[];
  importedEntries: ExperienceEntry[];
  importedIds: string[];
  warnings: string[];
  statistics: ExperienceImportStatistics;
}

export interface UserExperienceImportResult {
  entries: ExperienceEntry[];
  importedIds: string[];
  warnings: string[];
}

export interface UserExperiencesPersistenceService {
  queryUserExperiences(userId: string): Promise<ExperienceEntry[]>;
  saveUserExperiences(userId: string, entries: readonly ExperienceEntry[]): Promise<ExperienceEntry[]>;
}

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

export interface ProfileRow {
  label: string;
  value: string;
  privacy: DetailPrivacy;
}

export interface ProfileGroup {
  title: string;
  rows: ProfileRow[];
}

export interface ProfileViewData {
  user: UserDto | null;
  experiences: ExperienceEntry[];
}
