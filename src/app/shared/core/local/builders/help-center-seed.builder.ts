import { APP_STATIC_DATA } from '../../../app-static-data';
import type { HelpCenterDocumentKind, HelpCenterRevision } from '../../base/models';

export class LocalHelpCenterSeedBuilder {
  static explanationBootstrapContextKeys(): string[] {
    return APP_STATIC_DATA.explainableSurfaces
      .filter(surface => surface.enabled)
      .map(surface => this.normalizeContextKey('explanation', surface.key, false))
      .filter((contextKey): contextKey is string => Boolean(contextKey));
  }

  static defaultRevision(kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): HelpCenterRevision {
    const language = this.normalizeLang(lang);
    const revisionsByLang = this.defaultRevisionsByLang(kind, contextKey);
    return this.cloneRevision(language === 'hu' ? revisionsByLang.hu : revisionsByLang.en);
  }

  static defaultTitle(kind: HelpCenterDocumentKind, version: number, lang = 'en'): string {
    if (this.normalizeLang(lang) === 'hu') {
      return kind === 'privacy'
        ? `Adatvédelmi verzió v${version}`
        : kind === 'explanation'
          ? `Magyarázat verzió v${version}`
          : `Súgó verzió v${version}`;
    }
    return `${this.documentLabel(kind)} revision v${version}`;
  }

  static defaultSummary(kind: HelpCenterDocumentKind, lang = 'en'): string {
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

  static defaultDescription(kind: HelpCenterDocumentKind, lang = 'en'): string {
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

  static documentLabel(kind: HelpCenterDocumentKind): string {
    switch (kind) {
      case 'privacy':
        return 'Privacy';
      case 'explanation':
        return 'Explanation';
      default:
        return 'Help';
    }
  }

  static defaultSectionIcon(kind: HelpCenterDocumentKind): string {
    switch (kind) {
      case 'privacy':
        return 'policy';
      case 'explanation':
        return 'tips_and_updates';
      default:
        return 'help_outline';
    }
  }

  private static defaultRevisionsByLang(
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

  private static cloneRevision(revision: HelpCenterRevision): HelpCenterRevision {
    return {
      ...revision,
      sections: revision.sections.map(section => ({ ...section }))
    };
  }

  private static normalizeContextKey(kind: HelpCenterDocumentKind, contextKey: string | null | undefined, required: boolean): string | null {
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

  private static normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return normalized === 'hu' ? 'hu' : 'en';
  }
}
