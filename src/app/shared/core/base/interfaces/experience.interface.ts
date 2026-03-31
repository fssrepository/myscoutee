import type { ExperienceEntry } from '../models/profile.model';

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
