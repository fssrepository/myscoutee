import { APP_STATIC_DATA } from '../../../../app-static-data';
import type { HelpCenterDocumentKind, HelpCenterRevisionDto } from '../../../contracts';

export class SeedHelpCenterContentBuilder {
  static explanationBootstrapContextKeys(): string[] {
    return APP_STATIC_DATA.explainableSurfaces
      .filter(surface => surface.enabled)
      .map(surface => this.normalizeContextKey('explanation', surface.key, false))
      .filter((contextKey): contextKey is string => Boolean(contextKey));
  }

  static defaultRevision(kind: HelpCenterDocumentKind, lang = 'en', contextKey?: string | null): HelpCenterRevisionDto {
    const language = this.normalizeLang(lang);
    const revisionsByLang = this.defaultRevisionsByLang(kind, contextKey);
    return this.cloneRevision(language === 'hu' ? revisionsByLang.hu : revisionsByLang.en);
  }

  static documentLabel(kind: HelpCenterDocumentKind): string {
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

  private static defaultRevisionsByLang(
    kind: HelpCenterDocumentKind,
    contextKey?: string | null
  ): { en: HelpCenterRevisionDto; hu: HelpCenterRevisionDto } {
    if (kind === 'privacy') {
      return APP_STATIC_DATA.defaultPrivacyCenterRevisionsByLang;
    }
    if (kind === 'terms') {
      return APP_STATIC_DATA.defaultTermsCenterRevisionsByLang;
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

  private static cloneRevision(revision: HelpCenterRevisionDto): HelpCenterRevisionDto {
    return {
      ...revision,
      sections: revision.sections.map(section => ({ ...section }))
    };
  }

  private static normalizeContextKey(
    kind: HelpCenterDocumentKind,
    contextKey: string | null | undefined,
    required: boolean
  ): string | null {
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
