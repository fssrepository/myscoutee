import { APP_STATIC_DATA } from '../../../app-static-data';
import { AppUtils } from '../../../app-utils';
import type { AppMenuPalette } from '../..';

export interface SideMenuPresentation {
  aliases: readonly string[];
  icon: string;
  colorClass: string;
  toneClass: string;
  menuPalette: AppMenuPalette;
  memberTitle?: string;
}

export type SideMenuPresentationKind = 'hostTier' | 'trait';
type SideMenuPresentationCatalogKind = SideMenuPresentationKind | 'title';

interface SideMenuPresentationCatalog {
  entries: readonly SideMenuPresentation[];
  fallback: SideMenuPresentation;
}

export function resolveSideMenuPresentation(
  kind: SideMenuPresentationKind,
  value: string
): SideMenuPresentation {
  const catalog = sideMenuPresentationCatalog(kind);
  const presenter = AppUtils.findByAlias(catalog.entries, value);
  const fallback = catalog.fallback;
  return {
    aliases: presenter?.aliases ?? fallback.aliases,
    icon: presenter?.icon ?? fallback.icon,
    colorClass: presenter?.colorClass ?? fallback.colorClass,
    toneClass: presenter?.toneClass ?? fallback.toneClass,
    menuPalette: presenter?.menuPalette ?? fallback.menuPalette,
    ...(kind === 'trait' ? { memberTitle: resolveMemberImpressionTitle(value) } : {})
  };
}

function sideMenuPresentationCatalog(kind: SideMenuPresentationCatalogKind): SideMenuPresentationCatalog {
  if (kind === 'title') {
    return {
      entries: APP_STATIC_DATA.navigatorMemberImpressionTitlePresenters,
      fallback: APP_STATIC_DATA.navigatorTraitPresenterDefault
    };
  }
  if (kind === 'trait') {
    return {
      entries: APP_STATIC_DATA.navigatorTraitPresenters,
      fallback: APP_STATIC_DATA.navigatorTraitPresenterDefault
    };
  }
  return {
    entries: APP_STATIC_DATA.navigatorHostTierPresenters,
    fallback: APP_STATIC_DATA.navigatorHostTierPresenterDefault
  };
}

function resolveMemberImpressionTitle(traitLabel: string): string {
  const catalog = sideMenuPresentationCatalog('title');
  const presenter = AppUtils.findByAlias(catalog.entries, traitLabel);
  if (presenter?.memberTitle) {
    return presenter.memberTitle;
  }
  const defaultTitle = catalog.fallback.memberTitle ?? 'Attendee';
  const label = `${traitLabel ?? ''}`.trim();
  return label
    ? `${label} ${defaultTitle}`
    : defaultTitle;
}
