import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../core/base/models';
import { DemoAssetTicketsService } from '../../demo/services/asset-tickets.service';
import { HttpAssetTicketsService } from '../../http/services/asset-tickets.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class AssetTicketsService {
  private readonly demoAssetTicketsService = inject(DemoAssetTicketsService);
  private readonly httpAssetTicketsService = inject(HttpAssetTicketsService);
  private readonly sessionService = inject(SessionService);

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  private get assetTicketsService(): DemoAssetTicketsService | HttpAssetTicketsService {
    return this.demoModeEnabled ? this.demoAssetTicketsService : this.httpAssetTicketsService;
  }

  peekTicketCountByUser(userId: string): number {
    return this.assetTicketsService.peekTicketCountByUser(userId);
  }

  async queryTicketPage(query: AppTypes.AssetTicketPageQuery): Promise<AppTypes.AssetTicketPageResult> {
    return this.assetTicketsService.queryTicketPage(query);
  }
}
