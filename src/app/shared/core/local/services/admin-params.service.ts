import { Injectable, inject } from '@angular/core';

import type {
  AdminParamFieldDto,
  AdminParamsDemoStore,
  AdminParamsHistoryDto,
  AdminParamsHistoryItemDto,
  AdminParamsStateDto
} from '../../base/models';
import { LocalAdminParamsRepository } from '../repositories/admin-params.repository';
import { LocalRouteDelayService } from './route-delay.service';

const ADMIN_PARAMS_LOAD_ROUTE = '/admin/params';
const ADMIN_PARAMS_SAVE_ROUTE = '/admin/params/save';
const ADMIN_PARAMS_HISTORY_ROUTE = '/admin/params/history';
const ADMIN_PARAMS_REVERT_ROUTE = '/admin/params/revert';

export interface LocalAdminParamsDelayOptions {
  skipDemoDelay?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LocalAdminParamsService extends LocalRouteDelayService {
  private readonly repository = inject(LocalAdminParamsRepository);

  async loadParamsState(options?: LocalAdminParamsDelayOptions): Promise<AdminParamsStateDto> {
    return await this.withAdminParamsDelay(this.readParamsStore(), ADMIN_PARAMS_LOAD_ROUTE, options);
  }

  async saveParamsSection(
    sectionKey: string,
    fields: readonly AdminParamFieldDto[],
    summary: string,
    adminUserId?: string | null,
    options?: LocalAdminParamsDelayOptions
  ): Promise<AdminParamsStateDto> {
    return await this.withAdminParamsDelay(
      this.saveParamsSectionSnapshot(sectionKey, fields, summary, adminUserId),
      ADMIN_PARAMS_SAVE_ROUTE,
      options
    );
  }

  async loadParamsHistory(
    sectionKey: string,
    options?: LocalAdminParamsDelayOptions
  ): Promise<AdminParamsHistoryDto> {
    return await this.withAdminParamsDelay(
      this.loadParamsHistorySnapshot(sectionKey),
      ADMIN_PARAMS_HISTORY_ROUTE,
      options
    );
  }

  async revertParamsSection(
    sectionKey: string,
    version: number,
    adminUserId?: string | null
  ): Promise<AdminParamsStateDto> {
    return await this.withAdminParamsDelay(
      this.revertParamsSectionSnapshot(sectionKey, version, adminUserId),
      ADMIN_PARAMS_REVERT_ROUTE
    );
  }

  private async saveParamsSectionSnapshot(
    sectionKey: string,
    fields: readonly AdminParamFieldDto[],
    summary: string,
    adminUserId?: string | null
  ): Promise<AdminParamsStateDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    const store = await this.readParamsStore();
    const nowIso = new Date().toISOString();
    const version = this.nextParamsVersion(store);
    const changedBy = `${adminUserId ?? ''}`.trim() || 'demo-admin';
    const nextSections = store.sections.map(section => section.key === normalizedSectionKey
      ? {
          ...section,
          version,
          changedDate: nowIso,
          changedBy,
          summary: summary.trim() || `Updated ${section.label} parameters.`,
          summaryKey: this.paramSummaryKey(summary.trim() || `Updated ${section.label} parameters.`, section.key),
          fields: fields.map(field => ({ ...field }))
        }
      : section
    );
    const updatedSection = nextSections.find(section => section.key === normalizedSectionKey);
    const nextStore: AdminParamsDemoStore = {
      sections: nextSections,
      updatedDate: nowIso,
      historyBySection: {
        ...store.historyBySection,
        [normalizedSectionKey]: updatedSection
          ? [{
              configId: `demo-params-v${version}`,
              version,
              changedDate: nowIso,
              changedBy,
              summary: updatedSection.summary,
              summaryKey: updatedSection.summaryKey,
              active: true,
              fields: updatedSection.fields.map(field => ({ ...field }))
            }, ...(store.historyBySection[normalizedSectionKey] ?? []).map(item => ({ ...item, active: false }))]
          : store.historyBySection[normalizedSectionKey] ?? []
      }
    };
    await this.repository.writeStore(nextStore);
    return nextStore;
  }

  private async loadParamsHistorySnapshot(sectionKey: string): Promise<AdminParamsHistoryDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    const store = await this.readParamsStore();
    const section = store.sections.find(item => item.key === normalizedSectionKey);
    return {
      sectionKey: normalizedSectionKey,
      label: section?.label ?? normalizedSectionKey,
      labelKey: section?.labelKey ?? this.paramSectionLabelKey(normalizedSectionKey),
      versions: store.historyBySection[normalizedSectionKey] ?? []
    };
  }

  private async revertParamsSectionSnapshot(
    sectionKey: string,
    version: number,
    adminUserId?: string | null
  ): Promise<AdminParamsStateDto> {
    const normalizedSectionKey = `${sectionKey ?? ''}`.trim();
    const normalizedVersion = Math.max(1, Math.trunc(Number(version) || 0));
    const history = await this.loadParamsHistorySnapshot(normalizedSectionKey);
    const selected = history.versions.find(item => item.version === normalizedVersion);
    if (!selected) {
      return await this.readParamsStore();
    }
    return await this.saveParamsSectionSnapshot(
      normalizedSectionKey,
      selected.fields,
      `Reverted ${history.label} parameters to version ${normalizedVersion}.`,
      adminUserId
    );
  }

  private async readParamsStore(): Promise<AdminParamsDemoStore> {
    await this.repository.whenReady();
    const existing = await this.repository.readStore<AdminParamsDemoStore>();
    if (!existing?.sections?.length) {
      throw new Error('Demo params store is not bootstrapped.');
    }
    return {
      ...existing,
      historyBySection: existing.historyBySection ?? {}
    };
  }

  private async withAdminParamsDelay<T>(
    work: Promise<T>,
    route: string,
    options?: LocalAdminParamsDelayOptions
  ): Promise<T> {
    if (options?.skipDemoDelay === true) {
      return await work;
    }
    const delay = this.waitForRouteDelay(route);
    try {
      const [result] = await Promise.all([work, delay]);
      return result;
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  private nextParamsVersion(store: AdminParamsDemoStore): number {
    return Math.max(
      1,
      ...store.sections.map(section => section.version),
      ...Object.values(store.historyBySection ?? {}).flat().map((item: AdminParamsHistoryItemDto) => item.version)
    ) + 1;
  }

  private paramSectionLabelKey(sectionKey: string | null | undefined): string {
    const normalized = `${sectionKey ?? ''}`.trim();
    return normalized ? `admin.params.section.${normalized}` : 'admin.params.platform';
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
}
