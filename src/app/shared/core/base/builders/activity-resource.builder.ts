import { AppUtils } from '../../../app-utils';
import type { InfoCardData, CardMenuAction } from '../../../ui';
import type * as AppTypes from '../models';
import type * as ContractTypes from '../../contracts';
import { AssetDefaultsBuilder } from './asset-defaults.builder';
import { PricingBuilder } from './pricing.builder';

import type * as AppDTOs from '../dto';
import type * as AppConstants from '../../common/constants';
export interface ActivitySubEventResourceInfoCardOptions {
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

export class ActivityResourceBuilder {
  static buildSubEventResourceInfoCard(
    card: AppDTOs.SubEventResourceCardDTO,
    options: ActivitySubEventResourceInfoCardOptions
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

  static ownerKey(ref: AppDTOs.ActivitySubEventResourceStateRefDTO): string {
    return `${ref.assetOwnerUserId}:${ref.ownerId}`;
  }

  static recordId(ref: AppDTOs.ActivitySubEventResourceStateRefDTO): string {
    return `${ref.assetOwnerUserId}:${ref.ownerId}:${ref.subEventId}`;
  }

  static createEmptyState(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): AppDTOs.ActivitySubEventResourceStateDTO {
    return {
      ownerId: ref.ownerId.trim(),
      subEventId: ref.subEventId.trim(),
      assetOwnerUserId: ref.assetOwnerUserId.trim(),
      assetAssignmentIds: {},
      assetSettingsByType: {},
      supplyContributionEntriesByAssetId: {},
      fallbackAssetCardsByType: {}
    };
  }

  static cloneState(
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    if (!state) {
      return null;
    }
    return {
      ownerId: `${state.ownerId ?? ''}`.trim(),
      subEventId: `${state.subEventId ?? ''}`.trim(),
      assetOwnerUserId: `${state.assetOwnerUserId ?? ''}`.trim(),
      assetAssignmentIds: this.cloneAssetAssignmentIds(state.assetAssignmentIds),
      assetSettingsByType: this.cloneAssetSettingsByType(state.assetSettingsByType),
      supplyContributionEntriesByAssetId: this.cloneSupplyContributionEntriesByAssetId(
        state.supplyContributionEntriesByAssetId
      ),
      fallbackAssetCardsByType: this.cloneFallbackAssetCardsByType(state.fallbackAssetCardsByType)
    };
  }

  static normalizeState(
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    fallbackRef?: AppDTOs.ActivitySubEventResourceStateRefDTO | null
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    const fallback = fallbackRef ? this.createEmptyState(fallbackRef) : null;
    if (!state && !fallback) {
      return null;
    }

    const next = this.cloneState(state) ?? fallback;
    if (!next) {
      return null;
    }

    if (!next.ownerId || !next.subEventId || !next.assetOwnerUserId) {
      return fallback;
    }

    next.assetAssignmentIds = this.cloneAssetAssignmentIds(next.assetAssignmentIds);
    next.assetSettingsByType = this.cloneAssetSettingsByType(next.assetSettingsByType);
    next.supplyContributionEntriesByAssetId = this.cloneSupplyContributionEntriesByAssetId(
      next.supplyContributionEntriesByAssetId
    );
    next.fallbackAssetCardsByType = this.cloneFallbackAssetCardsByType(next.fallbackAssetCardsByType);
    return next;
  }

  static cloneAssetAssignmentIds(
    source: AppDTOs.ActivitySubEventAssetAssignmentIdsDTO | null | undefined
  ): AppDTOs.ActivitySubEventAssetAssignmentIdsDTO {
    const next: AppDTOs.ActivitySubEventAssetAssignmentIdsDTO = {};
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const ids = Array.isArray(source?.[type]) ? source?.[type] : [];
      const normalizedIds = Array.from(new Set(ids
        .map(id => `${id ?? ''}`.trim())
        .filter(id => id.length > 0)));
      if (normalizedIds.length > 0) {
        next[type] = normalizedIds;
      }
    }
    return next;
  }

  static cloneAssetSettingsByType(
    source: AppDTOs.ActivitySubEventAssetSettingsByTypeDTO | null | undefined
  ): AppDTOs.ActivitySubEventAssetSettingsByTypeDTO {
    const next: AppDTOs.ActivitySubEventAssetSettingsByTypeDTO = {};
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const rawMap = source?.[type];
      if (!rawMap || typeof rawMap !== 'object') {
        continue;
      }
      const normalizedMap: Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> = {};
      for (const [assetId, settings] of Object.entries(rawMap)) {
        const normalizedAssetId = `${assetId ?? ''}`.trim();
        if (!normalizedAssetId || !settings) {
          continue;
        }
        normalizedMap[normalizedAssetId] = {
          capacityMin: Math.max(0, Math.trunc(Number(settings.capacityMin) || 0)),
          capacityMax: Math.max(0, Math.trunc(Number(settings.capacityMax) || 0)),
          addedByUserId: `${settings.addedByUserId ?? ''}`.trim(),
          routes: this.normalizeRoutes(settings.routes)
        };
      }
      if (Object.keys(normalizedMap).length > 0) {
        next[type] = normalizedMap;
      }
    }
    return next;
  }

  static cloneSupplyContributionEntriesByAssetId(
    source: AppDTOs.ActivitySubEventSupplyContributionsByAssetIdDTO | null | undefined
  ): AppDTOs.ActivitySubEventSupplyContributionsByAssetIdDTO {
    const next: AppDTOs.ActivitySubEventSupplyContributionsByAssetIdDTO = {};
    if (!source || typeof source !== 'object') {
      return next;
    }
    for (const [assetId, rawEntries] of Object.entries(source)) {
      const normalizedAssetId = `${assetId ?? ''}`.trim();
      if (!normalizedAssetId || !Array.isArray(rawEntries)) {
        continue;
      }
      const entries = rawEntries
        .map(entry => ({
          id: `${entry?.id ?? ''}`.trim(),
          userId: `${entry?.userId ?? ''}`.trim(),
          quantity: Math.max(0, Math.trunc(Number(entry?.quantity) || 0)),
          addedAtIso: `${entry?.addedAtIso ?? ''}`.trim()
        }))
        .filter(entry => entry.id.length > 0 && entry.userId.length > 0 && entry.quantity > 0)
        .sort((left, right) => AppUtils.toSortableDate(left.addedAtIso) - AppUtils.toSortableDate(right.addedAtIso));
      if (entries.length > 0) {
        next[normalizedAssetId] = entries;
      }
    }
    return next;
  }

  static cloneFallbackAssetCardsByType(
    source: Partial<Record<AppConstants.AssetType, AppDTOs.AssetCardDTO[]>> | null | undefined
  ): Partial<Record<AppConstants.AssetType, AppDTOs.AssetCardDTO[]>> {
    const next: Partial<Record<AppConstants.AssetType, AppDTOs.AssetCardDTO[]>> = {};
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const cards = source?.[type];
      if (!Array.isArray(cards) || cards.length === 0) {
        continue;
      }
      next[type] = cards.map(card => this.cloneAssetCard(card));
    }
    return next;
  }

  static resolveAssignedAssetIds(
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    type: AppConstants.AssetType,
    assets: readonly AppDTOs.AssetCardDTO[]
  ): string[] {
    const eligibleIds = this.resolveAvailableAssetCards(type, state, assets).map(card => card.id);
    const eligible = new Set(eligibleIds);
    const stored = state?.assetAssignmentIds?.[type] ?? [];
    return stored.filter(id => eligible.has(id));
  }

  static resolveAssignedAssetSettings(
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    type: AppConstants.AssetType
  ): Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> {
    return {
      ...(state?.assetSettingsByType?.[type] ?? {})
    };
  }

  static resolveSupplyContributionEntries(
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assetId: string
  ): AppDTOs.SubEventSupplyContributionEntryDTO[] {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      return [];
    }
    return [
      ...(state?.supplyContributionEntriesByAssetId?.[normalizedAssetId] ?? [])
    ].map(entry => ({ ...entry }));
  }

  static resourceAcceptedCount(
    subEvent: ContractTypes.SubEventFormItem,
    type: AppConstants.AssetType,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assets: readonly AppDTOs.AssetCardDTO[]
  ): number {
    const assignedCards = this.resolveAssignedCards(type, state, assets);
    if (assignedCards.length > 0) {
      if (type === 'Supplies') {
        return assignedCards.reduce((sum, card) => (
          sum + this.resolveSupplyContributionEntries(state, card.id)
            .reduce((entrySum, entry) => entrySum + Math.max(0, Math.trunc(Number(entry.quantity) || 0)), 0)
        ), 0);
      }
      return assignedCards.reduce((sum, card) => (
        sum + card.requests.filter(request => request.status === 'accepted').length
      ), 0);
    }
    if (type === 'Car') {
      return Math.max(0, Math.trunc(Number(subEvent.carsAccepted) || 0));
    }
    if (type === 'Accommodation') {
      return Math.max(0, Math.trunc(Number(subEvent.accommodationAccepted) || 0));
    }
    return Math.max(0, Math.trunc(Number(subEvent.suppliesAccepted) || 0));
  }

  static resourcePendingCount(
    subEvent: ContractTypes.SubEventFormItem,
    type: AppConstants.AssetType,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assets: readonly AppDTOs.AssetCardDTO[]
  ): number {
    const assignedCards = this.resolveAssignedCards(type, state, assets);
    if (assignedCards.length > 0) {
      if (type === 'Supplies') {
        return 0;
      }
      return assignedCards.reduce((sum, card) => (
        sum + card.requests.filter(request => request.status === 'pending').length
      ), 0);
    }
    if (type === 'Car') {
      return Math.max(0, Math.trunc(Number(subEvent.carsPending) || 0));
    }
    if (type === 'Accommodation') {
      return Math.max(0, Math.trunc(Number(subEvent.accommodationPending) || 0));
    }
    return Math.max(0, Math.trunc(Number(subEvent.suppliesPending) || 0));
  }

  static resourceCapacityBounds(
    subEvent: ContractTypes.SubEventFormItem,
    type: AppConstants.AssetType,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assets: readonly AppDTOs.AssetCardDTO[],
    accepted: number,
    pending: number
  ): { capacityMin: number; capacityMax: number } {
    const assignedCards = this.resolveAssignedCards(type, state, assets);
    if (assignedCards.length > 0) {
      const settings = this.resolveAssignedAssetSettings(state, type);
      return {
        capacityMin: 0,
        capacityMax: assignedCards.reduce((sum, card) => (
          sum + Math.max(0, Math.trunc(Number(settings[card.id]?.capacityMax ?? card.capacityTotal) || 0))
        ), 0)
      };
    }

    const observed = Math.max(accepted, accepted + pending);
    if (type === 'Car') {
      const min = Math.max(0, Math.trunc(Number(subEvent.carsCapacityMin) || 0));
      const max = Math.max(min, Math.trunc(Number(subEvent.carsCapacityMax) || observed));
      return { capacityMin: min, capacityMax: max };
    }
    if (type === 'Accommodation') {
      const min = Math.max(0, Math.trunc(Number(subEvent.accommodationCapacityMin) || 0));
      const max = Math.max(min, Math.trunc(Number(subEvent.accommodationCapacityMax) || observed));
      return { capacityMin: min, capacityMax: max };
    }
    const min = Math.max(0, Math.trunc(Number(subEvent.suppliesCapacityMin) || 0));
    const max = Math.max(min, Math.trunc(Number(subEvent.suppliesCapacityMax) || observed));
    return { capacityMin: min, capacityMax: max };
  }

  static buildSeededState(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO,
    assets: readonly AppDTOs.AssetCardDTO[]
  ): AppDTOs.ActivitySubEventResourceStateDTO {
    return this.createEmptyState(ref);
  }

  private static resolveAssignedCards(
    type: AppConstants.AssetType,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assets: readonly AppDTOs.AssetCardDTO[]
  ): AppDTOs.AssetCardDTO[] {
    const assignedIds = this.resolveAssignedAssetIds(state, type, assets);
    const availableCards = this.resolveAvailableAssetCards(type, state, assets);
    return assignedIds
      .map(id => availableCards.find(card => card.id === id && card.type === type) ?? null)
      .filter((card): card is AppDTOs.AssetCardDTO => card !== null);
  }

  private static resolveAvailableAssetCards(
    type: AppConstants.AssetType,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assets: readonly AppDTOs.AssetCardDTO[]
  ): AppDTOs.AssetCardDTO[] {
    const nextById = new Map<string, AppDTOs.AssetCardDTO>();
    for (const card of assets) {
      if (card.type !== type) {
        continue;
      }
      nextById.set(card.id, card);
    }
    for (const card of state?.fallbackAssetCardsByType?.[type] ?? []) {
      if (card.type !== type || nextById.has(card.id)) {
        continue;
      }
      nextById.set(card.id, card);
    }
    return [...nextById.values()];
  }

  static isSubEventManualAssignmentRequest(request: AppDTOs.AssetMemberRequestDTO, subEventId: string): boolean {
    const normalizedSubEventId = subEventId.trim();
    return (
      request.requestKind === 'manual'
      && normalizedSubEventId.length > 0
      && request.id.startsWith(`manual:${normalizedSubEventId}:`)
    );
  }

  static assetRequestSyncSignature(request: AppDTOs.AssetMemberRequestDTO): string {
    return JSON.stringify({
      id: request.id,
      userId: request.userId ?? '',
      status: request.status,
      requestKind: request.requestKind ?? '',
      bookingQuantity: request.booking?.quantity ?? '',
      bookingAcceptedPolicyIds: [...(request.booking?.acceptedPolicyIds ?? [])]
    });
  }

  private static cloneAssetCard(card: AppDTOs.AssetCardDTO): AppDTOs.AssetCardDTO {
    return {
      ...card,
      routes: [...(card.routes ?? [])],
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(item => ({ ...item })),
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
      requests: card.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      }))
    };
  }

  private static normalizeRoutes(routes: readonly string[] | undefined | null): string[] {
    if (!Array.isArray(routes)) {
      return [];
    }
    return routes
      .map(route => `${route ?? ''}`.trim())
      .filter(route => route.length > 0);
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
    options: ActivitySubEventResourceInfoCardOptions
  ): readonly CardMenuAction[] {
    const actions: CardMenuAction[] = ['viewAsset'];
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
