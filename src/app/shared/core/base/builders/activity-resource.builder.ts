import { AppUtils } from '../../../app-utils';
import type * as ContractTypes from '../../contracts';
import { PricingBuilder } from './pricing.builder';

import type * as AppDTOs from '../../contracts';
import * as AppConstants from '../../common/constants';

type ActivityResourceAssetDTO = AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO;

export interface ActivityRuntimeResourceScopeRef {
  ownerId: string | null | undefined;
  subEventId: string | null | undefined;
  runtimeKind?: string | null;
  eventId?: string | null;
  groupId?: string | null;
  memberOwnerId?: string | null;
  memberOwnerType?: AppConstants.ActivityMemberOwnerType | null;
}

export interface ActivityRuntimeResourceScopeIdentity {
  isMainEvent: boolean;
  eventId: string;
  resourceOwnerId: string;
  resourceScopeId: string;
  memberOwner: AppDTOs.ActivityMemberOwnerRef | null;
  chatChannelType: ContractTypes.ChatChannelType | null;
  chatOwnerId: string;
}

export interface ActivityRuntimeResourceTargetRef extends ActivityRuntimeResourceScopeRef {
  name: string;
  description?: string | null;
  location?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}

export class ActivityResourceBuilder {
  static chatResourceDateRange(
    chat: Pick<ContractTypes.ChatDTO, 'contextStartAtIso' | 'contextEndAtIso'>
  ): { startAtIso: string; endAtIso: string } | null {
    const startAtIso = `${chat.contextStartAtIso ?? ''}`.trim();
    const endAtIso = `${chat.contextEndAtIso ?? ''}`.trim();
    return startAtIso && endAtIso ? { startAtIso, endAtIso } : null;
  }

  static authorizationEventId(ownerIdValue: string, subEventIdValue = ''): string {
    const ownerId = `${ownerIdValue ?? ''}`.trim();
    const subEventId = `${subEventIdValue ?? ''}`.trim();
    if (!ownerId) {
      return '';
    }
    let runtimeOwnerId = ownerId;
    if (subEventId) {
      const groupOwnerMarker = ownerId.indexOf(`:${subEventId}:`);
      if (groupOwnerMarker > 0) {
        runtimeOwnerId = ownerId.slice(0, groupOwnerMarker);
      }
    }
    const slotMarker = runtimeOwnerId.indexOf(':slot:');
    return slotMarker > 0 ? runtimeOwnerId.slice(0, slotMarker) : runtimeOwnerId;
  }

  static runtimeResourceScopeIdentity(
    ref: ActivityRuntimeResourceScopeRef
  ): ActivityRuntimeResourceScopeIdentity {
    const resourceOwnerId = `${ref.ownerId ?? ''}`.trim();
    const resourceScopeId = `${ref.subEventId ?? ''}`.trim();
    const groupId = `${ref.groupId ?? ''}`.trim();
    const memberOwnerId = `${ref.memberOwnerId ?? ''}`.trim();
    const memberOwnerType = ref.memberOwnerType === 'event' ? 'event' : 'group';
    const isMainEvent = !groupId && `${ref.runtimeKind ?? ''}`.trim().toUpperCase() === 'MAIN_EVENT';
    const eventId = `${ref.eventId ?? ''}`.trim()
      || this.authorizationEventId(resourceOwnerId, resourceScopeId);

    if (groupId) {
      const suffix = `:${resourceScopeId}:${groupId}`;
      const chatOwnerId = resourceOwnerId && resourceScopeId
        ? (resourceOwnerId.endsWith(suffix) ? resourceOwnerId : `${resourceOwnerId}${suffix}`)
        : '';
      return {
        isMainEvent: false,
        eventId,
        resourceOwnerId,
        resourceScopeId,
        memberOwner: memberOwnerId
          ? { ownerType: memberOwnerType, ownerId: memberOwnerId }
          : resourceOwnerId ? { ownerType: 'group', ownerId: resourceOwnerId } : null,
        chatChannelType: chatOwnerId ? 'groupSubEvent' : null,
        chatOwnerId
      };
    }

    if (isMainEvent) {
      return {
        isMainEvent: true,
        eventId,
        resourceOwnerId,
        resourceScopeId,
        memberOwner: eventId ? { ownerType: 'event', ownerId: eventId } : null,
        chatChannelType: eventId ? 'mainEvent' : null,
        chatOwnerId: eventId
      };
    }

    const subEventOwnerId = resourceOwnerId && resourceScopeId
      ? `${resourceOwnerId}:${resourceScopeId}`
      : resourceScopeId || resourceOwnerId;
    return {
      isMainEvent: false,
      eventId,
      resourceOwnerId,
      resourceScopeId,
      memberOwner: subEventOwnerId ? { ownerType: 'subEvent', ownerId: subEventOwnerId } : null,
      chatChannelType: resourceOwnerId && resourceScopeId ? 'optionalSubEvent' : null,
      chatOwnerId: resourceOwnerId && resourceScopeId ? subEventOwnerId : ''
    };
  }

  static runtimeResourceTarget(
    ref: ActivityRuntimeResourceTargetRef
  ): AppDTOs.SubEventDTO | null {
    const id = `${ref.subEventId ?? ''}`.trim();
    if (!id) {
      return null;
    }
    const runtimeKind = `${ref.runtimeKind ?? ''}`.trim() || null;
    const isMainEvent = runtimeKind?.toUpperCase() === 'MAIN_EVENT';
    const eventId = `${ref.eventId ?? ''}`.trim()
      || (isMainEvent ? this.authorizationEventId(`${ref.ownerId ?? ''}`, id) : '');
    return {
      id,
      runtimeKind,
      eventId: eventId || null,
      name: `${ref.name ?? ''}`.trim() || (isMainEvent ? 'Event' : 'Sub Event'),
      description: `${ref.description ?? ''}`.trim(),
      location: `${ref.location ?? ''}`.trim(),
      startAt: `${ref.startAt ?? ''}`.trim(),
      endAt: `${ref.endAt ?? ''}`.trim(),
      optional: !isMainEvent,
      capacityMin: 0,
      capacityMax: 0,
      membersAccepted: 0,
      membersPending: 0,
      carsPending: 0,
      accommodationPending: 0,
      suppliesPending: 0,
      carsAccepted: 0,
      accommodationAccepted: 0,
      suppliesAccepted: 0
    };
  }

  static ownerKey(ref: AppDTOs.ActivitySubEventResourceStateRefDTO): string {
    return `${ref.assetOwnerUserId}:${ref.ownerId}`;
  }

  static recordId(ref: AppDTOs.ActivitySubEventResourceStateRefDTO): string {
    return `${ref.assetOwnerUserId}:${ref.ownerId}:${ref.subEventId}`;
  }

  static scopeId(ref: AppDTOs.ActivitySubEventResourceStateRefDTO): string {
    return `${ref.ownerId}:${ref.subEventId}:${ref.assetOwnerUserId}`;
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
      fallbackAssetCardsByType: {},
      resourceMetricsByType: {}
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
      fallbackAssetCardsByType: this.cloneFallbackAssetCardsByType(state.fallbackAssetCardsByType),
      resourceMetricsByType: this.cloneResourceMetricsByType(state.resourceMetricsByType)
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
    next.resourceMetricsByType = this.cloneResourceMetricsByType(next.resourceMetricsByType);
    return next;
  }

  static normalizeScope(
    scope: AppDTOs.ActivitySubEventResourceScopeDTO | null | undefined,
    viewerRef: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): AppDTOs.ActivitySubEventResourceScopeDTO {
    const viewerState = this.normalizeState(scope?.viewerState, viewerRef)
      ?? this.createEmptyState(viewerRef);
    const visibleByRecordId = new Map<string, AppDTOs.ActivitySubEventResourceStateDTO>();
    for (const source of scope?.visibleStates ?? []) {
      const state = this.normalizeState(source);
      if (
        !state
        || state.ownerId !== viewerRef.ownerId
        || state.subEventId !== viewerRef.subEventId
      ) {
        continue;
      }
      visibleByRecordId.set(this.recordId(state), state);
    }
    if ((viewerState.assetAssignmentIds && Object.keys(viewerState.assetAssignmentIds).length > 0)
      || (viewerState.assetSettingsByType && Object.keys(viewerState.assetSettingsByType).length > 0)
      || Object.keys(viewerState.supplyContributionEntriesByAssetId ?? {}).length > 0) {
      visibleByRecordId.set(this.recordId(viewerState), viewerState);
    }
    return {
      viewerState: this.cloneState(viewerState) ?? this.createEmptyState(viewerRef),
      visibleStates: [...visibleByRecordId.values()]
        .sort((left, right) => left.assetOwnerUserId.localeCompare(right.assetOwnerUserId))
        .map(state => this.cloneState(state) as AppDTOs.ActivitySubEventResourceStateDTO)
    };
  }

  static cloneResourceMetricsByType(
    source: Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>> | null | undefined
  ): Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>> {
    const next: Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>> = {};
    for (const type of AppConstants.ASSET_TYPES) {
      const metric = source?.[type];
      if (!metric) {
        continue;
      }
      next[type] = {
        accepted: Math.max(0, Math.trunc(Number(metric.accepted) || 0)),
        pending: Math.max(0, Math.trunc(Number(metric.pending) || 0)),
        capacityMin: Math.max(0, Math.trunc(Number(metric.capacityMin) || 0)),
        capacityMax: Math.max(0, Math.trunc(Number(metric.capacityMax) || 0))
      };
    }
    return next;
  }

  static withPersistedResourceMetrics(
    subEvent: ContractTypes.SubEventDTO,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined
  ): ContractTypes.SubEventDTO {
    const next = { ...subEvent };
    const metrics = this.cloneResourceMetricsByType(state?.resourceMetricsByType);
    const transport = metrics[AppConstants.ASSET_TYPE_TRANSPORT];
    if (transport) {
      next.carsAccepted = transport.accepted;
      next.carsPending = transport.pending;
      next.carsCapacityMin = transport.capacityMin;
      next.carsCapacityMax = transport.capacityMax;
    }
    const accommodation = metrics[AppConstants.ASSET_TYPE_ACCOMMODATION];
    if (accommodation) {
      next.accommodationAccepted = accommodation.accepted;
      next.accommodationPending = accommodation.pending;
      next.accommodationCapacityMin = accommodation.capacityMin;
      next.accommodationCapacityMax = accommodation.capacityMax;
    }
    const supplies = metrics[AppConstants.ASSET_TYPE_SUPPLIES];
    if (supplies) {
      next.suppliesAccepted = supplies.accepted;
      next.suppliesPending = supplies.pending;
      next.suppliesCapacityMin = supplies.capacityMin;
      next.suppliesCapacityMax = supplies.capacityMax;
    }
    return next;
  }

  static cloneAssetAssignmentIds(
    source: AppDTOs.ActivitySubEventAssetAssignmentIdsDTO | null | undefined
  ): AppDTOs.ActivitySubEventAssetAssignmentIdsDTO {
    const next: AppDTOs.ActivitySubEventAssetAssignmentIdsDTO = {};
    for (const type of AppConstants.ASSET_TYPES) {
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
    for (const type of AppConstants.ASSET_TYPES) {
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
        const routes = this.normalizeRoutes(settings.routes);
        normalizedMap[normalizedAssetId] = {
          capacityMin: Math.max(0, Math.trunc(Number(settings.capacityMin) || 0)),
          capacityMax: Math.max(0, Math.trunc(Number(settings.capacityMax) || 0)),
          quantity: Math.max(0, Math.trunc(Number(settings.quantity) || 0)),
          addedByUserId: `${settings.addedByUserId ?? ''}`.trim(),
          routeEnabled: this.normalizeRouteEnabled(settings, routes),
          routes
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
    source: Partial<Record<AppConstants.AssetType, AppDTOs.AssetDetailDTO[]>> | null | undefined
  ): Partial<Record<AppConstants.AssetType, AppDTOs.AssetDetailDTO[]>> {
    const next: Partial<Record<AppConstants.AssetType, AppDTOs.AssetDetailDTO[]>> = {};
    for (const type of AppConstants.ASSET_TYPES) {
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
    assets: readonly ActivityResourceAssetDTO[]
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
    subEvent: ContractTypes.SubEventDTO,
    type: AppConstants.AssetType,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assets: readonly ActivityResourceAssetDTO[]
  ): number {
    const assignedCards = this.resolveAssignedCards(type, state, assets);
    if (assignedCards.length > 0) {
      if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
        return assignedCards.reduce((sum, card) => (
          sum + this.resolveSupplyContributionEntries(state, card.id)
            .reduce((entrySum, entry) => entrySum + Math.max(0, Math.trunc(Number(entry.quantity) || 0)), 0)
        ), 0);
      }
      return assignedCards.reduce((sum, card) => (
        sum + this.subEventOccupancyRequestCount(card, subEvent.id, 'accepted', state?.ownerId)
      ), 0);
    }
    if (state) {
      return 0;
    }
    if (type === AppConstants.ASSET_TYPE_TRANSPORT) {
      return Math.max(0, Math.trunc(Number(subEvent.carsAccepted) || 0));
    }
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return Math.max(0, Math.trunc(Number(subEvent.accommodationAccepted) || 0));
    }
    return Math.max(0, Math.trunc(Number(subEvent.suppliesAccepted) || 0));
  }

  static resourcePendingCount(
    subEvent: ContractTypes.SubEventDTO,
    type: AppConstants.AssetType,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assets: readonly ActivityResourceAssetDTO[]
  ): number {
    const assignedCards = this.resolveAssignedCards(type, state, assets);
    if (assignedCards.length > 0) {
      if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
        return 0;
      }
      return assignedCards.reduce((sum, card) => (
        sum + this.subEventOccupancyRequestCount(card, subEvent.id, 'pending', state?.ownerId)
      ), 0);
    }
    if (state) {
      return 0;
    }
    if (type === AppConstants.ASSET_TYPE_TRANSPORT) {
      return Math.max(0, Math.trunc(Number(subEvent.carsPending) || 0));
    }
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return Math.max(0, Math.trunc(Number(subEvent.accommodationPending) || 0));
    }
    return Math.max(0, Math.trunc(Number(subEvent.suppliesPending) || 0));
  }

  static resourceCapacityBounds(
    subEvent: ContractTypes.SubEventDTO,
    type: AppConstants.AssetType,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assets: readonly ActivityResourceAssetDTO[],
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
    if (state) {
      return { capacityMin: 0, capacityMax: 0 };
    }

    const observed = Math.max(accepted, accepted + pending);
    if (type === AppConstants.ASSET_TYPE_TRANSPORT) {
      const min = Math.max(0, Math.trunc(Number(subEvent.carsCapacityMin) || 0));
      const max = Math.max(min, Math.trunc(Number(subEvent.carsCapacityMax) || observed));
      return { capacityMin: min, capacityMax: max };
    }
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      const min = Math.max(0, Math.trunc(Number(subEvent.accommodationCapacityMin) || 0));
      const max = Math.max(min, Math.trunc(Number(subEvent.accommodationCapacityMax) || observed));
      return { capacityMin: min, capacityMax: max };
    }
    const min = Math.max(0, Math.trunc(Number(subEvent.suppliesCapacityMin) || 0));
    const max = Math.max(min, Math.trunc(Number(subEvent.suppliesCapacityMax) || observed));
    return { capacityMin: min, capacityMax: max };
  }

  static buildPersistedResourceMetrics(
    state: AppDTOs.ActivitySubEventResourceStateDTO,
    assets: readonly ActivityResourceAssetDTO[]
  ): Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>> {
    return Object.fromEntries(AppConstants.ASSET_TYPES.map(type => {
      const assignedCards = this.resolveAssignedCards(type, state, assets);
      const settings = this.resolveAssignedAssetSettings(state, type);
      const accepted = type === AppConstants.ASSET_TYPE_SUPPLIES
        ? assignedCards.reduce((sum, card) => (
            sum + this.resolveSupplyContributionEntries(state, card.id)
              .reduce((entrySum, entry) => entrySum + Math.max(0, Math.trunc(Number(entry.quantity) || 0)), 0)
          ), 0)
        : assignedCards.reduce((sum, card) => (
            sum + this.subEventOccupancyRequestCount(card, state.subEventId, 'accepted', state.ownerId)
          ), 0);
      const pending = type === AppConstants.ASSET_TYPE_SUPPLIES
        ? 0
        : assignedCards.reduce((sum, card) => (
            sum + this.subEventOccupancyRequestCount(card, state.subEventId, 'pending', state.ownerId)
          ), 0);
      const capacityMin = assignedCards.reduce((sum, card) => (
        sum + Math.max(0, Math.trunc(Number(settings[card.id]?.capacityMin) || 0))
      ), 0);
      const capacityMax = assignedCards.reduce((sum, card) => (
        sum + Math.max(0, Math.trunc(Number(settings[card.id]?.capacityMax ?? card.capacityTotal) || 0))
      ), 0);
      return [type, {
        accepted,
        pending,
        capacityMin,
        capacityMax: Math.max(capacityMin, capacityMax)
      }];
    })) as Partial<Record<AppConstants.AssetType, AppDTOs.SubEventResourceMetricDTO>>;
  }

  private static resolveAssignedCards(
    type: AppConstants.AssetType,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assets: readonly ActivityResourceAssetDTO[]
  ): ActivityResourceAssetDTO[] {
    const assignedIds = this.resolveAssignedAssetIds(state, type, assets);
    const availableCards = this.resolveAvailableAssetCards(type, state, assets);
    return assignedIds
      .map(id => availableCards.find(card => card.id === id && card.type === type) ?? null)
      .filter((card): card is ActivityResourceAssetDTO => card !== null);
  }

  private static resolveAvailableAssetCards(
    type: AppConstants.AssetType,
    state: AppDTOs.ActivitySubEventResourceStateDTO | null | undefined,
    assets: readonly ActivityResourceAssetDTO[]
  ): ActivityResourceAssetDTO[] {
    const nextById = new Map<string, ActivityResourceAssetDTO>();
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
    const requestId = `${request.id ?? ''}`.trim();
    return (
      request.requestKind === 'manual'
      && normalizedSubEventId.length > 0
      && requestId.startsWith(`manual:${normalizedSubEventId}:`)
    );
  }

  static isSubEventScopedAssetRequest(
    request: AppDTOs.AssetMemberRequestDTO,
    subEventId: string,
    ownerId?: string | null
  ): boolean {
    const normalizedSubEventId = subEventId.trim();
    const normalizedOwnerId = `${ownerId ?? ''}`.trim();
    const bookingOwnerId = `${request.booking?.eventId ?? ''}`.trim();
    const ownerIdsMatchExactly = bookingOwnerId === normalizedOwnerId;
    const groupOwnerMarker = normalizedSubEventId ? `:${normalizedSubEventId}:` : '';
    const ownerIsUngroupedSlotRuntime = normalizedOwnerId.includes(':slot:')
      && (!groupOwnerMarker || !normalizedOwnerId.includes(groupOwnerMarker));
    const bookingIsUngroupedSlotRuntime = bookingOwnerId.includes(':slot:')
      && (!groupOwnerMarker || !bookingOwnerId.includes(groupOwnerMarker));
    const ownerIdsMatchSlotAuthorizationScope = (
      ownerIsUngroupedSlotRuntime
      || bookingIsUngroupedSlotRuntime
    ) && this.authorizationEventId(normalizedOwnerId, normalizedSubEventId)
      === this.authorizationEventId(bookingOwnerId, normalizedSubEventId);
    if (normalizedOwnerId && !ownerIdsMatchExactly && !ownerIdsMatchSlotAuthorizationScope) {
      return false;
    }
    return this.isSubEventManualAssignmentRequest(request, normalizedSubEventId)
      || `${request.booking?.subEventId ?? ''}`.trim() === normalizedSubEventId;
  }

  static assetRequestQuantity(request: AppDTOs.AssetMemberRequestDTO): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 1));
  }

  static subEventOccupancyRequestCount(
    card: ActivityResourceAssetDTO,
    subEventId: string,
    status: AppConstants.AssetRequestStatus,
    ownerId?: string | null
  ): number {
    const normalizedSubEventId = subEventId.trim();
    if (!normalizedSubEventId) {
      return 0;
    }
    return card.requests
      .filter(request =>
        request.status === status
        && this.isSubEventScopedAssetRequest(request, normalizedSubEventId, ownerId)
        && !this.isSubEventManualAssignmentRequest(request, normalizedSubEventId)
      )
      .reduce((sum, request) => sum + this.assetRequestQuantity(request), 0);
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

  static subEventAssetAssignmentKey(subEventId: string, type: AppConstants.AssetType): string {
    return `${subEventId}:${type}`;
  }

  static subEventSupplyAssignmentKey(subEventId: string, cardId: string): string {
    return `${subEventId}:${cardId}`;
  }

  static assetDetailText(card: { details?: string | null; description?: string | null }): string {
    return `${card.details ?? card.description ?? ''}`.trim();
  }

  static assetSourceLink(card: { sourceLink?: string | null }): string {
    return `${card.sourceLink ?? ''}`.trim();
  }

  static normalizeAssetRoutes(
    type: AppConstants.AssetType,
    routes: readonly string[] | undefined | null
  ): string[] {
    if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
      return [];
    }
    const cleaned = (routes ?? [])
      .map(value => `${value ?? ''}`.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return cleaned.length > 0 ? [cleaned[0]] : [''];
    }
    return cleaned.length > 0 ? cleaned : [''];
  }

  static assetRequestTimeframeLabel(startAtIso: string, endAtIso: string): string {
    const start = AppUtils.isoLocalDateTimeToDate(startAtIso);
    const end = AppUtils.isoLocalDateTimeToDate(endAtIso);
    if (!start || !end) {
      return '';
    }
    const sameDay = start.toDateString() === end.toDateString();
    const startDate = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endDate = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return sameDay
      ? `${startDate} · ${startTime} - ${endTime}`
      : `${startDate} ${startTime} - ${endDate} ${endTime}`;
  }

  static defaultAssetExploreRange(
    subEvent: ContractTypes.SubEventDTO
  ): { startAtIso: string; endAtIso: string } {
    const startAtIso = `${subEvent.startAt ?? ''}`.trim() || AppUtils.toIsoDateTimeLocal(new Date());
    const endAtIso = `${subEvent.endAt ?? ''}`.trim();
    if (endAtIso) {
      return {
        startAtIso,
        endAtIso
      };
    }
    const base = AppUtils.isoLocalDateTimeToDate(startAtIso) ?? new Date();
    const nextEnd = new Date(base);
    nextEnd.setHours(nextEnd.getHours() + 2);
    return {
      startAtIso,
      endAtIso: AppUtils.toIsoDateTimeLocal(nextEnd)
    };
  }

  private static cloneAssetCard(card: AppDTOs.AssetDetailDTO): AppDTOs.AssetDetailDTO {
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

  private static normalizeRouteEnabled(
    settings: Partial<AppDTOs.SubEventAssignedAssetSettingsDTO>,
    routes: readonly string[]
  ): boolean {
    return typeof settings.routeEnabled === 'boolean'
      ? settings.routeEnabled
      : routes.length > 0;
  }
}
