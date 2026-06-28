import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import type { AppMenuPalette } from '../../../shared/ui';

export interface NavigatorPresentation {
  aliases: readonly string[];
  icon: string;
  colorClass: string;
  toneClass: string;
  menuPalette: AppMenuPalette;
  memberTitle?: string;
}

export type NavigatorPresentationKind = 'hostTier' | 'trait';
type NavigatorPresentationCatalogKind = NavigatorPresentationKind | 'title';

interface NavigatorPresentationCatalog {
  entries: readonly NavigatorPresentation[];
  fallback: NavigatorPresentation;
}

export function resolveNavigatorPresentation(
  kind: NavigatorPresentationKind,
  value: string
): NavigatorPresentation {
  const catalog = navigatorPresentationCatalog(kind);
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

function navigatorPresentationCatalog(kind: NavigatorPresentationCatalogKind): NavigatorPresentationCatalog {
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
  const catalog = navigatorPresentationCatalog('title');
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
