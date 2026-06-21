import type {
  HelpCenterAuditRecord,
  HelpCenterRevisionRecord,
  HelpCenterTable,
  PrivacyConsentLocalRecord
} from '../entity/content.entity';
import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../../app-static-data';
import type {
  HelpCenterAuditEntryDto,
  HelpCenterDocumentKind,
  HelpCenterRevisionDto,
  HelpCenterRevisionSaveRequestDto,
  HelpCenterSectionDto,
  HelpCenterStateDto,
  PrivacyConsentDto,
  PrivacyConsentSaveRequestDto
} from '../../../contracts';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { HelpCenterContentBuilder } from '../../../base/builders';

import { LocalHelpCenterRepository } from '../repositories/help-center.repository';
import { LocalHelpCenterMapper } from '../mappers';

const SEEDED_HELP_IMAGE_REF_PREFIX = 'help-seeded-image:';
const LAZY_HELP_IMAGE_PLACEHOLDER_URL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

@Injectable({
  providedIn: 'root'
})
export class LocalHelpCenterService {
  private readonly helpCenterRepository = inject(LocalHelpCenterRepository);
  private readonly routeDelay = inject(RouteDelayService);

  async loadState(kind: HelpCenterDocumentKind = 'help', lang?: string | null, contextKey?: string | null): Promise<HelpCenterStateDto> {
    const documentKind = this.normalizeKind(kind);
    const language = this.requestContentLang(lang);
    const context = this.normalizeContextKey(documentKind, contextKey, false);
    await Promise.all([
      this.helpCenterRepository.whenReady(),
      this.routeDelay.waitForRouteDelay(`/${documentKind}/active`)
    ]);
    const table = this.table();
    this.assertBootstrappedState(table, documentKind, language, context);
    return this.stateFromTable(table, documentKind, language, context);
  }

  async loadAdminState(
    _adminUserId: string,
    kind: HelpCenterDocumentKind = 'help',
    lang = 'en',
    contextKey?: string | null
  ): Promise<HelpCenterStateDto> {
    const documentKind = this.normalizeKind(kind);
    const language = this.normalizeLang(lang);
    const context = this.normalizeContextKey(documentKind, contextKey, false);
    await Promise.all([
      this.helpCenterRepository.whenReady(),
      this.routeDelay.waitForRouteDelay(this.adminRoute(documentKind))
    ]);
    const table = this.table();
    this.assertBootstrappedState(table, documentKind, language, context);
    return this.stateFromTable(table, documentKind, language, context);
  }

  async loadPrivacyConsent(
    userId: string,
    revisionId: string,
    revisionVersion?: number
  ): Promise<PrivacyConsentDto | null> {
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
      return LocalHelpCenterMapper.toPrivacyConsentDTO(consent);
    }
    return this.latestPrivacyConsentForUser(table, normalizedUserId);
  }

  async savePrivacyConsent(request: PrivacyConsentSaveRequestDto): Promise<PrivacyConsentDto> {
    await this.helpCenterRepository.whenReady();
    const userId = this.nonEmptyText(request?.userId, '');
    const revisionId = this.nonEmptyText(request?.revisionId, '');
    if (!userId || !revisionId) {
      throw new Error('A user and privacy revision are required to save consent.');
    }
    const table = this.table();
    const revision = table.revisionsById[revisionId];
    const revisionDto = revision ? LocalHelpCenterMapper.toRevisionDTO(revision) : null;
    if (!revisionDto || this.revisionKind(revisionDto) !== 'privacy') {
      throw new Error('Privacy revision not found.');
    }
    const id = this.privacyConsentRecordId(userId, revisionId);
    const current = table.privacyConsentsById?.[id] ?? null;
    const nowIso = new Date().toISOString();
    const revisionVersion = Math.max(1, Math.trunc(Number(revisionDto.version || request?.revisionVersion) || 1));
    const currentRevisionVersion = Math.max(0, Math.trunc(Number(current?.revisionVersion) || 0));
    const consent = LocalHelpCenterMapper.toPrivacyConsentRecord({
      id,
      userId,
      revisionId,
      revisionVersion,
      approvedOptionalSectionIds: this.approvedOptionalSectionIds(request?.approvedOptionalSectionIds, revisionDto),
      acceptedAtIso: currentRevisionVersion >= revisionVersion && current?.acceptedAtIso ? current.acceptedAtIso : nowIso,
      updatedAtIso: nowIso,
      source: this.normalizeConsentSource(request?.source)
    });
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
      this.routeDelay.waitForRouteDelay('/privacy/consents')
    ]);
    return LocalHelpCenterMapper.toPrivacyConsentDTO(consent);
  }

  async saveRevision(request: HelpCenterRevisionSaveRequestDto, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterStateDto> {
    await this.helpCenterRepository.whenReady();
    const documentKind = this.normalizeKind(kind);
    const language = this.normalizeLang(request?.lang);
    const contextKey = this.normalizeContextKey(documentKind, request?.contextKey, true);
    const table = this.table();
    const nowIso = new Date().toISOString();
    const actorUserId = this.normalizeActor(request.actorUserId);
    const version = this.nextVersion(table, documentKind, language, contextKey);
    const revisionId = this.newId(`${documentKind}-rev`);
    const revision: HelpCenterRevisionDto = {
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
          [revisionId]: LocalHelpCenterMapper.toRevisionRecord(revision)
        },
        revisionIds: [...current.revisionIds.filter(id => id !== revisionId), revisionId],
        auditById: {
          ...current.auditById,
          [audit.id]: LocalHelpCenterMapper.toAuditRecord(audit)
        },
        auditIds: [...current.auditIds, audit.id]
      };
    });
    await Promise.all([
      this.helpCenterRepository.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay(`/admin/${documentKind}/revisions`)
    ]);
    return this.stateFromTable(this.table(), documentKind, language, contextKey);
  }

  async activateRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterStateDto> {
    await this.helpCenterRepository.whenReady();
    const documentKind = this.normalizeKind(kind);
    const language = this.normalizeLang(this.table().revisionsById[revisionId.trim()]?.lang);
    const normalizedRevisionId = revisionId.trim();
    const table = this.table();
    const revision = table.revisionsById[normalizedRevisionId];
    const revisionDto = revision ? LocalHelpCenterMapper.toRevisionDTO(revision) : null;
    if (!revisionDto || this.revisionKind(revisionDto) !== documentKind) {
      throw new Error(`${this.documentLabel(documentKind)} revision not found.`);
    }
    const contextKey = this.revisionContextKey(revisionDto);
    const audit = this.auditEntry({
      action: 'activate',
      actorUserId: this.normalizeActor(actorUserId),
      revision: revisionDto,
      message: `Activated v${revisionDto.version}.`
    });
    this.helpCenterRepository.updateTable(current => {
      const revisionsById = Object.fromEntries(
        current.revisionIds
          .filter(id => Boolean(current.revisionsById[id]))
          .map(id => {
            const item = LocalHelpCenterMapper.toRevisionDTO(current.revisionsById[id]);
            const itemKind = this.revisionKind(item);
            const itemLang = this.revisionLang(item);
            const itemContext = this.revisionContextKey(item);
            return [id, LocalHelpCenterMapper.toRevisionRecord({
              ...item,
              documentKind: itemKind,
              contextKey: itemContext,
              lang: itemLang,
              languageLabel: this.languageLabel(itemLang),
              active: itemKind === documentKind && itemLang === language && itemContext === contextKey
                ? id === normalizedRevisionId
                : item.active
            })];
          })
      ) as Record<string, HelpCenterRevisionRecord>;
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
          [audit.id]: LocalHelpCenterMapper.toAuditRecord(audit)
        },
        auditIds: [...current.auditIds, audit.id]
      };
    });
    await Promise.all([
      this.helpCenterRepository.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay(`/admin/${documentKind}/revisions/activate`)
    ]);
    return this.stateFromTable(this.table(), documentKind, language, contextKey);
  }

  async deleteRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterStateDto> {
    await this.helpCenterRepository.whenReady();
    const documentKind = this.normalizeKind(kind);
    const normalizedRevisionId = revisionId.trim();
    const table = this.table();
    const revision = table.revisionsById[normalizedRevisionId];
    const revisionDto = revision ? LocalHelpCenterMapper.toRevisionDTO(revision) : null;
    const language = this.normalizeLang(revisionDto?.lang);
    const contextKey = this.revisionContextKey(revisionDto);
    if (!revisionDto || this.revisionKind(revisionDto) !== documentKind) {
      return this.stateFromTable(table, documentKind);
    }
    const remainingIds = table.revisionIds.filter(id => id !== normalizedRevisionId);
    const remainingRevisions = remainingIds
      .map(id => table.revisionsById[id])
      .filter((item): item is HelpCenterRevisionRecord => Boolean(item))
      .map(item => LocalHelpCenterMapper.toRevisionDTO(item))
      .filter(item => this.revisionKind(item) === documentKind && this.revisionLang(item) === language && this.revisionContextKey(item) === contextKey)
      .sort((left, right) => right.version - left.version);
    const currentActiveRevisionId = this.activeRevisionId(table, documentKind, language, contextKey);
    const nextActiveRevisionId = currentActiveRevisionId === normalizedRevisionId
      ? (remainingRevisions[0]?.id ?? null)
      : currentActiveRevisionId;
    const audit = this.auditEntry({
      action: 'delete',
      actorUserId: this.normalizeActor(actorUserId),
      revision: revisionDto,
      message: `Deleted v${revisionDto.version}.`
    });

    this.helpCenterRepository.updateTable(current => {
      const { [normalizedRevisionId]: _removed, ...revisionsById } = current.revisionsById;
      const normalizedRevisionsById = Object.fromEntries(
        remainingIds
          .filter(id => Boolean(revisionsById[id]))
          .map(id => {
            const item = LocalHelpCenterMapper.toRevisionDTO(revisionsById[id]);
            const itemKind = this.revisionKind(item);
            const itemLang = this.revisionLang(item);
            const itemContext = this.revisionContextKey(item);
            return [id, LocalHelpCenterMapper.toRevisionRecord({
              ...item,
              documentKind: itemKind,
              contextKey: itemContext,
              lang: itemLang,
              languageLabel: this.languageLabel(itemLang),
              active: itemKind === documentKind && itemLang === language && itemContext === contextKey
                ? id === nextActiveRevisionId
                : item.active
            })];
          })
      ) as Record<string, HelpCenterRevisionRecord>;
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
          [audit.id]: LocalHelpCenterMapper.toAuditRecord(audit)
        },
        auditIds: [...current.auditIds, audit.id]
      };
    });
    await Promise.all([
      this.helpCenterRepository.flushToIndexedDb(),
      this.routeDelay.waitForRouteDelay(`/admin/${documentKind}/revisions/delete`)
    ]);
    return this.stateFromTable(this.table(), documentKind, language, contextKey);
  }

  private assertBootstrappedState(
    table: HelpCenterTable,
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

  private latestRevision(revisions: readonly HelpCenterRevisionDto[]): HelpCenterRevisionDto | null {
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

  private table(): HelpCenterTable {
    return this.helpCenterRepository.readTable();
  }

  private privacyConsentRecordId(userId: string, revisionId: string): string {
    return `${userId.trim()}::${revisionId.trim()}`;
  }

  private latestPrivacyConsentForUser(table: HelpCenterTable, userId: string): PrivacyConsentDto | null {
    const consentsById = table.privacyConsentsById ?? {};
    const latest = Object.values(consentsById)
      .filter(consent => consent?.userId?.trim() === userId)
      .sort((left, right) => this.privacyConsentSortValue(right) - this.privacyConsentSortValue(left))[0] ?? null;
    return latest ? LocalHelpCenterMapper.toPrivacyConsentDTO(latest) : null;
  }

  private privacyConsentSortValue(consent: PrivacyConsentDto | PrivacyConsentLocalRecord): number {
    const updatedAtMs = Date.parse(consent.updatedAtIso || consent.acceptedAtIso || '');
    if (Number.isFinite(updatedAtMs)) {
      return updatedAtMs;
    }
    return Math.max(0, Math.trunc(Number(consent.revisionVersion) || 0));
  }

  private approvedOptionalSectionIds(
    approvedSectionIds: readonly string[] | null | undefined,
    revision: HelpCenterRevisionDto
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

  private stateFromTable(table: HelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): HelpCenterStateDto {
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
      .filter((entry): entry is HelpCenterAuditRecord => Boolean(entry))
      .map(entry => LocalHelpCenterMapper.toAuditDTO(entry))
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

  private revisionsForState(table: HelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): HelpCenterRevisionDto[] {
    const language = this.normalizeLang(lang);
    if (kind === 'explanation' && this.normalizeContextKey(kind, contextKey, false)) {
      return this.revisionsForKind(table, kind, language, null);
    }
    return this.revisionsForKind(table, kind, language, contextKey);
  }

  private nextVersion(table: HelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): number {
    const currentMax = this.revisionsForKind(table, kind, this.normalizeLang(lang), this.normalizeContextKey(kind, contextKey, false))
      .map(revision => revision.version ?? 0)
      .reduce((max, version) => Math.max(max, Math.trunc(Number(version) || 0)), 0);
    return currentMax + 1;
  }

  private activeRevisionId(table: HelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): string | null {
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

  private revisionsForKind(table: HelpCenterTable, kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): HelpCenterRevisionDto[] {
    const language = this.normalizeLang(lang);
    const context = this.normalizeContextKey(kind, contextKey, false);
    return table.revisionIds
      .map(id => table.revisionsById[id])
      .filter((revision): revision is HelpCenterRevisionRecord => Boolean(revision))
      .map(revision => LocalHelpCenterMapper.toRevisionDTO(revision))
      .filter(revision => this.revisionKind(revision) === kind && this.revisionLang(revision) === language)
      .filter(revision => kind !== 'explanation' || !context || this.revisionContextKey(revision) === context);
  }

  private normalizedRevisionsById(table: HelpCenterTable): Record<string, HelpCenterRevisionRecord> {
    return Object.fromEntries(
      table.revisionIds
        .filter(id => Boolean(table.revisionsById[id]))
        .map(id => {
          const revision = LocalHelpCenterMapper.toRevisionDTO(table.revisionsById[id]);
          const lang = this.revisionLang(revision);
          return [id, LocalHelpCenterMapper.toRevisionRecord({
            ...revision,
            documentKind: this.revisionKind(revision),
            contextKey: this.revisionContextKey(revision),
            lang,
            languageLabel: this.languageLabel(lang)
          })];
        })
    ) as Record<string, HelpCenterRevisionRecord>;
  }

  private auditEntry(options: {
    action: HelpCenterAuditEntryDto['action'];
    actorUserId: string;
    revision: HelpCenterRevisionDto;
    message: string;
  }): HelpCenterAuditEntryDto {
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

  private normalizeSections(sections: readonly HelpCenterSectionDto[], kind: HelpCenterDocumentKind): HelpCenterSectionDto[] {
    const seenIds = new Set<string>();
    return (Array.isArray(sections) ? sections : [])
      .map((section, index) => this.normalizeSection(section, index, seenIds, kind))
      .filter((section): section is HelpCenterSectionDto => section !== null);
  }

  private normalizeSection(
    section: HelpCenterSectionDto,
    index: number,
    seenIds: Set<string>,
    kind: HelpCenterDocumentKind
  ): HelpCenterSectionDto | null {
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

  private normalizePanelSpan(value: string | null | undefined): HelpCenterSectionDto['panelSpan'] {
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

  private htmlFromLegacySection(section: HelpCenterSectionDto | null | undefined): string {
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

  private cloneRevision(revision: HelpCenterRevisionDto, kind = this.revisionKind(revision)): HelpCenterRevisionDto {
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

  private defaultRevision(kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): HelpCenterRevisionDto {
    return this.cloneRevision(HelpCenterContentBuilder.defaultRevision(kind, lang, contextKey), kind);
  }

  private defaultTitle(kind: HelpCenterDocumentKind, version: number, lang = 'en'): string {
    return HelpCenterContentBuilder.defaultTitle(kind, version, lang);
  }

  private defaultSummary(kind: HelpCenterDocumentKind, lang = 'en'): string {
    return HelpCenterContentBuilder.defaultSummary(kind, lang);
  }

  private defaultDescription(kind: HelpCenterDocumentKind, lang = 'en'): string {
    return HelpCenterContentBuilder.defaultDescription(kind, lang);
  }

  private normalizeHeaderColor(value: string | null | undefined): HelpCenterRevisionDto['headerColor'] {
    switch (`${value ?? ''}`.trim()) {
      case 'blue':
      case 'green':
      case 'rose':
      case 'violet':
      case 'slate':
        return value as HelpCenterRevisionDto['headerColor'];
      default:
        return 'amber';
    }
  }

  private documentLabel(kind: HelpCenterDocumentKind): string {
    return HelpCenterContentBuilder.documentLabel(kind);
  }

  private defaultSectionIcon(kind: HelpCenterDocumentKind): string {
    return HelpCenterContentBuilder.defaultSectionIcon(kind);
  }

  private revisionKind(revision: HelpCenterRevisionDto | null | undefined): HelpCenterDocumentKind {
    return this.normalizeKind(revision?.documentKind);
  }

  private revisionLang(revision: HelpCenterRevisionDto | null | undefined): string {
    return this.normalizeLang(revision?.lang);
  }

  private auditKind(entry: HelpCenterAuditEntryDto | null | undefined): HelpCenterDocumentKind {
    return this.normalizeKind(entry?.documentKind);
  }

  private normalizeKind(kind: string | null | undefined): HelpCenterDocumentKind {
    if (kind === 'privacy' || kind === 'terms' || kind === 'explanation') {
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

  private revisionContextKey(revision: HelpCenterRevisionDto | null | undefined): string | null {
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

  private adminRoute(kind: HelpCenterDocumentKind): string {
    return `/admin/${kind}`;
  }

  private normalizeActor(actorUserId: string): string {
    return this.nonEmptyText(actorUserId, 'admin');
  }

  private normalizeConsentSource(source: string | null | undefined): PrivacyConsentDto['source'] {
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
