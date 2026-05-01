import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppMemoryDb } from '../../base/db';
import type {
  HelpCenterAuditEntry,
  HelpCenterDocumentKind,
  HelpCenterRevision,
  HelpCenterRevisionSaveRequest,
  HelpCenterSection,
  HelpCenterState
} from '../../base/models';
import { RouteDelayService } from '../../base/services/route-delay.service';
import { HELP_CENTER_TABLE_NAME, type DemoHelpCenterTable } from '../models/help-center.model';

@Injectable({
  providedIn: 'root'
})
export class DemoHelpCenterService {
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly routeDelay = inject(RouteDelayService);

  async loadState(kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const documentKind = this.normalizeKind(kind);
    const changed = this.ensureSeeded(documentKind) || this.ensureRevisionDescriptions(documentKind);
    if (changed) {
      await this.memoryDb.flushToIndexedDb();
    }
    return this.stateFromTable(this.table(), documentKind);
  }

  async saveRevision(request: HelpCenterRevisionSaveRequest, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const documentKind = this.normalizeKind(kind);
    const table = this.table();
    const nowIso = new Date().toISOString();
    const actorUserId = this.normalizeActor(request.actorUserId);
    const version = this.nextVersion(table, documentKind);
    const revisionId = this.newId(`${documentKind}-rev`);
    const revision: HelpCenterRevision = {
      id: revisionId,
      documentKind,
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
    return this.stateFromTable(this.table(), documentKind);
  }

  async activateRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const documentKind = this.normalizeKind(kind);
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
            return [id, { ...item, documentKind: itemKind, active: itemKind === documentKind ? id === normalizedRevisionId : item.active }];
          })
      ) as Record<string, HelpCenterRevision>;
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...current,
          activeRevisionId: documentKind === 'help' ? normalizedRevisionId : current.activeRevisionId,
          activeRevisionIdsByKind: {
            ...(current.activeRevisionIdsByKind ?? {}),
            [documentKind]: normalizedRevisionId
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
    return this.stateFromTable(this.table(), documentKind);
  }

  async deleteRevision(revisionId: string, actorUserId: string, kind: HelpCenterDocumentKind = 'help'): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const documentKind = this.normalizeKind(kind);
    const normalizedRevisionId = revisionId.trim();
    const table = this.table();
    const revision = table.revisionsById[normalizedRevisionId];
    if (!revision || this.revisionKind(revision) !== documentKind) {
      return this.stateFromTable(table, documentKind);
    }
    const remainingIds = table.revisionIds.filter(id => id !== normalizedRevisionId);
    const remainingRevisions = remainingIds
      .map(id => table.revisionsById[id])
      .filter((item): item is HelpCenterRevision => Boolean(item))
      .filter(item => this.revisionKind(item) === documentKind)
      .sort((left, right) => right.version - left.version);
    const currentActiveRevisionId = this.activeRevisionId(table, documentKind);
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
            return [id, { ...item, documentKind: itemKind, active: itemKind === documentKind ? id === nextActiveRevisionId : item.active }];
          })
      ) as Record<string, HelpCenterRevision>;
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...current,
          seeded: true,
          activeRevisionId: documentKind === 'help' ? nextActiveRevisionId : current.activeRevisionId,
          activeRevisionIdsByKind: {
            ...(current.activeRevisionIdsByKind ?? {}),
            [documentKind]: nextActiveRevisionId
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
    return this.stateFromTable(this.table(), documentKind);
  }

  private ensureSeeded(kind: HelpCenterDocumentKind): boolean {
    const table = this.table();
    if (this.revisionsForKind(table, kind).length > 0) {
      return false;
    }
    const revision = this.cloneRevision(this.defaultRevision(kind), kind);
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
          activeRevisionId: kind === 'help' ? revision.id : current.activeRevisionId,
          activeRevisionIdsByKind: {
            ...(current.activeRevisionIdsByKind ?? {}),
            [kind]: revision.id
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

  private ensureRevisionDescriptions(kind: HelpCenterDocumentKind): boolean {
    const table = this.table();
    const missingIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision)
        && this.revisionKind(revision) === kind
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

  private stateFromTable(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind): HelpCenterState {
    const revisions = this.revisionsForKind(table, kind)
      .map(revision => this.cloneRevision(revision, kind))
      .sort((left, right) => right.version - left.version);
    const activeRevisionId = this.activeRevisionId(table, kind);
    const activeRevision = activeRevisionId
      ? revisions.find(revision => revision.id === activeRevisionId) ?? null
      : null;
    const auditTrail = table.auditIds
      .map(id => table.auditById[id])
      .filter((entry): entry is HelpCenterAuditEntry => Boolean(entry))
      .filter(entry => this.auditKind(entry) === kind)
      .map(entry => ({ ...entry, documentKind: kind }))
      .sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));
    return {
      activeRevision: activeRevision ? this.cloneRevision(activeRevision, kind) : null,
      revisions,
      auditTrail
    };
  }

  private nextVersion(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind): number {
    const currentMax = this.revisionsForKind(table, kind)
      .map(revision => revision.version ?? 0)
      .reduce((max, version) => Math.max(max, Math.trunc(Number(version) || 0)), 0);
    return currentMax + 1;
  }

  private activeRevisionId(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind): string | null {
    if (table.activeRevisionIdsByKind && kind in table.activeRevisionIdsByKind) {
      return table.activeRevisionIdsByKind[kind] ?? null;
    }
    if (kind === 'help') {
      return table.activeRevisionId ?? null;
    }
    return this.revisionsForKind(table, kind).find(revision => revision.active)?.id ?? null;
  }

  private revisionsForKind(table: DemoHelpCenterTable, kind: HelpCenterDocumentKind): HelpCenterRevision[] {
    return table.revisionIds
      .map(id => table.revisionsById[id])
      .filter((revision): revision is HelpCenterRevision => Boolean(revision))
      .filter(revision => this.revisionKind(revision) === kind);
  }

  private normalizedRevisionsById(table: DemoHelpCenterTable): Record<string, HelpCenterRevision> {
    return Object.fromEntries(
      table.revisionIds
        .filter(id => Boolean(table.revisionsById[id]))
        .map(id => {
          const revision = table.revisionsById[id];
          return [id, { ...revision, documentKind: this.revisionKind(revision) }];
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
    return {
      ...revision,
      documentKind: kind,
      description: this.nonEmptyText(revision.description, this.defaultDescription(kind)),
      headerColor: this.normalizeHeaderColor(revision.headerColor),
      sections: this.normalizeSections(revision.sections, kind)
    };
  }

  private defaultRevision(kind: HelpCenterDocumentKind): HelpCenterRevision {
    return this.cloneRevision(
      kind === 'privacy'
        ? APP_STATIC_DATA.defaultPrivacyCenterRevision
        : APP_STATIC_DATA.defaultHelpCenterRevision,
      kind
    );
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

  private auditKind(entry: HelpCenterAuditEntry | null | undefined): HelpCenterDocumentKind {
    return this.normalizeKind(entry?.documentKind);
  }

  private normalizeKind(kind: string | null | undefined): HelpCenterDocumentKind {
    return kind === 'privacy' ? 'privacy' : 'help';
  }

  private normalizeActor(actorUserId: string): string {
    return this.nonEmptyText(actorUserId, 'admin');
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
