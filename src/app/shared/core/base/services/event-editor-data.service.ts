import { Injectable, Injector, inject } from '@angular/core';

import type { ActivityMembersSummary } from '../../../core/base/models';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { DemoEventEditorDataService } from '../../demo/services/event-editor-data.service';
import { HttpEventEditorDataService } from '../../http/services/event-editor-data.service';
import { BaseRouteModeService } from './base-route-mode.service';

@Injectable({
  providedIn: 'root'
})
export class EventEditorDataService extends BaseRouteModeService {
  private readonly injector = inject(Injector);
  private readonly httpEventEditorDataService = inject(HttpEventEditorDataService);
  private demoEventEditorDataServiceRef: DemoEventEditorDataService | null = null;

  private get demoEventEditorDataService(): DemoEventEditorDataService {
    if (!this.demoEventEditorDataServiceRef) {
      this.demoEventEditorDataServiceRef = this.injector.get(DemoEventEditorDataService);
    }
    return this.demoEventEditorDataServiceRef;
  }

  peekKnownItemById(userId: string, itemId: string): DemoEventRecord | null {
    return this.isDemoModeEnabled('/activities/events')
      ? this.demoEventEditorDataService.peekKnownItemById(userId, itemId)
      : this.httpEventEditorDataService.peekKnownItemById(userId, itemId);
  }

  queryKnownItemById(userId: string, itemId: string): Promise<DemoEventRecord | null> {
    return this.isDemoModeEnabled('/activities/events')
      ? this.demoEventEditorDataService.queryKnownItemById(userId, itemId)
      : this.httpEventEditorDataService.queryKnownItemById(userId, itemId);
  }

  querySummaryByOwnerId(ownerId: string): Promise<ActivityMembersSummary | null> {
    return this.isDemoModeEnabled('/activities/events/members')
      ? this.demoEventEditorDataService.querySummaryByOwnerId(ownerId)
      : this.httpEventEditorDataService.querySummaryByOwnerId(ownerId);
  }

}
