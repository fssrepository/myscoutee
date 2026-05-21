import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../app-utils';
import type { ActivitiesPageRequest } from '../../../core/base/models';
import type { RateRecord } from '../models/rate.model';
import type { ActivityRatePageResult } from '../interfaces/game.interface';
import { DemoRatesService } from '../../demo';
import { HttpRatesService } from '../../http';
import { BaseRouteModeService } from './base-route-mode.service';
import { GameService } from './game.service';

@Injectable({
  providedIn: 'root'
})
export class RatesService extends BaseRouteModeService {
  private readonly demoRatesService = inject(DemoRatesService);
  private readonly httpRatesService = inject(HttpRatesService);
  private readonly gameService = inject(GameService);

  private get ratesService(): DemoRatesService | HttpRatesService {
    return this.resolveRouteService('/activities/rates', this.demoRatesService, this.httpRatesService);
  }

  recordActivityRate(
    ownerUserId: string,
    item: RateRecord,
    rating: number,
    direction?: RateRecord['direction'] | null
  ): void {
    this.ratesService.recordActivityRate(ownerUserId, item, rating, direction);
    this.gameService.resetUserGameCardsStack(ownerUserId);
    this.gameService.kickUserRatesOutboxSync();
  }

  peekRateItemsByUser(userId: string): RateRecord[] {
    return this.ratesService.peekRateItemsByUser(userId);
  }

  async queryRateItemsByUser(userId: string): Promise<RateRecord[]> {
    return this.ratesService.queryRateItemsByUser(userId);
  }

  async queryActivitiesRatePage(
    userId: string,
    request: ActivitiesPageRequest,
    signal?: AbortSignal
  ): Promise<ActivityRatePageResult> {
    if (this.isDemoModeEnabled('/activities/rates')) {
      return this.demoRatesService.queryActivitiesRatePage(userId, request, signal);
    }
    const { value } = await this.loadWithRecovery(
      () => this.httpRatesService.queryActivitiesRatePage(userId, request, signal),
      () => this.buildLocalActivitiesRatePage(request, this.peekRateItemsByUser(userId)),
      {
        shouldRecover: next =>
          next.items.length === 0
          && next.total === 0
          && this.peekRateItemsByUser(userId).length > 0,
        hasRecoveryValue: next => next.items.length > 0 || next.total > 0
      }
    );
    return value;
  }

  private buildLocalActivitiesRatePage(
    request: ActivitiesPageRequest,
    items: readonly RateRecord[]
  ): ActivityRatePageResult {
    const [mode, direction] = request.rateFilter.split('-') as ['individual' | 'pair', RateRecord['direction']];
    const filtered = items
      .filter(item => item.mode === mode && item.direction === direction)
      .filter(item => this.matchesRateSocialFilter(item, request.rateSocialBadgeEnabled === true))
      .filter(item => this.matchesRateRange(item, request))
      .sort((left, right) => this.compareRateItems(left, right, request));
    const cursorId = this.resolveRateCursorId(request.cursor);
    const startIndex = cursorId
      ? Math.max(0, filtered.findIndex(item => item.id === cursorId) + 1)
      : request.page * request.pageSize;
    const pageItems = filtered
      .slice(startIndex, startIndex + request.pageSize)
      .map(item => ({ ...item }));

    return {
      items: pageItems,
      total: filtered.length,
      nextCursor: filtered.length > startIndex + pageItems.length && pageItems.length > 0
        ? pageItems[pageItems.length - 1]?.id ?? null
        : null,
      users: []
    };
  }

  private matchesRateRange(item: RateRecord, request: ActivitiesPageRequest): boolean {
    const happenedAtMs = AppUtils.toSortableDate(item.happenedAt ?? '');
    const rangeStartMs = request.rangeStart ? AppUtils.toSortableDate(request.rangeStart) : null;
    const rangeEndMs = request.rangeEnd ? AppUtils.toSortableDate(request.rangeEnd) : null;
    if (rangeStartMs !== null && happenedAtMs < rangeStartMs) {
      return false;
    }
    if (rangeEndMs !== null && happenedAtMs > rangeEndMs) {
      return false;
    }
    return true;
  }

  private matchesRateSocialFilter(item: RateRecord, socialBadgeEnabled: boolean): boolean {
    if (item.mode === 'individual') {
      const friendsInCommon = item.socialContext === 'friends-in-common';
      return socialBadgeEnabled ? friendsInCommon : !friendsInCommon;
    }
    if (item.mode === 'pair') {
      const insideNetwork = item.socialContext === 'separated-friends';
      return socialBadgeEnabled ? insideNetwork : !insideNetwork;
    }
    return true;
  }

  private compareRateItems(left: RateRecord, right: RateRecord, request: ActivitiesPageRequest): number {
    if (request.sort === 'distance') {
      const distanceDelta = this.rateDistanceValue(left) - this.rateDistanceValue(right);
      if (distanceDelta !== 0) {
        return distanceDelta;
      }
      return left.id.localeCompare(right.id);
    }

    if (request.sort === 'relevance') {
      const relevanceDelta = this.rateRelevanceScore(right) - this.rateRelevanceScore(left);
      if (relevanceDelta !== 0) {
        return relevanceDelta;
      }
      return right.id.localeCompare(left.id);
    }

    const sortDirection = request.direction === 'asc' || request.direction === 'desc'
      ? request.direction
      : 'desc';
    const happenedAtDelta = sortDirection === 'asc'
      ? AppUtils.toSortableDate(left.happenedAt ?? '') - AppUtils.toSortableDate(right.happenedAt ?? '')
      : AppUtils.toSortableDate(right.happenedAt ?? '') - AppUtils.toSortableDate(left.happenedAt ?? '');
    if (happenedAtDelta !== 0) {
      return happenedAtDelta;
    }
    return sortDirection === 'asc'
      ? left.id.localeCompare(right.id)
      : right.id.localeCompare(left.id);
  }

  private rateDistanceValue(item: RateRecord): number {
    if (Number.isFinite(item.distanceMetersExact)) {
      return Math.max(0, Math.trunc(Number(item.distanceMetersExact)));
    }
    return 0;
  }

  private rateRelevanceScore(item: RateRecord): number {
    const scoreGiven = Number.isFinite(item.scoreGiven)
      ? Math.max(0, Math.round(Number(item.scoreGiven)))
      : 0;
    const scoreReceived = Number.isFinite(item.scoreReceived)
      ? Math.max(0, Math.round(Number(item.scoreReceived)))
      : 0;
    if (item.direction === 'mutual') {
      return scoreGiven + scoreReceived;
    }
    return scoreGiven > 0 ? scoreGiven : 5;
  }

  private resolveRateCursorId(cursor: string | null | undefined): string | null {
    const normalizedCursor = `${cursor ?? ''}`.trim();
    if (!normalizedCursor) {
      return null;
    }
    try {
      const parsed = JSON.parse(normalizedCursor) as { id?: string };
      return typeof parsed.id === 'string' && parsed.id.trim().length > 0
        ? parsed.id.trim()
        : normalizedCursor;
    } catch {
      return normalizedCursor;
    }
  }
}
