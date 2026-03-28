import { Injectable, Injector, inject } from '@angular/core';

import type {
  ExperienceImportProgressCallback,
  UserExperienceImportDraft,
  UserExperienceImportResult,
  UserExperiencesPersistenceService
} from '../interfaces/experience.interface';
import type { ExperienceEntry } from '../models/profile.model';
import { BaseRouteModeService } from './base-route-mode.service';
import { ExperienceDocumentImportService } from './experience-document-import.service';
import { DemoUserExperiencesService } from '../../demo';
import { HttpUserExperiencesService } from '../../http';

@Injectable({
  providedIn: 'root'
})
export class UserExperiencesService extends BaseRouteModeService {
  private readonly injector = inject(Injector);
  private readonly parser = inject(ExperienceDocumentImportService);
  private demoServiceRef: DemoUserExperiencesService | null = null;
  private httpServiceRef: HttpUserExperiencesService | null = null;

  private get demoService(): DemoUserExperiencesService {
    if (!this.demoServiceRef) {
      this.demoServiceRef = this.injector.get(DemoUserExperiencesService);
    }
    return this.demoServiceRef;
  }

  private get httpService(): HttpUserExperiencesService {
    if (!this.httpServiceRef) {
      this.httpServiceRef = this.injector.get(HttpUserExperiencesService);
    }
    return this.httpServiceRef;
  }

  private get persistenceService(): UserExperiencesPersistenceService {
    return this.resolveRouteService('/auth/me/experiences', this.demoService, this.httpService);
  }

  async loadUserExperiences(userId: string): Promise<ExperienceEntry[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return this.cloneEntries(await this.persistenceService.queryUserExperiences(normalizedUserId));
  }

  async saveUserExperiences(userId: string, entries: readonly ExperienceEntry[]): Promise<ExperienceEntry[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const normalizedEntries = this.normalizeEntries(entries);
    return this.cloneEntries(await this.persistenceService.saveUserExperiences(normalizedUserId, normalizedEntries));
  }

  prepareUserExperienceImport(
    file: File,
    existingEntries: readonly ExperienceEntry[],
    onProgress?: ExperienceImportProgressCallback
  ): Promise<UserExperienceImportDraft> {
    return this.buildImportDraft(file, existingEntries, onProgress);
  }

  async importUserExperiences(
    userId: string,
    file: File,
    existingEntries: readonly ExperienceEntry[],
    onProgress?: ExperienceImportProgressCallback
  ): Promise<UserExperienceImportResult> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      throw new Error('Missing user id for experience import.');
    }

    const draft = await this.buildImportDraft(file, existingEntries, onProgress);
    onProgress?.({
      stage: 'saving',
      percent: 100,
      label: 'Saving imported experience batch'
    });
    if (draft.importedIds.length === 0) {
      return {
        entries: this.cloneEntries(draft.nextEntries),
        importedIds: [],
        warnings: draft.warnings
      };
    }
    const savedEntries = await this.saveUserExperiences(normalizedUserId, draft.nextEntries);
    return {
      entries: this.cloneEntries(savedEntries.length > 0 ? savedEntries : draft.nextEntries),
      importedIds: [...draft.importedIds],
      warnings: [...draft.warnings]
    };
  }

  private async buildImportDraft(
    file: File,
    existingEntries: readonly ExperienceEntry[],
    onProgress?: ExperienceImportProgressCallback
  ): Promise<UserExperienceImportDraft> {
    const parsed = await this.parser.parseFile(file, onProgress);
    const nextEntries = this.cloneEntries(existingEntries);
    const existingSignatures = new Set(nextEntries.map(entry => this.entrySignature(entry)));
    const importedIds: string[] = [];
    const importedEntries: ExperienceEntry[] = [];
    let duplicateCount = 0;
    const countsByType: Record<ExperienceEntry['type'], number> = {
      Workspace: 0,
      School: 0,
      'Online Session': 0,
      'Additional Project': 0
    };

    for (const entry of parsed.entries) {
      countsByType[entry.type] += 1;
    }

    for (const entry of parsed.entries) {
      const normalized = this.normalizeImportedEntry(entry);
      const signature = this.entrySignature(normalized);
      if (existingSignatures.has(signature)) {
        duplicateCount += 1;
        continue;
      }
      existingSignatures.add(signature);
      nextEntries.push(normalized);
      importedEntries.push(normalized);
      importedIds.push(normalized.id);
    }

    return {
      nextEntries: this.cloneEntries(nextEntries),
      importedEntries: this.cloneEntries(importedEntries),
      importedIds: [...importedIds],
      warnings: importedIds.length === 0
        ? [...parsed.warnings, 'The upload did not add any new experience cards.']
        : [...parsed.warnings],
      statistics: {
        detectedCount: parsed.entries.length,
        importedCount: importedIds.length,
        duplicateCount,
        countsByType
      }
    };
  }

  private normalizeEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries
      .map(entry => this.normalizeEntry(entry))
      .filter((entry): entry is ExperienceEntry => Boolean(entry));
  }

  private normalizeImportedEntry(entry: Omit<ExperienceEntry, 'id'>): ExperienceEntry {
    return {
      id: this.createExperienceId(),
      type: entry.type,
      title: `${entry.title ?? ''}`.trim(),
      org: `${entry.org ?? ''}`.trim(),
      city: `${entry.city ?? ''}`.trim(),
      dateFrom: `${entry.dateFrom ?? ''}`.trim(),
      dateTo: `${entry.dateTo ?? ''}`.trim() || 'Present',
      description: `${entry.description ?? ''}`.trim()
    };
  }

  private normalizeEntry(entry: ExperienceEntry | null | undefined): ExperienceEntry | null {
    const id = `${entry?.id ?? ''}`.trim();
    if (!id) {
      return null;
    }
    return {
      id,
      type: entry?.type === 'School'
        || entry?.type === 'Online Session'
        || entry?.type === 'Additional Project'
        ? entry.type
        : 'Workspace',
      title: `${entry?.title ?? ''}`.trim(),
      org: `${entry?.org ?? ''}`.trim(),
      city: `${entry?.city ?? ''}`.trim(),
      dateFrom: `${entry?.dateFrom ?? ''}`.trim(),
      dateTo: `${entry?.dateTo ?? ''}`.trim() || 'Present',
      description: `${entry?.description ?? ''}`.trim()
    };
  }

  private entrySignature(entry: Omit<ExperienceEntry, 'id'> | ExperienceEntry): string {
    return [
      `${entry.type}`,
      `${entry.title}`.trim().toLowerCase(),
      `${entry.org}`.trim().toLowerCase(),
      `${entry.dateFrom}`.trim(),
      `${entry.dateTo}`.trim()
    ].join('|');
  }

  private createExperienceId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `exp-${crypto.randomUUID()}`;
    }
    return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private cloneEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries.map(entry => ({ ...entry }));
  }
}
