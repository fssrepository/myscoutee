import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { AppUtils } from '../../../app-utils';
import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { RateMenuItem } from '../interfaces/activity-feed.interface';
import { DemoRatesService } from '../../demo';
import { HttpRatesService } from '../../http';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class RatesService {
  private readonly demoRatesService = inject(DemoRatesService);
  private readonly httpRatesService = inject(HttpRatesService);
  private readonly sessionService = inject(SessionService);

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  private get ratesService(): DemoRatesService | HttpRatesService {
    return this.demoModeEnabled ? this.demoRatesService : this.httpRatesService;
  }

  peekRateItemsByUser(userId: string): RateMenuItem[] {
    return this.ratesService.peekRateItemsByUser(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<RateMenuItem[]> {
    return this.ratesService.queryRateItemsByUser(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest
  ): Promise<{ items: RateMenuItem[]; total: number; nextCursor?: string | null }> {
    if (this.demoModeEnabled) {
      return this.demoRatesService.queryActivitiesRatePage(userId, request);
    }

    const [mode, direction] = request.rateFilter.split('-') as ['individual' | 'pair', RateMenuItem['direction']];
    const items = (await this.httpRatesService.queryRateItemsByUser(userId))
      .filter(item => item.mode === mode && item.direction === direction);
    const sorted = [...items].sort((left, right) => this.compareActivitiesRateItems(left, right, request));
    const startIndex = request.page * request.pageSize;
    return {
      items: sorted.slice(startIndex, startIndex + request.pageSize),
      total: sorted.length,
      nextCursor: null
    };
  }

  private compareActivitiesRateItems(
    left: RateMenuItem,
    right: RateMenuItem,
    request: ActivitiesPageRequest
  ): number {
    if (request.sort === 'distance') {
      return this.rateDistanceMeters(left) - this.rateDistanceMeters(right)
        || AppUtils.toSortableDate(right.happenedAt) - AppUtils.toSortableDate(left.happenedAt)
        || left.id.localeCompare(right.id);
    }
    if (request.sort === 'relevance') {
      return this.rateRelevanceValue(right) - this.rateRelevanceValue(left)
        || AppUtils.toSortableDate(right.happenedAt) - AppUtils.toSortableDate(left.happenedAt)
        || left.id.localeCompare(right.id);
    }
    return AppUtils.toSortableDate(right.happenedAt) - AppUtils.toSortableDate(left.happenedAt)
      || left.id.localeCompare(right.id);
  }

  private rateDistanceMeters(item: RateMenuItem): number {
    if (Number.isFinite(item.distanceMetersExact)) {
      return Math.max(0, Math.trunc(Number(item.distanceMetersExact)));
    }
    return Math.max(0, Math.round((Number(item.distanceKm) || 0) * 1000));
  }

  private rateRelevanceValue(item: RateMenuItem): number {
    return Math.max(
      0,
      Math.trunc(Number(item.scoreGiven) || 0),
      Math.trunc(Number(item.scoreReceived) || 0)
    );
  }
}
