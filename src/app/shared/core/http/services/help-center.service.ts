import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { APP_STATIC_DATA } from '../../../app-static-data';
import type {
  HelpCenterAuditEntry,
  HelpCenterRevision,
  HelpCenterRevisionSaveRequest,
  HelpCenterSection,
  HelpCenterState
} from '../../base/models';

@Injectable({
  providedIn: 'root'
})
export class HttpHelpCenterService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadState(): Promise<HelpCenterState> {
    const response = await this.http
      .get<Partial<HelpCenterState> | null>(`${this.apiBaseUrl}/help/active`)
      .toPromise();
    return this.normalizeState(response);
  }

  async loadAdminState(adminUserId: string): Promise<HelpCenterState> {
    const response = await this.http
      .get<Partial<HelpCenterState> | null>(`${this.apiBaseUrl}/admin/help`, {
        params: adminUserId.trim() ? { adminUserId: adminUserId.trim() } : {}
      })
      .toPromise();
    return this.normalizeState(response);
  }

  async saveRevision(request: HelpCenterRevisionSaveRequest): Promise<HelpCenterState> {
    const response = await this.http
      .post<Partial<HelpCenterState> | null>(`${this.apiBaseUrl}/admin/help/revisions`, request)
      .toPromise();
    return this.normalizeState(response);
  }

  async activateRevision(revisionId: string, actorUserId: string): Promise<HelpCenterState> {
    const response = await this.http
      .post<Partial<HelpCenterState> | null>(
        `${this.apiBaseUrl}/admin/help/revisions/${encodeURIComponent(revisionId)}/activate`,
        { actorUserId }
      )
      .toPromise();
    return this.normalizeState(response);
  }

  async deleteRevision(revisionId: string, actorUserId: string): Promise<HelpCenterState> {
    const response = await this.http
      .request<Partial<HelpCenterState> | null>(
        'delete',
        `${this.apiBaseUrl}/admin/help/revisions/${encodeURIComponent(revisionId)}`,
        { body: { actorUserId } }
      )
      .toPromise();
    return this.normalizeState(response);
  }

  private normalizeState(response: Partial<HelpCenterState> | null | undefined): HelpCenterState {
    const revisions = Array.isArray(response?.revisions)
      ? response.revisions.map(revision => this.normalizeRevision(revision)).filter((revision): revision is HelpCenterRevision => Boolean(revision))
      : [];
    const activeRevision = response?.activeRevision
      ? this.normalizeRevision(response.activeRevision)
      : null;
    const auditTrail = Array.isArray(response?.auditTrail)
      ? response.auditTrail.map(entry => this.normalizeAudit(entry)).filter((entry): entry is HelpCenterAuditEntry => Boolean(entry))
      : [];
    return {
      activeRevision,
      revisions: revisions.sort((left, right) => right.version - left.version),
      auditTrail: auditTrail.sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso))
    };
  }

  private normalizeRevision(value: Partial<HelpCenterRevision> | null | undefined): HelpCenterRevision | null {
    const id = `${value?.id ?? ''}`.trim();
    const version = Math.max(0, Math.trunc(Number(value?.version) || 0));
    if (!id || version <= 0) {
      return null;
    }
    return {
      id,
      version,
      title: `${value?.title ?? `Help revision v${version}`}`.trim(),
      summary: `${value?.summary ?? ''}`.trim(),
      description: `${value?.description ?? ''}`.trim() || APP_STATIC_DATA.defaultHelpCenterDescription,
      sections: Array.isArray(value?.sections)
        ? value.sections.map(section => this.normalizeSection(section)).filter((section): section is HelpCenterSection => Boolean(section))
        : [],
      active: value?.active === true,
      createdAtIso: `${value?.createdAtIso ?? ''}`.trim(),
      createdByUserId: `${value?.createdByUserId ?? ''}`.trim(),
      updatedAtIso: `${value?.updatedAtIso ?? value?.createdAtIso ?? ''}`.trim(),
      updatedByUserId: `${value?.updatedByUserId ?? value?.createdByUserId ?? ''}`.trim()
    };
  }

  private normalizeSection(value: Partial<HelpCenterSection> | null | undefined): HelpCenterSection | null {
    const id = `${value?.id ?? ''}`.trim();
    const title = `${value?.title ?? ''}`.trim();
    const contentHtml = `${value?.contentHtml ?? ''}`.trim();
    if (!id || !title || !contentHtml) {
      return null;
    }
    return {
      id,
      icon: `${value?.icon ?? 'help_outline'}`.trim() || 'help_outline',
      title,
      blurb: `${value?.blurb ?? ''}`.trim(),
      contentHtml
    };
  }

  private normalizeAudit(value: Partial<HelpCenterAuditEntry> | null | undefined): HelpCenterAuditEntry | null {
    const id = `${value?.id ?? ''}`.trim();
    const action = value?.action;
    if (!id || (action !== 'seed' && action !== 'create' && action !== 'update' && action !== 'activate' && action !== 'delete')) {
      return null;
    }
    return {
      id,
      revisionId: `${value?.revisionId ?? ''}`.trim() || null,
      version: Number.isFinite(Number(value?.version)) ? Math.max(0, Math.trunc(Number(value?.version))) : null,
      action,
      actorUserId: `${value?.actorUserId ?? ''}`.trim(),
      createdAtIso: `${value?.createdAtIso ?? ''}`.trim(),
      message: `${value?.message ?? ''}`.trim()
    };
  }
}
