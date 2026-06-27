import { Injectable, effect, inject } from '@angular/core';

import { AppContext, AppPopupContext, type ActivitiesNavigationRequest } from '../../shared/ui';
import { EventEditorPopupStore } from '../../shared/ui/context/stores/event-editor-popup.store';
import { OwnedAssetsStore } from '../../shared/ui/context/stores/owned-assets.store';
import { AssetPopupStore } from '../../shared/ui/context/stores/asset-popup.store';
import { SubEventResourcePopupStore } from '../../shared/ui/context/stores/sub-event-resource-popup.store';
import type { EventEditorSubEventResourcePopupRequest } from '../../shared/ui/context/event-editor-popup.types';
import type { ResourcePopupContext } from '../../shared/ui/context/sub-event-resource-popup.types';
import { AppUtils } from '../../shared/app-utils';
import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../shared/core/base/builders';
import {
  ActivityResourceBuilder,
  ActivityResourcesService,
  AssetsService as SharedAssetsService,
  UsersService,
  type UserDto
} from '../../shared/core';

import type * as ContractTypes from '../../shared/core/contracts';
import type * as AppDTOs from '../../shared/core/contracts';
import type * as AppConstants from '../../shared/core/common/constants';
type ResourceAssetDTO = (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO) & {
  description?: string;
  details?: string;
  sourceLink?: string;
  routes?: string[];
  topics?: string[];
  policies?: AppDTOs.EventPolicyItemDTO[];
  pricing?: AppDTOs.PricingConfig | null;
  locationLabel?: string;
  priceLabel?: string;
  policyCount?: number;
};

@Injectable({
  providedIn: 'root'
})
export class SubEventResourcePopupController {
  private readonly eventEditorStore = inject(EventEditorPopupStore);
  private readonly assetPopupStore = inject(AssetPopupStore);
  private readonly ownedAssetsStore = inject(OwnedAssetsStore);
  private readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly assetsService = inject(SharedAssetsService);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  private readonly usersService = inject(UsersService);

  private pendingAssignSaveAbortController: AbortController | null = null;
  private pendingAssignSaveRequestVersion = 0;

  private get users(): UserDto[] {
    return this.usersService.peekCachedUsers();
  }

  private ownedAssetCards(): ResourceAssetDTO[] {
    return this.ownedAssetsStore.assetCards();
  }

  constructor() {
    effect(() => {
      this.ownedAssetsStore.assetListRevision();
      this.handleOwnedAssetsChanged();
    });

    effect(() => {
      const deletedAssetEvent = this.ownedAssetsStore.deletedAssetEvent();
      if (!deletedAssetEvent) {
        return;
      }
      this.handleOwnedAssetDeleted(deletedAssetEvent.cardId);
    });

    effect(() => {
      const request = this.popupCtx.popupStore.activitiesNavigationRequest();
      if (!request || (request.type !== 'chatResource' && request.type !== 'assetExplore')) {
        return;
      }
      this.popupCtx.popupStore.clearActivitiesNavigationRequest();
      if (request.type === 'assetExplore') {
        this.openStandaloneAssetExploreRequest(request);
        return;
      }
      this.openFromChatRequest(request);
    });

    effect(() => {
      const request = this.eventEditorStore.subEventResourcePopupRequest();
      if (!request) {
        return;
      }
      this.eventEditorStore.clearSubEventResourcePopupRequest();
      this.openFromEventEditorRequest(request);
    });
  }

  private activeUser(): UserDto {
    const activeUserId = this.appCtx.userProfileStore.activeUserId().trim();
    return this.appCtx.userProfileStore.activeUserProfile()
      ?? this.usersService.peekCachedUserById(activeUserId)
      ?? this.users[0]
      ?? this.createFallbackUser(activeUserId);
  }

  private openFromChatRequest(request: Extract<ActivitiesNavigationRequest, { type: 'chatResource' }>): void {
    if (request.resourceType === 'Members') {
      this.popupCtx.popupStore.requestActivitiesNavigation({
        type: 'members',
        ownerId: request.group?.id?.trim() || request.subEvent.id,
        ownerType: request.group?.id ? 'group' : 'subEvent'
      });
      return;
    }

    const context = this.buildPopupContext(
      'chat',
      request.ownerId?.trim() || request.item.eventId?.trim() || '',
      request.item.title,
      request.resourceType,
      request.subEvent,
      request.group ?? null,
      request.assetCardsByType
    );
    this.seedAssignmentsFromRequest(context.subEvent.id, request.assetAssignmentIds, context.fallbackCardsByType);
    this.openPopupContext(context, request.resourceType);
    this.resourcePopupStore.assetExploreOnlyRef.set(request.openExplore === true);
    this.resourcePopupStore.resourceAssetViewIdRef.set(request.assetViewId?.trim() || null);
    if (request.openExplore) {
      this.openInitialExplorePopup();
    }
  }

  private openStandaloneAssetExploreRequest(
    request: Extract<ActivitiesNavigationRequest, { type: 'assetExplore' }>
  ): void {
    const type = request.assetType === 'Accommodation' || request.assetType === 'Supplies'
      ? request.assetType
      : 'Car';
    const now = new Date();
    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    const subEvent: ContractTypes.SubEventDTO = {
      id: `asset-explore-${this.activeUser().id || 'user'}`,
      name: 'Asset Explore',
      description: '',
      startAt: AppUtils.toIsoDateTimeLocal(now),
      endAt: AppUtils.toIsoDateTimeLocal(end),
      optional: true,
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
    this.openPopupContext({
      origin: 'chat',
      ownerId: this.activeUser().id,
      parentTitle: 'Assets',
      subEvent,
      fallbackCardsByType: request.fallbackAsset ? { [type]: [this.cloneAsset(request.fallbackAsset)] } : {}
    }, type, { hydrate: !request.viewOnly });
    this.resourcePopupStore.assetExploreOnlyRef.set(!request.viewOnly);
    if (request.viewOnly && request.assetId) {
      this.resourcePopupStore.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(subEvent.id, type)] = [request.assetId];
      this.resourcePopupStore.resourceAssetViewIdRef.set(request.assetId);
      this.resourcePopupStore.resourceAssetViewModeRef.set('view');
      this.resourcePopupStore.resourceAssetViewReturnToChatRef.set(true);
      return;
    }
    this.openInitialExplorePopup();
  }

  private openFromEventEditorRequest(request: EventEditorSubEventResourcePopupRequest): void {
    if (request.type === 'Members') {
      const group = request.group ?? null;
      const ownerId = group?.id?.trim() || `${request.subEvent.id ?? ''}`.trim();
      const groupLabel = group?.groupLabel?.trim() ?? '';
      this.popupCtx.popupStore.requestActivitiesNavigation({
        type: 'members',
        ownerId,
        ownerType: group?.id ? 'group' : 'subEvent',
        subtitle: groupLabel || request.subEvent.title?.trim() || request.subEvent.name?.trim() || request.parentTitle?.trim() || 'Event',
        canManage: group?.canManage === true,
        viewOnly: group?.id ? group.canManage !== true : undefined,
        acceptedMembers: Math.max(0, Math.trunc(Number(group?.accepted) || 0)),
        pendingMembers: Math.max(0, Math.trunc(Number(group?.pending) || 0)),
        capacityTotal: Math.max(0, Math.trunc(Number(group?.capacityMax) || 0)),
        members: group?.members,
        onMembersChanged: group?.onMembersChanged
      });
      return;
    }

    const context = this.buildPopupContext(
      'eventEditor',
      request.ownerId?.trim() || '',
      request.parentTitle?.trim() || 'Event',
      request.type,
      request.subEvent,
      request.group ?? null
    );
    this.openPopupContext(context, request.type);
  }

  private buildPopupContext(
    origin: 'chat' | 'eventEditor',
    ownerId: string,
    parentTitle: string,
    type: AppConstants.AssetType,
    rawSubEvent: ContractTypes.SubEventDTO,
    group: EventEditorSubEventResourcePopupRequest['group'],
    fallbackCardsByType?: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>>
  ): ResourcePopupContext {
    const subEvent = this.cloneSubEvent(rawSubEvent);
    const scopedSubEvent = group?.id
      ? this.applyGroupScopedAssetSnapshot(subEvent, type, group)
      : subEvent;

    return {
      origin,
      ownerId: ownerId.trim(),
      parentTitle: parentTitle.trim() || 'Event',
      subEvent: scopedSubEvent,
      groupId: group?.id?.trim() || undefined,
      groupName: group?.groupLabel?.trim() || undefined,
      fallbackCardsByType: this.cloneFallbackCards(fallbackCardsByType)
    };
  }

  private openPopupContext(
    context: ResourcePopupContext,
    type: AppConstants.AssetType,
    options: { hydrate?: boolean } = {}
  ): void {
    this.resourcePopupStore.openResourcePopup(context, type);
    this.closeAssignPopup(false);
    if (options.hydrate !== false) {
      this.hydratePopupResourceState(context);
    }
    this.syncPopupSubEventMetrics();
  }

  private openInitialExplorePopup(): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const type = this.resourcePopupStore.resourceFilterRef();
    const { startAtIso, endAtIso } = this.defaultAssetExploreRange(context.subEvent);
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
    this.resourcePopupStore.assetExplorePopupRef.set({
      subEventId: context.subEvent.id,
      type,
      category: AssetDefaultsBuilder.defaultCategory(type),
      startAtIso,
      endAtIso,
      loading: true,
      error: null,
      cards: []
    });
  }

  private hydratePopupResourceState(context: ResourcePopupContext): void {
    const ownerId = context.ownerId.trim();
    const subEventId = context.subEvent.id.trim();
    const assetOwnerUserId = this.activeUser().id;
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return;
    }
    const applyState = (state: AppDTOs.ActivitySubEventResourceStateDTO | null): void => {
      const activeContext = this.resourcePopupStore.popupContextRef();
      if (!state || !activeContext || activeContext.ownerId !== ownerId || activeContext.subEvent.id !== subEventId) {
        return;
      }
      this.applyPersistedPopupState(state);
      this.syncPopupSubEventMetrics();
    };
    applyState(this.activityResourcesService.peekSubEventResourceState(ownerId, subEventId, assetOwnerUserId));
    void this.activityResourcesService
      .querySubEventResourceState(ownerId, subEventId, assetOwnerUserId)
      .then(state => applyState(state));
  }

  private applyPersistedPopupState(state: AppDTOs.ActivitySubEventResourceStateDTO): void {
    const normalizedState = ActivityResourceBuilder.normalizeState(state, state);
    if (!normalizedState) {
      return;
    }
    const activeContext = this.resourcePopupStore.popupContextRef();
    if (
      activeContext
      && activeContext.ownerId === normalizedState.ownerId
      && activeContext.subEvent.id === normalizedState.subEventId
    ) {
      this.resourcePopupStore.popupContextRef.set({
        ...activeContext,
        fallbackCardsByType: this.mergePersistedFallbackCards(
          activeContext.fallbackCardsByType,
          normalizedState.fallbackAssetCardsByType,
          normalizedState.subEventId
        )
      });
    }
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      this.resourcePopupStore.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(normalizedState.subEventId, type)] = [
        ...(normalizedState.assetAssignmentIds[type] ?? [])
      ];
      this.resourcePopupStore.assignedAssetSettingsByKey[this.subEventAssetAssignmentKey(normalizedState.subEventId, type)] = {
        ...(normalizedState.assetSettingsByType[type] ?? {})
      };
    }
    for (const key of Object.keys(this.resourcePopupStore.supplyContributionEntriesByAssignmentKey)) {
      if (key.startsWith(`${normalizedState.subEventId}:`)) {
        delete this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[key];
      }
    }
    for (const [assetId, entries] of Object.entries(normalizedState.supplyContributionEntriesByAssetId)) {
      this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(normalizedState.subEventId, assetId)] = entries
        .map(entry => ({ ...entry }));
    }
  }

  private persistPopupResourceState(context: ResourcePopupContext | null = this.resourcePopupStore.popupContextRef()): void {
    const nextState = this.buildPopupResourceState(context);
    if (!nextState) {
      return;
    }
    void this.activityResourcesService.replaceSubEventResourceState(nextState);
  }

  private buildPopupResourceState(
    context: ResourcePopupContext | null = this.resourcePopupStore.popupContextRef()
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    if (!context) {
      return null;
    }
    const ownerId = context.ownerId.trim();
    const subEventId = context.subEvent.id.trim();
    const assetOwnerUserId = this.activeUser().id;
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return null;
    }
    return {
      ownerId,
      subEventId,
      assetOwnerUserId,
      assetAssignmentIds: {
        Car: [...this.resolveSubEventAssignedAssetIds(subEventId, 'Car')],
        Accommodation: [...this.resolveSubEventAssignedAssetIds(subEventId, 'Accommodation')],
        Supplies: [...this.resolveSubEventAssignedAssetIds(subEventId, 'Supplies')]
      },
      assetSettingsByType: {
        Car: { ...this.getSubEventAssignedAssetSettings(subEventId, 'Car') },
        Accommodation: { ...this.getSubEventAssignedAssetSettings(subEventId, 'Accommodation') },
        Supplies: { ...this.getSubEventAssignedAssetSettings(subEventId, 'Supplies') }
      },
      supplyContributionEntriesByAssetId: Object.fromEntries(
        this.resolveSubEventAssignedAssetIds(subEventId, 'Supplies').map(assetId => [
          assetId,
          this.subEventSupplyContributionEntries(subEventId, assetId).map(entry => ({ ...entry }))
        ])
      ),
      fallbackAssetCardsByType: {
        Car: this.persistedAssignedFallbackCards(context, 'Car'),
        Accommodation: this.persistedAssignedFallbackCards(context, 'Accommodation'),
        Supplies: this.persistedAssignedFallbackCards(context, 'Supplies')
      }
    };
  }

  closeAssignPopup(apply = false): void {
    if (apply) {
      this.confirmAssignPopup();
      return;
    }
    this.abortPendingAssignSaveRequest();
    this.resourcePopupStore.pendingAssignSaveRef.set(null);
    this.resourcePopupStore.assignContextRef.set(null);
    this.resourcePopupStore.selectedAssignAssetIdsRef.set([]);
    this.assetPopupStore.basketVisibleRef.set(false);
    this.ownedAssetsStore.closeAssetPopup();
    this.assetPopupStore.resetTicketState();
    this.assetPopupStore.primaryVisibleRef.set(false);
  }

  confirmAssignPopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.assignContextRef();
    const nextState = this.buildNextAssignResourceState();
    if (!context || !nextState || !this.canConfirmAssignSelection()) {
      return;
    }

    const requestVersion = ++this.pendingAssignSaveRequestVersion;
    const abortController = new AbortController();
    this.pendingAssignSaveAbortController = abortController;
    this.resourcePopupStore.pendingAssignSaveRef.set({
      subEventId: context.subEventId,
      type: context.type,
      busy: true,
      error: null
    });

    void this.activityResourcesService.replaceSubEventResourceState(nextState, abortController.signal)
      .then(savedState => {
        if (this.pendingAssignSaveAbortController === abortController) {
          this.pendingAssignSaveAbortController = null;
        }
        if (abortController.signal.aborted || requestVersion !== this.pendingAssignSaveRequestVersion) {
          return;
        }
        const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
        this.applyPersistedPopupState(resolvedState);
        this.syncPopupSubEventMetrics({ persistAssetRequests: true });
        this.resourcePopupStore.pendingAssignSaveRef.set(null);
        this.closeAssignPopup(false);
      })
      .catch(error => {
        if (this.pendingAssignSaveAbortController === abortController) {
          this.pendingAssignSaveAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion !== this.pendingAssignSaveRequestVersion) {
          return;
        }
        const currentPending = this.resourcePopupStore.pendingAssignSaveRef();
        if (!currentPending || currentPending.subEventId !== context.subEventId || currentPending.type !== context.type) {
          return;
        }
        this.resourcePopupStore.pendingAssignSaveRef.set({
          ...currentPending,
          busy: false,
          error: 'Unable to save asset selection.'
        });
      });
  }

  private canConfirmAssignSelection(): boolean {
    const context = this.resourcePopupStore.assignContextRef();
    if (!context || this.resourcePopupStore.pendingAssignSaveRef()?.busy === true) {
      return false;
    }
    const currentIds = [...this.resolveSubEventAssignedAssetIds(context.subEventId, context.type)].sort();
    const draft = this.buildAssignSelectionDraft(context);
    const nextIds = [...draft.nextIds].sort();
    if (currentIds.length !== nextIds.length) {
      return true;
    }
    return currentIds.some((assetId, index) => assetId !== nextIds[index]);
  }

  private buildNextAssignResourceState(): AppDTOs.ActivitySubEventResourceStateDTO | null {
    const context = this.resourcePopupStore.assignContextRef();
    const nextState = this.buildPopupResourceState();
    if (!context || !nextState) {
      return null;
    }
    const draft = this.buildAssignSelectionDraft(context);
    nextState.assetAssignmentIds = {
      ...nextState.assetAssignmentIds,
      [context.type]: [...draft.nextIds]
    };
    nextState.assetSettingsByType = {
      ...nextState.assetSettingsByType,
      [context.type]: draft.nextSettings
    };
    if (context.type === 'Supplies') {
      nextState.supplyContributionEntriesByAssetId = Object.fromEntries(
        Object.entries(nextState.supplyContributionEntriesByAssetId)
          .filter(([assetId]) => draft.nextIds.includes(assetId))
          .map(([assetId, entries]) => [assetId, entries.map(entry => ({ ...entry }))])
      );
    }
    return nextState;
  }

  private buildAssignSelectionDraft(
    context: { subEventId: string; type: AppConstants.AssetType }
  ): { nextIds: string[]; nextSettings: Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> } {
    const allowedIds = new Set(this.ownedAssetCards().filter(card => card.type === context.type).map(card => card.id));
    const nextIds = this.resourcePopupStore.selectedAssignAssetIdsRef()
      .filter((id, index, arr) => allowedIds.has(id) && arr.indexOf(id) === index);
    const key = this.subEventAssetAssignmentKey(context.subEventId, context.type);
    const previousSettings = this.resourcePopupStore.assignedAssetSettingsByKey[key] ?? {};
    const nextSettings: Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> = {};
    for (const assetId of nextIds) {
      const source = this.ownedAssetCards().find(card => card.id === assetId && card.type === context.type);
      if (!source) {
        continue;
      }
      const previous = previousSettings[assetId];
      const capacityLimit = Math.max(0, source.capacityTotal);
      const capacityMax = AppUtils.clampNumber(Math.trunc(previous?.capacityMax ?? capacityLimit), 0, capacityLimit);
      const capacityMin = AppUtils.clampNumber(Math.trunc(previous?.capacityMin ?? 0), 0, capacityMax);
      nextSettings[assetId] = {
        capacityMin,
        capacityMax,
        addedByUserId: previous?.addedByUserId ?? this.activeUser().id,
        routes: this.normalizeAssetRoutes(context.type, previous?.routes)
      };
    }
    return {
      nextIds,
      nextSettings
    };
  }

  private abortPendingAssignSaveRequest(): void {
    this.pendingAssignSaveRequestVersion += 1;
    const controller = this.pendingAssignSaveAbortController;
    this.pendingAssignSaveAbortController = null;
    controller?.abort();
  }

  private getSubEventAssignedAssetSettings(
    subEventId: string,
    type: AppConstants.AssetType
  ): Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEventId, type);
    const existing = this.resourcePopupStore.assignedAssetSettingsByKey[key] ?? {};
    const next: Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> = {};
    for (const assetId of assignedIds) {
      const source = this.resolveSubEventAssignedAssetCard(subEventId, type, assetId);
      if (!source) {
        continue;
      }
      const previous = existing[assetId];
      const capacityLimit = Math.max(0, source.capacityTotal);
      const capacityMax = AppUtils.clampNumber(Math.trunc(previous?.capacityMax ?? capacityLimit), 0, capacityLimit);
      const capacityMin = AppUtils.clampNumber(Math.trunc(previous?.capacityMin ?? 0), 0, capacityMax);
      next[assetId] = {
        capacityMin,
        capacityMax,
        addedByUserId: previous?.addedByUserId ?? this.activeUser().id,
        routes: this.normalizeAssetRoutes(type, previous?.routes)
      };
    }
    this.resourcePopupStore.assignedAssetSettingsByKey[key] = next;
    return next;
  }

  private resolveSubEventAssignedAssetIds(subEventId: string, type: AppConstants.AssetType): string[] {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const eligibleIds = [
      ...this.ownedAssetCards().filter(card => card.type === type).map(card => card.id),
      ...this.subEventFallbackAssetCards(subEventId, type).map(card => card.id)
    ];
    const eligible = new Set(eligibleIds);
    const stored = this.resourcePopupStore.assignedAssetIdsByKey[key];
    if (!stored) {
      this.resourcePopupStore.assignedAssetIdsByKey[key] = [];
      return [];
    }
    const normalized = stored.filter(id => eligible.has(id));
    if (normalized.length !== stored.length) {
      this.resourcePopupStore.assignedAssetIdsByKey[key] = [...normalized];
    }
    return normalized;
  }

  private resolveSubEventAssignedAssetCard(
    subEventId: string,
    type: AppConstants.AssetType,
    assetId: string
  ): ResourceAssetDTO | null {
    return this.ownedAssetCards().find(card => card.id === assetId && card.type === type)
      ?? this.subEventFallbackAssetCards(subEventId, type).find(card => card.id === assetId && card.type === type)
      ?? null;
  }

  private subEventAssignedAssetCards(subEventId: string, type: AppConstants.AssetType): ResourceAssetDTO[] {
    return this.resolveSubEventAssignedAssetIds(subEventId, type)
      .map(id => this.resolveSubEventAssignedAssetCard(subEventId, type, id))
      .filter((card): card is ResourceAssetDTO => card !== null);
  }

  private subEventFallbackAssetCards(subEventId: string, type: AppConstants.AssetType): ResourceAssetDTO[] {
    const context = this.resourcePopupStore.popupContextRef();
    if (context?.subEvent.id !== subEventId) {
      return [];
    }
    return context.fallbackCardsByType[type] ?? [];
  }

  private seedAssignmentsFromRequest(
    subEventId: string,
    assetAssignmentIds: Partial<Record<AppConstants.AssetType, string[]>> | undefined,
    fallbackCardsByType: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>>
  ): void {
    if (!subEventId || !assetAssignmentIds) {
      return;
    }
    const types: AppConstants.AssetType[] = ['Car', 'Accommodation', 'Supplies'];
    for (const type of types) {
      const raw = assetAssignmentIds[type];
      if (!Array.isArray(raw)) {
        continue;
      }
      const allowedIds = new Set([
        ...this.ownedAssetCards().filter(card => card.type === type).map(card => card.id),
        ...(fallbackCardsByType[type] ?? []).map(card => card.id)
      ]);
      const normalized = raw.filter((id, index, arr): id is string =>
        typeof id === 'string' && arr.indexOf(id) === index && allowedIds.has(id)
      );
      this.resourcePopupStore.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(subEventId, type)] = [...normalized];
    }
  }

  private subEventAssetCapacityMetrics(
    subEvent: ContractTypes.SubEventDTO,
    type: AppConstants.AssetType
  ): { joined: number; capacityMin: number; capacityMax: number; pending: number } {
    const cards = this.subEventAssignedAssetCards(subEvent.id, type);
    const settings = this.getSubEventAssignedAssetSettings(subEvent.id, type);
    const capacityMax = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal)), 0);
    const capacityMin = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMin ?? 0), 0);
    const pending = type === 'Supplies'
      ? 0
      : cards.reduce((sum, card) => (
        sum + ActivityResourceBuilder.subEventOccupancyRequestCount(card, subEvent.id, 'pending')
      ), 0);
    if (type === 'Supplies') {
      return {
        joined: cards.reduce((sum, card) => sum + this.subEventSupplyProvidedCount(card.id, subEvent.id), 0),
        capacityMin,
        capacityMax,
        pending
      };
    }
    return {
      joined: cards.reduce((sum, card) => (
        sum + ActivityResourceBuilder.subEventOccupancyRequestCount(card, subEvent.id, 'accepted')
      ), 0),
      capacityMin,
      capacityMax,
      pending
    };
  }

  private syncPopupSubEventMetrics(
    options: boolean | { persistResourceState?: boolean; persistAssetRequests?: boolean } = false
  ): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const persistResourceState = typeof options === 'boolean' ? options : options.persistResourceState === true;
    const persistAssetRequests = typeof options === 'boolean' ? options : options.persistAssetRequests === true;
    const nextSubEvent = this.cloneSubEvent(context.subEvent);
    const cars = this.subEventAssetCapacityMetrics(nextSubEvent, 'Car');
    const accommodation = this.subEventAssetCapacityMetrics(nextSubEvent, 'Accommodation');
    const supplies = this.subEventAssetCapacityMetrics(nextSubEvent, 'Supplies');
    nextSubEvent.carsAccepted = cars.joined;
    nextSubEvent.carsPending = cars.pending;
    nextSubEvent.carsCapacityMin = cars.capacityMin;
    nextSubEvent.carsCapacityMax = cars.capacityMax;
    nextSubEvent.accommodationAccepted = accommodation.joined;
    nextSubEvent.accommodationPending = accommodation.pending;
    nextSubEvent.accommodationCapacityMin = accommodation.capacityMin;
    nextSubEvent.accommodationCapacityMax = accommodation.capacityMax;
    nextSubEvent.suppliesAccepted = supplies.joined;
    nextSubEvent.suppliesPending = supplies.pending;
    nextSubEvent.suppliesCapacityMin = supplies.capacityMin;
    nextSubEvent.suppliesCapacityMax = supplies.capacityMax;
    this.resourcePopupStore.popupContextRef.set({
      ...context,
      subEvent: nextSubEvent
    });
    this.syncSubEventManualAssetRequests(nextSubEvent, persistAssetRequests);
    if (persistResourceState) {
      this.persistPopupResourceState({
        ...context,
        subEvent: nextSubEvent
      });
    }
  }

  private syncSubEventManualAssetRequests(subEvent: ContractTypes.SubEventDTO, persist = false): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const activeUser = this.activeUser();
    let changed = false;
    const dirtyCards: ResourceAssetDTO[] = [];
    const nextCards = this.ownedAssetCards().map(card => {
      const nextManualRequest = this.buildManualAssignmentRequest(card, subEvent, context.ownerId, context.parentTitle, activeUser);
      const preservedRequests: AppDTOs.AssetMemberRequestDTO[] = card.requests
        .filter(request => !ActivityResourceBuilder.isSubEventManualAssignmentRequest(request, subEvent.id))
        .map(request => ({
          ...request,
          booking: request.booking
            ? {
                ...request.booking,
                acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
              }
            : null
        }));
      if (nextManualRequest) {
        preservedRequests.unshift(nextManualRequest);
      }
      const sameRequests = preservedRequests.length === card.requests.length
        && preservedRequests.every((request, index) => (
          ActivityResourceBuilder.assetRequestSyncSignature(request)
          === ActivityResourceBuilder.assetRequestSyncSignature(card.requests[index])
        ));
      if (sameRequests) {
        return card;
      }
      changed = true;
      const nextCard = {
        ...card,
        requests: preservedRequests
      };
      dirtyCards.push(nextCard);
      return nextCard;
    });
    if (!changed) {
      return;
    }
    this.ownedAssetsStore.applyAssetCards(nextCards, { mutation: persist });
    if (!persist) {
      return;
    }
    for (const dirtyCard of dirtyCards) {
      void this.assetsService.saveOwnedAsset(activeUser.id, this.toAssetDetailDto(dirtyCard));
    }
  }

  private buildManualAssignmentRequest(
    card: ResourceAssetDTO,
    subEvent: ContractTypes.SubEventDTO,
    ownerId: string,
    parentTitle: string,
    activeUser: UserDto
  ): AppDTOs.AssetMemberRequestDTO | null {
    if (card.type === 'Supplies') {
      const assignedSupplyIds = new Set(this.resolveSubEventAssignedAssetIds(subEvent.id, 'Supplies'));
      if (!assignedSupplyIds.has(card.id)) {
        return null;
      }
      const settings = this.getSubEventAssignedAssetSettings(subEvent.id, 'Supplies')[card.id];
      const quantity = this.subEventSupplyProvidedCount(card.id, subEvent.id)
        || Math.max(0, Math.trunc(Number(settings?.capacityMax ?? card.capacityTotal) || 0));
      if (quantity <= 0) {
        return null;
      }
      const existing = card.requests.find(request => ActivityResourceBuilder.isSubEventManualAssignmentRequest(request, subEvent.id)) ?? null;
      return {
        id: existing?.id ?? `manual:${subEvent.id}:${card.id}`,
        userId: activeUser.id,
        name: activeUser.name,
        initials: activeUser.initials,
        gender: activeUser.gender,
        status: 'accepted',
        note: 'Reserved and assigned by the owner.',
        requestKind: 'manual',
        requestedAtIso: existing?.requestedAtIso ?? new Date().toISOString(),
        booking: this.assetRequestBookingForSubEvent(subEvent, quantity, ownerId, parentTitle)
      };
    }
    if (card.type !== 'Car' && card.type !== 'Accommodation') {
      return null;
    }
    const assignedIds = new Set(this.resolveSubEventAssignedAssetIds(subEvent.id, card.type));
    if (!assignedIds.has(card.id)) {
      return null;
    }
    const existing = card.requests.find(request => ActivityResourceBuilder.isSubEventManualAssignmentRequest(request, subEvent.id)) ?? null;
    return {
      id: existing?.id ?? `manual:${subEvent.id}:${card.id}`,
      userId: activeUser.id,
      name: activeUser.name,
      initials: activeUser.initials,
      gender: activeUser.gender,
      status: 'accepted',
      note: 'Reserved and assigned by the owner.',
      requestKind: 'manual',
      requestedAtIso: existing?.requestedAtIso ?? new Date().toISOString(),
      booking: this.assetRequestBookingForSubEvent(subEvent, 1, ownerId, parentTitle)
    };
  }

  private assetRequestBookingForSubEvent(
    subEvent: ContractTypes.SubEventDTO,
    quantity: number,
    ownerId: string,
    parentTitle: string
  ): AppDTOs.AssetHireRequestBookingDTO | null {
    return {
      eventId: ownerId,
      eventTitle: parentTitle,
      subEventId: subEvent.id,
      subEventTitle: subEvent.name,
      slotKey: subEvent.id,
      slotLabel: subEvent.name,
      timeframe: this.assetRequestTimeframeLabel(`${subEvent.startAt ?? ''}`.trim(), `${subEvent.endAt ?? ''}`.trim()),
      startAtIso: `${subEvent.startAt ?? ''}`.trim() || undefined,
      endAtIso: `${subEvent.endAt ?? ''}`.trim() || undefined,
      quantity,
      totalAmount: null,
      currency: null,
      acceptedPolicyIds: [],
      paymentSessionId: null,
      inventoryApplied: null
    };
  }

  private assetRequestTimeframeLabel(startAtIso: string, endAtIso: string): string {
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
      ? `${startDate} ${startTime} - ${endTime}`
      : `${startDate} ${startTime} - ${endDate} ${endTime}`;
  }

  private defaultAssetExploreRange(subEvent: ContractTypes.SubEventDTO): { startAtIso: string; endAtIso: string } {
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

  private isSubEventScopedAssetRequest(request: AppDTOs.AssetMemberRequestDTO, subEventId: string): boolean {
    return ActivityResourceBuilder.isSubEventScopedAssetRequest(request, subEventId);
  }

  private createFallbackUser(userId: string): UserDto {
    return {
      id: userId.trim(),
      name: 'User',
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: 'U',
      gender: 'woman',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      headline: '',
      about: '',
      images: [],
      profileStatus: 'public',
      activities: {
        game: 0,
        chat: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0
      }
    };
  }

  private handleOwnedAssetDeleted(cardId: string): void {
    for (const key of Object.keys(this.resourcePopupStore.supplyContributionEntriesByAssignmentKey)) {
      if (key.endsWith(`:${cardId}`)) {
        delete this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[key];
      }
    }
    for (const key of Object.keys(this.resourcePopupStore.assignedAssetIdsByKey)) {
      this.resourcePopupStore.assignedAssetIdsByKey[key] = this.resourcePopupStore.assignedAssetIdsByKey[key].filter(id => id !== cardId);
    }
    for (const key of Object.keys(this.resourcePopupStore.assignedAssetSettingsByKey)) {
      if (!this.resourcePopupStore.assignedAssetSettingsByKey[key][cardId]) {
        continue;
      }
      const next = { ...this.resourcePopupStore.assignedAssetSettingsByKey[key] };
      delete next[cardId];
      this.resourcePopupStore.assignedAssetSettingsByKey[key] = next;
    }
    const supplyContext = this.resourcePopupStore.supplyPopupRef();
    if (supplyContext?.assetId === cardId) {
      this.resourcePopupStore.supplyPopupRef.set(null);
      this.resourcePopupStore.pendingSupplyDeleteRef.set(null);
      this.resourcePopupStore.bringDialogRef.set(null);
    }
    this.syncPopupSubEventMetrics();
  }

  private handleOwnedAssetsChanged(): void {
    this.syncPopupSubEventMetrics();
  }

  private cloneSubEvent(subEvent: ContractTypes.SubEventDTO): ContractTypes.SubEventDTO {
    return {
      ...subEvent,
      pricing: subEvent.pricing ? PricingBuilder.clonePricingConfig(subEvent.pricing) : undefined,
      groups: Array.isArray(subEvent.groups)
        ? subEvent.groups.map(group => ({ ...group }))
        : []
    };
  }

  private cloneAsset(card: ResourceAssetDTO): ResourceAssetDTO {
    return {
      ...card,
      routes: [...(card.routes ?? [])],
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

  private toAssetDetailDto(card: ResourceAssetDTO): AppDTOs.AssetDetailDTO {
    return {
      id: card.id,
      type: card.type,
      title: card.title,
      subtitle: card.subtitle,
      category: card.category,
      city: card.city,
      capacityTotal: card.capacityTotal,
      quantity: AssetCardBuilder.storedQuantityValue(card),
      details: `${card.details ?? card.description ?? ''}`.trim(),
      imageUrl: card.imageUrl,
      sourceLink: `${card.sourceLink ?? ''}`.trim(),
      routes: this.normalizeAssetRoutes(card.type, card.routes),
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(policy => ({ ...policy })),
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : card.pricing,
      visibility: card.visibility,
      status: card.status,
      ownerUserId: card.ownerUserId,
      ownerName: card.ownerName,
      requests: card.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      })),
      menuActions: card.menuActions ? [...card.menuActions] : undefined
    };
  }

  private cloneFallbackCards(
    fallbackCardsByType?: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>>
  ): Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> {
    const next: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> = {};
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const cards = fallbackCardsByType?.[type];
      if (!Array.isArray(cards) || cards.length === 0) {
        continue;
      }
      next[type] = cards.map(card => this.cloneAsset(card));
    }
    return next;
  }

  private mergePersistedFallbackCards(
    current: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> | undefined,
    persisted: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> | undefined,
    subEventId: string
  ): Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> {
    const next = this.cloneFallbackCards(current);
    for (const type of ['Car', 'Accommodation', 'Supplies'] as const) {
      const cards = persisted?.[type];
      if (!Array.isArray(cards) || cards.length === 0) {
        continue;
      }
      const nextById = new Map((next[type] ?? []).map(card => [card.id, this.cloneAsset(card)] as const));
      for (const card of cards) {
        nextById.set(card.id, this.assignedFallbackAssetSnapshot(subEventId, card));
      }
      next[type] = [...nextById.values()];
    }
    return next;
  }

  private persistedAssignedFallbackCards(
    context: ResourcePopupContext,
    type: AppConstants.AssetType
  ): AppDTOs.AssetDetailDTO[] {
    const assignedIds = new Set(this.resolveSubEventAssignedAssetIds(context.subEvent.id, type));
    const ownedIds = new Set(this.ownedAssetCards().filter(card => card.type === type).map(card => card.id));
    return (context.fallbackCardsByType[type] ?? [])
      .filter(card => assignedIds.has(card.id) && !ownedIds.has(card.id))
      .map(card => this.toAssetDetailDto(this.assignedFallbackAssetSnapshot(context.subEvent.id, card)));
  }

  private assignedFallbackAssetSnapshot(
    subEventId: string,
    card: ResourceAssetDTO,
    options: { clearRequests?: boolean } = {}
  ): ResourceAssetDTO {
    const nextCard = this.cloneAsset(card);
    if (options.clearRequests) {
      return {
        ...nextCard,
        requests: []
      };
    }
    return {
      ...nextCard,
      requests: nextCard.requests.filter(request => this.isSubEventScopedAssetRequest(request, subEventId))
    };
  }

  private applyGroupScopedAssetSnapshot(
    subEvent: ContractTypes.SubEventDTO,
    type: AppConstants.AssetType,
    group: { pending?: number; capacityMin?: number; capacityMax?: number }
  ): ContractTypes.SubEventDTO {
    const scopedPending = Number.isFinite(Number(group.pending)) ? Math.max(0, Math.trunc(Number(group.pending))) : undefined;
    const scopedMin = Number.isFinite(Number(group.capacityMin)) ? Math.max(0, Math.trunc(Number(group.capacityMin))) : undefined;
    const scopedMax = Number.isFinite(Number(group.capacityMax)) ? Math.max(0, Math.trunc(Number(group.capacityMax))) : undefined;
    if (type === 'Car') {
      return {
        ...subEvent,
        carsPending: scopedPending ?? subEvent.carsPending,
        carsCapacityMin: scopedMin ?? subEvent.carsCapacityMin,
        carsCapacityMax: scopedMax ?? subEvent.carsCapacityMax
      };
    }
    if (type === 'Accommodation') {
      return {
        ...subEvent,
        accommodationPending: scopedPending ?? subEvent.accommodationPending,
        accommodationCapacityMin: scopedMin ?? subEvent.accommodationCapacityMin,
        accommodationCapacityMax: scopedMax ?? subEvent.accommodationCapacityMax
      };
    }
    return {
      ...subEvent,
      suppliesPending: scopedPending ?? subEvent.suppliesPending,
      suppliesCapacityMin: scopedMin ?? subEvent.suppliesCapacityMin,
      suppliesCapacityMax: scopedMax ?? subEvent.suppliesCapacityMax
    };
  }

  private normalizeAssetRoutes(type: AppConstants.AssetType, routes: string[] | undefined | null): string[] {
    if (type === 'Supplies') {
      return [];
    }
    const cleaned = (routes ?? [])
      .map(value => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
    if (type === 'Accommodation') {
      return cleaned.length > 0 ? [cleaned[0]] : [''];
    }
    return cleaned.length > 0 ? cleaned : [''];
  }

  private subEventSupplyAssignmentKey(subEventId: string, cardId: string): string {
    return `${subEventId}:${cardId}`;
  }

  private subEventSupplyContributionEntries(subEventId: string, cardId: string): AppDTOs.SubEventSupplyContributionEntryDTO[] {
    return this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(subEventId, cardId)] ?? [];
  }

  private subEventSupplyProvidedCount(cardId: string, subEventId: string): number {
    return this.subEventSupplyContributionEntries(subEventId, cardId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  private subEventAssetAssignmentKey(subEventId: string, type: AppConstants.AssetType): string {
    return `${subEventId}:${type}`;
  }

  private isAbortError(error: unknown): boolean {
    return !!error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError';
  }
}
