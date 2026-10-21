import { HTTP_ADAPTER, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { CommunityCaseChangesStore } from '../../../../ui/context/stores/community/community-case-changes.store';
import { Injectable, inject } from '@angular/core';
import { BaseRouteModeService } from '../platform/base-route-mode.service';

import type { CaseCommand, CaseFilters, ICommunityCasesService, SaveCommunityCase, SaveCommunityScheduledTask, ScheduledTaskAction, ScheduledTaskFilters, ScheduledTaskCounters } from '../../../contracts/community/community-case.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';

@Injectable({ providedIn: 'root' })
export class CommunityCasesService extends BaseRouteModeService implements ICommunityCasesService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly changes = inject(CommunityCaseChangesStore);
  private readonly local = this.transportAdapters.reference(LOCAL_ADAPTER.COMMUNITY_CASES);
  private readonly http = this.transportAdapters.reference(HTTP_ADAPTER.COMMUNITY_CASES);
  private get adapter(): ICommunityCasesService { return this.resolveRouteService('/community-cases', this.local, this.http); }
  page(userId: string, query: ListQuery<CaseFilters>, signal?: AbortSignal) { return this.adapter.page(userId, query, signal); }
  detail(userId: string, id: string, signal?: AbortSignal) { return this.adapter.detail(userId, id, signal); }
  save(request: SaveCommunityCase) { return this.adapter.save(request); }
  async action(id: string, request: CaseCommand) { const value = await this.adapter.action(id, request); this.changes.publish(request.userId, value); return value; }
  read(userId: string, id: string) { return this.adapter.read(userId, id); }
  tasks(userId: string, query: ListQuery<ScheduledTaskFilters>, signal?: AbortSignal) { return this.adapter.tasks(userId, query, signal); }
  saveTask(request: SaveCommunityScheduledTask) { return this.adapter.saveTask(request); }
  taskAction(userId: string, id: string, action: ScheduledTaskAction, version: number) { return this.adapter.taskAction(userId, id, action, version); }
}
