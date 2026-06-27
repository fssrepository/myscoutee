import { AssetDefaultsBuilder } from '../../core/base/builders';
import type * as AppDTOs from '../../core/base/dto';
import type * as AppConstants from '../../core/common/constants';
import type { CardMenuActionId, InfoCardData } from '../components/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface ActivitySubEventResourceInfoCardConverterOptions {
  groupLabel?: string | null;
  canOpenMap?: boolean;
  occupancyLabel: string;
  canOpenBadgeDetails?: boolean;
  canOpenAssetMembers?: boolean;
  canEditRoute?: boolean;
  canJoin?: boolean;
  canLeave?: boolean;
  canReportResourceManager?: boolean;
}

export class ActivitySubEventResourceInfoCardConverter {
  static convert(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): InfoCardData {
    return {
      id: card.id,
      groupLabel: options.groupLabel ?? null,
      title: card.title,
      imageUrl: card.imageUrl,
      metaRows: [`${card.type} · ${card.subtitle} · ${card.city}`],
      description: card.details,
      leadingIcon: {
        icon: this.resourceTypeIcon(card.type)
      },
      mediaStart: this.resourceMediaStart(card, options.canOpenMap === true),
      mediaEnd: {
        variant: 'badge',
        tone: 'default',
        label: options.occupancyLabel,
        interactive: options.canOpenBadgeDetails === true,
        pendingCount: card.pending,
        ariaLabel: options.canOpenAssetMembers === true
          ? 'Open member requests'
          : 'Open resource details'
      },
      menuActions: this.resourceMenuActions(card, options),
      clickable: false
    };
  }

  static convertList(
    cards: readonly AppDTOs.SubEventResourceCardDTO[],
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): InfoCardData[] {
    return cards.map(card => this.convert(card, options));
  }

  private static resourceTypeIcon(type: AppConstants.SubEventResourceFilter): string {
    return type === 'Members'
      ? 'groups'
      : AssetDefaultsBuilder.assetTypeIcon(type);
  }

  private static resourceMediaStart(
    card: AppDTOs.SubEventResourceCardDTO,
    canOpenMap: boolean
  ): NonNullable<InfoCardData['mediaStart']> | null {
    if (!canOpenMap) {
      return null;
    }
    return {
      variant: 'avatar',
      tone: 'default',
      icon: 'location_on',
      interactive: true,
      ariaLabel: card.type === 'Car' ? 'Open route map' : 'Open accommodation map'
    };
  }

  private static resourceMenuActions(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): readonly CardMenuActionId[] {
    const actions: CardMenuActionId[] = ['viewAsset'];
    if (options.canEditRoute === true) {
      actions.push('editAsset');
    }
    if (options.canJoin === true) {
      actions.push('joinResource');
    } else if (options.canLeave === true) {
      actions.push('leaveResource');
    }
    actions.push('contactOrganizer');
    actions.push('shareAsset');
    if (options.canReportResourceManager === true) {
      actions.push(card.sourceAssetId ? 'reportManager' : 'reportOrganizer');
    }
    actions.push('removeAssignment');
    return actions;
  }
}

export const activitySubEventResourceInfoCardConverter =
  ActivitySubEventResourceInfoCardConverter satisfies UiListConverter<
    AppDTOs.SubEventResourceCardDTO,
    InfoCardData,
    ActivitySubEventResourceInfoCardConverterOptions
  >;
