import { AppUtils } from '../../../app-utils';
import type * as AppTypes from '../models';
import { PricingBuilder } from './pricing.builder';

export class ActivityResourceBuilder {
  static ownerKey(ref: AppTypes.ActivitySubEventResourceStateRef): string {
    return `${ref.assetOwnerUserId}:${ref.ownerId}`;
  }

  static recordId(ref: AppTypes.ActivitySubEventResourceStateRef): string {
    return `${ref.assetOwnerUserId}:${ref.ownerId}:${ref.subEventId}`;
  }

  static createEmptyState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): AppTypes.ActivitySubEventResourceState {
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
    state: AppTypes.ActivitySubEventResourceState | null | undefined
  ): AppTypes.ActivitySubEventResourceState | null {
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
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    fallbackRef?: AppTypes.ActivitySubEventResourceStateRef | null
  ): AppTypes.ActivitySubEventResourceState | null {
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
    source: AppTypes.ActivitySubEventAssetAssignmentIds | null | undefined
  ): AppTypes.ActivitySubEventAssetAssignmentIds {
    const next: AppTypes.ActivitySubEventAssetAssignmentIds = {};
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
    source: AppTypes.ActivitySubEventAssetSettingsByType | null | undefined
  ): AppTypes.ActivitySubEventAssetSettingsByType {
    const next: AppTypes.ActivitySubEventAssetSettingsByType = {};
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const rawMap = source?.[type];
      if (!rawMap || typeof rawMap !== 'object') {
        continue;
      }
      const normalizedMap: Record<string, AppTypes.SubEventAssignedAssetSettings> = {};
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
    source: AppTypes.ActivitySubEventSupplyContributionsByAssetId | null | undefined
  ): AppTypes.ActivitySubEventSupplyContributionsByAssetId {
    const next: AppTypes.ActivitySubEventSupplyContributionsByAssetId = {};
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
    source: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> | null | undefined
  ): Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> {
    const next: Partial<Record<AppTypes.AssetType, AppTypes.AssetCard[]>> = {};
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
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    type: AppTypes.AssetType,
    assets: readonly AppTypes.AssetCard[]
  ): string[] {
    const eligibleIds = this.resolveAvailableAssetCards(type, state, assets).map(card => card.id);
    const eligible = new Set(eligibleIds);
    const stored = state?.assetAssignmentIds?.[type] ?? [];
    return stored.filter(id => eligible.has(id));
  }

  static resolveAssignedAssetSettings(
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    type: AppTypes.AssetType
  ): Record<string, AppTypes.SubEventAssignedAssetSettings> {
    return {
      ...(state?.assetSettingsByType?.[type] ?? {})
    };
  }

  static resolveSupplyContributionEntries(
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    assetId: string
  ): AppTypes.SubEventSupplyContributionEntry[] {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      return [];
    }
    return [
      ...(state?.supplyContributionEntriesByAssetId?.[normalizedAssetId] ?? [])
    ].map(entry => ({ ...entry }));
  }

  static resourceAcceptedCount(
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType,
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    assets: readonly AppTypes.AssetCard[]
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
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType,
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    assets: readonly AppTypes.AssetCard[]
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
    subEvent: AppTypes.SubEventFormItem,
    type: AppTypes.AssetType,
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    assets: readonly AppTypes.AssetCard[],
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
    ref: AppTypes.ActivitySubEventResourceStateRef,
    assets: readonly AppTypes.AssetCard[]
  ): AppTypes.ActivitySubEventResourceState {
    return this.createEmptyState(ref);
  }

  private static resolveAssignedCards(
    type: AppTypes.AssetType,
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    assets: readonly AppTypes.AssetCard[]
  ): AppTypes.AssetCard[] {
    const assignedIds = this.resolveAssignedAssetIds(state, type, assets);
    const availableCards = this.resolveAvailableAssetCards(type, state, assets);
    return assignedIds
      .map(id => availableCards.find(card => card.id === id && card.type === type) ?? null)
      .filter((card): card is AppTypes.AssetCard => card !== null);
  }

  private static resolveAvailableAssetCards(
    type: AppTypes.AssetType,
    state: AppTypes.ActivitySubEventResourceState | null | undefined,
    assets: readonly AppTypes.AssetCard[]
  ): AppTypes.AssetCard[] {
    const nextById = new Map<string, AppTypes.AssetCard>();
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

  static isSubEventManualAssignmentRequest(request: AppTypes.AssetMemberRequest, subEventId: string): boolean {
    const normalizedSubEventId = subEventId.trim();
    return (
      request.requestKind === 'manual'
      && normalizedSubEventId.length > 0
      && request.id.startsWith(`manual:${normalizedSubEventId}:`)
    );
  }

  static assetRequestSyncSignature(request: AppTypes.AssetMemberRequest): string {
    return JSON.stringify({
      id: request.id,
      userId: request.userId ?? '',
      status: request.status,
      requestKind: request.requestKind ?? '',
      bookingQuantity: request.booking?.quantity ?? '',
      bookingAcceptedPolicyIds: [...(request.booking?.acceptedPolicyIds ?? [])]
    });
  }

  private static cloneAssetCard(card: AppTypes.AssetCard): AppTypes.AssetCard {
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
}
