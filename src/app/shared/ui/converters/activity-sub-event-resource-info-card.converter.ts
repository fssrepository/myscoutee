import {
  ActivityResourceBuilder,
  AssetDefaultsBuilder
} from '../../core/base/builders';
import {
  AppUtils
} from '../../app-utils';
import type * as AppDTOs from '../../core/contracts';
import * as AppConstants from '../../core/common/constants';
import type { UserDto } from '../../core/contracts/user.interface';
import type { CardMenuActionId, InfoCardData } from '../components/core/smart-list/card';
import type { UiListConverter } from './converter.types';

export interface ActivitySubEventResourceInfoCardAssetRef {
  id: string;
  type: AppConstants.AssetType;
}

export interface ActivitySubEventResourceInfoCardSourceAsset extends ActivitySubEventResourceInfoCardAssetRef {
  ownerUserId?: string | null;
  requests?: readonly AppDTOs.AssetMemberRequestDTO[];
}

export interface ActivitySubEventResourceInfoCardContext {
  subEvent?: AppDTOs.SubEventDTO | null;
  fallbackCardsByType?: Partial<Record<AppConstants.AssetType, readonly ActivitySubEventResourceInfoCardSourceAsset[]>>;
}

export interface ActivitySubEventResourceInfoCardConverterOptions {
  groupLabel?: string | null;
  context?: ActivitySubEventResourceInfoCardContext | null;
  activeUserId?: string | null;
  activeUserAssets?: readonly ActivitySubEventResourceInfoCardSourceAsset[];
  assetSettingsByKey?: Record<string, Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO>>;
  users?: UserDto[];
  eventCreatorUserId?: string | null;
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
      mediaStart: this.resourceMediaStart(card),
      mediaEnd: {
        variant: 'badge',
        tone: 'default',
        label: this.occupancyLabel(card),
        interactive: this.canOpenBadgeDetails(card),
        pendingCount: card.pending,
        ariaLabel: this.canOpenAssetMembers(card)
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
    card: AppDTOs.SubEventResourceCardDTO
  ): NonNullable<InfoCardData['mediaStart']> | null {
    if (!this.canOpenMap(card)) {
      return null;
    }
    return {
      variant: 'avatar',
      tone: 'default',
      icon: 'location_on',
      interactive: true,
      ariaLabel: card.type === AppConstants.ASSET_TYPE_TRANSPORT ? 'Open route map' : 'Open accommodation map'
    };
  }

  private static resourceMenuActions(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): readonly CardMenuActionId[] {
    const actions: CardMenuActionId[] = ['viewAsset'];
    if (this.canJoin(card, options)) {
      actions.push('joinResource');
    } else if (this.canLeave(card, options)) {
      actions.push('leaveResource');
    }
    actions.push('askOrganizer');
    actions.push('shareAsset');
    if (this.canReportResourceManager(card, options)) {
      actions.push(card.sourceAssetId ? 'reportManager' : 'reportOrganizer');
    }
    actions.push('removeAssignment');
    return actions;
  }

  private static resourceCardAssetType(card: AppDTOs.SubEventResourceCardDTO): AppConstants.AssetType | null {
    if (!card.sourceAssetId || !AppConstants.isAssetType(card.type)) {
      return null;
    }
    return card.type;
  }

  private static canOpenMap(card: AppDTOs.SubEventResourceCardDTO): boolean {
    if (!card.sourceAssetId || (card.type !== AppConstants.ASSET_TYPE_TRANSPORT && card.type !== AppConstants.ASSET_TYPE_ACCOMMODATION)) {
      return false;
    }
    return ActivityResourceBuilder.normalizeAssetRoutes(card.type, card.routes)
      .some(stop => stop.trim().length > 0);
  }

  private static canOpenAssetMembers(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return this.isAssignableAsset(card);
  }

  private static canOpenBadgeDetails(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return this.isAssignableAsset(card);
  }

  private static canJoin(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): boolean {
    return this.isJoinableAssignedAsset(card, options)
      && !this.hasActiveUserJoinRequest(card, options);
  }

  private static canLeave(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): boolean {
    return this.isJoinableAssignedAsset(card, options)
      && this.hasActiveUserJoinRequest(card, options);
  }

  private static isJoinableAssignedAsset(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): boolean {
    return !!card.sourceAssetId
      && (card.type === AppConstants.ASSET_TYPE_TRANSPORT || card.type === AppConstants.ASSET_TYPE_ACCOMMODATION)
      && !!this.sourceAsset(card, options)
      && !this.isSourceAssetManagedByActiveUser(card, options);
  }

  private static isSourceAssetManagedByActiveUser(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): boolean {
    const activeUserId = this.normalizeId(options.activeUserId);
    const managerUserId = this.normalizeId(this.assetManagerUserId(card, options));
    return activeUserId.length > 0 && managerUserId === activeUserId;
  }

  private static hasActiveUserJoinRequest(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): boolean {
    const sourceAsset = this.sourceAsset(card, options);
    const subEventId = this.contextSubEventId(options);
    const activeUserId = this.normalizeId(options.activeUserId);
    if (!sourceAsset || !subEventId || !activeUserId) {
      return false;
    }
    const users = options.users ?? [];
    return (sourceAsset.requests ?? []).some(request =>
      request.requestKind !== 'manual'
      && ActivityResourceBuilder.isSubEventScopedAssetRequest(request, subEventId)
      && AppUtils.resolveAssetRequestUserId(request, users) === activeUserId
    );
  }

  private static canReportResourceManager(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): boolean {
    const reportTargetUserId = this.normalizeId(this.reportTargetUserId(card, options));
    const activeUserId = this.normalizeId(options.activeUserId);
    return reportTargetUserId.length > 0 && reportTargetUserId !== activeUserId;
  }

  private static isAssignableAsset(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return !!card.sourceAssetId
      && AppConstants.isAssetType(card.type);
  }

  private static occupancyLabel(card: AppDTOs.SubEventResourceCardDTO): string {
    return `${card.accepted} / ${card.capacityTotal}`;
  }

  private static sourceAsset(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): ActivitySubEventResourceInfoCardSourceAsset | null {
    const type = this.resourceCardAssetType(card);
    const sourceAssetId = this.normalizeId(card.sourceAssetId);
    if (!type || !sourceAssetId) {
      return null;
    }
    return this.findSourceAsset(type, sourceAssetId, options);
  }

  private static findSourceAsset(
    type: AppConstants.AssetType,
    sourceAssetId: string,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): ActivitySubEventResourceInfoCardSourceAsset | null {
    return (options.activeUserAssets ?? []).find(asset =>
      asset.type === type && this.normalizeId(asset.id) === sourceAssetId
    ) ?? (options.context?.fallbackCardsByType?.[type] ?? []).find(asset =>
      asset.type === type && this.normalizeId(asset.id) === sourceAssetId
    ) ?? null;
  }

  private static assetManagerUserId(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): string | null {
    const subEventId = this.contextSubEventId(options);
    const sourceAssetId = this.normalizeId(card.sourceAssetId);
    if (!subEventId || !sourceAssetId || (card.type !== AppConstants.ASSET_TYPE_TRANSPORT && card.type !== AppConstants.ASSET_TYPE_ACCOMMODATION)) {
      return null;
    }
    const settings = options.assetSettingsByKey?.[ActivityResourceBuilder.subEventAssetAssignmentKey(subEventId, card.type)];
    const managerUserId = this.normalizeId(settings?.[sourceAssetId]?.addedByUserId);
    return managerUserId || null;
  }

  private static reportTargetUserId(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardConverterOptions
  ): string | null {
    const sourceAsset = this.sourceAsset(card, options);
    const managerUserId = this.normalizeId(sourceAsset?.ownerUserId) || this.normalizeId(this.assetManagerUserId(card, options));
    if (managerUserId) {
      return managerUserId;
    }
    return this.normalizeId(options.eventCreatorUserId) || this.normalizeId(options.context?.subEvent?.createdByUserId) || null;
  }

  private static contextSubEventId(options: ActivitySubEventResourceInfoCardConverterOptions): string {
    return this.normalizeId(options.context?.subEvent?.id);
  }

  private static normalizeId(value: string | null | undefined): string {
    return `${value ?? ''}`.trim();
  }
}

export const activitySubEventResourceInfoCardConverter =
  ActivitySubEventResourceInfoCardConverter satisfies UiListConverter<
    AppDTOs.SubEventResourceCardDTO,
    InfoCardData,
    ActivitySubEventResourceInfoCardConverterOptions
  >;
