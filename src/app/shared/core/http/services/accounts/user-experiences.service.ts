import { ProfileExperiencesMapper } from '../../../base/mappers/accounts/profile-experiences.mapper';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../../environments/environment';
import type {
  UserExperiencesPersistenceService,
  UserExperiencesQueryResponseDto
} from '../../../contracts/accounts/profile.interface';
import type { ExperienceEntry } from '../../../contracts/accounts/profile.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpUserExperiencesService implements UserExperiencesPersistenceService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedEntriesByUserId: Record<string, ExperienceEntry[]> = {};

  async queryUserExperiences(userId: string): Promise<ExperienceEntry[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<UserExperiencesQueryResponseDto | null>(`${this.apiBaseUrl}/auth/me/experiences`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      const entries = this.normalizeEntries(response?.entries ?? []);
      this.cachedEntriesByUserId[normalizedUserId] = entries;
      return this.cloneEntries(entries);
    } catch {
      return this.cloneEntries(this.cachedEntriesByUserId[normalizedUserId] ?? []);
    }
  }

  async saveUserExperiences(userId: string, entries: readonly ExperienceEntry[]): Promise<ExperienceEntry[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }

    const normalizedEntries = this.normalizeEntries(entries);
    this.cachedEntriesByUserId[normalizedUserId] = this.cloneEntries(normalizedEntries);

    try {
      const response = await this.http
        .post<UserExperiencesQueryResponseDto | null>(`${this.apiBaseUrl}/auth/me/experiences`, {
          userId: normalizedUserId,
          entries: normalizedEntries
        })
        .toPromise();
      const savedEntries = this.normalizeEntries(response?.entries ?? normalizedEntries);
      this.cachedEntriesByUserId[normalizedUserId] = savedEntries;
      return this.cloneEntries(savedEntries);
    } catch {
      return this.cloneEntries(normalizedEntries);
    }
  }

  private normalizeEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries
      .map(entry => this.normalizeEntry(entry))
      .filter((entry): entry is ExperienceEntry => Boolean(entry));
  }

  private normalizeEntry(entry: ExperienceEntry | null | undefined): ExperienceEntry | null {
    return ProfileExperiencesMapper.toEntry(entry);
  }

  private cloneEntries(entries: readonly ExperienceEntry[]): ExperienceEntry[] {
    return entries.map(entry => ({ ...entry }));
  }
}
