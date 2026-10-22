import SUPPORTED_CONTENT_LANGUAGES from '../../../common/content-languages.json';
import { DEFAULT_TERMS_CENTER_DESCRIPTION_HU, DEFAULT_EXPLANATION_HOME_DESCRIPTION_HU, DEFAULT_HELP_CENTER_DESCRIPTION_HU, DEFAULT_HELP_CENTER_DESCRIPTION, DEFAULT_PRIVACY_CENTER_DESCRIPTION, DEFAULT_TERMS_CENTER_DESCRIPTION } from '../../../common/help-center-options';
import type { GuideDocumentKind as HelpCenterDocumentKind } from '@fssrepository/myscoutee-components';

export class HelpCenterContentBuilder {
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

  private static normalizeLang(lang: string | null | undefined): string {
    const normalized = `${lang ?? ''}`.trim().toLowerCase().split('-')[0];
    return SUPPORTED_CONTENT_LANGUAGES.some(item => item.lang === normalized) ? normalized : 'en';
  }
}
