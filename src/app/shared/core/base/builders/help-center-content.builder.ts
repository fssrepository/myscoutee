import { APP_STATIC_DATA } from '../../../app-static-data';
import type { HelpCenterDocumentKind } from '../../contracts';

export class HelpCenterContentBuilder {
  static defaultTitle(kind: HelpCenterDocumentKind, version: number, lang = 'en'): string {
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
    if (this.normalizeLang(lang) === 'hu') {
      return kind === 'privacy'
        ? 'Folytatás előtt nézd át és fogadd el, hogyan használja a MyScoutee az adataidat.'
        : kind === 'terms'
          ? APP_STATIC_DATA.defaultTermsCenterRevisionsByLang.hu.description
        : kind === 'explanation'
          ? APP_STATIC_DATA.defaultExplanationHomeRevisionsByLang.hu.description
          : 'A MyScoutee segít az eseményeket elejétől végéig megtervezni: meghívások, szakaszok és csoportok, erőforrások, valamint kontextushoz kötött csevegések.';
    }
    return kind === 'privacy'
      ? APP_STATIC_DATA.defaultPrivacyCenterDescription
      : kind === 'terms'
        ? APP_STATIC_DATA.defaultTermsCenterDescription
      : kind === 'explanation'
        ? ''
        : APP_STATIC_DATA.defaultHelpCenterDescription;
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
    return normalized === 'hu' ? 'hu' : 'en';
  }
}
