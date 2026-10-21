import { HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

import type { CampaignAction, CampaignFilters, ICampaignsService, SaveCampaign } from '../../../contracts/campaigns/campaign.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';

@Injectable({ providedIn: 'root' })
export class CampaignsService extends BaseRouteModeService implements ICampaignsService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly local = this.transportAdapters.reference(LOCAL_ADAPTER.CAMPAIGNS);
  private readonly http = this.transportAdapters.reference(HTTP_ADAPTER.CAMPAIGNS);
  private get adapter(): ICampaignsService { return this.resolveRouteService('/campaigns', this.local, this.http); }
  history(userId: string, targetUserId: string, query: ListQuery, signal?: AbortSignal) { return this.adapter.history(userId, targetUserId, query, signal); }
  page(userId: string, query: ListQuery<CampaignFilters>, signal?: AbortSignal) { return this.adapter.page(userId, query, signal); }
  detail(userId: string, id: string, signal?: AbortSignal) { return this.adapter.detail(userId, id, signal); }
  save(request: SaveCampaign) { return this.adapter.save(request); }
  action(userId: string, id: string, action: CampaignAction, version: number) { return this.adapter.action(userId, id, action, version); }
}
