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

  async loadState(kind: HelpCenterDocumentKind = 'help', lang = 'en'): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const documentKind = this.normalizeKind(kind);
    const language = this.normalizeLang(lang);
    let changed = false;
    for (const option of this.availableLanguages()) {
      changed = this.ensureSeeded(documentKind, option.lang) || this.ensureRevisionDescriptions(documentKind, option.lang) || changed;
    }
    if (changed) {
      await this.memoryDb.flushToIndexedDb();
    }
    return this.stateFromTable(this.table(), documentKind, language);
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
    const table = this.table();
    const nowIso = new Date().toISOString();
    const actorUserId = this.normalizeActor(request.actorUserId);
    const version = this.nextVersion(table, documentKind, language);
    const revisionId = this.newId(`${documentKind}-rev`);
    const revision: HelpCenterRevision = {
      id: revisionId,
      documentKind,
      lang: language,
      languageLabel: this.languageLabel(language),
      version,
      title: this.nonEmptyText(request.title, this.defaultTitle(documentKind, version)),
      summary: this.nonEmptyText(request.summary, this.defaultSummary(documentKind)),
      description: this.nonEmptyText(request.description, this.defaultDescription(documentKind)),
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
    return this.stateFromTable(this.table(), documentKind, language);
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
            return [id, { ...item, documentKind: itemKind, lang: itemLang, languageLabel: this.languageLabel(itemLang), active: itemKind === documentKind && itemLang === language ? id === normalizedRevisionId : item.active }];
          })
      ) as Record<string, HelpCenterRevision>;
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...current,
          activeRevisionId: documentKind === 'help' && language === 'en' ? normalizedRevisionId : current.activeRevisionId,
          activeRevisionIdsByKind: {
            ...(current.activeRevisionIdsByKind ?? {}),
            [this.activeRevisionKey(documentKind, language)]: normalizedRevisionId
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
    return this.stateFromTable(this.table(), documentKind, language);
  }

  async deleteRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const documentKind = this.normalizeKind(kind);
    const normalizedRevisionId = revisionId.trim();
    const table = this.table();
    const revision = table.revisionsById[normalizedRevisionId];
    const language = this.normalizeLang(revision?.lang);
    if (!revision || this.revisionKind(revision) !== documentKind) {
      return this.stateFromTable(table, documentKind);
    }
    const remainingIds = table.revisionIds.filter(id => id !== normalizedRevisionId);
    const remainingRevisions = remainingIds
      .map(id => table.revisionsById[id])
      .filter((item): item is HelpCenterRevision => Boolean(item))
      .filter(item => this.revisionKind(item) === documentKind && this.revisionLang(item) === language)
      .sort((left, right) => right.version - left.version);
    const currentActiveRevisionId = this.activeRevisionId(table, documentKind, language);
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
            return [id, { ...item, documentKind: itemKind, lang: itemLang, languageLabel: this.languageLabel(itemLang), active: itemKind === documentKind && itemLang === language ? id === nextActiveRevisionId : item.active }];
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
            [this.activeRevisionKey(documentKind, language)]: nextActiveRevisionId
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
    return this.stateFromTable(this.table(), documentKind, language);
  }

  private ensureSeeded(kind: HelpCenterDocumentKind, lang = 'en'): boolean {
    const table = this.table();
    const language = this.normalizeLang(lang);
    if (this.revisionsForKind(table, kind, language).length > 0) {
      return false;
    }
    const revision = this.cloneRevision(this.defaultRevision(kind, language), kind);
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
            [this.activeRevisionKey(kind, language)]: revision.id
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
            description: this.defaultDescription(kind)
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

  private stateFromTable(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en'): HelpCenterState {
    const language = this.normalizeLang(lang);
    const revisions = this.revisionsForKind(table, kind, language)
      .map(revision => this.cloneRevision(revision, kind))
      .sort((left, right) => right.version - left.version);
    const activeRevisionId = this.activeRevisionId(table, kind, language);
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

  private nextVersion(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en'): number {
    const currentMax = this.revisionsForKind(table, kind, this.normalizeLang(lang))
      .map(revision => revision.version ?? 0)
      .reduce((max, version) => Math.max(max, Math.trunc(Number(version) || 0)), 0);
    return currentMax + 1;
  }

  private activeRevisionId(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en'): string | null {
    const language = this.normalizeLang(lang);
    const activeKey = this.activeRevisionKey(kind, language);
    if (table.activeRevisionIdsByKind && activeKey in table.activeRevisionIdsByKind) {
      return table.activeRevisionIdsByKind[activeKey] ?? null;
    }
    if (language === 'en' && table.activeRevisionIdsByKind && kind in table.activeRevisionIdsByKind) {
      return table.activeRevisionIdsByKind[kind] ?? null;
    }
    if (kind === 'help' && language === 'en') {
      return table.activeRevisionId ?? null;
    }
    return this.revisionsForKind(table, kind, language).find(revision => revision.active)?.id ?? null;
  }

  private revisionsForKind(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en'): HelpCenterRevision[] {
    const language = this.normalizeLang(lang);
    return table.revisionIds
      .map(id => table.revisionsById[id])
      .filter((revision): revision is HelpCenterRevision => Boolean(revision))
      .filter(revision => this.revisionKind(revision) === kind && this.revisionLang(revision) === language);
  }

  private normalizedRevisionsById(table: DemoHelpCenterTable): Record<string, HelpCenterRevision> {
    return Object.fromEntries(
      table.revisionIds
        .filter(id => Boolean(table.revisionsById[id]))
        .map(id => {
          const revision = table.revisionsById[id];
          const lang = this.revisionLang(revision);
          return [id, { ...revision, documentKind: this.revisionKind(revision), lang, languageLabel: this.languageLabel(lang) }];
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
      icon: this.nonEmptyText(section?.icon, kind === 'privacy' ? 'policy' : 'help_outline'),
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
      lang,
      languageLabel: this.languageLabel(lang),
      description: this.nonEmptyText(revision.description, this.defaultDescription(kind)),
      headerColor: this.normalizeHeaderColor(revision.headerColor),
      sections: this.normalizeSections(revision.sections, kind)
    };
  }

  private defaultRevision(kind: HelpCenterDocumentKind, lang = 'en'): HelpCenterRevision {
    const language = this.normalizeLang(lang);
    if (language === 'hu') {
      return this.cloneRevision(this.huDefaultRevision(kind), kind);
    }
    return this.cloneRevision(
      kind === 'privacy'
        ? APP_STATIC_DATA.defaultPrivacyCenterRevision
        : APP_STATIC_DATA.defaultHelpCenterRevision,
      kind
    );
  }

  private huDefaultRevision(kind: HelpCenterDocumentKind): HelpCenterRevision {
    const nowIso = kind === 'privacy' ? '2026-02-01T00:00:00.000Z' : '2026-05-01T00:00:00.000Z';
    const base = kind === 'privacy'
      ? APP_STATIC_DATA.defaultPrivacyCenterRevision
      : APP_STATIC_DATA.defaultHelpCenterRevision;
    return {
      ...base,
      id: kind === 'privacy' ? 'privacy-default-hu-v1' : 'help-default-hu-v1',
      documentKind: kind,
      lang: 'hu',
      languageLabel: 'Magyar',
      title: kind === 'privacy' ? 'Adatvédelem' : 'MyScoutee súgó',
      summary: kind === 'privacy' ? 'Adatvédelem elsőként' : 'Mit tehetsz a MyScoutee-ban',
      description: kind === 'privacy'
        ? 'Folytatás előtt nézd át és fogadd el, hogyan használja a MyScoutee az adataidat.'
        : 'A MyScoutee segít az eseményeket elejétől végéig megtervezni: meghívások, szakaszok és csoportok, erőforrások, valamint kontextushoz kötött csevegések.',
      sections: kind === 'privacy' ? this.huPrivacySections() : this.huHelpSections(),
      createdAtIso: nowIso,
      updatedAtIso: nowIso
    };
  }

  private huHelpSections(): HelpCenterSection[] {
    return [
      {
        id: 'events',
        icon: 'event_note',
        title: 'Események és alesemények',
        blurb: 'Építsd fel a teljes eseményfolyamatot szakaszokkal vagy opcionális elemekkel.',
        contentHtml: '<p><strong>Építsd fel a teljes eseményfolyamatot szakaszokkal vagy opcionális elemekkel.</strong></p><p>Hozz létre fő eseményt, majd bontsd aleseményekre szakaszokhoz, mellékprogramokhoz vagy opcionális alkalmakhoz.</p><ul><li>Alkalmi és verseny jellegű struktúrák támogatása</li><li>A szakaszkontextus látható marad a kapcsolódó képernyőkön</li><li>A szervezők a hierarchia elvesztése nélkül szerkeszthetnek</li></ul>'
      },
      {
        id: 'resources',
        icon: 'inventory_2',
        title: 'Erőforrások és kapacitás',
        blurb: 'Rendelj embereket, autókat, szállást és kellékeket limitekkel.',
        contentHtml: '<p><strong>Rendelj embereket, autókat, szállást és kellékeket limitekkel.</strong></p><p>Az erőforrásmenükben eszközöket rendelhetsz aleseményekhez és csoportokhoz, majd közvetlenül állíthatod a kapacitásokat.</p><ul><li>Minimum/maximum kapacitás feladatonként</li><li>Kontextusos jelvények függő kérésekhez</li><li>Útvonal- és helytámogatás utazási erőforrásokhoz</li></ul>'
      },
      {
        id: 'activities',
        icon: 'forum',
        title: 'Tevékenységek és csevegések',
        blurb: 'Koordinálj kontextustudatos csatornákkal és szűrőkkel.',
        contentHtml: '<p><strong>Koordinálj kontextustudatos csatornákkal és szűrőkkel.</strong></p><p>A csevegőcsatornák követik az esemény hatókörét: fő esemény, opcionális alesemény és csoportcsatorna is együtt létezhet.</p><ul><li>Gyors csatornaszűrés kontextus szerint</li><li>Olvasatlan számlálók releváns csatornákra szűkítve</li><li>Mobilon és asztali nézetben is működik</li></ul>'
      },
      {
        id: 'safety',
        icon: 'verified_user',
        title: 'Profilok és biztonság',
        blurb: 'Erősítsd a bizalmat profilminőséggel és moderációs eszközökkel.',
        contentHtml: '<p><strong>Erősítsd a bizalmat profilminőséggel és moderációs eszközökkel.</strong></p><p>A profilkészültség valós időben frissül, ahogy a felhasználók kitöltik a fontos mezőket.</p><ul><li>Élő profilkészültségi visszajelzés</li><li>Felhasználójelentési és visszajelzési folyamatok</li><li>Adatvédelmi és hozzáférési láthatósági kontrollok</li></ul>'
      }
    ];
  }

  private huPrivacySections(): HelpCenterSection[] {
    return [
      {
        id: 'privacy',
        icon: 'policy',
        title: 'Adatvédelem',
        blurb: 'Hogyan kezeli a MyScoutee a profilhoz, eseményekhez és közösségi aktivitáshoz kapcsolódó személyes adatokat.',
        contentHtml: '<p>Hogyan kezeli a MyScoutee a profilhoz, eseményekhez és közösségi aktivitáshoz kapcsolódó személyes adatokat.</p><p><strong>Utolsó frissítés:</strong> 2026. február 1.</p>'
      },
      {
        id: 'contact-details',
        icon: 'contact_mail',
        title: 'Kapcsolati adatok',
        blurb: 'Kihez fordulhatsz adatvédelemmel és adatkezeléssel kapcsolatban.',
        contentHtml: '<ul><li><strong>Adatkezelő:</strong> MyScoutee demo platform</li><li><strong>Támogatási email:</strong> privacy@myscoutee.app</li><li><strong>DPO kapcsolat:</strong> dpo@myscoutee.app</li></ul>'
      },
      {
        id: 'legal-basis',
        icon: 'gavel',
        title: 'Jogalap',
        blurb: 'Miért kezel adatokat a MyScoutee a termék- és biztonsági folyamatokhoz.',
        contentHtml: '<ul><li>Szerződés teljesítése a fiók- és eseményfunkciókhoz.</li><li>Jogos érdek a platform biztonsága és a visszaélések megelőzése érdekében.</li><li>Hozzájárulás opcionális profiladatokhoz, pontos helykoordinátákhoz és marketingkommunikációhoz.</li><li>Jogi kötelezettség biztonsági naplókhoz és megfelelőségi nyilvántartásokhoz.</li></ul>'
      },
      {
        id: 'your-rights',
        icon: 'fact_check',
        title: 'Jogaid',
        blurb: 'A fiókodhoz és személyes adataidhoz kapcsolódó jogaid.',
        contentHtml: '<h4>Hozzáférés</h4><ul><li>Kérhetsz másolatot a tárolt személyes adataidról.</li></ul><h4>Helyesbítés</h4><ul><li>Javíthatod a pontatlan profil- vagy fiókadatokat.</li></ul><h4>Törlés</h4><ul><li>Kérheted a fiók és a személyes adatok törlését, ahol ez jogilag lehetséges.</li></ul><h4>Adathordozhatóság</h4><ul><li>Kérheted adataid exportját géppel olvasható formátumban.</li></ul>'
      },
      {
        id: 'data-categories',
        icon: 'category',
        title: 'Adatkategóriák',
        blurb: 'Milyen adattípusokat kezelhet a MyScoutee.',
        contentHtml: '<h4>Fiók és azonosítás</h4><ul><li>Név</li><li>Születésnap</li><li>Lakóhely városa</li><li>Nem</li><li>Profilképek</li></ul><h4>Aktivitási adatok</h4><ul><li>Csevegések</li><li>Meghívások</li><li>Események</li><li>Szervezési interakciók</li><li>Értékelések</li></ul>'
      },
      {
        id: 'purposes',
        icon: 'tips_and_updates',
        title: 'Célok',
        blurb: 'Hogyan támogatják az adatok a profil-, esemény-, chat- és bizalmi funkciókat.',
        contentHtml: '<ul><li>Profil-, chat-, esemény- és szervezői funkciók működtetése.</li><li>Releváns tagok ajánlása és a felfedezés minőségének javítása.</li><li>Visszaélések, spam és gyanús aktivitás észlelése.</li><li>Fiókkérések és megfelelőségi folyamatok támogatása.</li></ul>'
      },
      {
        id: 'retention',
        icon: 'schedule',
        title: 'Megőrzés',
        blurb: 'Mennyi ideig őrizzük meg az adatokat.',
        contentHtml: '<ul><li>Fiókprofil-adatok: amíg a fiók aktív.</li><li>Pontos helykoordináták: csak az aktív helyalapú funkciókhoz szükséges ideig.</li><li>Biztonsági és auditnaplók: jogi vagy megfelelőségi igény szerint.</li><li>Törölt fiókok: az adatok a megőrzési idő után törlődnek vagy anonimizálódnak.</li></ul>'
      },
      {
        id: 'sharing',
        icon: 'share',
        title: 'Harmadik felekkel megosztás',
        blurb: 'Mikor kerülhetnek adatok a MyScoutee-n kívülre.',
        contentHtml: '<ul><li>Szolgáltatókkal tárhely, analitika és támogatási működés céljából.</li><li>Hatóságokkal csak akkor, ha alkalmazandó jog előírja.</li><li>Személyes adatot nem értékesítünk.</li></ul>'
      },
      {
        id: 'security',
        icon: 'security',
        title: 'Biztonság',
        blurb: 'Az adatok védelmét szolgáló kontrollok.',
        contentHtml: '<ul><li>Szerepköralapú hozzáférés belső eszközökhöz.</li><li>Titkosított adatátvitel.</li><li>Üzemeltetési monitorozás és incidenskezelési folyamatok.</li></ul>'
      }
    ];
  }

  private defaultTitle(kind: HelpCenterDocumentKind, version: number): string {
    return kind === 'privacy' ? `Privacy revision v${version}` : `Help revision v${version}`;
  }

  private defaultSummary(kind: HelpCenterDocumentKind): string {
    return kind === 'privacy' ? 'Privacy first' : 'What you can do in MyScoutee';
  }

  private defaultDescription(kind: HelpCenterDocumentKind): string {
    return kind === 'privacy'
      ? APP_STATIC_DATA.defaultPrivacyCenterDescription
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
    return kind === 'privacy' ? 'Privacy' : 'Help';
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
    return kind === 'privacy' ? 'privacy' : 'help';
  }

  private normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' ? 'hu' : 'en';
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

  private activeRevisionKey(kind: HelpCenterDocumentKind, lang: string): string {
    return `${kind}:${this.normalizeLang(lang)}`;
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
