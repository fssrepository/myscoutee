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
      rowId: `${row.type}:${row.id}`,
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
    const pendingRequests = card.requests.filter(request => request.status === 'pending').length;
    return {
      rowId: `asset:${card.id}`,
      groupLabel: options.groupLabel ?? null,
      title: card.title,
      imageUrl: AssetCardBuilder.normalizeAssetImageLink(card.type, card.imageUrl, {
        fallbackImageUrl: options.fallbackImageUrl ?? ''
      }),
      metaRows: [this.ownedAssetMetaLine(card, options.fallbackSubtitle ?? '')],
      description: card.details,
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
        : {
            variant: 'avatar',
            tone: 'default',
            label: AssetCardBuilder.capacityLabel(card),
            interactive: false,
            ariaLabel: null
          },
      menuBadgeCount: selectMode ? 0 : pendingRequests,
      menuActions: selectMode ? [] : this.ownedAssetMenuActions(card),
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
    const source = row.source as { imageUrl?: string } | null;
    return `${source?.imageUrl ?? ''}`.trim() || 'https://picsum.photos/seed/event-default/1200/700';
  }

  private static ticketMetaLine(row: AppTypes.ActivityListRow): string {
    return `${row.type === 'hosting' ? 'Hosting' : 'Event'} · ${AssetTicketConverter.buildTicketDateLabel(row)} · ${this.ticketDistanceLabel(row.distanceKm)}`;
  }

  private static ticketDistanceLabel(distanceKm: number): string {
    const rounded = Math.round((Number(distanceKm) || 0) * 10) / 10;
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
    const source = row.source as { visibility?: AppTypes.EventVisibility } | null;
    const visibility = source?.visibility;
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
    const source = row.source as { avatar?: string; creatorInitials?: string } | null;
    const explicit = `${source?.avatar ?? source?.creatorInitials ?? ''}`.trim();
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
    const label = AssetDefaultsBuilder.assetTypeLabel(card.type).toLowerCase();
    const pendingRequests = card.requests.filter(request => request.status === 'pending').length;
    return [
      {
        id: 'requests',
        label: pendingRequests > 0
          ? `Borrow requests (${pendingRequests})`
          : 'Borrow requests',
        icon: 'inbox',
        tone: pendingRequests > 0 ? 'warning' : 'default'
      },
      {
        id: 'edit',
        label: `Edit ${label}`,
        icon: 'edit'
      },
      {
        id: 'delete',
        label: `Delete ${label}`,
        icon: 'delete',
        tone: 'destructive'
      }
    ];
  }
}
