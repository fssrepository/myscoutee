import { AppUtils } from '../../app-utils';
import { AssetCardBuilder } from '../../core/base/builders/asset-card.builder';
import { AssetDefaultsBuilder } from '../../core/base/builders/asset-defaults.builder';
import type * as AppDTOs from '../../core/contracts';
import type * as AppConstants from '../../core/common/constants';
import type { CardMenuActionId, InfoCardData } from '../components/core/smart-list/card/card.types';
import type { UiListConverter } from './converter.types';

export type AssetInfoCardModel = InfoCardData;

export interface AssetOwnedInfoCardConverterOptions {
  variant?: 'owned';
  groupLabel?: string | null;
  selectMode?: boolean;
  selected?: boolean;
  selectDisabled?: boolean;
  fallbackImageUrl?: string | null;
  fallbackSubtitle?: string | null;
}

export interface AssetExploreInfoCardConverterOptions {
  variant: 'explore';
  groupLabel?: string | null;
  availabilityLabel: string;
  canBorrow: boolean;
  canReportOwner: boolean;
}

export type AssetInfoCardConverterOptions =
  | AssetOwnedInfoCardConverterOptions
  | AssetExploreInfoCardConverterOptions;

export class AssetInfoCardConverter {
  static convert(
    card: AppDTOs.AssetDTO,
    options: AssetInfoCardConverterOptions = {}
  ): AssetInfoCardModel {
    return options.variant === 'explore'
      ? this.convertExplore(card, options)
      : this.convertOwned(card, options);
  }

  static convertList(
    cards: readonly AppDTOs.AssetDTO[],
    options: AssetInfoCardConverterOptions = {}
  ): AssetInfoCardModel[] {
    return cards.map(card => this.convert(card, options));
  }

  private static convertOwned(
    card: AppDTOs.AssetDTO,
    options: AssetOwnedInfoCardConverterOptions
  ): AssetInfoCardModel {
    const selectMode = options.selectMode === true;
    const selected = options.selected === true;
    return {
      id: `asset:${card.id}`,
      status: `${card.status ?? ''}`.trim() || null,
      ownerUserId: card.ownerUserId ?? null,
      groupLabel: options.groupLabel ?? null,
      title: card.title,
      imageUrl: AssetCardBuilder.normalizeAssetLink(card.imageUrl, options.fallbackImageUrl ?? ''),
      metaRows: [this.ownedAssetMetaLine(card, options.fallbackSubtitle ?? '')],
      description: card.description,
      surfaceTone: this.assetStatusSurfaceTone(card),
      leadingIcon: {
        icon: AssetDefaultsBuilder.assetTypeIcon(card.type)
      },
      mediaStart: this.ownedAssetMediaStart(card),
      mediaEnd: selectMode
        ? {
            actionId: 'toggleSelection',
            actionTone: 'accent',
            variant: 'toggle',
            tone: selected ? 'selected' : 'default',
            icon: 'add',
            selected,
            selectedIcon: 'check',
            interactive: true,
            disabled: options.selectDisabled === true,
            ariaLabel: selected ? 'Remove asset from basket' : 'Add asset to basket'
          }
        : this.ownedAssetMediaEnd(card),
      menuActions: selectMode ? [] : this.ownedAssetMenuActions(card),
      clickable: false
    };
  }

  private static convertExplore(
    card: AppDTOs.AssetDTO,
    options: AssetExploreInfoCardConverterOptions
  ): AssetInfoCardModel {
    const visibility = this.assetExploreVisibility(card);
    const canBorrow = options.canBorrow === true;
    return {
      id: `asset-explore:${card.id}`,
      status: `${card.status ?? ''}`.trim() || null,
      ownerUserId: card.ownerUserId ?? null,
      groupLabel: options.groupLabel ?? null,
      title: card.title,
      imageUrl: card.imageUrl,
      metaRows: [[
        AssetDefaultsBuilder.assetTypeLabel(card.type),
        card.category ?? '',
        card.city
      ].filter(Boolean).join(' · ')],
      description: card.description,
      detailRows: [[
        card.ownerName?.trim() || 'Unknown owner',
        visibility
      ].filter(Boolean).join(' · ')],
      footerChips: [
        { label: this.assetExplorePriceLabel(card) },
        { label: this.assetExplorePolicyLabel(card) }
      ],
      leadingIcon: {
        icon: this.assetExploreVisibilityIcon(visibility),
        tone: this.assetExploreVisibilityTone(visibility)
      },
      mediaStart: {
        variant: 'avatar',
        tone: this.assetExploreOwnerAvatarTone(card),
        label: AppUtils.initialsFromText(card.ownerName?.trim() || card.title),
        interactive: false,
        ariaLabel: null
      },
      mediaEnd: {
        variant: 'badge',
        tone: canBorrow ? 'default' : 'inactive',
        label: options.availabilityLabel,
        interactive: canBorrow,
        disabled: !canBorrow,
        ariaLabel: canBorrow ? 'Borrow asset' : 'Asset unavailable for this time'
      },
      menuActions: this.assetExploreMenuActions(canBorrow, options.canReportOwner === true),
      clickable: false
    };
  }

  private static ownedAssetMetaLine(card: AppDTOs.AssetDTO, fallbackSubtitle: string): string {
    const subtitle = card.subtitle.trim() || fallbackSubtitle.trim();
    const city = card.city.trim();
    return [AssetDefaultsBuilder.assetTypeLabel(card.type), subtitle, city].filter(Boolean).join(' · ');
  }

  private static assetExploreVisibility(card: AppDTOs.AssetDTO): AppConstants.EventVisibility {
    if (card.visibility === 'Friends only' || card.visibility === 'Invitation only') {
      return card.visibility;
    }
    return 'Public';
  }

  private static assetExploreVisibilityIcon(visibility: AppConstants.EventVisibility): string {
    if (visibility === 'Friends only') {
      return 'groups';
    }
    if (visibility === 'Invitation only') {
      return 'mail_lock';
    }
    return 'public';
  }

  private static assetExploreVisibilityTone(
    visibility: AppConstants.EventVisibility
  ): NonNullable<InfoCardData['leadingIcon']>['tone'] {
    if (visibility === 'Friends only') {
      return 'friends';
    }
    if (visibility === 'Invitation only') {
      return 'invitation';
    }
    return 'public';
  }

  private static assetExploreOwnerAvatarTone(card: AppDTOs.AssetDTO): NonNullable<InfoCardData['mediaStart']>['tone'] {
    return `tone-${(AppUtils.hashText(`${card.ownerUserId ?? card.id}:${card.ownerName ?? card.title}`) % 8) + 1}` as NonNullable<InfoCardData['mediaStart']>['tone'];
  }

  private static assetExploreMenuActions(
    canBorrow: boolean,
    canReportOwner: boolean
  ): readonly CardMenuActionId[] {
    const actions: CardMenuActionId[] = ['viewAsset'];
    if (canBorrow) {
      actions.push('borrowAsset');
    }
    actions.push('contactOwner');
    actions.push('shareAsset');
    if (canReportOwner) {
      actions.push('reportOwner');
    }
    return actions;
  }

  private static assetExplorePriceLabel(card: AppDTOs.AssetDTO): string {
    if (card.priceLabel?.trim()) {
      return card.priceLabel.trim();
    }
    const amount = this.assetExplorePriceAmount(card);
    const currency = 'USD';
    if (amount <= 0) {
      return 'Free borrow';
    }
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(0)}`;
    }
  }

  private static assetExplorePriceAmount(card: AppDTOs.AssetDTO): number {
    const amount = Number(card.priceLabel?.replace(/[^\d.]/g, '') ?? 0);
    return Number.isFinite(amount) ? Math.max(0, amount) : 0;
  }

  private static assetExplorePolicyLabel(card: AppDTOs.AssetDTO): string {
    const count = Math.max(0, Math.trunc(Number(card.policyCount) || 0));
    if (count <= 0) {
      return 'No policy';
    }
    return count === 1 ? '1 policy' : `${count} policies`;
  }

  private static ownedAssetMediaStart(card: AppDTOs.AssetDTO): NonNullable<InfoCardData['mediaStart']> | null {
    if (!AssetCardBuilder.canOpenMap(card)) {
      return null;
    }
    return {
      variant: 'avatar',
      tone: 'default',
      icon: 'location_on',
      interactive: true,
      ariaLabel: 'Open property map'
    };
  }

  private static ownedAssetMenuActions(card: AppDTOs.AssetDTO): readonly CardMenuActionId[] {
    const configuredActions = (card.menuActions ?? [])
      .map(action => `${action ?? ''}`.trim())
      .filter(action => action.length > 0);
    const actions = configuredActions.length > 0
      ? [...configuredActions]
      : ['shareAsset', 'editAsset', 'delete'];
    if (!actions.includes('assetAvailability')) {
      actions.unshift('assetAvailability');
    }
    const sourceLink = AppUtils.normalizeHttpUrl(card.sourceLink ?? '');
    if (sourceLink && !actions.includes('externalInfo')) {
      const shareIndex = actions.findIndex(action => action === 'shareAsset' || action === 'share');
      actions.splice(shareIndex >= 0 ? shareIndex + 1 : 0, 0, 'externalInfo');
    }
    return actions;
  }

  private static ownedAssetMediaEnd(card: AppDTOs.AssetDTO): NonNullable<InfoCardData['mediaEnd']> | null {
    const statusLabel = this.assetStatusBadgeLabel(card);
    if (statusLabel) {
      return {
        variant: 'badge',
        tone: this.assetStatusOverlayTone(card),
        label: statusLabel,
        interactive: false,
        ariaLabel: statusLabel
      };
    }
    const metrics = this.assetRequestMetrics(card);
    return {
      variant: 'badge',
      shape: 'circle',
      actionId: 'assetAvailability',
      tone: card.type === 'Supplies' ? 'warm' : 'default',
      label: `${metrics.activeItems}`,
      detailLabel: AssetCardBuilder.capacityLabel(card),
      interactive: true,
      pendingCount: metrics.pendingItems,
      ariaLabel: `${metrics.activeItems} active items, ${metrics.pendingItems} pending items`
    };
  }

  private static assetRequestMetrics(card: AppDTOs.AssetDTO): AppDTOs.AssetRequestMetricsDTO {
    if (card.metrics) {
      return {
        allItems: this.normalizeCount(card.metrics.allItems),
        activeItems: this.normalizeCount(card.metrics.activeItems),
        assignedItems: this.normalizeCount(card.metrics.assignedItems),
        borrowedItems: this.normalizeCount(card.metrics.borrowedItems),
        pendingItems: this.normalizeCount(card.metrics.pendingItems)
      };
    }
    return {
      allItems: 0,
      activeItems: 0,
      assignedItems: 0,
      borrowedItems: 0,
      pendingItems: 0
    };
  }

  private static normalizeCount(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
  }

  private static assetStatusCode(card: AppDTOs.AssetDTO): string {
    const status = `${card.status ?? ''}`.trim();
    switch (status) {
      case 'active':
        return 'A';
      case 'under-review':
      case 'under review':
        return 'UR';
      case 'blocked':
        return 'B';
      case 'deleted':
        return 'D';
      case 'inactive':
        return 'I';
      case 'trashed':
      case 'trash':
        return 'T';
      default:
        return status || 'A';
    }
  }

  private static assetStatusBadgeLabel(card: AppDTOs.AssetDTO): string | null {
    switch (this.assetStatusCode(card)) {
      case 'UR':
        return 'Under Review';
      case 'B':
        return 'Blocked User';
      case 'D':
        return 'Deleted User';
      case 'T':
        return 'Deleted';
      case 'I':
        return 'Inactive User';
      default:
        return null;
    }
  }

  private static assetStatusSurfaceTone(card: AppDTOs.AssetDTO): InfoCardData['surfaceTone'] {
    switch (this.assetStatusCode(card)) {
      case 'UR':
        return 'review';
      case 'B':
        return 'blocked';
      case 'D':
      case 'T':
        return 'deleted';
      case 'I':
        return 'inactive';
      default:
        return 'default';
    }
  }

  private static assetStatusOverlayTone(card: AppDTOs.AssetDTO): NonNullable<InfoCardData['mediaEnd']>['tone'] {
    switch (this.assetStatusCode(card)) {
      case 'UR':
        return 'review';
      case 'B':
        return 'blocked';
      case 'D':
      case 'T':
        return 'deleted';
      case 'I':
        return 'inactive';
      default:
        return 'default';
    }
  }
}

export const assetInfoCardConverter =
  AssetInfoCardConverter satisfies UiListConverter<
    AppDTOs.AssetDTO,
    AssetInfoCardModel,
    AssetInfoCardConverterOptions
  >;
