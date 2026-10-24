import type { HelpCenterDocumentKind } from '../../../../contracts/content/content.interface';
import type { HelpCenterGuideFieldDto } from '../../../../contracts/content/content.interface';
import type { HelpCenterRevisionDto } from '../../../../contracts/content/content.interface';
import SUPPORTED_CONTENT_LANGUAGES from '../../../../common/content-languages.json';
import GUIDE_VERSIONS from '../../data/help-center-guide-versions.json';
import { APP_STATIC_DATA } from '../../../../common/app-static-data';

import GUIDE_FIELDS_BY_PAGE from '../../data/help-center-guide-fields.json';

const GUIDE_FIELDS_BY_SCREEN = GUIDE_FIELDS_BY_PAGE as Record<string, HelpCenterGuideFieldDto[]>;

export class SeedHelpCenterContentBuilder {
  static explanationBootstrapContextKeys(): string[] {
    return APP_STATIC_DATA.explainableSurfaces
      .filter(surface => surface.enabled)
      .map(surface => this.normalizeContextKey('explanation', surface.key, false))
      .filter((contextKey): contextKey is string => Boolean(contextKey));
  }

  static defaultRevision(
    kind: HelpCenterDocumentKind,
    lang = 'en',
    contextKey?: string | null,
    translate: (key: string) => string = key => key
  ): HelpCenterRevisionDto {
    const language = this.normalizeLang(lang);
    const context = this.normalizeContextKey(kind, contextKey, false);
    if (kind === 'explanation' && context) {
      return this.explanationTourRevision(context, language, translate);
    }
    const revisionsByLang = this.defaultRevisionsByLang(kind, contextKey);
    const revision = this.cloneRevision(language === 'hu' ? revisionsByLang.hu : revisionsByLang.en);
    if (language === 'en' || language === 'hu') return revision;
    return { ...revision, id: revision.id.replace(/-v(\d+)$/, `-${language}-v$1`), lang: language,
      languageLabel: SUPPORTED_CONTENT_LANGUAGES.find(item => item.lang === language)!.label,
      title: translate(revision.title), summary: translate(revision.summary), description: translate(revision.description),
      sections: revision.sections.map(section => ({ ...section, title: translate(section.title),
        blurb: translate(section.blurb), contentHtml: translate(section.contentHtml) })) };

  }

  private static explanationTourRevision(
    context: string,
    lang: string,
    translate: (key: string) => string
  ): HelpCenterRevisionDto {
    const original = this.explanationRevision(context, lang, translate);
    const fields = GUIDE_FIELDS_BY_SCREEN[context] ?? [];
    if (!fields.length) throw new Error(`No guide fields are seeded for ${context}.`);
    const version = (GUIDE_VERSIONS as Record<string, number>)[context] ?? 4;
    return {
      ...original,
      isSystem: APP_STATIC_DATA.explainableSurfaces.some(surface => surface.key === context && surface.isSystem),
      id: original.id.replace(/v\d+$/, `v${version}`),
      version,
      presentation: 'tour',
      title: context === 'activities.rates' ? translate('guide.activities.rates.title') : original.title,
      sections: fields.map(field => ({
        id: `guide-${field.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        guideStepId: field.id,
        icon: field.group === 'card' ? 'touch_app' : field.group === 'popup' ? 'close' : 'help_outline',
        title: translate(`${field.i18nKey}.label`),
        blurb: '',
        contentHtml: `<p>${this.escapeHtml(translate(`${field.i18nKey}.description`))}</p>`
      }))
    };
  }

  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      return {
        en: this.explanationRevision(context, 'en', key => key),
        hu: this.explanationRevision(context, 'hu', key => key)
      };
    }
    return APP_STATIC_DATA.defaultHelpCenterRevisionsByLang;
  }

  private static explanationRevision(
    context: string,
    lang: string,
    translate: (key: string) => string
  ): HelpCenterRevisionDto {
    const configured = context === 'activities.rates'
      ? APP_STATIC_DATA.legacyActivityRatesRevisionsByLang
      : APP_STATIC_DATA.defaultExplanationRevisionsByContext[
        context as keyof typeof APP_STATIC_DATA.defaultExplanationRevisionsByContext
      ];
    const language = this.normalizeLang(lang);
    if (configured && (language === 'en' || language === 'hu')) {
      return this.cloneRevision(language === 'hu' ? configured.hu : configured.en);
    }

    const base = APP_STATIC_DATA.defaultExplanationHomeRevisionsByLang[language === 'hu' ? 'hu' : 'en'];
    const translationKey = `guide.context.${context}`;
    return {
      ...this.cloneRevision(base),
      id: `explanation-${context.replace(/[^a-z0-9]+/gi, '-')}-default-${language}-v1`,
      contextKey: context,
      lang: language,
      languageLabel: SUPPORTED_CONTENT_LANGUAGES.find(item => item.lang === language)!.label,
      title: translate(`${translationKey}.title`),
      summary: translate(`${translationKey}.summary`),
      description: translate(`${translationKey}.description`),
      sections: []
    };
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
    return SUPPORTED_CONTENT_LANGUAGES.some(item => item.lang === normalized) ? normalized : 'en';
  }
}
