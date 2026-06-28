import type {
  AppMenuGroup,
  AppMenuItem,
  AppMenuItemKind,
  AppMenuModel,
  AppMenuSummary,
  AppMenuPalette
} from './menu.types';

export interface AppMenuStaticOptionGroup {
  title: string;
  shortTitle?: string;
  icon?: string;
  toneClass?: string;
  options: readonly string[];
}

export interface BuildTabbedMenuGroupsParams<TId extends string, TContext> {
  idPrefix: string;
  groups: readonly AppMenuStaticOptionGroup[];
  selected?: readonly string[];
  maxSelected?: number | null;
  context: (option: string, group: AppMenuStaticOptionGroup) => TContext;
  normalize?: (value: string) => string;
  kind?: AppMenuItemKind;
  closeOnSelect?: boolean;
  itemLabel?: (option: string, group: AppMenuStaticOptionGroup) => string;
  itemIcon?: (option: string, group: AppMenuStaticOptionGroup) => string;
  itemPalette?: (option: string, group: AppMenuStaticOptionGroup) => AppMenuPalette;
  groupIcon?: (group: AppMenuStaticOptionGroup) => string;
  groupPalette?: (group: AppMenuStaticOptionGroup) => AppMenuPalette;
  removable?: (option: string, group: AppMenuStaticOptionGroup, selected: boolean) => boolean;
  removeAriaLabel?: (option: string, group: AppMenuStaticOptionGroup) => string;
}

export interface BuildTabbedMenuModelParams<TId extends string, TContext>
  extends BuildTabbedMenuGroupsParams<TId, TContext> {
  summary?: AppMenuSummary | null;
}

export function buildTabbedMenuModel<TId extends string = string, TContext = unknown>(
  params: BuildTabbedMenuModelParams<TId, TContext>
): AppMenuModel<TId, TContext> {
  const { summary, ...groupParams } = params;
  return {
    layout: 'tabs',
    summary: summary ?? null,
    maxSelected: params.maxSelected ?? null,
    groups: buildTabbedMenuGroups<TId, TContext>(groupParams)
  };
}

export function buildTabbedMenuGroups<TId extends string = string, TContext = unknown>(
  params: BuildTabbedMenuGroupsParams<TId, TContext>
): readonly AppMenuGroup<TId, TContext>[] {
  const normalize = params.normalize ?? appMenuNormalizeStaticOption;
  const selectedKeys = new Set((params.selected ?? []).map(item => normalize(item)));

  return params.groups.map((group, groupIndex) => ({
    id: `${params.idPrefix}-group-${appMenuSafeId(group.shortTitle || group.title || `${groupIndex}`)}`,
    label: group.shortTitle || group.title,
    icon: params.groupIcon?.(group) ?? appMenuIconFromToneClass(group.toneClass),
    palette: params.groupPalette?.(group) ?? appMenuPaletteFromToneClass(group.toneClass),
    ariaLabel: group.title,
    items: group.options.map(option => {
      const selected = selectedKeys.has(normalize(option));
      const label = params.itemLabel?.(option, group) ?? option;
      return {
        id: `${params.idPrefix}-${appMenuSafeId(option)}` as TId,
        label,
        icon: params.itemIcon?.(option, group) ?? appMenuIconFromToneClass(group.toneClass),
        kind: params.kind ?? 'checkbox',
        active: selected,
        checked: selected,
        removable: params.removable?.(option, group, selected) ?? selected,
        removeAriaLabel: params.removeAriaLabel?.(option, group) ?? `Remove ${label}`,
        closeOnSelect: params.closeOnSelect ?? false,
        palette: params.itemPalette?.(option, group) ?? appMenuPaletteFromToneClass(group.toneClass),
        value: option,
        context: params.context(option, group)
      } satisfies AppMenuItem<TId, TContext>;
    })
  }));
}

export function appMenuPaletteFromToneClass(toneClass: string | null | undefined): AppMenuPalette {
  switch (toneClass) {
    case 'section-active':
      return 'green';
    case 'section-languages':
    case 'section-social':
      return 'blue';
    case 'section-food':
    case 'section-family':
      return 'orange';
    case 'section-ambition':
      return 'amber';
    case 'section-lifestyle':
    case 'section-mind':
      return 'teal';
    case 'section-identity':
      return 'cyan';
    case 'section-beliefs':
      return 'purple';
    case 'section-arts':
      return 'violet';
    default:
      return 'neutral';
  }
}

export function appMenuIconFromToneClass(toneClass: string | null | undefined): string {
  switch (toneClass) {
    case 'section-family':
      return 'family_restroom';
    case 'section-ambition':
      return 'rocket_launch';
    case 'section-lifestyle':
      return 'eco';
    case 'section-beliefs':
      return 'auto_awesome';
    case 'section-social':
      return 'groups';
    case 'section-arts':
      return 'theater_comedy';
    case 'section-food':
      return 'restaurant';
    case 'section-active':
      return 'hiking';
    case 'section-languages':
      return 'language';
    case 'section-mind':
      return 'self_improvement';
    case 'section-identity':
      return 'public';
    default:
      return 'label';
  }
}

export function appMenuNormalizeStaticOption(value: string): string {
  return `${value ?? ''}`.trim().replace(/^#+/, '').toLowerCase();
}

function appMenuSafeId(value: string): string {
  return appMenuNormalizeStaticOption(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}
