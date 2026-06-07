import { Injectable, inject } from '@angular/core';

import {
  AppContext,
  AdminParamsService as CoreAdminParamsService,
  type AdminParamsDelayOptions
} from '../../shared/core';
import type {
  AdminParamFieldDto,
  AdminParamsHistoryDto,
  AdminParamsStateDto
} from '../models/admin-params.model';

@Injectable({
  providedIn: 'root'
})
export class AdminParamsService {
  private readonly coreParams = inject(CoreAdminParamsService);
  private readonly appCtx = inject(AppContext);

  paramsLoadProgressWindowMs(): number {
    return this.coreParams.paramsLoadProgressWindowMs();
  }

  paramsHistoryProgressWindowMs(): number {
    return this.coreParams.paramsHistoryProgressWindowMs();
  }

  async loadParamsState(options?: AdminParamsDelayOptions): Promise<AdminParamsStateDto> {
    return await this.coreParams.loadParamsState(this.activeAdminId(), options);
  }

  async saveParamsSection(
    sectionKey: string,
    fields: readonly AdminParamFieldDto[],
    summary: string,
    options?: AdminParamsDelayOptions
  ): Promise<AdminParamsStateDto> {
    return await this.coreParams.saveParamsSection(sectionKey, fields, summary, this.activeAdminId(), options);
  }

  async loadParamsHistory(sectionKey: string, options?: AdminParamsDelayOptions): Promise<AdminParamsHistoryDto> {
    return await this.coreParams.loadParamsHistory(sectionKey, this.activeAdminId(), options);
  }

  async revertParamsSection(sectionKey: string, version: number): Promise<AdminParamsStateDto> {
    return await this.coreParams.revertParamsSection(sectionKey, version, this.activeAdminId());
  }

  private activeAdminId(): string {
    return this.appCtx.activeUserId().trim();
  }
}
