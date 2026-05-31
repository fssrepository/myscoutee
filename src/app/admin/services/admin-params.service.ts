import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { RouteDelayService } from '../../shared/core/base/services/route-delay.service';
import { AdminParamsSeedBuilder } from '../builders/admin-params-seed.builder';
import type {
  AdminParamFieldDto,
  AdminParamOptionDto,
  AdminParamValueType,
  AdminParamsDemoStore,
  AdminParamsHistoryDto,
  AdminParamsHistoryItemDto,
  AdminParamsSectionDto,
  AdminParamsStateDto
} from '../models/admin-params.model';
import { AdminParamsRepository } from '../repositories/admin-params.repository';
import { AdminWorkspaceService } from './admin-workspace.service';

const ADMIN_PARAMS_STORAGE_TIMEOUT_MS = 2500;
const ADMIN_PARAMS_HTTP_TIMEOUT_MS = 12000;
const ADMIN_PARAMS_LOAD_ROUTE = '/admin/params';
const ADMIN_PARAMS_SAVE_ROUTE = '/admin/params/save';
const ADMIN_PARAMS_HISTORY_ROUTE = '/admin/params/history';
const ADMIN_PARAMS_REVERT_ROUTE = '/admin/params/revert';
const ADMIN_PARAMS_LOAD_DEMO_DELAY_MS = 1500;
const ADMIN_PARAMS_SAVE_DEMO_DELAY_MS = 1500;
const ADMIN_PARAMS_HISTORY_DEMO_DELAY_MS = 1500;
const ADMIN_PARAMS_REVERT_DEMO_DELAY_MS = 1500;

interface AdminParamsDelayOptions {
  skipDemoDelay?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AdminParamsService {
  private readonly http = inject(HttpClient);
  private readonly repository = inject(AdminParamsRepository);
  private readonly workspace = inject(AdminWorkspaceService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadParamsState(options?: AdminParamsDelayOptions): Promise<AdminParamsStateDto> {
    return this.withAdminParamsDemoDelay(
      this.loadParamsStateSnapshot(),
      ADMIN_PARAMS_LOAD_ROUTE,
      ADMIN_PARAMS_LOAD_DEMO_DELAY_MS,
      options
    );
  }

  private async loadParamsStateSnapshot(): Promise<AdminParamsStateDto> {
    if (this.workspace.usesHttpAdminApi) {
      const state = await this.withHttpTimeout(this.http
        .get<AdminParamsStateDto>(`${this.apiBaseUrl}/admin/params`, {
          params: { adminUserId: this.workspace.activeAdmin()?.id ?? '' }
        })
        .toPromise());
      return this.normalizeParamsState(state ?? this.buildDefaultParamsStore());
    }
    const store = await this.readDemoParamsStore();
    return this.normalizeParamsState(store);
  }

  async saveParamsSection(
    sectionKey: string,
    fields: readonly AdminParamFieldDto[],
    summary: string,
    options?: AdminParamsDelayOptions
  ): Promise<AdminParamsStateDto> {
    return this.withAdminParamsDemoDelay(
      this.saveParamsSectionSnapshot(sectionKey, fields, summary),
      ADMIN_PARAMS_SAVE_ROUTE,
      ADMIN_PARAMS_SAVE_DEMO_DELAY_MS,
      options
    );
  }

  private async saveParamsSectionSnapshot(
    sectionKey: string,
    fields: readonly AdminParamFieldDto[],
    summary: string
  ): Promise<AdminParamsStateDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    const normalizedFields = fields.map(field => this.normalizeParamField(field));
    if (this.workspace.usesHttpAdminApi) {
      const state = await this.withHttpTimeout(this.http
        .post<AdminParamsStateDto>(`${this.apiBaseUrl}/admin/params`, {
          adminUserId: this.workspace.activeAdmin()?.id ?? '',
          sectionKey: normalizedSectionKey,
          fields: normalizedFields,
          summary
        })
        .toPromise());
      return this.normalizeParamsState(state ?? this.buildDefaultParamsStore());
    }
    const store = await this.readDemoParamsStore();
    const nowIso = new Date().toISOString();
    const version = this.nextDemoParamsVersion(store);
    const nextSections = store.sections.map(section => section.key === normalizedSectionKey
      ? {
          ...section,
          version,
          changedDate: nowIso,
          changedBy: this.workspace.activeAdmin()?.id ?? 'demo-admin',
          summary: summary.trim() || `Updated ${section.label} parameters.`,
          summaryKey: this.paramSummaryKey(summary.trim() || `Updated ${section.label} parameters.`, section.key),
          fields: normalizedFields.map(field => ({ ...field }))
        }
      : section
    );
    const updatedSection = nextSections.find(section => section.key === normalizedSectionKey);
    const nextStore = this.normalizeParamsStore({
      sections: nextSections,
      updatedDate: nowIso,
      historyBySection: {
        ...store.historyBySection,
        [normalizedSectionKey]: updatedSection
          ? [{
              configId: `demo-params-v${version}`,
              version,
              changedDate: nowIso,
              changedBy: this.workspace.activeAdmin()?.id ?? 'demo-admin',
              summary: updatedSection.summary,
              summaryKey: updatedSection.summaryKey,
              active: true,
              fields: updatedSection.fields.map(field => ({ ...field }))
            }, ...(store.historyBySection[normalizedSectionKey] ?? []).map(item => ({ ...item, active: false }))]
          : store.historyBySection[normalizedSectionKey] ?? []
      }
    });
    await this.withStorageFallback(
      this.repository.writeStore(nextStore),
      undefined
    );
    return this.normalizeParamsState(nextStore);
  }

  async loadParamsHistory(sectionKey: string, options?: AdminParamsDelayOptions): Promise<AdminParamsHistoryDto> {
    return this.withAdminParamsDemoDelay(
      this.loadParamsHistorySnapshot(sectionKey),
      ADMIN_PARAMS_HISTORY_ROUTE,
      ADMIN_PARAMS_HISTORY_DEMO_DELAY_MS,
      options
    );
  }

  private async loadParamsHistorySnapshot(sectionKey: string): Promise<AdminParamsHistoryDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    if (this.workspace.usesHttpAdminApi) {
      const history = await this.withHttpTimeout(this.http
        .get<AdminParamsHistoryDto>(
          `${this.apiBaseUrl}/admin/params/${encodeURIComponent(normalizedSectionKey)}/history`,
          { params: { adminUserId: this.workspace.activeAdmin()?.id ?? '' } }
        )
        .toPromise());
      return this.normalizeParamsHistory(history ?? {
        sectionKey: normalizedSectionKey,
        label: normalizedSectionKey,
        versions: []
      });
    }
    const store = await this.readDemoParamsStore();
    const section = store.sections.find(item => item.key === normalizedSectionKey);
    return this.normalizeParamsHistory({
      sectionKey: normalizedSectionKey,
      label: section?.label ?? normalizedSectionKey,
      labelKey: section?.labelKey ?? this.paramSectionLabelKey(normalizedSectionKey),
      versions: store.historyBySection[normalizedSectionKey] ?? []
    });
  }

  async revertParamsSection(sectionKey: string, version: number): Promise<AdminParamsStateDto> {
    return this.withAdminParamsDemoDelay(
      this.revertParamsSectionSnapshot(sectionKey, version),
      ADMIN_PARAMS_REVERT_ROUTE,
      ADMIN_PARAMS_REVERT_DEMO_DELAY_MS
    );
  }

  private async revertParamsSectionSnapshot(sectionKey: string, version: number): Promise<AdminParamsStateDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    const normalizedVersion = Math.max(1, Math.trunc(Number(version) || 0));
    if (this.workspace.usesHttpAdminApi) {
      const state = await this.withHttpTimeout(this.http
        .post<AdminParamsStateDto>(
          `${this.apiBaseUrl}/admin/params/${encodeURIComponent(normalizedSectionKey)}/revert`,
          {
            adminUserId: this.workspace.activeAdmin()?.id ?? '',
            version: normalizedVersion
          }
        )
        .toPromise());
      return this.normalizeParamsState(state ?? this.buildDefaultParamsStore());
    }
    const history = await this.loadParamsHistory(normalizedSectionKey, { skipDemoDelay: true });
    const selected = history.versions.find(item => item.version === normalizedVersion);
    if (!selected) {
      return this.loadParamsState({ skipDemoDelay: true });
    }
    return this.saveParamsSection(
      normalizedSectionKey,
      selected.fields,
      `Reverted ${history.label} parameters to version ${normalizedVersion}.`,
      { skipDemoDelay: true }
    );
  }

  private async withAdminParamsDemoDelay<T>(
    work: Promise<T>,
    route: string,
    fallbackDelayMs: number,
    options?: AdminParamsDelayOptions
  ): Promise<T> {
    if (this.workspace.usesHttpAdminApi || options?.skipDemoDelay === true) {
      return work;
    }
    const delay = this.routeDelay.waitForRouteDelay(route, undefined, undefined, fallbackDelayMs);
    try {
      const [result] = await Promise.all([work, delay]);
      return result;
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  private async readDemoParamsStore(): Promise<AdminParamsDemoStore> {
    await this.withStorageFallback(this.repository.whenReady(), undefined);
    const existing = await this.withStorageFallback(
      this.repository.readStore<AdminParamsDemoStore>(),
      null
    );
    if (!existing?.sections?.length) {
      throw new Error('Demo params store is not bootstrapped.');
    }
    return this.normalizeParamsStore(existing);
  }

  private buildDefaultParamsStore(): AdminParamsDemoStore {
    return this.normalizeParamsStore(AdminParamsSeedBuilder.buildDefaultParamsStore());
  }

  private normalizeParamsState(state: AdminParamsStateDto): AdminParamsStateDto {
    return {
      sections: (state.sections ?? []).map(section => this.normalizeParamsSection(section)),
      updatedDate: `${state.updatedDate ?? ''}`.trim() || new Date().toISOString()
    };
  }

  private normalizeParamsStore(store: AdminParamsDemoStore): AdminParamsDemoStore {
    const state = this.normalizeParamsState(store);
    const historyBySection: Record<string, AdminParamsHistoryItemDto[]> = {};
    for (const section of state.sections) {
      historyBySection[section.key] = (store.historyBySection?.[section.key] ?? [])
        .map(item => this.normalizeParamsHistoryItem(item))
        .sort((left, right) => right.version - left.version);
      if (!historyBySection[section.key].length) {
        historyBySection[section.key] = [{
          configId: `demo-params-${section.key}-v${section.version}`,
          version: section.version,
          changedDate: section.changedDate,
          changedBy: section.changedBy,
          summary: section.summary,
          active: true,
          fields: section.fields.map(field => ({ ...field }))
        }];
      }
    }
    return {
      ...state,
      historyBySection
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
    const valueType: AdminParamValueType = field.valueType === 'text' ? 'text' : 'number';
    const numberValue = valueType === 'number'
      ? (Number.isFinite(Number(field.numberValue)) ? Number(field.numberValue) : 0)
      : null;
    return {
      key: `${field.key ?? ''}`.trim(),
      label: `${field.label ?? ''}`.trim() || `${field.key ?? ''}`.trim(),
      labelKey: `${field.labelKey ?? ''}`.trim() || this.paramFieldLabelKey(field.key),
      group: `${field.group ?? ''}`.trim() || 'General',
      groupKey: `${field.groupKey ?? ''}`.trim() || this.paramGroupLabelKey(field.group),
      valueType,
      numberValue,
      textValue: valueType === 'text' ? `${field.textValue ?? ''}`.trim() : null,
      unit: `${field.unit ?? ''}`.trim(),
      options: (field.options ?? []).map(option => this.normalizeParamOption(option)),
      strategy: `${field.strategy ?? ''}`.trim(),
      strategyKey: `${field.strategyKey ?? ''}`.trim() || this.paramStrategyLabelKey(field.strategy),
      readOnly: field.readOnly === true
    };
  }

  private normalizeParamOption(option: AdminParamOptionDto): AdminParamOptionDto {
    const value = `${option.value ?? ''}`.trim();
    return {
      value,
      label: `${option.label ?? ''}`.trim() || value,
      labelKey: `${option.labelKey ?? ''}`.trim() || this.paramStrategyLabelKey(value)
    };
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
    const normalized = `${sectionKey ?? ''}`.trim();
    return normalized ? `admin.params.section.${normalized}` : 'admin.params.platform';
  }

  private paramFieldLabelKey(fieldKey: string | null | undefined): string {
    const normalized = `${fieldKey ?? ''}`.trim();
    return normalized ? `admin.params.field.${normalized}` : '';
  }

  private paramGroupLabelKey(group: string | null | undefined): string {
    const normalized = this.paramsI18nSegment(group);
    return normalized ? `admin.params.group.${normalized}` : 'admin.params.group.general';
  }

  private paramStrategyLabelKey(strategy: string | null | undefined): string {
    const normalized = `${strategy ?? ''}`.trim();
    return normalized ? `admin.params.strategy.${normalized}` : '';
  }

  private paramSummaryKey(summary: string | null | undefined, sectionKey: string | null | undefined): string {
    const normalizedSummary = `${summary ?? ''}`.trim();
    const normalizedSection = `${sectionKey ?? ''}`.trim();
    if (!normalizedSummary || !normalizedSection) {
      return '';
    }
    if (/^Updated\s+.+?\s+parameters\.$/i.test(normalizedSummary)) {
      return `admin.params.summary.updated.${normalizedSection}`;
    }
    return '';
  }

  private paramsI18nSegment(value: string | null | undefined): string {
    return `${value ?? ''}`
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
      .replace(/[^a-zA-Z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .toLocaleLowerCase('en-US');
  }

  private nextDemoParamsVersion(store: AdminParamsDemoStore): number {
    return Math.max(
      1,
      ...store.sections.map(section => section.version),
      ...Object.values(store.historyBySection ?? {}).flat().map(item => item.version)
    ) + 1;
  }

  private withStorageFallback<T>(task: Promise<T>, fallback: T): Promise<T> {
    return new Promise<T>(resolve => {
      let finished = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const finish = (value: T) => {
        if (finished) {
          return;
        }
        finished = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        resolve(value);
      };
      timeoutId = setTimeout(() => finish(fallback), ADMIN_PARAMS_STORAGE_TIMEOUT_MS);
      task.then(finish).catch(() => finish(fallback));
    });
  }

  private withHttpTimeout<T>(task: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const finish = (callback: () => void) => {
        if (finished) {
          return;
        }
        finished = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        callback();
      };
      timeoutId = setTimeout(
        () => finish(() => reject(new Error('Params request timed out.'))),
        ADMIN_PARAMS_HTTP_TIMEOUT_MS
      );
      task.then(value => finish(() => resolve(value))).catch(error => finish(() => reject(error)));
    });
  }
}
