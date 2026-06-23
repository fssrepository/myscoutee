import { AppUtils } from '../../app-utils';
import { AssetTicketMapper } from '../../core/base/mappers';
import type * as AssetContracts from '../../core/contracts/asset.interface';
import type * as AppConstants from '../../core/common/constants';
import type { InfoCardData } from '../components/card';
import type { UiListConverter } from './converter.types';

export type AssetTicketInfoCardModel = InfoCardData;

export interface AssetTicketInfoCardConverterOptions {
  groupLabel?: string | null;
}

export class AssetTicketInfoCardConverter {
  static convert(
    row: AssetContracts.AssetTicketDTO,
    options: AssetTicketInfoCardConverterOptions = {}
  ): AssetTicketInfoCardModel {
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

  static convertList(
    rows: readonly AssetContracts.AssetTicketDTO[],
    options: AssetTicketInfoCardConverterOptions = {}
  ): AssetTicketInfoCardModel[] {
    return rows.map(row => this.convert(row, options));
  }

  private static ticketImageUrl(row: AssetContracts.AssetTicketDTO): string {
    return `${row.imageUrl ?? ''}`.trim() || 'https://picsum.photos/seed/event-default/1200/700';
  }

  private static ticketMetaLine(row: AssetContracts.AssetTicketDTO): string {
    return `${row.type === 'hosting' ? 'Hosting' : 'Event'} · ${AssetTicketMapper.buildTicketDateLabel(row)} · ${this.ticketDistanceLabel(row.distanceMetersExact)}`;
  }

  private static ticketDistanceLabel(distanceMeters: number | null | undefined): string {
    const meters = Number.isFinite(distanceMeters) ? Math.max(0, Math.trunc(Number(distanceMeters))) : 0;
    const rounded = Math.round((meters / 1000) * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
  }

  private static ticketLeadingIcon(row: AssetContracts.AssetTicketDTO): string {
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
    row: AssetContracts.AssetTicketDTO
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

  private static ticketVisibility(row: AssetContracts.AssetTicketDTO): AppConstants.EventVisibility {
    const visibility = row.visibility;
    if (visibility === 'Friends only' || visibility === 'Invitation only') {
      return visibility;
    }
    return 'Public';
  }

  private static ticketSourceAvatarTone(
    row: AssetContracts.AssetTicketDTO
  ): NonNullable<InfoCardData['mediaStart']>['tone'] {
    const toneIndex = (AppUtils.hashText(`${row.type}:${row.id}:${row.title}`) % 8) + 1;
    return `tone-${toneIndex}` as NonNullable<InfoCardData['mediaStart']>['tone'];
  }

  private static ticketSourceAvatarLabel(row: AssetContracts.AssetTicketDTO): string {
    const explicit = `${row.avatarInitials ?? row.creatorInitials ?? ''}`.trim();
    if (explicit) {
      return explicit.slice(0, 2).toUpperCase();
    }
    return AppUtils.initialsFromText(row.title);
  }
}

export const assetTicketInfoCardConverter =
  AssetTicketInfoCardConverter satisfies UiListConverter<
    AssetContracts.AssetTicketDTO,
    AssetTicketInfoCardModel,
    AssetTicketInfoCardConverterOptions
  >;
