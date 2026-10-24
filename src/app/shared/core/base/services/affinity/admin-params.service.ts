import { AdminConfigurationBuilder } from '../../builders/administration/admin-configuration.builder';
import { AppUtils } from '../../app-utils';
import { HTTP_ADAPTER, LOCAL_ADAPTER, type AdapterInstance } from '../../adapter-loaders';
import { AdapterProxyService } from '../platform/adapter-proxy.service';
import { Injectable, inject } from '@angular/core';

import type {
  AdminParamFieldDto,
  AdminParamOptionDto,
  AdminParamValueType,
  AdminParamsHistoryDto,
  AdminParamsHistoryItemDto,
  AdminParamsSectionDto,
  AdminParamsStateDto
} from '../../../contracts/administration/admin.interface';

import { BaseRouteModeService } from '../platform/base-route-mode.service';

const ADMIN_PARAMS_ROUTE = '/admin/params';

export interface AdminParamsDelayOptions {
  skipDemoDelay?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminParamsService extends BaseRouteModeService {
  private readonly transportAdapters = inject(AdapterProxyService);
  private readonly localService = this.transportAdapters.reference(LOCAL_ADAPTER.ADMIN_PARAMS);
  private readonly httpService = this.transportAdapters.reference(HTTP_ADAPTER.ADMIN_PARAMS);

  private get paramsService(): AdapterInstance<typeof LOCAL_ADAPTER.ADMIN_PARAMS> | AdapterInstance<typeof HTTP_ADAPTER.ADMIN_PARAMS> {
    return this.resolveRouteService(ADMIN_PARAMS_ROUTE, this.localService, this.httpService);
  }

  async loadParamsState(adminUserId?: string | null, options?: AdminParamsDelayOptions): Promise<AdminParamsStateDto> {
    const state = this.paramsService === this.localService
      ? await this.localService.loadParamsState(options, adminUserId)
      : await this.httpService.loadParamsState(adminUserId);
    return this.normalizeParamsState(state);
  }

  async saveParamsSection(
    sectionKey: string,
    fields: readonly AdminParamFieldDto[],
    summary: string,
    adminUserId?: string | null,
    options?: AdminParamsDelayOptions
  ): Promise<AdminParamsStateDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    const normalizedFields = fields.map(field => this.normalizeParamField(field));
    const state = this.paramsService === this.localService
      ? await this.localService.saveParamsSection(normalizedSectionKey, normalizedFields, summary, adminUserId, options)
      : await this.httpService.saveParamsSection(normalizedSectionKey, normalizedFields, summary, adminUserId);
    return this.normalizeParamsState(state);
  }

  async loadParamsHistory(
    sectionKey: string,
    adminUserId?: string | null,
    options?: AdminParamsDelayOptions
  ): Promise<AdminParamsHistoryDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    const history = this.paramsService === this.localService
      ? await this.localService.loadParamsHistory(normalizedSectionKey, options, adminUserId)
      : await this.httpService.loadParamsHistory(normalizedSectionKey, adminUserId);
    return this.normalizeParamsHistory(history);
  }

  async revertParamsSection(
    sectionKey: string,
    version: number,
    adminUserId?: string | null
  ): Promise<AdminParamsStateDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    const normalizedVersion = Math.max(1, Math.trunc(Number(version) || 0));
    const state = await this.paramsService.revertParamsSection(normalizedSectionKey, normalizedVersion, adminUserId);
    return this.normalizeParamsState(state);
  }

  private normalizeParamsState(state: AdminParamsStateDto): AdminParamsStateDto {
    return {
      sections: (state.sections ?? []).map(section => this.normalizeParamsSection(section)),
      updatedDate: `${state.updatedDate ?? ''}`.trim() || new Date().toISOString()
    };
  }

  private normalizeParamsSection(section: AdminParamsSectionDto): AdminParamsSectionDto {
    return {
      key: `${section.key ?? ''}`.trim(),
      label: `${section.label ?? ''}`.trim() || `${section.key ?? ''}`.trim(),
      labelKey: `${section.labelKey ?? ''}`.trim() || this.paramSectionLabelKey(section.key),
      version: Math.max(1, Math.trunc(Number(section.version) || 1)),
      changedDate: `${section.changedDate ?? ''}`.trim() || new Date().toISOString(),
      changedBy: `${section.changedBy ?? ''}`.trim() || 'system',
      summary: `${section.summary ?? ''}`.trim(),
      summaryKey: `${section.summaryKey ?? ''}`.trim() || this.paramSummaryKey(section.summary, section.key),
      fields: (section.fields ?? []).map(field => this.normalizeParamField(field))
    };
  }

  private normalizeParamField(field: AdminParamFieldDto): AdminParamFieldDto {
    return AdminConfigurationBuilder.normalizeParamField(field);
  }

  private normalizeParamOption(option: AdminParamOptionDto): AdminParamOptionDto {
    return AdminConfigurationBuilder.normalizeParamOption(option);
  }

  private normalizeParamsHistory(history: AdminParamsHistoryDto): AdminParamsHistoryDto {
    return {
      sectionKey: `${history.sectionKey ?? ''}`.trim(),
      label: `${history.label ?? ''}`.trim() || `${history.sectionKey ?? ''}`.trim(),
      labelKey: `${history.labelKey ?? ''}`.trim() || this.paramSectionLabelKey(history.sectionKey),
      versions: (history.versions ?? [])
        .map(item => this.normalizeParamsHistoryItem(item))
        .sort((left, right) => right.version - left.version)
    };
  }

  private normalizeParamsHistoryItem(item: AdminParamsHistoryItemDto): AdminParamsHistoryItemDto {
    return {
      configId: `${item.configId ?? ''}`.trim() || null,
      version: Math.max(1, Math.trunc(Number(item.version) || 1)),
      changedDate: `${item.changedDate ?? ''}`.trim() || new Date().toISOString(),
      changedBy: `${item.changedBy ?? ''}`.trim() || 'system',
      summary: `${item.summary ?? ''}`.trim(),
      summaryKey: `${item.summaryKey ?? ''}`.trim(),
      active: item.active === true,
      fields: (item.fields ?? []).map(field => this.normalizeParamField(field))
    };
  }

  private paramSectionLabelKey(sectionKey: string | null | undefined): string {
    return AdminConfigurationBuilder.paramSectionLabelKey(sectionKey);
  }

  private paramFieldLabelKey(fieldKey: string | null | undefined): string {
    return AdminConfigurationBuilder.paramFieldLabelKey(fieldKey);
  }

  private paramGroupLabelKey(group: string | null | undefined): string {
    return AdminConfigurationBuilder.paramGroupLabelKey(group);
  }

  private paramStrategyLabelKey(strategy: string | null | undefined): string {
    return AdminConfigurationBuilder.paramStrategyLabelKey(strategy);
  }

  private paramSummaryKey(summary: string | null | undefined, sectionKey: string | null | undefined): string {
    const normalizedSummary = `${summary ?? ''}`.trim();
    const normalizedSection = `${sectionKey ?? ''}`.trim();
    if (!normalizedSummary || !normalizedSection) {
      return '';
    }
    if (/^Updated .+ parameters\.$/i.test(normalizedSummary.replace(/\s+/g, ' '))) {
      return `admin.params.summary.updated.${normalizedSection}`;
    }
    return '';
  }

  private paramsI18nSegment(value: string | null | undefined): string {
    return AppUtils.trimCharacters(`${value ?? ''}`
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
      .replace(/[^a-zA-Z0-9]+/g, '.'), ".")
      .toLocaleLowerCase('en-US');
  }
}
