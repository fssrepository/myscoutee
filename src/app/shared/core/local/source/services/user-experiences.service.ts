import { Injectable, inject } from '@angular/core';

import type { UserExperiencesPersistenceService } from '../../../contracts/profile.interface';
import type { ExperienceEntry } from '../../../contracts/profile.interface';
import { LocalProfileExperiencesMapper } from '../mappers';
import { LocalProfileExperiencesRepository } from '../repositories/profile-experiences.repository';
import { LocalRouteDelayService } from './route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class LocalUserExperiencesService extends LocalRouteDelayService implements UserExperiencesPersistenceService {
  private static readonly EXPERIENCES_ROUTE = '/auth/me/experiences';
  private readonly repository = inject(LocalProfileExperiencesRepository);

  async queryUserExperiences(userId: string): Promise<ExperienceEntry[]> {
    await this.waitForRouteDelay(LocalUserExperiencesService.EXPERIENCES_ROUTE);
    return LocalProfileExperiencesMapper.cloneEntries(this.repository.queryUserExperienceRecords(userId));
  }

  async saveUserExperiences(userId: string, entries: readonly ExperienceEntry[]): Promise<ExperienceEntry[]> {
    await this.waitForRouteDelay(LocalUserExperiencesService.EXPERIENCES_ROUTE);
    const savedEntries = this.repository.replaceUserExperienceRecords(
      userId,
      LocalProfileExperiencesMapper.toEntries(entries)
    );
    return LocalProfileExperiencesMapper.cloneEntries(savedEntries);
  }
}
