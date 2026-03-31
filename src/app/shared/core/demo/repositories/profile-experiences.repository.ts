import { Injectable, inject } from '@angular/core';

import type { ExperienceEntry } from '../../base/models/profile.model';
import { AppMemoryDb } from '../../base/db';
import { PROFILE_EXPERIENCES_TABLE_NAME } from '../models/profile-experiences.model';

@Injectable({
  providedIn: 'root'
})
export class DemoProfileExperiencesRepository {
  private readonly memoryDb = inject(AppMemoryDb);

  queryUserExperiences(userId: string): ExperienceEntry[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const table = this.memoryDb.read()[PROFILE_EXPERIENCES_TABLE_NAME];
    return this.cloneEntries(table.byUserId[normalizedUserId] ?? []);
  }

  replaceUserExperiences(userId: string, entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }

    const normalizedEntries = this.normalizeEntries(entries);
    this.memoryDb.write(state => {
      const table = state[PROFILE_EXPERIENCES_TABLE_NAME];
      const exists = Object.prototype.hasOwnProperty.call(table.byUserId, normalizedUserId);
      return {
        ...state,
        [PROFILE_EXPERIENCES_TABLE_NAME]: {
          byUserId: {
            ...table.byUserId,
            [normalizedUserId]: this.cloneEntries(normalizedEntries)
          },
          userIds: exists
            ? [...table.userIds]
            : [...table.userIds, normalizedUserId]
        }
      };
    });

    return this.cloneEntries(normalizedEntries);
  }

  private normalizeEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries
      .map(entry => this.normalizeEntry(entry))
      .filter((entry): entry is ExperienceEntry => Boolean(entry));
  }

  private normalizeEntry(entry: ExperienceEntry | null | undefined): ExperienceEntry | null {
    const id = `${entry?.id ?? ''}`.trim();
    if (!id) {
      return null;
    }
    const type = this.normalizeType(entry?.type);
    return {
      id,
      type,
      title: `${entry?.title ?? ''}`.trim(),
      org: `${entry?.org ?? ''}`.trim(),
      city: `${entry?.city ?? ''}`.trim(),
      dateFrom: `${entry?.dateFrom ?? ''}`.trim(),
      dateTo: `${entry?.dateTo ?? ''}`.trim() || 'Present',
      description: `${entry?.description ?? ''}`.trim()
    };
  }

  private normalizeType(value: ExperienceEntry['type'] | null | undefined): ExperienceEntry['type'] {
    if (value === 'School' || value === 'Online Session' || value === 'Additional Project') {
      return value;
    }
    return 'Workspace';
  }

  private cloneEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries.map(entry => ({ ...entry }));
  }
}
