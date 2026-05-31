import { Injectable, inject } from '@angular/core';

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
import { RouteDelayService } from '../../base/services/route-delay.service';
import type { DemoHelpCenterTable } from '../models/help-center.model';
import { DemoHelpCenterRepository } from '../repositories/help-center.repository';

const LEGACY_EXPLANATION_FILTER_COUNT_COPY_BY_LANG: Record<string, { from: string; to: string }> = {
  en: {
    from: 'The number shows how many filter groups are active.',
    to: 'The number shows how many results match the selected filter condition.'
  },
  hu: {
    from: 'A szám azt mutatja, hány szűrőcsoport aktív.',
    to: 'A szám azt mutatja, hogy az adott szűrőfeltétel mellett hány találat van.'
  }
};
const LEGACY_ACTIVITY_RATES_EXPLANATION_SECTION_IDS = new Set([
  'activity-tabs',
  'activity-distance-sort',
  'activity-card-actions',
  'activity-panel-actions'
]);
const SEEDED_HELP_IMAGE_REF_PREFIX = 'help-seeded-image:';
const LAZY_HELP_IMAGE_PLACEHOLDER_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

@Injectable({
  providedIn: 'root'
})
export class DemoHelpCenterService {
  private readonly helpCenterRepository = inject(DemoHelpCenterRepository);
  private readonly routeDelay = inject(RouteDelayService);

  async init(): Promise<boolean> {
    await this.helpCenterRepository.whenReady();
    const changed = this.ensureStaticDefaultsSeeded();
    if (changed) {
      await this.helpCenterRepository.flushToIndexedDb();
    }
    return changed;
  }

  async loadState(kind: HelpCenterDocumentKind = 'help', lang?: string | null, contextKey?: string | null): Promise<HelpCenterState> {
    await this.helpCenterRepository.whenReady();
    const documentKind = this.normalizeKind(kind);
    const language = this.requestContentLang(lang);
    const context = this.normalizeContextKey(documentKind, contextKey, false);
    const table = this.table();
    this.assertBootstrappedState(table, documentKind, language, context);
    return this.stateFromTable(table, documentKind, language, context);
  }

  async ensureEntryPrivacySeeded(lang?: string | null): Promise<boolean> {
    await this.helpCenterRepository.whenReady();
    const language = this.requestContentLang(lang);
    const changed = this.ensureSeeded('privacy', language);
    if (changed) {
      await this.helpCenterRepository.flushToIndexedDb();
    }
    return changed;
  }

  private ensureStaticDefaultsSeeded(): boolean {
    let changed = false;
    for (const option of this.availableLanguages()) {
      const language = option.lang;
      const helpSeeded = this.ensureSeeded('help', language);
      const privacySeeded = this.ensureSeeded('privacy', language);
      const explanationsSeeded = this.explanationBootstrapContextKeys()
        .map(contextKey => this.ensureSeeded('explanation', language, contextKey))
        .some(Boolean);
      changed = helpSeeded
        || privacySeeded
        || explanationsSeeded
        || changed;
    }
    const lazyImageMigrationChanged = this.ensureSeededImageRefsLazyLoaded();
    const explanationPanelSpanChanged = this.ensureScopedExplanationPanelSpan();
    return changed || lazyImageMigrationChanged || explanationPanelSpanChanged;
  }

  private explanationBootstrapContextKeys(): string[] {
    return APP_STATIC_DATA.explainableSurfaces
      .filter(surface => surface.enabled)
      .map(surface => this.normalizeContextKey('explanation', surface.key, false))
      .filter((contextKey): contextKey is string => Boolean(contextKey));
  }

  async loadPrivacyConsent(
    userId: string,
    revisionId: string,
    revisionVersion?: number
  ): Promise<PrivacyConsentRecord | null> {
    await this.helpCenterRepository.whenReady();
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
    await this.helpCenterRepository.whenReady();
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
    this.helpCenterRepository.updateTable(currentTable => {
      const consentsById = {
        ...(currentTable.privacyConsentsById ?? {}),
        [id]: consent
      };
      return {
        ...currentTable,
        privacyConsentsById: consentsById,
        privacyConsentIds: [...new Set([...(currentTable.privacyConsentIds ?? []), id])]
      };
    });
    await Promise.all([
      this.helpCenterRepository.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay('/privacy/consents', undefined, undefined, 1500)
    ]);
    return this.clonePrivacyConsent(consent);
  }

  async saveRevision(request: HelpCenterRevisionSaveRequest, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.helpCenterRepository.whenReady();
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
      summary: this.nonEmptyText(request.summary, ''),
      description: this.nonEmptyText(request.description, ''),
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

    this.helpCenterRepository.updateTable(current => {
      return {
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
      };
    });
    await Promise.all([
      this.helpCenterRepository.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay(`/admin/${documentKind}/revisions`, undefined, undefined, 1500)
    ]);
    return this.stateFromTable(this.table(), documentKind, language, contextKey);
  }

  async activateRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.helpCenterRepository.whenReady();
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
    this.helpCenterRepository.updateTable(current => {
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
      };
    });
    await Promise.all([
      this.helpCenterRepository.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay(`/admin/${documentKind}/revisions/activate`, undefined, undefined, 1500)
    ]);
    return this.stateFromTable(this.table(), documentKind, language, contextKey);
  }

  async deleteRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.helpCenterRepository.whenReady();
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

    this.helpCenterRepository.updateTable(current => {
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
      };
    });
    await Promise.all([
      this.helpCenterRepository.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay(`/admin/${documentKind}/revisions/delete`, undefined, undefined, 1500)
    ]);
    return this.stateFromTable(this.table(), documentKind, language, contextKey);
  }

  private ensureSeeded(kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): boolean {
    const table = this.table();
    const language = this.normalizeLang(lang);
    const context = this.normalizeContextKey(kind, contextKey, false);
    const existingRevisions = this.revisionsForKind(table, kind, language, context);
    if (existingRevisions.length > 0) {
      return this.ensureActiveRevision(table, kind, language, context, existingRevisions);
    }
    const revision = this.cloneRevision(this.defaultRevision(kind, language, context), kind);
    const revisionContextKey = this.revisionContextKey(revision);
    const audit = this.auditEntry({
      action: 'seed',
      actorUserId: 'system',
      revision,
      message: `Seeded default ${this.documentLabel(kind).toLowerCase()} revision v${revision.version}.`
    });
    this.helpCenterRepository.updateTable(current => {
      return {
        ...current,
        seeded: current.seeded || kind === 'help',
        seededKinds: { ...(current.seededKinds ?? {}), [kind]: true },
        activeRevisionId: kind === 'help' && language === 'en' ? revision.id : current.activeRevisionId,
        activeRevisionIdsByKind: {
          ...(current.activeRevisionIdsByKind ?? {}),
          [this.activeRevisionKey(kind, language, revisionContextKey)]: revision.id
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
      };
    });
    return true;
  }

  private ensureActiveRevision(
    table: DemoHelpCenterTable,
    kind: HelpCenterDocumentKind,
    lang: string,
    contextKey: string | null,
    revisions: readonly HelpCenterRevision[]
  ): boolean {
    const activeRevisionId = this.activeRevisionId(table, kind, lang, contextKey);
    if (activeRevisionId && revisions.some(revision => revision.id === activeRevisionId)) {
      return false;
    }
    const revision = this.latestRevision(revisions);
    if (!revision) {
      return false;
    }
    const normalizedRevision = {
      ...this.cloneRevision(revision, kind),
      active: true
    };
    this.helpCenterRepository.updateTable(current => {
      return {
        ...current,
        activeRevisionId: kind === 'help' && this.normalizeLang(lang) === 'en'
          ? normalizedRevision.id
          : current.activeRevisionId,
        activeRevisionIdsByKind: {
          ...(current.activeRevisionIdsByKind ?? {}),
          [this.activeRevisionKey(kind, lang, contextKey)]: normalizedRevision.id
        },
        revisionsById: {
          ...this.normalizedRevisionsById(current),
          [normalizedRevision.id]: normalizedRevision
        },
        revisionIds: current.revisionIds.includes(normalizedRevision.id)
          ? current.revisionIds
          : [...current.revisionIds, normalizedRevision.id]
      };
    });
    return true;
  }

  private assertBootstrappedState(
    table: DemoHelpCenterTable,
    kind: HelpCenterDocumentKind,
    lang: string,
    contextKey: string | null
  ): void {
    if (kind === 'explanation' && !contextKey) {
      return;
    }
    const revisions = this.revisionsForKind(table, kind, lang, contextKey);
    const activeRevisionId = this.activeRevisionId(table, kind, lang, contextKey);
    if (revisions.length > 0 && activeRevisionId && revisions.some(revision => revision.id === activeRevisionId)) {
      return;
    }
    throw new Error(`Demo ${this.documentLabel(kind).toLowerCase()} content is not bootstrapped.`);
  }

  private latestRevision(revisions: readonly HelpCenterRevision[]): HelpCenterRevision | null {
    return [...revisions].sort((left, right) => {
      const versionOrder = (right.version ?? 0) - (left.version ?? 0);
      if (versionOrder !== 0) {
        return versionOrder;
      }
      const rightUpdated = right.updatedAtIso ?? right.createdAtIso ?? '';
      const leftUpdated = left.updatedAtIso ?? left.createdAtIso ?? '';
      return rightUpdated.localeCompare(leftUpdated);
    })[0] ?? null;
  }

  private ensureSeededImageRefsLazyLoaded(): boolean {
    const table = this.table();
    const revisionIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision?.sections?.some(section => this.hasLegacySeededImageSrc(section.contentHtml)));
    });
    if (revisionIds.length === 0) {
      return false;
    }
    this.helpCenterRepository.updateTable(current => {
      const revisionsById = this.normalizedRevisionsById(current);
      for (const id of revisionIds) {
        const revision = revisionsById[id];
        if (!revision) {
          continue;
        }
        revisionsById[id] = {
          ...revision,
          sections: revision.sections.map(section => ({
            ...section,
            contentHtml: this.normalizeSeededImageRefsInHtml(section.contentHtml)
          }))
        };
      }
      return {
        ...current,
        revisionsById
      };
    });
    return true;
  }

  private ensureScopedExplanationPanelSpan(): boolean {
    const table = this.table();
    const span1Contexts = new Set(['events', 'event.editor']);
    const revisionIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision)
        && this.revisionKind(revision) === 'explanation'
        && span1Contexts.has(this.revisionContextKey(revision) ?? '')
        && revision?.sections?.some(section => section.panelSpan !== 'span-1');
    });
    if (revisionIds.length === 0) {
      return false;
    }
    this.helpCenterRepository.updateTable(current => {
      const revisionsById = this.normalizedRevisionsById(current);
      for (const id of revisionIds) {
        const revision = revisionsById[id];
        if (!revision) {
          continue;
        }
        revisionsById[id] = {
          ...revision,
          sections: revision.sections.map(section => ({
            ...section,
            panelSpan: 'span-1'
          }))
        };
      }
      return {
        ...current,
        revisionsById
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
    this.helpCenterRepository.updateTable(current => {
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
        ...current,
        revisionsById
      };
    });
    return true;
  }

  private ensureExplanationFilterCountCopy(kind: HelpCenterDocumentKind, lang = 'en'): boolean {
    if (kind !== 'explanation') {
      return false;
    }
    const language = this.normalizeLang(lang);
    const copy = LEGACY_EXPLANATION_FILTER_COUNT_COPY_BY_LANG[language];
    if (!copy) {
      return false;
    }
    const table = this.table();
    const revisionIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision)
        && this.revisionKind(revision) === 'explanation'
        && this.revisionLang(revision) === language
        && revision?.sections?.some(section => section.id === 'filters' && section.contentHtml.includes(copy.from));
    });
    if (revisionIds.length === 0) {
      return false;
    }
    this.helpCenterRepository.updateTable(current => {
      const revisionsById = this.normalizedRevisionsById(current);
      for (const id of revisionIds) {
        const revision = revisionsById[id];
        if (!revision) {
          continue;
        }
        revisionsById[id] = {
          ...revision,
          sections: revision.sections.map(section => section.id === 'filters'
            ? { ...section, contentHtml: section.contentHtml.replace(copy.from, copy.to) }
            : section)
        };
      }
      return {
        ...current,
        revisionsById
      };
    });
    return true;
  }

  private ensureActivityRatesExplanationCopy(kind: HelpCenterDocumentKind, lang = 'en'): boolean {
    if (kind !== 'explanation') {
      return false;
    }
    const language = this.normalizeLang(lang);
    const table = this.table();
    const revisionIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision)
        && this.revisionKind(revision) === 'explanation'
        && this.revisionLang(revision) === language
        && this.revisionContextKey(revision) === 'activities.rates'
        && this.isLegacyActivityRatesExplanation(revision);
    });
    if (revisionIds.length === 0) {
      return false;
    }
    const replacement = this.defaultRevision('explanation', language, 'activities.rates');
    this.helpCenterRepository.updateTable(current => {
      const revisionsById = this.normalizedRevisionsById(current);
      for (const id of revisionIds) {
        const revision = revisionsById[id];
        if (!revision) {
          continue;
        }
        revisionsById[id] = {
          ...revision,
          title: replacement.title,
          summary: replacement.summary,
          sections: replacement.sections.map(section => ({ ...section })),
          updatedAtIso: new Date().toISOString(),
          updatedByUserId: revision.updatedByUserId || 'system'
        };
      }
      return {
        ...current,
        revisionsById
      };
    });
    return true;
  }

  private ensureChatsExplanationCopy(kind: HelpCenterDocumentKind, lang = 'en'): boolean {
    if (kind !== 'explanation') {
      return false;
    }
    const language = this.normalizeLang(lang);
    const table = this.table();
    const revisionIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision)
        && this.revisionKind(revision) === 'explanation'
        && this.revisionLang(revision) === language
        && this.revisionContextKey(revision) === 'chats'
        && this.isLegacyChatsExplanation(revision);
    });
    if (revisionIds.length === 0) {
      return false;
    }
    const replacement = this.defaultRevision('explanation', language, 'chats');
    this.helpCenterRepository.updateTable(current => {
      const revisionsById = this.normalizedRevisionsById(current);
      for (const id of revisionIds) {
        const revision = revisionsById[id];
        if (!revision) {
          continue;
        }
        revisionsById[id] = {
          ...revision,
          title: replacement.title,
          summary: replacement.summary,
          sections: replacement.sections.map(section => ({ ...section })),
          updatedAtIso: new Date().toISOString(),
          updatedByUserId: revision.updatedByUserId || 'system'
        };
      }
      return {
        ...current,
        revisionsById
      };
    });
    return true;
  }

  private ensureEventsExplanationCopy(kind: HelpCenterDocumentKind, lang = 'en'): boolean {
    if (kind !== 'explanation') {
      return false;
    }
    const language = this.normalizeLang(lang);
    const table = this.table();
    const revisionIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision)
        && this.revisionKind(revision) === 'explanation'
        && this.revisionLang(revision) === language
        && this.revisionContextKey(revision) === 'events'
        && this.isLegacyEventsExplanation(revision);
    });
    if (revisionIds.length === 0) {
      return false;
    }
    const replacement = this.defaultRevision('explanation', language, 'events');
    this.helpCenterRepository.updateTable(current => {
      const revisionsById = this.normalizedRevisionsById(current);
      for (const id of revisionIds) {
        const revision = revisionsById[id];
        if (!revision) {
          continue;
        }
        revisionsById[id] = {
          ...revision,
          title: replacement.title,
          summary: replacement.summary,
          sections: replacement.sections.map(section => ({ ...section })),
          updatedAtIso: new Date().toISOString(),
          updatedByUserId: revision.updatedByUserId || 'system'
        };
      }
      return {
        ...current,
        revisionsById
      };
    });
    return true;
  }

  private ensureAssetsExplanationCopy(kind: HelpCenterDocumentKind, lang = 'en'): boolean {
    if (kind !== 'explanation') {
      return false;
    }
    const language = this.normalizeLang(lang);
    const table = this.table();
    const revisionIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision)
        && this.revisionKind(revision) === 'explanation'
        && this.revisionLang(revision) === language
        && this.revisionContextKey(revision) === 'assets'
        && this.isLegacyAssetsExplanation(revision);
    });
    if (revisionIds.length === 0) {
      return false;
    }
    const replacement = this.defaultRevision('explanation', language, 'assets');
    this.helpCenterRepository.updateTable(current => {
      const revisionsById = this.normalizedRevisionsById(current);
      for (const id of revisionIds) {
        const revision = revisionsById[id];
        if (!revision) {
          continue;
        }
        revisionsById[id] = {
          ...revision,
          title: replacement.title,
          summary: replacement.summary,
          sections: replacement.sections.map(section => ({ ...section })),
          updatedAtIso: new Date().toISOString(),
          updatedByUserId: revision.updatedByUserId || 'system'
        };
      }
      return {
        ...current,
        revisionsById
      };
    });
    return true;
  }

  private ensureEventEditorExplanationCopy(kind: HelpCenterDocumentKind, lang = 'en'): boolean {
    if (kind !== 'explanation') {
      return false;
    }
    const language = this.normalizeLang(lang);
    const table = this.table();
    const revisionIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision)
        && this.revisionKind(revision) === 'explanation'
        && this.revisionLang(revision) === language
        && this.revisionContextKey(revision) === 'event.editor'
        && this.isLegacyEventEditorExplanation(revision);
    });
    if (revisionIds.length === 0) {
      return false;
    }
    const replacement = this.defaultRevision('explanation', language, 'event.editor');
    this.helpCenterRepository.updateTable(current => {
      const revisionsById = this.normalizedRevisionsById(current);
      for (const id of revisionIds) {
        const revision = revisionsById[id];
        if (!revision) {
          continue;
        }
        revisionsById[id] = {
          ...revision,
          title: replacement.title,
          summary: replacement.summary,
          sections: replacement.sections.map(section => ({ ...section })),
          updatedAtIso: new Date().toISOString(),
          updatedByUserId: revision.updatedByUserId || 'system'
        };
      }
      return {
        ...current,
        revisionsById
      };
    });
    return true;
  }

  private ensureHomeAffinityNetworkExplanation(kind: HelpCenterDocumentKind, lang = 'en'): boolean {
    if (kind !== 'explanation') {
      return false;
    }
    const language = this.normalizeLang(lang);
    const replacement = this.defaultRevision('explanation', language, 'home.game')
      .sections.find(section => section.id === 'affinity-network');
    if (!replacement) {
      return false;
    }
    const table = this.table();
    const revisionIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision)
        && this.revisionKind(revision) === 'explanation'
        && this.revisionLang(revision) === language
        && this.revisionContextKey(revision) === 'home.game'
        && (
          !revision?.sections?.some(section => section.id === 'affinity-network')
          || revision?.sections?.some(section => this.isLegacyHomeAffinityNetworkSection(section))
        );
    });
    if (revisionIds.length === 0) {
      return false;
    }
    this.helpCenterRepository.updateTable(current => {
      const revisionsById = this.normalizedRevisionsById(current);
      for (const id of revisionIds) {
        const revision = revisionsById[id];
        if (!revision) {
          continue;
        }
        const sections = [...(revision.sections ?? [])];
        const affinityIndex = sections.findIndex(section => section.id === 'affinity');
        const networkIndex = sections.findIndex(section => section.id === 'affinity-network');
        if (networkIndex >= 0) {
          sections.splice(networkIndex, 1, { ...sections[networkIndex], ...replacement });
        } else {
          sections.splice(affinityIndex >= 0 ? affinityIndex + 1 : sections.length, 0, { ...replacement });
        }
        revisionsById[id] = {
          ...revision,
          sections,
          updatedAtIso: new Date().toISOString(),
          updatedByUserId: revision.updatedByUserId || 'system'
        };
      }
      return {
        ...current,
        revisionsById
      };
    });
    return true;
  }

  private isLegacyHomeAffinityNetworkSection(section: HelpCenterSection | null | undefined): boolean {
    if (section?.id !== 'affinity-network') {
      return false;
    }
    const title = `${section.title ?? ''}`;
    const blurb = `${section.blurb ?? ''}`;
    const contentHtml = `${section.contentHtml ?? ''}`;
    return title === 'Affinity and group matching'
      || blurb === 'Your score is compared with the crowd, not read alone.'
      || blurb === 'Az értéked a tömeghez képest értelmeződik.'
      || contentHtml.includes('social graph')
      || contentHtml.includes('kapcsolati gráf')
      || contentHtml.includes('affinity edges')
      || contentHtml.includes('szimpátia-edge');
  }

  private isLegacyAssetsExplanation(revision: HelpCenterRevision | undefined): boolean {
    if (!revision) {
      return false;
    }
    const sections = revision.sections ?? [];
    if (!sections.some(section => section.id === 'assets-entry')) {
      return true;
    }
    return revision.title === 'Home explanation'
      || revision.title === 'Kezdőlap magyarázat'
      || sections.some(section =>
        section.id === 'affinity'
        || section.id === 'filters'
        || section.id === 'history'
        || section.title === 'Your assets and tickets'
        || section.title === 'Saját eszközök és jegyek');
  }

  private isLegacyActivityRatesExplanation(revision: HelpCenterRevision | undefined): boolean {
    return Boolean(revision?.sections?.some(section =>
      LEGACY_ACTIVITY_RATES_EXPLANATION_SECTION_IDS.has(section.id)
      || section.title === 'Panel actions'
      || section.title === 'Panelműveletek'
      || section.title === 'Activity menu'
      || section.title === 'Tevékenység menü'
      || section.title === 'Rating list'
      || section.title === 'Értékelési lista'
      || section.title === 'Star rating badge'
      || section.title === 'Csillagos értékelő jelvény'
      || section.title === 'Scoring a card'
      || section.title === 'Kártya pontozása'
      || `${section.contentHtml ?? ''}`.includes('The top-right controls change the panel mode or close it.')
      || `${section.contentHtml ?? ''}`.includes('A jobb felső gombok módot váltanak vagy bezárják a panelt.')
      || `${section.contentHtml ?? ''}`.includes('The first toolbar menu switches the whole Activities panel.')
      || `${section.contentHtml ?? ''}`.includes('Az első eszköztári menü az egész Tevékenységek panelt váltja.')
      || `${section.contentHtml ?? ''}`.includes('The star badge is the rating control, not a generic card score.')
      || `${section.contentHtml ?? ''}`.includes('A csillagos jelvény az értékelés vezérlője, nem általános kártyapont.')
      || `${section.contentHtml ?? ''}`.includes('Use the filter menu to switch between Given, Received, Mutual, Met, and Suggestions.')
      || `${section.contentHtml ?? ''}`.includes('A szűrőmenüvel válthatsz: adott, kapott, kölcsönös, találkozott és javaslatok.')
      || `${section.contentHtml ?? ''}`.includes('The fullscreen button opens a focused rating flow.')
      || `${section.contentHtml ?? ''}`.includes('A teljes képernyő ikon fókuszált értékelési folyamatot nyit.')
    ));
  }

  private isLegacyEventsExplanation(revision: HelpCenterRevision | undefined): boolean {
    if (!revision || this.revisionContextKey(revision) !== 'events') {
      return false;
    }
    if (revision.title === 'Home explanation' || revision.title === 'Kezdőlap magyarázat') {
      return true;
    }
    return Boolean(revision.sections?.some(section =>
      section.id === 'affinity'
      || section.id === 'profile'
      || section.id === 'filters'
      || section.id === 'history'
      || `${section.contentHtml ?? ''}`.includes('Tap or drag the Affinity slider')
      || `${section.contentHtml ?? ''}`.includes('Tapints vagy húzd a Szimpátia sávot')
      || `${section.contentHtml ?? ''}`.includes('Cards can contain more photos and a profile detail view')
      || `${section.contentHtml ?? ''}`.includes('A kártya több képet és részletes profilt is rejthet')
      || `${section.contentHtml ?? ''}`.includes('This is the event hub inside Activities.')
      || `${section.contentHtml ?? ''}`.includes('Ez az eseményközpont a Tevékenységekben.')
      || `${section.contentHtml ?? ''}`.includes('Embedded screens like checkout')
      || `${section.contentHtml ?? ''}`.includes('A beágyazott képernyők, például fizetés')
      || `${section.contentHtml ?? ''}`.includes('Create or auto-fill an event')
      || `${section.contentHtml ?? ''}`.includes('Létrehozás vagy automatikus feltöltés')
    ));
  }

  private isLegacyEventEditorExplanation(revision: HelpCenterRevision | undefined): boolean {
    if (!revision || this.revisionContextKey(revision) !== 'event.editor') {
      return false;
    }
    if (revision.title === 'Event editor explanation' || revision.title === 'Eseményszerkesztő magyarázat') {
      return true;
    }
    return Boolean(revision.sections?.some(section =>
      `${section.contentHtml ?? ''}`.includes('This is where the event card and the basic rules are made.')
      || `${section.contentHtml ?? ''}`.includes('Itt készül az eseménykártya')
      || `${section.contentHtml ?? ''}`.includes('These cards decide how people find, join, and understand the event.')
      || `${section.contentHtml ?? ''}`.includes('Ezek döntik el, hogyan találják meg')
      || `${section.contentHtml ?? ''}`.includes('Blind Event</strong> hides the crowd before the event')
      || `${section.contentHtml ?? ''}`.includes('A <strong>Blind Event</strong> elrejti')
      || `${section.contentHtml ?? ''}`.includes('Roles are simple:')
      || `${section.contentHtml ?? ''}`.includes('A szerepek egyszerűek')
      || `${section.contentHtml ?? ''}`.includes('Assets are the practical things')
      || `${section.contentHtml ?? ''}`.includes('Az eszköz itt gyakorlati')
      || `${section.contentHtml ?? ''}`.includes('Manager/Admin people are protected from normal disqualify/remove actions')
      || `${section.contentHtml ?? ''}`.includes('Az Admin/Manager védett')
      || `${section.contentHtml ?? ''}`.includes('helper-organizer role under Admin')
      || `${section.contentHtml ?? ''}`.includes('segítő-szervező szerep az Admin alatt')
    ));
  }

  private isLegacyChatsExplanation(revision: HelpCenterRevision | undefined): boolean {
    if (!revision || this.revisionContextKey(revision) !== 'chats') {
      return false;
    }
    if (revision.title === 'Home explanation' || revision.title === 'Kezdőlap magyarázat') {
      return true;
    }
    return Boolean(revision.sections?.some(section =>
      section.id === 'affinity'
      || section.id === 'profile'
      || section.id === 'filters'
      || section.id === 'history'
      || `${section.contentHtml ?? ''}`.includes('Tap or drag the Affinity slider')
      || `${section.contentHtml ?? ''}`.includes('Tapints vagy húzd a Szimpátia sávot')
      || `${section.contentHtml ?? ''}`.includes('Cards can contain more photos and a profile detail view')
      || `${section.contentHtml ?? ''}`.includes('A kártya több képet és részletes profilt is rejthet')
      || `${section.contentHtml ?? ''}`.includes('The message window shows the channel title, message history')
      || `${section.contentHtml ?? ''}`.includes('The message window shows the channel title, history, shared items')
      || `${section.contentHtml ?? ''}`.includes('Az üzenetablakban látod a csatorna címét, az üzeneteket')
      || `${section.contentHtml ?? ''}`.includes('Az üzenetablakban látod a csatorna címét, az előzményeket')
      || `${section.contentHtml ?? ''}`.includes('You can write text, reply to a message, react with emoji')
      || `${section.contentHtml ?? ''}`.includes('Írhatsz szöveget, válaszolhatsz üzenetre')
      || `${section.contentHtml ?? ''}`.includes('Tap a message to select it. The small buttons')
      || `${section.contentHtml ?? ''}`.includes('Koppints egy üzenetre a kijelöléshez')
      || `${section.contentHtml ?? ''}`.includes('Kitűzés')
    ));
  }

  private table(): DemoHelpCenterTable {
    return this.helpCenterRepository.readTable();
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
    const revisions = this.revisionsForState(table, kind, language, context)
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

  private revisionsForState(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): HelpCenterRevision[] {
    const language = this.normalizeLang(lang);
    if (kind === 'explanation' && this.normalizeContextKey(kind, contextKey, false)) {
      return this.revisionsForKind(table, kind, language, null);
    }
    return this.revisionsForKind(table, kind, language, contextKey);
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
      imageUrls: this.normalizeImageUrls(section?.imageUrls),
      panelSpan: this.normalizePanelSpan(section?.panelSpan),
      optional: kind === 'privacy' && section?.optional === true
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
    return this.normalizeSeededImageRefsInHtml(`${value ?? ''}`)
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, '')
      .trim();
  }

  private hasLegacySeededImageSrc(value: string | null | undefined): boolean {
    const html = `${value ?? ''}`;
    return /<img\b[^>]*\bsrc\s*=\s*(["'])\s*help-seeded-image:/i.test(html)
      || /<img\b[^>]*\bdata-lazy-src\s*=\s*(["'])\s*help-seeded-image:/i.test(html)
      || /<img\b[^>]*\bsrc\s*=\s*(["'])[^"']*#lazy-src=/i.test(html);
  }

  private normalizeSeededImageRefsInHtml(value: string | null | undefined): string {
    return `${value ?? ''}`.replace(/<img\b[^>]*>/gi, tag => this.normalizeSeededImageTag(tag));
  }

  private normalizeSeededImageTag(tag: string): string {
    const srcMatch = /\ssrc\s*=\s*(["'])(.*?)\1/i.exec(tag);
    const dataLazyMatch = /\sdata-lazy-src\s*=\s*(["'])(.*?)\1/i.exec(tag);
    const lazySource = dataLazyMatch && this.isSeededHelpImageRef(dataLazyMatch[2])
      ? dataLazyMatch[2].trim()
      : srcMatch && this.isSeededHelpImageRef(srcMatch[2])
        ? srcMatch[2].trim()
        : this.seededHelpImageRefFromPlaceholder(srcMatch?.[2]);
    if (!lazySource) {
      return tag;
    }
    const nextSourceAttrs = ` src="${this.escapeHtml(this.lazyImagePlaceholderSrc(lazySource))}"`;
    const withoutLazySource = tag
      .replace(/\sdata-lazy-src\s*=\s*(["']).*?\1/gi, '')
      .replace(/\sdata-i18n-svg\s*=\s*(["']).*?\1/gi, '');
    if (!srcMatch) {
      return withoutLazySource.replace(/<img\b/i, `<img${nextSourceAttrs}`);
    }
    return withoutLazySource.replace(/\ssrc\s*=\s*(["']).*?\1/i, nextSourceAttrs);
  }

  private isSeededHelpImageRef(value: string | null | undefined): boolean {
    return `${value ?? ''}`.trim().startsWith(SEEDED_HELP_IMAGE_REF_PREFIX);
  }

  private lazyImagePlaceholderSrc(imageUrl: string): string {
    return `${LAZY_HELP_IMAGE_PLACEHOLDER_URL}#lazy-src=${encodeURIComponent(imageUrl)}`;
  }

  private seededHelpImageRefFromPlaceholder(value: string | null | undefined): string {
    const src = `${value ?? ''}`.trim();
    if (!src.startsWith(LAZY_HELP_IMAGE_PLACEHOLDER_URL)) {
      return '';
    }
    const marker = '#lazy-src=';
    const markerIndex = src.indexOf(marker);
    if (markerIndex < 0) {
      return '';
    }
    try {
      const decoded = decodeURIComponent(src.slice(markerIndex + marker.length)).trim();
      return this.isSeededHelpImageRef(decoded) ? decoded : '';
    } catch {
      return '';
    }
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

  private defaultRevision(kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): HelpCenterRevision {
    const language = this.normalizeLang(lang);
    const revisionsByLang = this.defaultRevisionsByLang(kind, contextKey);
    return this.cloneRevision(language === 'hu' ? revisionsByLang.hu : revisionsByLang.en, kind);
  }

  private defaultRevisionsByLang(
    kind: HelpCenterDocumentKind,
    contextKey?: string | null
  ): { en: HelpCenterRevision; hu: HelpCenterRevision } {
    if (kind === 'privacy') {
      return APP_STATIC_DATA.defaultPrivacyCenterRevisionsByLang;
    }
    if (kind === 'explanation') {
      const context = this.normalizeContextKey(kind, contextKey, false) ?? 'home.game';
      const revisionsByLang = APP_STATIC_DATA.defaultExplanationRevisionsByContext[
        context as keyof typeof APP_STATIC_DATA.defaultExplanationRevisionsByContext
      ];
      if (!revisionsByLang) {
        throw new Error(`No default explanation revision exists for ${context}.`);
      }
      return revisionsByLang;
    }
    return APP_STATIC_DATA.defaultHelpCenterRevisionsByLang;
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
        ? ''
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
