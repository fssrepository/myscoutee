import { Injectable } from '@angular/core';

import type {
  ExperienceEntry,
  UserExperiencesPersistenceService
} from '../../contracts/profile.interface';
import { LocalProfileExperiencesMapper } from '../../local/source/mappers';

@Injectable({
  providedIn: 'root'
})
export class MemoryUserExperiencesService implements UserExperiencesPersistenceService {
  private readonly entriesByUserId = new Map<string, ExperienceEntry[]>();

  async queryUserExperiences(userId: string): Promise<ExperienceEntry[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return LocalProfileExperiencesMapper.cloneEntries(this.entriesByUserId.get(normalizedUserId) ?? []);
  }

  async saveUserExperiences(userId: string, entries: readonly ExperienceEntry[]): Promise<ExperienceEntry[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    const normalizedEntries = LocalProfileExperiencesMapper.toEntries(entries);
    this.entriesByUserId.set(normalizedUserId, normalizedEntries);
    return LocalProfileExperiencesMapper.cloneEntries(normalizedEntries);
  }

  clearUserExperiences(userId: string): void {
    const normalizedUserId = userId.trim();
    if (normalizedUserId) {
      this.entriesByUserId.delete(normalizedUserId);
    }
  }
}
