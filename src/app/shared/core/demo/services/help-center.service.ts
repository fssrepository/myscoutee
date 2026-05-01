import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppMemoryDb } from '../../base/db';
import type {
  HelpCenterAuditEntry,
  HelpCenterRevision,
  HelpCenterRevisionSaveRequest,
  HelpCenterSection,
  HelpCenterState
} from '../../base/models';
import { HELP_CENTER_TABLE_NAME, type DemoHelpCenterTable } from '../models/help-center.model';

@Injectable({
  providedIn: 'root'
})
export class DemoHelpCenterService {
  private readonly memoryDb = inject(AppMemoryDb);

  async loadState(): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const changed = this.ensureSeeded() || this.ensureRevisionDescriptions();
    if (changed) {
      await this.memoryDb.flushToIndexedDb();
    }
    return this.stateFromTable(this.table());
  }

  async saveRevision(request: HelpCenterRevisionSaveRequest): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const table = this.table();
    const nowIso = new Date().toISOString();
    const actorUserId = this.normalizeActor(request.actorUserId);
    const version = this.nextVersion(table);
    const revisionId = this.newId('help-rev');
    const revision: HelpCenterRevision = {
      id: revisionId,
      version,
      title: this.nonEmptyText(request.title, `Help revision v${version}`),
      summary: this.nonEmptyText(request.summary, 'What you can do in MyScoutee'),
      description: this.nonEmptyText(request.description, APP_STATIC_DATA.defaultHelpCenterDescription),
      sections: this.normalizeSections(request.sections),
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
      const nextRevisionsById = Object.fromEntries(
        current.revisionIds
          .filter(id => Boolean(current.revisionsById[id]))
          .map(id => [id, { ...current.revisionsById[id] }])
      ) as Record<string, HelpCenterRevision>;
      nextRevisionsById[revisionId] = revision;
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          seeded: true,
          activeRevisionId: current.activeRevisionId,
          revisionsById: nextRevisionsById,
          revisionIds: [...current.revisionIds.filter(id => id !== revisionId), revisionId],
          auditById: {
            ...current.auditById,
            [audit.id]: audit
          },
          auditIds: [...current.auditIds, audit.id]
        }
      };
    });
    await this.memoryDb.flushToIndexedDb();
    return this.stateFromTable(this.table());
  }

  async activateRevision(revisionId: string, actorUserId: string): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const normalizedRevisionId = revisionId.trim();
    const table = this.table();
    const revision = table.revisionsById[normalizedRevisionId];
    if (!revision) {
      throw new Error('Help revision not found.');
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
          .map(id => [id, { ...current.revisionsById[id], active: id === normalizedRevisionId }])
      ) as Record<string, HelpCenterRevision>;
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...current,
          activeRevisionId: normalizedRevisionId,
          revisionsById,
          auditById: {
            ...current.auditById,
            [audit.id]: audit
          },
          auditIds: [...current.auditIds, audit.id]
        }
      };
    });
    await this.memoryDb.flushToIndexedDb();
    return this.stateFromTable(this.table());
  }

  async deleteRevision(revisionId: string, actorUserId: string): Promise<HelpCenterState> {
    await this.memoryDb.whenReady();
    const normalizedRevisionId = revisionId.trim();
    const table = this.table();
    const revision = table.revisionsById[normalizedRevisionId];
    if (!revision) {
      return this.stateFromTable(table);
    }
    const remainingIds = table.revisionIds.filter(id => id !== normalizedRevisionId);
    const remainingRevisions = remainingIds
      .map(id => table.revisionsById[id])
      .filter((item): item is HelpCenterRevision => Boolean(item))
      .sort((left, right) => right.version - left.version);
    const nextActiveRevisionId = table.activeRevisionId === normalizedRevisionId
      ? (remainingRevisions[0]?.id ?? null)
      : table.activeRevisionId;
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
          .map(id => [id, { ...revisionsById[id], active: id === nextActiveRevisionId }])
      ) as Record<string, HelpCenterRevision>;
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          seeded: true,
          activeRevisionId: nextActiveRevisionId,
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
    await this.memoryDb.flushToIndexedDb();
    return this.stateFromTable(this.table());
  }

  private ensureSeeded(): boolean {
    const table = this.table();
    if (table.seeded || table.revisionIds.length > 0 || table.auditIds.length > 0) {
      return false;
    }
    const revision = this.cloneRevision(APP_STATIC_DATA.defaultHelpCenterRevision);
    const audit = this.auditEntry({
      action: 'seed',
      actorUserId: 'system',
      revision,
      message: 'Seeded default help revision v1.'
    });
    this.memoryDb.write(state => ({
      ...state,
      [HELP_CENTER_TABLE_NAME]: {
        seeded: true,
        activeRevisionId: revision.id,
        revisionsById: {
          [revision.id]: revision
        },
        revisionIds: [revision.id],
        auditById: {
          [audit.id]: audit
        },
        auditIds: [audit.id]
      }
    }));
    return true;
  }

  private ensureRevisionDescriptions(): boolean {
    const table = this.table();
    const missingIds = table.revisionIds.filter(id => {
      const revision = table.revisionsById[id] as HelpCenterRevision | undefined;
      return Boolean(revision) && !this.nonEmptyText(revision?.description, '');
    });
    if (missingIds.length === 0) {
      return false;
    }
    this.memoryDb.write(state => {
      const current = state[HELP_CENTER_TABLE_NAME];
      const revisionsById = { ...current.revisionsById };
      for (const id of missingIds) {
        const revision = revisionsById[id];
        if (revision) {
          revisionsById[id] = {
            ...revision,
            description: APP_STATIC_DATA.defaultHelpCenterDescription
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

  private stateFromTable(table: DemoHelpCenterTable): HelpCenterState {
    const revisions = table.revisionIds
      .map(id => table.revisionsById[id])
      .filter((revision): revision is HelpCenterRevision => Boolean(revision))
      .map(revision => this.cloneRevision(revision))
      .sort((left, right) => right.version - left.version);
    const activeRevision = table.activeRevisionId
      ? revisions.find(revision => revision.id === table.activeRevisionId) ?? null
      : null;
    const auditTrail = table.auditIds
      .map(id => table.auditById[id])
      .filter((entry): entry is HelpCenterAuditEntry => Boolean(entry))
      .map(entry => ({ ...entry }))
      .sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso));
    return {
      activeRevision: activeRevision ? this.cloneRevision(activeRevision) : null,
      revisions,
      auditTrail
    };
  }

  private nextVersion(table: DemoHelpCenterTable): number {
    const currentMax = table.revisionIds
      .map(id => table.revisionsById[id]?.version ?? 0)
      .reduce((max, version) => Math.max(max, Math.trunc(Number(version) || 0)), 0);
    return currentMax + 1;
  }

  private auditEntry(options: {
    action: HelpCenterAuditEntry['action'];
    actorUserId: string;
    revision: HelpCenterRevision;
    message: string;
  }): HelpCenterAuditEntry {
    return {
      id: this.newId('help-audit'),
      revisionId: options.revision.id,
      version: options.revision.version,
      action: options.action,
      actorUserId: this.normalizeActor(options.actorUserId),
      createdAtIso: new Date().toISOString(),
      message: options.message
    };
  }

  private normalizeSections(sections: readonly HelpCenterSection[]): HelpCenterSection[] {
    const seenIds = new Set<string>();
    return (Array.isArray(sections) ? sections : [])
      .map((section, index) => this.normalizeSection(section, index, seenIds))
      .filter((section): section is HelpCenterSection => section !== null);
  }

  private normalizeSection(
    section: HelpCenterSection,
    index: number,
    seenIds: Set<string>
  ): HelpCenterSection | null {
    const title = this.nonEmptyText(section?.title, `Help section ${index + 1}`);
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
      icon: this.nonEmptyText(section?.icon, 'help_outline'),
      title,
      blurb: this.nonEmptyText(section?.blurb, ''),
      contentHtml
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

  private cloneRevision(revision: HelpCenterRevision): HelpCenterRevision {
    return {
      ...revision,
      description: this.nonEmptyText(revision.description, APP_STATIC_DATA.defaultHelpCenterDescription),
      sections: this.normalizeSections(revision.sections)
    };
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
