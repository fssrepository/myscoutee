import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { APP_STATIC_DATA } from '../../../app-static-data';
import type {
  ContentLanguage,
  HelpCenterAuditEntry,
  HelpCenterDocumentKind,
  HelpCenterRevision,
  HelpCenterRevisionSaveRequest,
  HelpCenterSection,
  HelpCenterState,
  PrivacyConsentRecord,
  PrivacyConsentSaveRequest
} from '../../base/models';
import { RouteDelayService } from '../../base/services/route-delay.service';

@Injectable({
  providedIn: 'root'
})
export class HttpHelpCenterService {
  private readonly http = inject(HttpClient);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';

  async loadState(kind: HelpCenterDocumentKind = 'help', lang?: string | null, contextKey?: string | null): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const requestLang = this.requestLang(lang);
    const params: Record<string, string> = { lang: requestLang };
    const context = this.normalizeContextKey(documentKind, contextKey);
    if (context) {
      params['contextKey'] = context;
    }
    const route = `/${documentKind}/active`;
    const response = await this.routeDelay.withRequestTimeout(route, this.http
      .get<Partial<HelpCenterState> | null>(`${this.apiBaseUrl}/${documentKind}/active`, {
        params
      })
      .toPromise(), 'Help center request timed out.');
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
    const route = '/privacy/consents';
    const response = await this.routeDelay.withRequestTimeout(route, this.http
      .get<Partial<PrivacyConsentRecord> | null>(`${this.apiBaseUrl}/privacy/consents`, {
        params: {
          userId: normalizedUserId,
          revisionId: normalizedRevisionId,
          ...(minimumRevisionVersion > 0 ? { revisionVersion: `${minimumRevisionVersion}` } : {})
        }
      })
      .toPromise(), 'Help center request timed out.');
    return this.normalizePrivacyConsent(response);
  }

  async savePrivacyConsent(request: PrivacyConsentSaveRequest): Promise<PrivacyConsentRecord> {
    const route = '/privacy/consents';
    const response = await this.routeDelay.withRequestTimeout(route, this.http
      .post<Partial<PrivacyConsentRecord> | null>(`${this.apiBaseUrl}/privacy/consents`, request)
      .toPromise(), 'Help center request timed out.');
    const consent = this.normalizePrivacyConsent(response);
    if (!consent) {
      throw new Error('Privacy consent could not be saved.');
    }
    return consent;
  }

  async loadAdminState(
    adminUserId: string,
    kind: HelpCenterDocumentKind = 'help',
    lang = 'en',
    contextKey?: string | null
  ): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const params: Record<string, string> = { lang: this.normalizeLang(lang) };
    if (adminUserId.trim()) {
      params['adminUserId'] = adminUserId.trim();
    }
    const context = this.normalizeContextKey(documentKind, contextKey);
    if (context) {
      params['contextKey'] = context;
    }
    const route = this.adminRoute(documentKind);
    const response = await this.routeDelay.withRequestTimeout(route, this.http
      .get<Partial<HelpCenterState> | null>(`${this.apiBaseUrl}/admin/${documentKind}`, {
        params
      })
      .toPromise(), 'Help center request timed out.');
    return this.normalizeState(response, documentKind);
  }

  async saveRevision(request: HelpCenterRevisionSaveRequest, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const route = `/admin/${documentKind}/revisions`;
    const response = await this.routeDelay.withRequestTimeout(route, this.http
      .post<Partial<HelpCenterState> | null>(`${this.apiBaseUrl}/admin/${documentKind}/revisions`, request)
      .toPromise(), 'Help center request timed out.');
    return this.normalizeState(response, documentKind);
  }

  async activateRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const route = `/admin/${documentKind}/revisions/activate`;
    const response = await this.routeDelay.withRequestTimeout(route, this.http
      .post<Partial<HelpCenterState> | null>(
        `${this.apiBaseUrl}/admin/${documentKind}/revisions/${encodeURIComponent(revisionId)}/activate`,
        { actorUserId }
      )
      .toPromise(), 'Help center request timed out.');
    return this.normalizeState(response, documentKind);
  }

  async deleteRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    const documentKind = this.normalizeKind(kind);
    const route = `/admin/${documentKind}/revisions/delete`;
    const response = await this.routeDelay.withRequestTimeout(route, this.http
      .request<Partial<HelpCenterState> | null>(
        'delete',
        `${this.apiBaseUrl}/admin/${documentKind}/revisions/${encodeURIComponent(revisionId)}`,
        { body: { actorUserId } }
      )
      .toPromise(), 'Help center request timed out.');
    return this.normalizeState(response, documentKind);
  }

  normalizeExternalState(response: Partial<HelpCenterState> | null | undefined, kind: HelpCenterDocumentKind = 'help'): HelpCenterState {
    return this.normalizeState(response, this.normalizeKind(kind));
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
      auditTrail: auditTrail.sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso)),
      availableLanguages: this.normalizeAvailableLanguages(response?.availableLanguages)
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
      contextKey: this.normalizeContextKey(kind, value?.contextKey),
      lang: this.normalizeLang(value?.lang),
      languageLabel: this.languageLabel(value?.lang, value?.languageLabel),
      version,
      title: `${value?.title ?? `${this.documentLabel(kind)} revision v${version}`}`.trim(),
      summary: `${value?.summary ?? ''}`.trim(),
      description: `${value?.description ?? ''}`.trim()
        || this.defaultDescription(kind),
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
      imageUrls: this.normalizeImageUrls(value?.imageUrls),
      panelSpan: this.normalizePanelSpan(value?.panelSpan),
      optional: value?.optional === true
    };
  }

  private normalizePanelSpan(value: string | null | undefined): HelpCenterSection['panelSpan'] {
    const normalized = `${value ?? ''}`.trim().toLowerCase();
    if (normalized === 'span-1' || normalized === 'compact' || normalized === 'single' || normalized === 'one' || normalized === '1') {
      return 'span-1';
    }
    if (normalized === 'span-2' || normalized === 'wide' || normalized === 'double' || normalized === 'two' || normalized === '2') {
      return 'span-2';
    }
    if (normalized === 'span-3' || normalized === 'full' || normalized === 'row' || normalized === 'all' || normalized === '3') {
      return 'span-3';
    }
    return undefined;
  }

  private normalizeImageUrls(imageUrls: readonly string[] | null | undefined, limit = 8): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const imageUrl of imageUrls ?? []) {
      const normalized = `${imageUrl ?? ''}`.trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
      if (result.length >= limit) {
        break;
      }
    }
    return result;
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
      lang: this.normalizeLang(value?.lang),
      languageLabel: this.languageLabel(value?.lang, value?.languageLabel),
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
    if (kind === 'privacy' || kind === 'terms' || kind === 'explanation') {
      return kind;
    }
    return 'help';
  }

  private normalizeContextKey(kind: HelpCenterDocumentKind, contextKey: string | null | undefined): string | null {
    if (kind !== 'explanation') {
      return null;
    }
    const normalized = `${contextKey ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    return APP_STATIC_DATA.explainableSurfaces.some(surface => surface.enabled && surface.key === normalized)
      ? normalized
      : null;
  }

  private adminRoute(kind: HelpCenterDocumentKind): string {
    return `/admin/${kind}`;
  }

  private documentLabel(kind: HelpCenterDocumentKind): string {
    switch (kind) {
      case 'privacy':
        return 'Privacy';
      case 'terms':
        return 'Terms';
      case 'explanation':
        return 'Explanation';
      default:
        return 'Help';
    }
  }

  private defaultDescription(kind: HelpCenterDocumentKind): string {
    switch (kind) {
      case 'privacy':
        return APP_STATIC_DATA.defaultPrivacyCenterDescription;
      case 'terms':
        return APP_STATIC_DATA.defaultTermsCenterDescription;
      case 'explanation':
        return APP_STATIC_DATA.defaultExplanationHomeRevision.description;
      default:
        return APP_STATIC_DATA.defaultHelpCenterDescription;
    }
  }

  private normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0] || 'en';
    return normalized === 'hu' ? 'hu' : 'en';
  }

  private requestLang(lang?: string | null): string {
    const explicit = this.normalizeRequestLanguage(lang);
    if (explicit) {
      return explicit;
    }
    return this.browserLanguage();
  }

  private browserLanguage(): string {
    const languages = this.browserLanguages()
      .map(value => this.normalizeRequestLanguage(value))
      .filter(Boolean);
    return languages.find(lang => lang !== 'en') ?? languages[0] ?? 'en';
  }

  private browserLanguages(): string[] {
    if (typeof navigator === 'undefined') {
      return [];
    }
    return Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  }

  private normalizeRequestLanguage(lang?: string | null): string {
    return `${lang ?? ''}`
      .trim()
      .toLowerCase()
      .split(',')[0]
      .split(';')[0]
      .split('-')[0]
      .replace(/[^a-z]/g, '');
  }

  private languageLabel(lang: string | null | undefined, label: string | null | undefined): string {
    const explicit = `${label ?? ''}`.trim();
    if (explicit) {
      return explicit;
    }
    return this.normalizeLang(lang) === 'hu' ? 'Magyar' : 'English';
  }

  private normalizeAvailableLanguages(value: readonly Partial<ContentLanguage>[] | null | undefined): ContentLanguage[] {
    const source = Array.isArray(value) && value.length > 0
      ? value
      : APP_STATIC_DATA.contentLanguages;
    const seen = new Set<string>();
    return source
      .map(item => {
        const lang = this.normalizeLang(item?.lang);
        return { lang, label: this.languageLabel(lang, item?.label) };
      })
      .filter(item => {
        if (seen.has(item.lang)) {
          return false;
        }
        seen.add(item.lang);
        return true;
      });
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
