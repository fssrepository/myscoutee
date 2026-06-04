import { Injectable, inject } from '@angular/core';

import type { UserExperiencesPersistenceService } from '../../base/interfaces/experience.interface';
import type { ExperienceEntry } from '../../base/models/profile.model';
import { DemoProfileExperiencesRepository } from '../repositories/profile-experiences.repository';
import { DemoRouteDelayService } from './demo-route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class DemoUserExperiencesService extends DemoRouteDelayService implements UserExperiencesPersistenceService {
  private static readonly EXPERIENCES_ROUTE = '/auth/me/experiences';
  private readonly repository = inject(DemoProfileExperiencesRepository);

  async queryUserExperiences(userId: string): Promise<ExperienceEntry[]> {
    await this.waitForRouteDelay(DemoUserExperiencesService.EXPERIENCES_ROUTE);
    return this.repository.queryUserExperiences(userId);
  }

  async saveUserExperiences(userId: string, entries: readonly ExperienceEntry[]): Promise<ExperienceEntry[]> {
    await this.waitForRouteDelay(DemoUserExperiencesService.EXPERIENCES_ROUTE);
    return this.repository.replaceUserExperiences(userId, entries);
  }
}
