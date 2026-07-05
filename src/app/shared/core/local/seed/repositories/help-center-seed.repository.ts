import { HELP_CENTER_TABLE_NAME } from '../../source/entity/content.entity';
import type {
  HelpCenterRevisionRecord,
  HelpCenterTable
} from '../../source/entity/content.entity';
import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../../app-static-data';
import { LocalMemoryDb } from '../../../common/app.db';

import type { HelpCenterAuditEntryDto, HelpCenterDocumentKind, HelpCenterRevisionDto } from '../../../contracts';
import { LocalHelpCenterMapper } from '../../source/mappers';
import { SeedHelpCenterContentBuilder } from '../builders';

@Injectable({
  providedIn: 'root'
})
export class SeedHelpCenterRepository {
  private readonly memoryDb = inject(LocalMemoryDb);

  async seedDefaults(): Promise<boolean> {
    await this.memoryDb.whenReady();
    let changed = false;
    for (const option of this.availableLanguages()) {
      const language = option.lang;
      changed = this.ensureSeeded('help', language) || changed;
      changed = this.ensureSeeded('privacy', language) || changed;
      changed = this.ensureSeeded('terms', language) || changed;
      for (const contextKey of SeedHelpCenterContentBuilder.explanationBootstrapContextKeys()) {
        changed = this.ensureSeeded('explanation', language, contextKey) || changed;
      }
    }
    if (changed) {
      await this.memoryDb.flushToIndexedDb();
    }
    return changed;
  }

  private ensureSeeded(kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): boolean {
    const table = this.memoryDb.read()[HELP_CENTER_TABLE_NAME];
    const language = this.normalizeLang(lang);
    const context = this.normalizeContextKey(kind, contextKey);
    const existingRevisions = this.revisionsForKind(table, kind, language, context);
    if (existingRevisions.length > 0) {
      return this.ensureActiveRevision(table, kind, language, context, existingRevisions);
    }

    const revision = this.cloneRevision(SeedHelpCenterContentBuilder.defaultRevision(kind, language, context), kind);
    const revisionContextKey = this.revisionContextKey(revision);
    const audit = this.auditEntry({
      action: 'seed',
      actorUserId: 'system',
      revision,
      message: `Seeded default ${SeedHelpCenterContentBuilder.documentLabel(kind).toLowerCase()} revision v${revision.version}.`
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
            [this.activeRevisionKey(kind, language, revisionContextKey)]: revision.id
          },
          revisionsById: {
            ...this.normalizedRevisionsById(current),
            [revision.id]: LocalHelpCenterMapper.toRecord(revision)
          },
          revisionIds: [...current.revisionIds.filter(id => id !== revision.id), revision.id],
          auditById: {
            ...current.auditById,
            [audit.id]: LocalHelpCenterMapper.toRecord(audit)
          },
          auditIds: [...current.auditIds, audit.id]
        }
      };
    });
    return true;
  }

  private ensureActiveRevision(
    table: HelpCenterTable,
    kind: HelpCenterDocumentKind,
    lang: string,
    contextKey: string | null,
    revisions: readonly HelpCenterRevisionDto[]
  ): boolean {
    const activeKey = this.activeRevisionKey(kind, lang, contextKey);
    const activeRevisionId = table.activeRevisionIdsByKind?.[activeKey] ?? null;
    if (activeRevisionId && table.revisionsById[activeRevisionId]) {
      return false;
    }
    const activeRevision = revisions.find(revision => revision.active) ?? revisions[0] ?? null;
    if (!activeRevision) {
      return false;
    }
    this.memoryDb.write(state => {
      const current = state[HELP_CENTER_TABLE_NAME];
      return {
        ...state,
        [HELP_CENTER_TABLE_NAME]: {
          ...current,
          seeded: current.seeded || kind === 'help',
          seededKinds: { ...(current.seededKinds ?? {}), [kind]: true },
          activeRevisionId: kind === 'help' && lang === 'en' ? activeRevision.id : current.activeRevisionId,
          activeRevisionIdsByKind: {
            ...(current.activeRevisionIdsByKind ?? {}),
            [activeKey]: activeRevision.id
          }
        }
      };
    });
    return true;
  }

  private revisionsForKind(
    table: HelpCenterTable,
    kind: HelpCenterDocumentKind,
    lang = 'en',
    contextKey?: string | null
  ): HelpCenterRevisionDto[] {
    const language = this.normalizeLang(lang);
    const context = this.normalizeContextKey(kind, contextKey);
    return table.revisionIds
      .map(id => table.revisionsById[id])
      .filter((revision): revision is HelpCenterRevisionRecord => Boolean(revision))
      .map(revision => LocalHelpCenterMapper.toDto(revision))
      .filter(revision => this.revisionKind(revision) === kind && this.revisionLang(revision) === language)
      .filter(revision => kind !== 'explanation' || !context || this.revisionContextKey(revision) === context);
  }

  private normalizedRevisionsById(table: HelpCenterTable): Record<string, HelpCenterRevisionRecord> {
    return Object.fromEntries(
      table.revisionIds
        .filter(id => Boolean(table.revisionsById[id]))
        .map(id => {
          const revision = LocalHelpCenterMapper.toDto(table.revisionsById[id]!);
          const lang = this.revisionLang(revision);
          return [id, LocalHelpCenterMapper.toRecord({
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
      id: `${documentKind}-audit-${options.revision.id}`,
      documentKind,
      lang: this.revisionLang(options.revision),
      languageLabel: this.languageLabel(this.revisionLang(options.revision)),
      revisionId: options.revision.id,
      version: options.revision.version,
      action: options.action,
      actorUserId: options.actorUserId.trim() || 'system',
      createdAtIso: new Date().toISOString(),
      message: options.message
    };
  }

  private cloneRevision(revision: HelpCenterRevisionDto, kind = this.revisionKind(revision)): HelpCenterRevisionDto {
    const lang = this.revisionLang(revision);
    return {
      ...revision,
      documentKind: kind,
      contextKey: this.revisionContextKey(revision),
      lang,
      languageLabel: this.languageLabel(lang),
      sections: (revision.sections ?? []).map(section => ({
        ...section,
        imageUrls: [...(section.imageUrls ?? [])],
        details: [...(section.details ?? [])],
        points: [...(section.points ?? [])]
      }))
    };
  }

  private revisionKind(revision: HelpCenterRevisionDto | null | undefined): HelpCenterDocumentKind {
    const kind = revision?.documentKind;
    if (kind === 'privacy' || kind === 'terms' || kind === 'explanation') {
      return kind;
    }
    return 'help';
  }

  private revisionLang(revision: HelpCenterRevisionDto | null | undefined): string {
    return this.normalizeLang(revision?.lang);
  }

  private revisionContextKey(revision: HelpCenterRevisionDto | null | undefined): string | null {
    return this.normalizeContextKey(this.revisionKind(revision), revision?.contextKey);
  }

  private normalizeContextKey(kind: HelpCenterDocumentKind, contextKey: string | null | undefined): string | null {
    if (kind !== 'explanation') {
      return null;
    }
    const normalized = `${contextKey ?? ''}`.trim();
    const match = APP_STATIC_DATA.explainableSurfaces.find(surface => surface.enabled && surface.key === normalized);
    return match?.key ?? null;
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

  private activeRevisionKey(kind: HelpCenterDocumentKind, lang: string, contextKey?: string | null): string {
    const context = this.normalizeContextKey(kind, contextKey);
    return context ? `${kind}:${this.normalizeLang(lang)}:${context}` : `${kind}:${this.normalizeLang(lang)}`;
  }
}
