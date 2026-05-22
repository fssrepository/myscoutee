import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppMemoryDb } from '../../base/db';
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
import { RouteDelayService } from '../../base/services/route-delay.service';
import { HELP_CENTER_TABLE_NAME, type DemoHelpCenterTable } from '../models/help-center.model';

@Injectable({
  providedIn: 'root'
})
export class DemoHelpCenterService {
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly routeDelay = inject(RouteDelayService);

  async loadState(kind: HelpCenterDocumentKind = 'help', lang?: string | null, contextKey?: string | null): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const documentKind = this.normalizeKind(kind);
    const language = this.requestContentLang(lang);
    const context = this.normalizeContextKey(documentKind, contextKey, false);
    let changed = false;
    for (const option of this.availableLanguages()) {
      changed = this.ensureSeeded(documentKind, option.lang)
        || this.ensureRevisionDescriptions(documentKind, option.lang)
        || changed;
    }
    if (changed) {
      await this.memoryDb.flushToIndexedDb();
    }
    return this.stateFromTable(this.table(), documentKind, language, context);
  }

  async loadPrivacyConsent(
    userId: string,
    revisionId: string,
    revisionVersion?: number
  ): Promise<PrivacyConsentRecord | null> {
    await this.memoryDb.whenReady();
    const normalizedUserId = this.nonEmptyText(userId, '');
    const normalizedRevisionId = this.nonEmptyText(revisionId, '');
    if (!normalizedUserId || !normalizedRevisionId) {
      return null;
    }
    const table = this.table();
    const consentId = this.privacyConsentRecordId(normalizedUserId, normalizedRevisionId);
    const consent = table.privacyConsentsById?.[consentId] ?? null;
    if (consent) {
      return this.clonePrivacyConsent(consent);
    }
    return this.latestPrivacyConsentForUser(table, normalizedUserId);
  }

  async savePrivacyConsent(request: PrivacyConsentSaveRequest): Promise<PrivacyConsentRecord> {
    await this.memoryDb.whenReady();
    const userId = this.nonEmptyText(request?.userId, '');
    const revisionId = this.nonEmptyText(request?.revisionId, '');
    if (!userId || !revisionId) {
      throw new Error('A user and privacy revision are required to save consent.');
    }
    const table = this.table();
    const revision = table.revisionsById[revisionId];
    if (!revision || this.revisionKind(revision) !== 'privacy') {
      throw new Error('Privacy revision not found.');
    }
    const id = this.privacyConsentRecordId(userId, revisionId);
    const current = table.privacyConsentsById?.[id] ?? null;
    const nowIso = new Date().toISOString();
    const revisionVersion = Math.max(1, Math.trunc(Number(revision.version || request?.revisionVersion) || 1));
    const currentRevisionVersion = Math.max(0, Math.trunc(Number(current?.revisionVersion) || 0));
    const consent: PrivacyConsentRecord = {
      id,
      userId,
      revisionId,
      revisionVersion,
      approvedOptionalSectionIds: this.approvedOptionalSectionIds(request?.approvedOptionalSectionIds, revision),
      acceptedAtIso: currentRevisionVersion >= revisionVersion && current?.acceptedAtIso ? current.acceptedAtIso : nowIso,
      updatedAtIso: nowIso,
      source: this.normalizeConsentSource(request?.source)
    };
    this.memoryDb.write(state => {
      const currentTable = state[HELP_CENTER_TABLE_NAME];
      const consentsById = {
        ...(currentTable.privacyConsentsById ?? {}),
        [id]: consent
      };
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...currentTable,
          privacyConsentsById: consentsById,
          privacyConsentIds: [...new Set([...(currentTable.privacyConsentIds ?? []), id])]
        }
      };
    });
    await Promise.all([
      this.memoryDb.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay('/privacy/consents', undefined, undefined, 1500)
    ]);
    return this.clonePrivacyConsent(consent);
  }

  async saveRevision(request: HelpCenterRevisionSaveRequest, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const documentKind = this.normalizeKind(kind);
    const language = this.normalizeLang(request?.lang);
    const contextKey = this.normalizeContextKey(documentKind, request?.contextKey, true);
    const table = this.table();
    const nowIso = new Date().toISOString();
    const actorUserId = this.normalizeActor(request.actorUserId);
    const version = this.nextVersion(table, documentKind, language, contextKey);
    const revisionId = this.newId(`${documentKind}-rev`);
    const revision: HelpCenterRevision = {
      id: revisionId,
      documentKind,
      contextKey,
      lang: language,
      languageLabel: this.languageLabel(language),
      version,
      title: this.nonEmptyText(request.title, this.defaultTitle(documentKind, version, language)),
      summary: this.nonEmptyText(request.summary, this.defaultSummary(documentKind, language)),
      description: this.nonEmptyText(request.description, this.defaultDescription(documentKind, language)),
      headerColor: this.normalizeHeaderColor(request.headerColor),
      sections: this.normalizeSections(request.sections, documentKind),
      active: false,
      createdAtIso: nowIso,
      createdByUserId: actorUserId,
      updatedAtIso: nowIso,
      updatedByUserId: actorUserId
    };
    const audit = this.auditEntry({
      action: 'create',
      actorUserId,
      revision,
      message: request.baseRevisionId?.trim()
        ? `Created v${version} from ${request.baseRevisionId.trim()}.`
        : `Created v${version}.`
    });

    this.memoryDb.write(state => {
      const current = state[HELP_CENTER_TABLE_NAME];
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...current,
          seeded: current.seeded || documentKind === 'help',
          seededKinds: { ...(current.seededKinds ?? {}), [documentKind]: true },
          activeRevisionIdsByKind: { ...(current.activeRevisionIdsByKind ?? {}) },
          revisionsById: {
            ...this.normalizedRevisionsById(current),
            [revisionId]: revision
          },
          revisionIds: [...current.revisionIds.filter(id => id !== revisionId), revisionId],
          auditById: {
            ...current.auditById,
            [audit.id]: audit
          },
          auditIds: [...current.auditIds, audit.id]
        }
      };
    });
    await Promise.all([
      this.memoryDb.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay(`/admin/${documentKind}/revisions`, undefined, undefined, 1500)
    ]);
    return this.stateFromTable(this.table(), documentKind, language, contextKey);
  }

  async activateRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const documentKind = this.normalizeKind(kind);
    const language = this.normalizeLang(this.table().revisionsById[revisionId.trim()]?.lang);
    const normalizedRevisionId = revisionId.trim();
    const table = this.table();
    const revision = table.revisionsById[normalizedRevisionId];
    if (!revision || this.revisionKind(revision) !== documentKind) {
      throw new Error(`${this.documentLabel(documentKind)} revision not found.`);
    }
    const contextKey = this.revisionContextKey(revision);
    const audit = this.auditEntry({
      action: 'activate',
      actorUserId: this.normalizeActor(actorUserId),
      revision,
      message: `Activated v${revision.version}.`
    });
    this.memoryDb.write(state => {
      const current = state[HELP_CENTER_TABLE_NAME];
      const revisionsById = Object.fromEntries(
        current.revisionIds
          .filter(id => Boolean(current.revisionsById[id]))
          .map(id => {
            const item = current.revisionsById[id];
            const itemKind = this.revisionKind(item);
            const itemLang = this.revisionLang(item);
            const itemContext = this.revisionContextKey(item);
            return [id, {
              ...item,
              documentKind: itemKind,
              contextKey: itemContext,
              lang: itemLang,
              languageLabel: this.languageLabel(itemLang),
              active: itemKind === documentKind && itemLang === language && itemContext === contextKey
                ? id === normalizedRevisionId
                : item.active
            }];
          })
      ) as Record<string, HelpCenterRevision>;
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...current,
          activeRevisionId: documentKind === 'help' && language === 'en' ? normalizedRevisionId : current.activeRevisionId,
          activeRevisionIdsByKind: {
            ...(current.activeRevisionIdsByKind ?? {}),
            [this.activeRevisionKey(documentKind, language, contextKey)]: normalizedRevisionId
          },
          revisionsById,
          auditById: {
            ...current.auditById,
            [audit.id]: audit
          },
          auditIds: [...current.auditIds, audit.id]
        }
      };
    });
    await Promise.all([
      this.memoryDb.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay(`/admin/${documentKind}/revisions/activate`, undefined, undefined, 1500)
    ]);
    return this.stateFromTable(this.table(), documentKind, language, contextKey);
  }

  async deleteRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const documentKind = this.normalizeKind(kind);
    const normalizedRevisionId = revisionId.trim();
    const table = this.table();
    const revision = table.revisionsById[normalizedRevisionId];
    const language = this.normalizeLang(revision?.lang);
    const contextKey = this.revisionContextKey(revision);
    if (!revision || this.revisionKind(revision) !== documentKind) {
      return this.stateFromTable(table, documentKind);
    }
    const remainingIds = table.revisionIds.filter(id => id !== normalizedRevisionId);
    const remainingRevisions = remainingIds
      .map(id => table.revisionsById[id])
      .filter((item): item is HelpCenterRevision => Boolean(item))
      .filter(item => this.revisionKind(item) === documentKind && this.revisionLang(item) === language && this.revisionContextKey(item) === contextKey)
      .sort((left, right) => right.version - left.version);
    const currentActiveRevisionId = this.activeRevisionId(table, documentKind, language, contextKey);
    const nextActiveRevisionId = currentActiveRevisionId === normalizedRevisionId
      ? (remainingRevisions[0]?.id ?? null)
      : currentActiveRevisionId;
    const audit = this.auditEntry({
      action: 'delete',
      actorUserId: this.normalizeActor(actorUserId),
      revision,
      message: `Deleted v${revision.version}.`
    });

    this.memoryDb.write(state => {
      const current = state[HELP_CENTER_TABLE_NAME];
      const { [normalizedRevisionId]: _removed, ...revisionsById } = current.revisionsById;
      const normalizedRevisionsById = Object.fromEntries(
        remainingIds
          .filter(id => Boolean(revisionsById[id]))
          .map(id => {
            const item = revisionsById[id];
            const itemKind = this.revisionKind(item);
            const itemLang = this.revisionLang(item);
            const itemContext = this.revisionContextKey(item);
            return [id, {
              ...item,
              documentKind: itemKind,
              contextKey: itemContext,
              lang: itemLang,
              languageLabel: this.languageLabel(itemLang),
              active: itemKind === documentKind && itemLang === language && itemContext === contextKey
                ? id === nextActiveRevisionId
                : item.active
            }];
          })
      ) as Record<string, HelpCenterRevision>;
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...current,
          seeded: true,
          activeRevisionId: documentKind === 'help' && language === 'en' ? nextActiveRevisionId : current.activeRevisionId,
          activeRevisionIdsByKind: {
            ...(current.activeRevisionIdsByKind ?? {}),
            [this.activeRevisionKey(documentKind, language, contextKey)]: nextActiveRevisionId
          },
          revisionsById: normalizedRevisionsById,
          revisionIds: remainingIds,
          auditById: {
            ...current.auditById,
            [audit.id]: audit
          },
          auditIds: [...current.auditIds, audit.id]
        }
      };
    });
    await Promise.all([
      this.memoryDb.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay(`/admin/${documentKind}/revisions/delete`, undefined, undefined, 1500)
    ]);
    return this.stateFromTable(this.table(), documentKind, language, contextKey);
  }

  private ensureSeeded(kind: HelpCenterDocumentKind, lang = 'en'): boolean {
    const table = this.table();
    const language = this.normalizeLang(lang);
    if (this.revisionsForKind(table, kind, language).length > 0) {
      return false;
    }
    const revision = this.cloneRevision(this.defaultRevision(kind, language), kind);
    const contextKey = this.revisionContextKey(revision);
    const audit = this.auditEntry({
      action: 'seed',
      actorUserId: 'system',
      revision,
      message: `Seeded default ${this.documentLabel(kind).toLowerCase()} revision v${revision.version}.`
    });
    this.memoryDb.write(state => {
      const current = state[HELP_CENTER_TABLE_NAME];
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...current,
          seeded: current.seeded || kind === 'help',
          seededKinds: { ...(current.seededKinds ?? {}), [kind]: true },
          activeRevisionId: kind === 'help' && language === 'en' ? revision.id : current.activeRevisionId,
          activeRevisionIdsByKind: {
            ...(current.activeRevisionIdsByKind ?? {}),
            [this.activeRevisionKey(kind, language, contextKey)]: revision.id
          },
          revisionsById: {
            ...this.normalizedRevisionsById(current),
            [revision.id]: revision
          },
          revisionIds: [...current.revisionIds.filter(id => id !== revision.id), revision.id],
          auditById: {
            ...current.auditById,
            [audit.id]: audit
          },
          auditIds: [...current.auditIds, audit.id]
        }
      };
    });
    return true;
  }

  private ensureRevisionDescriptions(kind: HelpCenterDocumentKind, lang = 'en'): boolean {
    const table = this.table();
    const language = this.normalizeLang(lang);
    const missingIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision)
        && this.revisionKind(revision) === kind
        && this.revisionLang(revision) === language
        && !this.nonEmptyText(revision?.description, '');
    });
    if (missingIds.length === 0) {
      return false;
    }
    this.memoryDb.write(state => {
      const current = state[HELP_CENTER_TABLE_NAME];
      const revisionsById = this.normalizedRevisionsById(current);
      for (const id of missingIds) {
        const revision = revisionsById[id];
        if (revision) {
          revisionsById[id] = {
            ...revision,
            description: this.defaultDescription(kind, language)
          };
        }
      }
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...current,
          revisionsById
        }
      };
    });
    return true;
  }

  private table(): DemoHelpCenterTable {
    return this.memoryDb.read()[HELP_CENTER_TABLE_NAME];
  }

  private privacyConsentRecordId(userId: string, revisionId: string): string {
    return `${userId.trim()}::${revisionId.trim()}`;
  }

  private latestPrivacyConsentForUser(table: DemoHelpCenterTable, userId: string): PrivacyConsentRecord | null {
    const consentsById = table.privacyConsentsById ?? {};
    const latest = Object.values(consentsById)
      .filter(consent => consent?.userId?.trim() === userId)
      .sort((left, right) => this.privacyConsentSortValue(right) - this.privacyConsentSortValue(left))[0] ?? null;
    return latest ? this.clonePrivacyConsent(latest) : null;
  }

  private privacyConsentSortValue(consent: PrivacyConsentRecord): number {
    const updatedAtMs = Date.parse(consent.updatedAtIso || consent.acceptedAtIso || '');
    if (Number.isFinite(updatedAtMs)) {
      return updatedAtMs;
    }
    return Math.max(0, Math.trunc(Number(consent.revisionVersion) || 0));
  }

  private approvedOptionalSectionIds(
    approvedSectionIds: readonly string[] | null | undefined,
    revision: HelpCenterRevision
  ): string[] {
    const optionalSectionIds = new Set(
      this.normalizeSections(revision.sections, 'privacy')
        .filter(section => section.optional === true)
        .map(section => section.id)
    );
    return Array.from(new Set(
      (Array.isArray(approvedSectionIds) ? approvedSectionIds : [])
        .map(sectionId => `${sectionId ?? ''}`.trim())
        .filter(sectionId => optionalSectionIds.has(sectionId))
    )).sort();
  }

  private clonePrivacyConsent(consent: PrivacyConsentRecord): PrivacyConsentRecord {
    return {
      ...consent,
      approvedOptionalSectionIds: [...consent.approvedOptionalSectionIds]
    };
  }

  private stateFromTable(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): HelpCenterState {
    const language = this.normalizeLang(lang);
    const context = this.normalizeContextKey(kind, contextKey, false);
    if (kind === 'explanation' && !context) {
      return {
        activeRevision: null,
        revisions: [],
        auditTrail: [],
        availableLanguages: this.availableLanguages()
      };
    }
    const revisions = this.revisionsForKind(table, kind, language, context)
      .map(revision => this.cloneRevision(revision, kind))
      .sort((left, right) => right.version - left.version);
    const activeRevisionId = this.activeRevisionId(table, kind, language, context);
    const activeRevision = activeRevisionId
      ? revisions.find(revision => revision.id === activeRevisionId) ?? null
      : null;
    const auditTrail = table.auditIds
      .map(id => table.auditById[id])
      .filter((entry): entry is HelpCenterAuditEntry => Boolean(entry))
      .filter(entry => this.auditKind(entry) === kind)
      .map(entry => {
        const entryLang = this.normalizeLang(entry.lang);
        return { ...entry, documentKind: kind, lang: entryLang, languageLabel: this.languageLabel(entryLang) };
      })
      .sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));
    return {
      activeRevision: activeRevision ? this.cloneRevision(activeRevision, kind) : null,
      revisions,
      auditTrail: auditTrail.filter(entry => this.normalizeLang(entry.lang) === language),
      availableLanguages: this.availableLanguages()
    };
  }

  private nextVersion(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): number {
    const currentMax = this.revisionsForKind(table, kind, this.normalizeLang(lang), this.normalizeContextKey(kind, contextKey, false))
      .map(revision => revision.version ?? 0)
      .reduce((max, version) => Math.max(max, Math.trunc(Number(version) || 0)), 0);
    return currentMax + 1;
  }

  private activeRevisionId(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): string | null {
    const language = this.normalizeLang(lang);
    const context = this.normalizeContextKey(kind, contextKey, false);
    if (kind === 'explanation' && !context) {
      return null;
    }
    const activeKey = this.activeRevisionKey(kind, language, context);
    if (table.activeRevisionIdsByKind && activeKey in table.activeRevisionIdsByKind) {
      return table.activeRevisionIdsByKind[activeKey] ?? null;
    }
    if (language === 'en' && table.activeRevisionIdsByKind && kind in table.activeRevisionIdsByKind) {
      return table.activeRevisionIdsByKind[kind] ?? null;
    }
    if (kind === 'help' && language === 'en') {
      return table.activeRevisionId ?? null;
    }
    return this.revisionsForKind(table, kind, language, context).find(revision => revision.active)?.id ?? null;
  }

  private revisionsForKind(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): HelpCenterRevision[] {
    const language = this.normalizeLang(lang);
    const context = this.normalizeContextKey(kind, contextKey, false);
    return table.revisionIds
      .map(id => table.revisionsById[id])
      .filter((revision): revision is HelpCenterRevision => Boolean(revision))
      .filter(revision => this.revisionKind(revision) === kind && this.revisionLang(revision) === language)
      .filter(revision => kind !== 'explanation' || !context || this.revisionContextKey(revision) === context);
  }

  private normalizedRevisionsById(table: DemoHelpCenterTable): Record<string, HelpCenterRevision> {
    return Object.fromEntries(
      table.revisionIds
        .filter(id => Boolean(table.revisionsById[id]))
        .map(id => {
          const revision = table.revisionsById[id];
          const lang = this.revisionLang(revision);
          return [id, {
            ...revision,
            documentKind: this.revisionKind(revision),
            contextKey: this.revisionContextKey(revision),
            lang,
            languageLabel: this.languageLabel(lang)
          }];
        })
    ) as Record<string, HelpCenterRevision>;
  }

  private auditEntry(options: {
    action: HelpCenterAuditEntry['action'];
    actorUserId: string;
    revision: HelpCenterRevision;
    message: string;
  }): HelpCenterAuditEntry {
    const documentKind = this.revisionKind(options.revision);
    return {
      id: this.newId(`${documentKind}-audit`),
      documentKind,
      lang: this.revisionLang(options.revision),
      languageLabel: this.languageLabel(this.revisionLang(options.revision)),
      revisionId: options.revision.id,
      version: options.revision.version,
      action: options.action,
      actorUserId: this.normalizeActor(options.actorUserId),
      createdAtIso: new Date().toISOString(),
      message: options.message
    };
  }

  private normalizeSections(sections: readonly HelpCenterSection[], kind: HelpCenterDocumentKind): HelpCenterSection[] {
    const seenIds = new Set<string>();
    return (Array.isArray(sections) ? sections : [])
      .map((section, index) => this.normalizeSection(section, index, seenIds, kind))
      .filter((section): section is HelpCenterSection => section !== null);
  }

  private normalizeSection(
    section: HelpCenterSection,
    index: number,
    seenIds: Set<string>,
    kind: HelpCenterDocumentKind
  ): HelpCenterSection | null {
    const title = this.nonEmptyText(section?.title, `${this.documentLabel(kind)} section ${index + 1}`);
    const baseId = this.slugify(section?.id || title) || `section-${index + 1}`;
    let id = baseId;
    let duplicateIndex = 2;
    while (seenIds.has(id)) {
      id = `${baseId}-${duplicateIndex++}`;
    }
    seenIds.add(id);
    const contentHtml = this.normalizeHtml(section?.contentHtml || this.htmlFromLegacySection(section));
    if (!contentHtml.trim()) {
      return null;
    }
    return {
      id,
      icon: this.nonEmptyText(section?.icon, this.defaultSectionIcon(kind)),
      title,
      blurb: this.nonEmptyText(section?.blurb, ''),
      contentHtml,
      optional: kind === 'privacy' && section?.optional === true
    };
  }

  private htmlFromLegacySection(section: HelpCenterSection | null | undefined): string {
    const details = Array.isArray(section?.details) ? section.details : [];
    const points = Array.isArray(section?.points) ? section.points : [];
    return [
      section?.blurb ? `<p><strong>${this.escapeHtml(section.blurb)}</strong></p>` : '',
      ...details.map(detail => `<p>${this.escapeHtml(detail)}</p>`),
      points.length
        ? `<ul>${points.map(point => `<li>${this.escapeHtml(point)}</li>`).join('')}</ul>`
        : ''
    ].join('');
  }

  private normalizeHtml(value: string): string {
    return `${value ?? ''}`
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '')
      .trim();
  }

  private escapeHtml(value: string): string {
    return `${value ?? ''}`
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private cloneRevision(revision: HelpCenterRevision, kind = this.revisionKind(revision)): HelpCenterRevision {
    const lang = this.revisionLang(revision);
    return {
      ...revision,
      documentKind: kind,
      contextKey: this.revisionContextKey(revision),
      lang,
      languageLabel: this.languageLabel(lang),
      description: this.nonEmptyText(revision.description, this.defaultDescription(kind, lang)),
      headerColor: this.normalizeHeaderColor(revision.headerColor),
      sections: this.normalizeSections(revision.sections, kind)
    };
  }

  private defaultRevision(kind: HelpCenterDocumentKind, lang = 'en'): HelpCenterRevision {
    const language = this.normalizeLang(lang);
    const revisionsByLang = kind === 'privacy'
      ? APP_STATIC_DATA.defaultPrivacyCenterRevisionsByLang
      : kind === 'explanation'
        ? APP_STATIC_DATA.defaultExplanationHomeRevisionsByLang
        : APP_STATIC_DATA.defaultHelpCenterRevisionsByLang;
    return this.cloneRevision(language === 'hu' ? revisionsByLang.hu : revisionsByLang.en, kind);
  }

  private defaultTitle(kind: HelpCenterDocumentKind, version: number, lang = 'en'): string {
    if (this.normalizeLang(lang) === 'hu') {
      return kind === 'privacy'
        ? `Adatvédelmi verzió v${version}`
        : kind === 'explanation'
          ? `Magyarázat verzió v${version}`
          : `Súgó verzió v${version}`;
    }
    return `${this.documentLabel(kind)} revision v${version}`;
  }

  private defaultSummary(kind: HelpCenterDocumentKind, lang = 'en'): string {
    if (this.normalizeLang(lang) === 'hu') {
      return kind === 'privacy'
        ? 'Adatvédelem elsőként'
        : kind === 'explanation'
          ? 'Rövid képernyőmagyarázat'
          : 'Mit tehetsz a MyScoutee-ban';
    }
    return kind === 'privacy'
      ? 'Privacy first'
      : kind === 'explanation'
        ? 'Short screen guidance'
        : 'What you can do in MyScoutee';
  }

  private defaultDescription(kind: HelpCenterDocumentKind, lang = 'en'): string {
    if (this.normalizeLang(lang) === 'hu') {
      return kind === 'privacy'
        ? 'Folytatás előtt nézd át és fogadd el, hogyan használja a MyScoutee az adataidat.'
        : kind === 'explanation'
          ? APP_STATIC_DATA.defaultExplanationHomeRevisionsByLang.hu.description
          : 'A MyScoutee segít az eseményeket elejétől végéig megtervezni: meghívások, szakaszok és csoportok, erőforrások, valamint kontextushoz kötött csevegések.';
    }
    return kind === 'privacy'
      ? APP_STATIC_DATA.defaultPrivacyCenterDescription
      : kind === 'explanation'
        ? APP_STATIC_DATA.defaultExplanationHomeRevision.description
      : APP_STATIC_DATA.defaultHelpCenterDescription;
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

  private documentLabel(kind: HelpCenterDocumentKind): string {
    switch (kind) {
      case 'privacy':
        return 'Privacy';
      case 'explanation':
        return 'Explanation';
      default:
        return 'Help';
    }
  }

  private defaultSectionIcon(kind: HelpCenterDocumentKind): string {
    switch (kind) {
      case 'privacy':
        return 'policy';
      case 'explanation':
        return 'tips_and_updates';
      default:
        return 'help_outline';
    }
  }

  private revisionKind(revision: HelpCenterRevision | null | undefined): HelpCenterDocumentKind {
    return this.normalizeKind(revision?.documentKind);
  }

  private revisionLang(revision: HelpCenterRevision | null | undefined): string {
    return this.normalizeLang(revision?.lang);
  }

  private auditKind(entry: HelpCenterAuditEntry | null | undefined): HelpCenterDocumentKind {
    return this.normalizeKind(entry?.documentKind);
  }

  private normalizeKind(kind: string | null | undefined): HelpCenterDocumentKind {
    if (kind === 'privacy' || kind === 'explanation') {
      return kind;
    }
    return 'help';
  }

  private normalizeContextKey(kind: HelpCenterDocumentKind, contextKey: string | null | undefined, required: boolean): string | null {
    if (kind !== 'explanation') {
      return null;
    }
    const normalized = `${contextKey ?? ''}`.trim();
    const match = APP_STATIC_DATA.explainableSurfaces.find(surface => surface.enabled && surface.key === normalized);
    if (match) {
      return match.key;
    }
    if (required) {
      throw new Error('A canonical explanation surface is required.');
    }
    return null;
  }

  private revisionContextKey(revision: HelpCenterRevision | null | undefined): string | null {
    return this.normalizeContextKey(this.revisionKind(revision), revision?.contextKey, false);
  }

  private normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' ? 'hu' : 'en';
  }

  private requestContentLang(lang: string | null | undefined): string {
    const explicit = this.supportedContentLang(lang);
    if (explicit) {
      return explicit;
    }
    return this.supportedContentLang(this.browserLanguage()) || 'en';
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

  private supportedContentLang(lang: string | null | undefined): string | null {
    const requested = this.normalizeRequestLanguage(lang);
    return this.availableLanguages().some(language => language.lang === requested) ? requested : null;
  }

  private normalizeRequestLanguage(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`
      .trim()
      .toLowerCase()
      .split(',')[0]
      .split(';')[0]
      .split('-')[0]
      .replace(/[^a-z]/g, '');
    return normalized;
  }

  private languageLabel(lang: string | null | undefined): string {
    return this.normalizeLang(lang) === 'hu' ? 'Magyar' : 'English';
  }

  private availableLanguages(): Array<{ lang: string; label: string }> {
    return APP_STATIC_DATA.contentLanguages.map(language => ({
      lang: this.normalizeLang(language.lang),
      label: language.label
    }));
  }

  private activeRevisionKey(kind: HelpCenterDocumentKind, lang: string, contextKey?: string | null): string {
    const context = this.normalizeContextKey(kind, contextKey, false);
    return context ? `${kind}:${this.normalizeLang(lang)}:${context}` : `${kind}:${this.normalizeLang(lang)}`;
  }

  private normalizeActor(actorUserId: string): string {
    return this.nonEmptyText(actorUserId, 'admin');
  }

  private normalizeConsentSource(source: string | null | undefined): PrivacyConsentRecord['source'] {
    return source === 'entry' ? 'entry' : 'settings';
  }

  private nonEmptyText(value: string | null | undefined, fallback: string): string {
    const normalized = `${value ?? ''}`.trim();
    return normalized || fallback;
  }

  private slugify(value: string): string {
    return `${value ?? ''}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private newId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
