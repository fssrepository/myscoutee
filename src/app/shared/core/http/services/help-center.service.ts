import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { APP_STATIC_DATA } from '../../../app-static-data';
import type {
  HelpCenterAuditEntry,
  HelpCenterDocumentKind,
  HelpCenterRevision,
  HelpCenterRevisionSaveRequest,
  HelpCenterSection,
  HelpCenterState,
  PrivacyConsentRecord,
  PrivacyConsentSaveRequest
} from '../../base/models';

@Injectable({
  providedIn: 'root'
})
export class HttpHelpCenterService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadState(kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const response = await this.http
      .get<Partial<HelpCenterState> | null>(`${this.apiBaseUrl}/${documentKind}/active`)
      .toPromise();
    return this.normalizeState(response, documentKind);
  }

  async loadPrivacyConsent(
    userId: string,
    revisionId: string,
    revisionVersion?: number
  ): Promise<PrivacyConsentRecord | null> {
    const normalizedUserId = userId.trim();
    const normalizedRevisionId = revisionId.trim();
    if (!normalizedUserId || !normalizedRevisionId) {
      return null;
    }
    const minimumRevisionVersion = Math.trunc(Number(revisionVersion) || 0);
    const response = await this.http
      .get<Partial<PrivacyConsentRecord> | null>(`${this.apiBaseUrl}/privacy/consents`, {
        params: {
          userId: normalizedUserId,
          revisionId: normalizedRevisionId,
          ...(minimumRevisionVersion > 0 ? { revisionVersion: `${minimumRevisionVersion}` } : {})
        }
      })
      .toPromise();
    return this.normalizePrivacyConsent(response);
  }

  async savePrivacyConsent(request: PrivacyConsentSaveRequest): Promise<PrivacyConsentRecord> {
    const response = await this.http
      .post<Partial<PrivacyConsentRecord> | null>(`${this.apiBaseUrl}/privacy/consents`, request)
      .toPromise();
    const consent = this.normalizePrivacyConsent(response);
    if (!consent) {
      throw new Error('Privacy consent could not be saved.');
    }
    return consent;
  }

  async loadAdminState(adminUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const response = await this.http
      .get<Partial<HelpCenterState> | null>(`${this.apiBaseUrl}/admin/${documentKind}`, {
        params: adminUserId.trim() ? { adminUserId: adminUserId.trim() } : {}
      })
      .toPromise();
    return this.normalizeState(response, documentKind);
  }

  async saveRevision(request: HelpCenterRevisionSaveRequest, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const response = await this.http
      .post<Partial<HelpCenterState> | null>(`${this.apiBaseUrl}/admin/${documentKind}/revisions`, request)
      .toPromise();
    return this.normalizeState(response, documentKind);
  }

  async activateRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const response = await this.http
      .post<Partial<HelpCenterState> | null>(
        `${this.apiBaseUrl}/admin/${documentKind}/revisions/${encodeURIComponent(revisionId)}/activate`,
        { actorUserId }
      )
      .toPromise();
    return this.normalizeState(response, documentKind);
  }

  async deleteRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const response = await this.http
      .request<Partial<HelpCenterState> | null>(
        'delete',
        `${this.apiBaseUrl}/admin/${documentKind}/revisions/${encodeURIComponent(revisionId)}`,
        { body: { actorUserId } }
      )
      .toPromise();
    return this.normalizeState(response, documentKind);
  }

  private normalizeState(response: Partial<HelpCenterState> | null | undefined, kind: HelpCenterDocumentKind): HelpCenterState {
    const revisions = Array.isArray(response?.revisions)
      ? response.revisions.map(revision => this.normalizeRevision(revision, kind)).filter((revision): revision is HelpCenterRevision => Boolean(revision))
      : [];
    const activeRevision = response?.activeRevision
      ? this.normalizeRevision(response.activeRevision, kind)
      : null;
    const auditTrail = Array.isArray(response?.auditTrail)
      ? response.auditTrail.map(entry => this.normalizeAudit(entry, kind)).filter((entry): entry is HelpCenterAuditEntry => Boolean(entry))
      : [];
    return {
      activeRevision,
      revisions: revisions.sort((left, right) => right.version - left.version),
      auditTrail: auditTrail.sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso))
    };
  }

  private normalizeRevision(value: Partial<HelpCenterRevision> | null | undefined, kind: HelpCenterDocumentKind): HelpCenterRevision | null {
    const id = `${value?.id ?? ''}`.trim();
    const version = Math.max(0, Math.trunc(Number(value?.version) || 0));
    if (!id || version <= 0) {
      return null;
    }
    return {
      id,
      documentKind: kind,
      version,
      title: `${value?.title ?? `${kind === 'privacy' ? 'Privacy' : 'Help'} revision v${version}`}`.trim(),
      summary: `${value?.summary ?? ''}`.trim(),
      description: `${value?.description ?? ''}`.trim()
        || (kind === 'privacy' ? APP_STATIC_DATA.defaultPrivacyCenterDescription : APP_STATIC_DATA.defaultHelpCenterDescription),
      headerColor: this.normalizeHeaderColor(value?.headerColor),
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
      contentHtml,
      optional: value?.optional === true
    };
  }

  private normalizeAudit(value: Partial<HelpCenterAuditEntry> | null | undefined, kind: HelpCenterDocumentKind): HelpCenterAuditEntry | null {
    const id = `${value?.id ?? ''}`.trim();
    const action = value?.action;
    if (!id || (action !== 'seed' && action !== 'create' && action !== 'update' && action !== 'activate' && action !== 'delete')) {
      return null;
    }
    return {
      id,
      documentKind: this.normalizeKind(value?.documentKind ?? kind),
      revisionId: `${value?.revisionId ?? ''}`.trim() || null,
      version: Number.isFinite(Number(value?.version)) ? Math.max(0, Math.trunc(Number(value?.version))) : null,
      action,
      actorUserId: `${value?.actorUserId ?? ''}`.trim(),
      createdAtIso: `${value?.createdAtIso ?? ''}`.trim(),
      message: `${value?.message ?? ''}`.trim()
    };
  }

  private normalizePrivacyConsent(value: Partial<PrivacyConsentRecord> | null | undefined): PrivacyConsentRecord | null {
    const userId = `${value?.userId ?? ''}`.trim();
    const revisionId = `${value?.revisionId ?? ''}`.trim();
    if (!userId || !revisionId) {
      return null;
    }
    const id = `${value?.id ?? `${userId}::${revisionId}`}`.trim();
    const revisionVersion = Math.max(1, Math.trunc(Number(value?.revisionVersion) || 1));
    const approvedOptionalSectionIds = Array.from(new Set(
      (Array.isArray(value?.approvedOptionalSectionIds) ? value.approvedOptionalSectionIds : [])
        .map(sectionId => `${sectionId ?? ''}`.trim())
        .filter(Boolean)
    )).sort();
    return {
      id,
      userId,
      revisionId,
      revisionVersion,
      approvedOptionalSectionIds,
      acceptedAtIso: `${value?.acceptedAtIso ?? ''}`.trim(),
      updatedAtIso: `${value?.updatedAtIso ?? value?.acceptedAtIso ?? ''}`.trim(),
      source: value?.source === 'entry' ? 'entry' : 'settings'
    };
  }

  private normalizeKind(kind: string | null | undefined): HelpCenterDocumentKind {
    return kind === 'privacy' ? 'privacy' : 'help';
  }

  private normalizeHeaderColor(value: string | null | undefined): HelpCenterRevision['headerColor'] {
    switch (`${value ?? ''}`.trim()) {
      case 'blue':
      case 'green':
      case 'rose':
      case 'violet':
      case 'slate':
        return value as HelpCenterRevision['headerColor'];
      default:
        return 'amber';
    }
  }
}
