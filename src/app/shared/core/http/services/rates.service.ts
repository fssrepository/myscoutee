import { Injectable, inject } from '@angular/core';

import type { RateMenuItem } from '../../base/interfaces/activity-feed.interface';
import { HttpUsersRatingsRepository } from '../repositories/users-ratings.repository';

@Injectable({
  providedIn: 'root'
})
export class HttpRatesService {
  private readonly usersRatingsRepository = inject(HttpUsersRatingsRepository);

  peekRateItemsByUser(userId: string): RateMenuItem[] {
    return this.usersRatingsRepository.peekRateItemsByUserId(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<RateMenuItem[]> {
    return this.usersRatingsRepository.queryRateItemsByUserId(userId);
  }
}
