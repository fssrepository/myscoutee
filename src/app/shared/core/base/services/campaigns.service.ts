import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from './base-route-mode.service';
import { LocalCampaignsService } from '../../local/source/services/campaigns.service';
import { HttpCampaignsService } from '../../http/services/campaigns.service';
import type { CampaignAction, CampaignFilters, ICampaignsService, SaveCampaign } from '../../contracts/campaign.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';

@Injectable({ providedIn: 'root' })
export class CampaignsService extends BaseRouteModeService implements ICampaignsService {
  private readonly local = inject(LocalCampaignsService);
  private readonly http = inject(HttpCampaignsService);
  private get adapter(): ICampaignsService { return this.resolveRouteService('/campaigns', this.local, this.http); }
  history(userId: string, targetUserId: string, query: ListQuery, signal?: AbortSignal) { return this.adapter.history(userId, targetUserId, query, signal); }
  page(userId: string, query: ListQuery<CampaignFilters>, signal?: AbortSignal) { return this.adapter.page(userId, query, signal); }
  detail(userId: string, id: string, signal?: AbortSignal) { return this.adapter.detail(userId, id, signal); }
  save(request: SaveCampaign) { return this.adapter.save(request); }
  action(userId: string, id: string, action: CampaignAction, version: number) { return this.adapter.action(userId, id, action, version); }
}
