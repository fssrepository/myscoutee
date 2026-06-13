import { Injectable, inject } from '@angular/core';

import type { ActivityEventRecord } from '../../contracts/activity.interface';
import { LocalEventEditorDataService } from '../../local/source/services/event-editor-data.service';
import { HttpEventEditorDataService } from '../../http/services/event-editor-data.service';
import { BaseRouteModeService } from './base-route-mode.service';
import type { ActivityMembersSummary } from '../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class EventEditorDataService extends BaseRouteModeService {
  private readonly localEventEditorDataService = inject(LocalEventEditorDataService);
  private readonly httpEventEditorDataService = inject(HttpEventEditorDataService);

  peekKnownItemById(userId: string, itemId: string): ActivityEventRecord | null {
    return this.isLocalRouteEnabled('/activities/events')
      ? this.localEventEditorDataService.peekKnownItemById(userId, itemId)
      : this.httpEventEditorDataService.peekKnownItemById(userId, itemId);
  }

  queryKnownItemById(userId: string, itemId: string): Promise<ActivityEventRecord | null> {
    return this.isLocalRouteEnabled('/activities/events')
      ? this.localEventEditorDataService.queryKnownItemById(userId, itemId)
      : this.httpEventEditorDataService.queryKnownItemById(userId, itemId);
  }

  loadFullItemById(userId: string, itemId: string): Promise<ActivityEventRecord | null> {
    return this.isLocalRouteEnabled('/activities/events')
      ? this.localEventEditorDataService.loadFullItemById(userId, itemId)
      : this.httpEventEditorDataService.loadFullItemById(userId, itemId);
  }

  querySummaryByOwnerId(ownerId: string): Promise<ActivityMembersSummary | null> {
    return this.isLocalRouteEnabled('/activities/events/members')
      ? this.localEventEditorDataService.querySummaryByOwnerId(ownerId)
      : this.httpEventEditorDataService.querySummaryByOwnerId(ownerId);
  }

}
