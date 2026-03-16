import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { ActivitiesEventSyncPayload } from '../../../activities-models';
import { DemoEventsService } from '../../demo';
import { HttpEventsService } from '../../http';
import type {
  DemoEventRecord,
  DemoEventScopeFilter,
  DemoRepositoryEventItemType
} from '../../demo/models/events.model';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  private readonly demoEventsService = inject(DemoEventsService);
  private readonly httpEventsService = inject(HttpEventsService);
  private readonly sessionService = inject(SessionService);

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  private get eventsService(): DemoEventsService | HttpEventsService {
    return this.demoModeEnabled ? this.demoEventsService : this.httpEventsService;
  }

  queryItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryItemsByUser(userId);
  }

  queryInvitationItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryInvitationItemsByUser(userId);
  }

  queryEventItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryEventItemsByUser(userId);
  }

  queryHostingItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryHostingItemsByUser(userId);
  }

  queryTrashedItemsByUser(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryTrashedItemsByUser(userId);
  }

  queryEventItemsByFilter(
    userId: string,
    filter: DemoEventScopeFilter,
    hostingPublicationFilter: 'all' | 'drafts' = 'all'
  ): Promise<DemoEventRecord[]> {
    return this.eventsService.queryEventItemsByFilter(userId, filter, hostingPublicationFilter);
  }

  queryExploreItems(userId: string): Promise<DemoEventRecord[]> {
    return this.eventsService.queryExploreItems(userId);
  }

  trashItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    return this.eventsService.trashItem(userId, type, sourceId);
  }

  restoreItem(userId: string, type: DemoRepositoryEventItemType, sourceId: string): Promise<void> {
    return this.eventsService.restoreItem(userId, type, sourceId);
  }

  async syncEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    if (!this.demoModeEnabled) {
      return;
    }
    await this.demoEventsService.syncEventSnapshot(payload);
  }
}
