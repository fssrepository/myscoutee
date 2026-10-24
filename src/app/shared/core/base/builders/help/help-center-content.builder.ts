import type { HelpCenterSectionDto } from '../../../contracts/content/content.interface';
import type { HelpCenterDocumentKind } from '../../../contracts/content/content.interface';
import type { ExplanationDialogSection } from '@fssrepository/myscoutee-components';
import { AppUtils } from '../../app-utils';

import SUPPORTED_CONTENT_LANGUAGES from '../../../common/content-languages.json';
import { DEFAULT_TERMS_CENTER_DESCRIPTION_HU, DEFAULT_EXPLANATION_HOME_DESCRIPTION_HU, DEFAULT_HELP_CENTER_DESCRIPTION_HU, DEFAULT_HELP_CENTER_DESCRIPTION, DEFAULT_PRIVACY_CENTER_DESCRIPTION, DEFAULT_TERMS_CENTER_DESCRIPTION } from '../../../common/help-center-options';


export class HelpCenterContentBuilder {
  static dialogSection(section: HelpCenterSectionDto): ExplanationDialogSection {
    let html = `${section.contentHtml ?? ''}`.trim();
    const image = `${section.imageUrls?.[0] ?? ''}`.trim();
    const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!/<img[\s>]/i.test(html) && image) {
      const source = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==#lazy-src=' + encodeURIComponent(image);
      html += `<figure class="explanation-seeded-visual lazy-image-frame-loading"><img class="lazy-image-loading" src="${escape(source)}" alt="${escape(section.title ?? '')}"></figure>`;
    }
    const marker = /<!--\s*(?:panel|layout|section|width)\s*:\s*([a-z0-9_-]+)\s*-->/i.exec(section.contentHtml ?? '')?.[1]
      ?? /\b(?:data-panel|data-layout|data-section|data-width|data-panel-width)\s*=\s*["']\s*([a-z0-9_-]+)\s*["']/i.exec(section.contentHtml ?? '')?.[1]
      ?? /\b(?:help|explanation|section|panel)-(?:panel|section|layout)--([a-z0-9_-]+)\b/i.exec(section.contentHtml ?? '')?.[1];
    return { id: section.id, title: section.title, blurb: section.blurb, html,
      layout: this.normalizePanelSpan(section.panelSpan) ?? this.normalizePanelSpan(marker) ?? null,
      showIcon: !/<img[\s>]/i.test(html), icon: section.icon || 'tips_and_updates' };
  }


  static requestContentLanguage(lang: string | null | undefined, languages: readonly {
    lang: string;
  }[]): string {
    const explicit = this.normalizeRequestLanguage(lang); if (languages.some(language => language.lang === explicit))
      return explicit; const browser = this.normalizeRequestLanguage(this.browserLanguage()); return languages.some(language => language.lang === browser) ? browser : 'en';
  }

  static availableLanguages(languages: readonly {
    lang: string;
    label: string;
  }[]): Array<{
    lang: string;
    label: string;
  }> { return languages.map(language => ({ lang: this.normalizeLang(language.lang), label: language.label })); }

  static languageLabel(lang: string | null | undefined): string {
    return SUPPORTED_CONTENT_LANGUAGES.find(item => item.lang === this.normalizeLang(lang))?.label ?? 'English';
  }

  static browserLanguage(): string {
    const languages = this.browserLanguages()
      .map(value => this.normalizeRequestLanguage(value))
      .filter(Boolean);
    return languages.find(lang => lang !== 'en') ?? languages[0] ?? 'en';
  }

  static browserLanguages(): string[] {
    if (typeof navigator === 'undefined') {
      return [];
    }
    return Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  }

  static normalizeRequestLanguage(lang: string | null | undefined): string { return AppUtils.normalizeLanguage(lang ?? ''); }

  static normalizeImageUrls(imageUrls: readonly string[] | null | undefined, limit = 8): string[] {
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

  static normalizePanelSpan(value: string | null | undefined): HelpCenterSectionDto['panelSpan'] {
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

  static defaultTitle(kind: HelpCenterDocumentKind, version: number, lang = 'en'): string {
    const language = this.normalizeLang(lang);
    if (language === 'de') {
      const labels = { help: 'Hilfe', privacy: 'Datenschutz', terms: 'Bedingungen', explanation: 'Erklärung' };
      return `${labels[kind]} v${version}`;
    }
    if (language === 'es') {
      const labels = { help: 'Ayuda', privacy: 'Privacidad', terms: 'Términos', explanation: 'Guía' };
      return `${labels[kind]} v${version}`;
    }
    if (this.normalizeLang(lang) === 'hu') {
      return kind === 'privacy'
        ? `Adatvédelmi verzió v${version}`
        : kind === 'terms'
          ? `Feltételek verzió v${version}`
        : kind === 'explanation'
          ? `Magyarázat verzió v${version}`
          : `Súgó verzió v${version}`;
    }
    return `${this.documentLabel(kind)} revision v${version}`;
  }

  static defaultDescription(kind: HelpCenterDocumentKind, lang = 'en'): string {
    const language = this.normalizeLang(lang);
    if (language === 'de') return {
      help: 'Profile, Communities, Events, Chats und Tools: Wähle ein Thema und folge den Schritten.',
      privacy: 'Prüfe und akzeptiere, wie MyScoutee deine Daten nutzt, bevor du fortfährst.',
      terms: 'Lies die Bedingungen für MyScoutee, Konten, Events, Chats und Community-Funktionen.',
      explanation: 'Entdecke die Funktionen und nächsten Schritte auf dieser Seite.'
    }[kind];
    if (language === 'es') return {
      help: 'Perfiles, comunidades, eventos, chats y herramientas: elige un tema y sigue los pasos.',
      privacy: 'Revisa y acepta cómo MyScoutee usa tus datos antes de continuar.',
      terms: 'Revisa las condiciones de MyScoutee, cuentas, eventos, chats y funciones de comunidad.',
      explanation: 'Descubre las funciones y los próximos pasos de esta página.'
    }[kind];
    if (this.normalizeLang(lang) === 'hu') {
      return kind === 'privacy'
        ? 'Folytatás előtt nézd át és fogadd el, hogyan használja a MyScoutee az adataidat.'
        : kind === 'terms'
          ? DEFAULT_TERMS_CENTER_DESCRIPTION_HU
        : kind === 'explanation'
          ? DEFAULT_EXPLANATION_HOME_DESCRIPTION_HU
          : DEFAULT_HELP_CENTER_DESCRIPTION_HU;
    }
    return kind === 'privacy'
      ? DEFAULT_PRIVACY_CENTER_DESCRIPTION
      : kind === 'terms'
        ? DEFAULT_TERMS_CENTER_DESCRIPTION
      : kind === 'explanation'
        ? ''
        : DEFAULT_HELP_CENTER_DESCRIPTION;
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

  static defaultSectionIcon(kind: HelpCenterDocumentKind): string {
    switch (kind) {
      case 'privacy':
        return 'policy';
      case 'terms':
        return 'rule';
      case 'explanation':
        return 'tips_and_updates';
      default:
        return 'help_outline';
    }
  }

  static normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return SUPPORTED_CONTENT_LANGUAGES.some(item => item.lang === normalized) ? normalized : 'en';
  }
}
