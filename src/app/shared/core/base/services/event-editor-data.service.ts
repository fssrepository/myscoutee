import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { ActivityMembersSummary } from '../../../core/base/models';
import type { DemoEventRecord } from '../../demo/models/events.model';
import { DemoEventEditorDataService } from '../../demo/services/event-editor-data.service';
import { HttpEventEditorDataService } from '../../http/services/event-editor-data.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class EventEditorDataService {
  private readonly demoEventEditorDataService = inject(DemoEventEditorDataService);
  private readonly httpEventEditorDataService = inject(HttpEventEditorDataService);
  private readonly sessionService = inject(SessionService);

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  private get eventEditorDataService(): DemoEventEditorDataService | HttpEventEditorDataService {
    return this.demoModeEnabled ? this.demoEventEditorDataService : this.httpEventEditorDataService;
  }

  peekKnownItemById(userId: string, itemId: string): DemoEventRecord | null {
    return this.eventEditorDataService.peekKnownItemById(userId, itemId);
  }

  queryKnownItemById(userId: string, itemId: string): Promise<DemoEventRecord | null> {
    return this.eventEditorDataService.queryKnownItemById(userId, itemId);
  }

  querySummaryByOwnerId(ownerId: string): Promise<ActivityMembersSummary | null> {
    return this.eventEditorDataService.querySummaryByOwnerId(ownerId);
  }
}
