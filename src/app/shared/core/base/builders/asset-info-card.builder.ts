import { AppUtils } from '../../../app-utils';
import type { UserDto } from '../interfaces/user.interface';
import type * as AppTypes from '../models';
import type { InfoCardData, InfoCardMenuAction } from '../../../ui';
import { AssetCardBuilder } from './asset-card.builder';
import { AssetDefaultsBuilder } from './asset-defaults.builder';
import { AssetTicketConverter } from '../converters/asset-ticket.converter';

type TicketPerson = Pick<UserDto, 'initials' | 'images'>;

export class AssetInfoCardBuilder {
  static buildTicketInfoCard(
    row: AppTypes.ActivityListRow,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return {
      id: `${row.type}:${row.id}`,
      dateIso: row.dateIso,
      distanceMetersExact: row.distanceMetersExact,
      groupLabel: options.groupLabel ?? null,
      title: row.title,
      imageUrl: this.ticketImageUrl(row),
      metaRows: [this.ticketMetaLine(row)],
      description: row.subtitle,
      leadingIcon: {
        icon: this.ticketLeadingIcon(row),
        tone: this.ticketLeadingIconTone(row)
      },
      mediaStart: {
        variant: 'avatar',
        tone: this.ticketSourceAvatarTone(row),
        label: this.ticketSourceAvatarLabel(row),
        interactive: false,
        ariaLabel: null
      },
      mediaEnd: {
        variant: 'badge',
        tone: 'default',
        icon: 'qr_code_2',
        interactive: true,
        ariaLabel: 'Open ticket QR code'
      },
      clickable: false
    };
  }

  static buildOwnedAssetInfoCard(
    card: AppTypes.AssetCard,
    options: {
      groupLabel?: string | null;
      selectMode?: boolean;
      selected?: boolean;
      selectDisabled?: boolean;
      fallbackImageUrl?: string | null;
      fallbackSubtitle?: string | null;
    } = {}
  ): InfoCardData {
    const selectMode = options.selectMode === true;
    const selected = options.selected === true;
    return {
      id: `asset:${card.id}`,
      status: `${card.status ?? ''}`.trim() || null,
      ownerUserId: card.ownerUserId ?? null,
      groupLabel: options.groupLabel ?? null,
      title: card.title,
      imageUrl: AssetCardBuilder.normalizeAssetImageLink(card.type, card.imageUrl, {
        fallbackImageUrl: options.fallbackImageUrl ?? ''
      }),
      metaRows: [this.ownedAssetMetaLine(card, options.fallbackSubtitle ?? '')],
      description: card.details,
      surfaceTone: this.assetStatusSurfaceTone(card),
      leadingIcon: {
        icon: AssetDefaultsBuilder.assetTypeIcon(card.type)
      },
      mediaStart: this.ownedAssetMediaStart(card),
      mediaEnd: selectMode
        ? {
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

  static buildExploreAssetInfoCard(
    card: AppTypes.AssetCard,
    options: {
      groupLabel?: string | null;
      availabilityLabel: string;
      canBorrow: boolean;
      canReportOwner: boolean;
    }
  ): InfoCardData {
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
      description: card.details,
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

  static buildTicketGroupLabel(dateIso: string): string {
    const parsed = new Date(dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return 'Date unavailable';
    }
    return parsed.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  static resolveTicketPayloadAvatarUrl(user: TicketPerson | null): string {
    if (!user) {
      return '';
    }
    return AppUtils.firstImageUrl(user.images);
  }

  static resolveTicketPayloadInitials(
    payload: AppTypes.TicketScanPayload,
    user: TicketPerson | null
  ): string {
    if (user?.initials?.trim()) {
      return user.initials.trim();
    }
    return AppUtils.initialsFromText(payload.holderName);
  }

  private static ticketImageUrl(row: AppTypes.ActivityListRow): string {
    return `${row.imageUrl ?? ''}`.trim() || 'https://picsum.photos/seed/event-default/1200/700';
  }

  private static ticketMetaLine(row: AppTypes.ActivityListRow): string {
    return `${row.type === 'hosting' ? 'Hosting' : 'Event'} · ${AssetTicketConverter.buildTicketDateLabel(row)} · ${this.ticketDistanceLabel(row.distanceMetersExact)}`;
  }

  private static ticketDistanceLabel(distanceMeters: number | null | undefined): string {
    const meters = Number.isFinite(distanceMeters) ? Math.max(0, Math.trunc(Number(distanceMeters))) : 0;
    const rounded = Math.round((meters / 1000) * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
  }

  private static ticketLeadingIcon(row: AppTypes.ActivityListRow): string {
    const visibility = this.ticketVisibility(row);
    if (visibility === 'Friends only') {
      return 'groups';
    }
    if (visibility === 'Invitation only') {
      return 'mail_lock';
    }
    return 'public';
  }

  private static ticketLeadingIconTone(
    row: AppTypes.ActivityListRow
  ): NonNullable<InfoCardData['leadingIcon']>['tone'] {
    const visibility = this.ticketVisibility(row);
    if (visibility === 'Friends only') {
      return 'friends';
    }
    if (visibility === 'Invitation only') {
      return 'invitation';
    }
    return 'public';
  }

  private static ticketVisibility(row: AppTypes.ActivityListRow): AppTypes.EventVisibility {
    const visibility = row.visibility;
    if (visibility === 'Friends only' || visibility === 'Invitation only') {
      return visibility;
    }
    return 'Public';
  }

  private static ticketSourceAvatarTone(
    row: AppTypes.ActivityListRow
  ): NonNullable<InfoCardData['mediaStart']>['tone'] {
    const toneIndex = (AppUtils.hashText(`${row.type}:${row.id}:${row.title}`) % 8) + 1;
    return `tone-${toneIndex}` as NonNullable<InfoCardData['mediaStart']>['tone'];
  }

  private static ticketSourceAvatarLabel(row: AppTypes.ActivityListRow): string {
    const explicit = `${row.avatarInitials ?? row.creatorInitials ?? ''}`.trim();
    if (explicit) {
      return explicit.slice(0, 2).toUpperCase();
    }
    return AppUtils.initialsFromText(row.title);
  }

  private static ownedAssetMetaLine(card: AppTypes.AssetCard, fallbackSubtitle: string): string {
    const subtitle = card.subtitle.trim() || fallbackSubtitle.trim();
    const city = card.city.trim();
    return [AssetDefaultsBuilder.assetTypeLabel(card.type), subtitle, city].filter(Boolean).join(' · ');
  }

  private static assetExploreVisibility(card: AppTypes.AssetCard): AppTypes.EventVisibility {
    if (card.visibility === 'Friends only' || card.visibility === 'Invitation only') {
      return card.visibility;
    }
    return 'Public';
  }

  private static assetExploreVisibilityIcon(visibility: AppTypes.EventVisibility): string {
    if (visibility === 'Friends only') {
      return 'groups';
    }
    if (visibility === 'Invitation only') {
      return 'mail_lock';
    }
    return 'public';
  }

  private static assetExploreVisibilityTone(
    visibility: AppTypes.EventVisibility
  ): NonNullable<InfoCardData['leadingIcon']>['tone'] {
    if (visibility === 'Friends only') {
      return 'friends';
    }
    if (visibility === 'Invitation only') {
      return 'invitation';
    }
    return 'public';
  }

  private static assetExploreOwnerAvatarTone(card: AppTypes.AssetCard): NonNullable<InfoCardData['mediaStart']>['tone'] {
    return `tone-${(AppUtils.hashText(`${card.ownerUserId ?? card.id}:${card.ownerName ?? card.title}`) % 8) + 1}` as NonNullable<InfoCardData['mediaStart']>['tone'];
  }

  private static assetExploreMenuActions(
    canBorrow: boolean,
    canReportOwner: boolean
  ): readonly InfoCardMenuAction[] {
    const actions: InfoCardMenuAction[] = ['viewAsset'];
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

  private static assetExplorePriceLabel(card: AppTypes.AssetCard): string {
    const amount = this.assetExplorePriceAmount(card);
    const currency = card.pricing?.currency || 'USD';
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

  private static assetExplorePriceAmount(card: AppTypes.AssetCard): number {
    if (!card.pricing?.enabled) {
      return 0;
    }
    return Math.max(0, Number(card.pricing.basePrice) || 0);
  }

  private static assetExplorePolicyLabel(card: AppTypes.AssetCard): string {
    const count = (card.policies ?? []).length;
    if (count <= 0) {
      return 'No policy';
    }
    return count === 1 ? '1 policy' : `${count} policies`;
  }

  private static ownedAssetMediaStart(card: AppTypes.AssetCard): NonNullable<InfoCardData['mediaStart']> | null {
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

  private static ownedAssetMenuActions(card: AppTypes.AssetCard): readonly InfoCardMenuAction[] {
    const configuredActions = (card.menuActions ?? [])
      .map(action => `${action ?? ''}`.trim())
      .filter(action => action.length > 0);
    if (configuredActions.length > 0) {
      return configuredActions;
    }
    return ['shareAsset', 'editAsset', 'delete'];
  }

  private static ownedAssetMediaEnd(card: AppTypes.AssetCard): NonNullable<InfoCardData['mediaEnd']> | null {
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
    const pendingCount = card.requests.filter(request => request.status === 'pending' && request.requestKind !== 'manual').length;
    return {
      variant: 'badge',
      tone: card.type === 'Supplies' ? 'warm' : 'default',
      label: AssetCardBuilder.quantityLabel(card),
      detailLabel: AssetCardBuilder.capacityLabel(card),
      interactive: true,
      pendingCount,
      ariaLabel: 'Open asset requests and assignments'
    };
  }

  private static assetStatusCode(card: AppTypes.AssetCard): string {
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

  private static assetStatusBadgeLabel(card: AppTypes.AssetCard): string | null {
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

  private static assetStatusSurfaceTone(card: AppTypes.AssetCard): InfoCardData['surfaceTone'] {
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

  private static assetStatusOverlayTone(card: AppTypes.AssetCard): NonNullable<InfoCardData['mediaEnd']>['tone'] {
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
