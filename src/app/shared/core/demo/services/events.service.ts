import { Injectable, inject } from '@angular/core';

import { AppMemoryDb } from '../../../core/base';
import type { ActivitiesEventSyncPayload } from '../../../core/base/models';
import { DemoRouteDelayService } from './demo-route-delay.service';
import { DemoEventsRepository } from '../repositories/events.repository';
import type {
  DemoEventActivitiesQuery,
  DemoEventActivitiesQueryResult,
  DemoEventExploreQuery,
  DemoEventExploreQueryResult,
  DemoEventRecord,
  DemoEventScopeFilter,
  DemoRepositoryEventItemType
} from '../models/events.model';

@Injectable({
  providedIn: 'root'
})
export class DemoEventsService extends DemoRouteDelayService {
  private static readonly EVENTS_ROUTE = '/activities/events';
  private static readonly EVENTS_EXPLORE_ROUTE = '/activities/events/explore';
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly memoryDb = inject(AppMemoryDb);

  async queryItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryItemsByUser(userId);
  }

  peekItemsByUser(userId: string): DemoEventRecord[] {
    return this.eventsRepository.queryItemsByUser(userId);
  }

  async queryInvitationItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryInvitationItemsByUser(userId);
  }

  async queryEventItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryEventItemsByUser(userId);
  }

  async queryHostingItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryHostingItemsByUser(userId);
  }

  async queryTrashedItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryTrashedItemsByUser(userId);
  }

  async queryEventItemsByFilter(
    userId: string,
    filter: DemoEventScopeFilter,
    hostingPublicationFilter: 'all' | 'drafts' = 'all'
  ): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryEventItemsByFilter(userId, filter, hostingPublicationFilter);
  }

  async queryActivitiesEventPage(query: DemoEventActivitiesQuery): Promise<DemoEventActivitiesQueryResult> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    return this.eventsRepository.queryActivitiesEventPage(query);
  }

  async queryExploreItems(userId: string): Promise<DemoEventRecord[]> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_EXPLORE_ROUTE);
    return this.eventsRepository.queryExploreItems(userId);
  }

  peekExploreItems(userId: string): DemoEventRecord[] {
    return this.eventsRepository.queryExploreItems(userId);
  }

  async queryEventExplorePage(query: DemoEventExploreQuery): Promise<DemoEventExploreQueryResult> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_EXPLORE_ROUTE);
    return this.eventsRepository.queryEventExplorePage(query);
  }

  peekEventExplorePage(query: DemoEventExploreQuery): DemoEventExploreQueryResult {
    return this.eventsRepository.queryEventExplorePage(query);
  }

  async syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.syncEventSnapshot(payload);
    await this.memoryDb.flushToIndexedDb();
  }

  async trashItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.trashItem(userId, type, sourceId);
  }

  async publishItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.publishItem(userId, type, sourceId);
  }

  async restoreItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    this.eventsRepository.restoreItem(userId, type, sourceId);
  }

  async requestJoin(userId: string, sourceId: string): Promise<DemoEventRecord | null> {
    await this.waitForRouteDelay(DemoEventsService.EVENTS_ROUTE);
    const record = this.eventsRepository.requestJoin(userId, sourceId);
    await this.memoryDb.flushToIndexedDb();
    return record;
  }

  countTicketItemsByUser(userId: string): number {
    return this.eventsRepository.countTicketItemsByUser(userId);
  }

  countPendingEventFeedbackByUser(userId: string, feedbackUnlockDelayMs: number): number {
    return this.eventsRepository.countPendingEventFeedbackByUser(userId, feedbackUnlockDelayMs);
  }

}
