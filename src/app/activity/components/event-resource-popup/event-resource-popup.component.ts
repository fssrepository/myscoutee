import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { type CardMenuActionEvent, type InfoCardData } from '../../../shared/ui';
import { AppContext, AppPopupContext, type ActivitiesNavigationRequest } from '../../../shared/ui';
import type * as ContractTypes from '../../../shared/core/contracts';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';
import { AppUtils } from '../../../shared/app-utils';
import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AssetCardBuilder, AssetDefaultsBuilder, PricingBuilder } from '../../../shared/core/base/builders';
import {
  ActivityResourceBuilder,
  ActivityResourcesService,
  AssetsService as SharedAssetsService,
  EventsService,
  ShareTokensService,
  UsersService,
  type UserDto
} from '../../../shared/core';
import { OwnedAssetsStore } from '../../../shared/ui/context/stores/owned-assets.store';
import { AssetPopupStore } from '../../../shared/ui/context/stores/asset-popup.store';
import { NavigatorStore } from '../../../shared/ui/context/stores/navigator.store';
import { ConfirmationDialogStore } from '../../../shared/ui/context/stores/confirmation-dialog.store';
import { ActivitiesPopupStore } from '../../../shared/ui/context/stores/activities-popup.store';
import { EventEditorPopupStore } from '../../../shared/ui/context/stores/event-editor-popup.store';
import { SubEventResourcePopupStore } from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import type { EventEditorSubEventResourcePopupRequest } from '../../../shared/ui/context/event-editor-popup.types';
import type {
  AssignedAssetJoinPricingPreview,
  ResourceAssetDTO,
  ResourcePopupContext,
  RouteEditorState
} from '../../../shared/ui/context/sub-event-resource-popup.types';
import type { ChatDTO } from '../../../shared/core/contracts/chat.interface';
import { EventResourceAssetViewComponent } from './asset-view/event-resource-asset-view.component';
import { EventResourceCapacityEditorComponent } from './capacity-editor/event-resource-capacity-editor.component';
import { EventResourceRouteEditorComponent } from './route-editor/event-resource-route-editor.component';
import {
  EventResourceAssignedAssetJoinDialogComponent,
  type AssignedAssetJoinDialogViewState
} from './assigned-asset-join-dialog/event-resource-assigned-asset-join-dialog.component';
import { EventResourceAssetExploreComponent } from './asset-explore/event-resource-asset-explore.component';
import {
  EventResourceListComponent,
  type EventResourceListModel
} from './resource-list/event-resource-list.component';

import type * as AppDTOs from '../../../shared/core/contracts';
import type * as AppConstants from '../../../shared/core/common/constants';
export interface ResourceAssetViewState {
  card: AppDTOs.SubEventResourceCardDTO;
  mode: 'view' | 'edit';
  source: ResourceAssetDTO | null;
  memberLabel: string;
  memberCount: number;
  pendingCount: number;
  canOpenMembers: boolean;
  canEditCapacity: boolean;
  canEditRoute: boolean;
}

interface ResourceAssignmentRemovalRequest {
  assetId: string;
  type: AppConstants.AssetType;
  title: string;
}

@Component({
  selector: 'app-event-resource-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    EventResourceAssetViewComponent,
    EventResourceCapacityEditorComponent,
    EventResourceRouteEditorComponent,
    EventResourceAssignedAssetJoinDialogComponent,
    EventResourceAssetExploreComponent,
    EventResourceListComponent
  ],
  templateUrl: './event-resource-popup.component.html',
  styleUrls: ['./event-resource-popup.component.scss']
})
export class EventResourcePopupComponent {
  protected readonly resourcePopupStore = inject(SubEventResourcePopupStore);

  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly activitiesStore = inject(ActivitiesPopupStore);
  private readonly assetPopupStore = inject(AssetPopupStore);
  private readonly ownedAssetsStore = inject(OwnedAssetsStore);
  private readonly assetsService = inject(SharedAssetsService);
  private readonly eventsService = inject(EventsService);
  private readonly usersService = inject(UsersService);
  private readonly navigatorStore = inject(NavigatorStore);
  private readonly confirmationDialogStore = inject(ConfirmationDialogStore);
  private readonly shareTokensService = inject(ShareTokensService);
  private readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly eventEditorStore = inject(EventEditorPopupStore);

  private get users(): UserDto[] {
    return this.usersService.peekCachedUsers();
  }

  private ownedAssetCards(): ResourceAssetDTO[] {
    return this.ownedAssetsStore.assetCards();
  }

  private get userById(): Map<string, UserDto> {
    return new Map(this.users.map(user => [user.id, user]));
  }

  private pendingCapacitySaveAbortController: AbortController | null = null;
  private pendingCapacitySaveRequestVersion = 0;
  private pendingRouteSaveAbortController: AbortController | null = null;
  private pendingRouteSaveRequestVersion = 0;
  private routeEditorRowIdSequence = 0;
  private pendingAssignSaveAbortController: AbortController | null = null;
  private pendingAssignSaveRequestVersion = 0;

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

  protected resourceTypeClass(type: AppConstants.SubEventResourceFilter): string {
    return AssetDefaultsBuilder.assetTypeClass(type === 'Members' ? 'Car' : type);
  }

  protected resourceListModel(): EventResourceListModel {
    const cards = this.resourceCards();
    return {
      filter: this.resourcePopupStore.resourceFilterRef(),
      filterCounts: this.resourceFilterCounts(),
      items: cards.map(card => ({
        card,
        infoCard: this.resourceInfoCard(card)
      }))
    };
  }

  protected resourceInfoCard(
    card: AppDTOs.SubEventResourceCardDTO,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return this.activityResourcesService.subEventResourceInfoCard(card, {
      groupLabel: options?.groupLabel ?? null,
      canOpenMap: this.canOpenResourceMap(card),
      occupancyLabel: this.occupancyLabel(card),
      canOpenBadgeDetails: this.canOpenResourceBadgeDetails(card),
      canOpenAssetMembers: this.canOpenAssetMembers(card),
      canEditRoute: this.canEditRoute(card),
      canJoin: this.canJoin(card),
      canLeave: this.canLeave(card),
      canReportResourceManager: this.canReportResourceManager(card)
    });
  }

  protected openResourceCardMap(card: AppDTOs.SubEventResourceCardDTO): void {
    if (!this.canOpenResourceMap(card)) {
      return;
    }
    this.openResourceMap(card);
  }

  protected openResourceCardBadgeDetails(card: AppDTOs.SubEventResourceCardDTO): void {
    if (!this.canOpenResourceBadgeDetails(card)) {
      return;
    }
    this.openResourceBadgeDetails(card);
  }

  protected openAssetViewMembers(view: ResourceAssetViewState, event: Event): void {
    event.stopPropagation();
    if (!view.canOpenMembers) {
      return;
    }
    this.openAssetMembersPopup(view.card, event);
  }

  protected closeResourceShellBackdrop(event: Event): void {
    if (this.resourcePopupStore.assetExploreOnlyRef() && this.resourceAssetView()) {
      this.closeResourceAssetView(event);
      return;
    }
    this.closeResourcePopup();
  }

  protected openAssetViewRoutePopup(view: ResourceAssetViewState, event: Event): void {
    event.stopPropagation();
    if (!view.card.routes.some(stop => stop.trim().length > 0)) {
      return;
    }
    this.openAssetViewRouteEditor(view, event, 'view');
  }

  protected openAssetViewRouteSetup(view: ResourceAssetViewState, event: Event): void {
    event.stopPropagation();
    if (view.mode !== 'edit' || !view.canEditRoute) {
      return;
    }
    this.openAssetViewRouteEditor(view, event, 'edit');
  }

  protected onResourceCardMenuAction(card: AppDTOs.SubEventResourceCardDTO, event: CardMenuActionEvent<InfoCardData>): void {
    if (event.actionId === 'viewAsset') {
      this.openResourceAssetView(card, 'view', new Event('click'));
      return;
    }
    if (event.actionId === 'editAsset') {
      this.openResourceAssetView(card, 'edit', new Event('click'));
      return;
    }
    if (event.actionId === 'joinResource') {
      this.join(card, new Event('click'));
      return;
    }
    if (event.actionId === 'leaveResource') {
      this.leave(card, new Event('click'));
      return;
    }
    if (event.actionId === 'capacity') {
      this.openCapacityEditor(card, new Event('click'));
      return;
    }
    if (event.actionId === 'route') {
      this.openRouteEditor(card, new Event('click'));
      return;
    }
    if (event.actionId === 'contactOrganizer') {
      this.openResourceServiceChat(card, new Event('click'));
      return;
    }
    if (event.actionId === 'shareAsset') {
      this.openResourceShareDialog(card);
      return;
    }
    if (event.actionId === 'reportManager' || event.actionId === 'reportOrganizer') {
      this.reportResourceManager(card, new Event('click'));
      return;
    }
    if (event.actionId === 'removeAssignment' || event.actionId === 'delete') {
      this.requestDeleteResourceCard(card, new Event('click'));
    }
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.defaultPrevented) {
      return;
    }
    if (this.assignedAssetJoinDialogViewState()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.closeAssignedAssetJoinDialog();
      return;
    }
    if (this.resourceAssetView()) {
      keyboardEvent.preventDefault();
      keyboardEvent.stopPropagation();
      this.closeResourceAssetView();
      return;
    }
  }

  private openResourceShareDialog(card: AppDTOs.SubEventResourceCardDTO): void {
    const sourceAssetId = `${card.sourceAssetId ?? ''}`.trim();
    if (!sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation' && card.type !== 'Supplies')) {
      void this.shareTokensService.createToken({
        kind: 'asset',
        entityId: card.id,
        assetType: card.type as AppConstants.AssetType
      }).then(token => this.openShareLinkDialog('Share asset', token));
      return;
    }
    void this.shareTokensService.createToken({
      kind: 'asset',
      entityId: sourceAssetId,
      assetType: card.type
    }).then(token => this.openShareLinkDialog('Share asset', token));
  }

  private openShareLinkDialog(title: string, shareToken: string): void {
    this.confirmationDialogStore.open({
      title,
      message: shareToken,
      confirmLabel: 'Copy link',
      cancelLabel: 'Cancel',
      confirmTone: 'accent',
      onConfirm: async () => {
        await navigator.clipboard?.writeText(shareToken);
      }
    });
  }

  private openResourceServiceChat(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    if (!context || !activeUserId) {
      return;
    }
    const sourceCard = card.sourceAssetId && card.type !== 'Members'
      ? this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppConstants.AssetType, card.sourceAssetId)
      : null;
    const managerUserId = sourceCard?.ownerUserId?.trim() || (
      card.type === 'Car' || card.type === 'Accommodation'
        ? this.assignedAssetManagerUserId(context.subEvent.id, card.type, card.sourceAssetId || '')
        : null
    );
    const titlePrefix = sourceCard ? 'Asset Service' : 'Event Service';
    const chat = this.buildServiceChatItem({
      id: sourceCard
        ? `c-service-asset-${sourceCard.id}-${context.subEvent.id}-${activeUserId}`
        : `c-service-event-resource-${context.ownerId}-${context.subEvent.id}-${card.id}-${activeUserId}`,
      title: `${titlePrefix} · ${card.title}`,
      lastMessage: sourceCard
        ? `Service chat with the ${card.type.toLowerCase()} manager for ${card.title}.`
        : `Service chat with the organizer for ${context.parentTitle}.`,
      eventId: context.ownerId,
      subEventId: context.subEvent.id,
      memberIds: [activeUserId, managerUserId].filter((id): id is string => `${id ?? ''}`.trim().length > 0),
      lastSenderId: managerUserId || activeUserId,
      avatarSource: sourceCard?.ownerName || sourceCard?.title || card.title
    });
    this.activitiesStore.openEventChat(chat);
  }

  private canReportResourceManager(card: AppDTOs.SubEventResourceCardDTO): boolean {
    const target = this.resolveResourceReportTarget(card);
    return !!target && target.userId !== this.activeUser().id.trim();
  }

  private reportResourceManager(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const target = this.resolveResourceReportTarget(card);
    if (!context || !target || target.userId === this.activeUser().id.trim()) {
      return;
    }
    this.navigatorStore.openReportUserPopup({
      targetUserId: target.userId,
      targetName: target.name,
      eventId: context.ownerId,
      eventTitle: target.ownerType === 'asset' ? card.title : context.parentTitle,
      eventStartAtIso: context.subEvent.startAt,
      eventTimeframe: this.reportContextTimeframe(context),
      ownerType: target.ownerType
    });
  }

  private resolveResourceReportTarget(card: AppDTOs.SubEventResourceCardDTO): {
    userId: string;
    name: string;
    ownerType: AppConstants.ActivityMemberOwnerType;
  } | null {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return null;
    }
    const sourceCard = card.sourceAssetId && card.type !== 'Members'
      ? this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppConstants.AssetType, card.sourceAssetId)
      : null;
    const managerUserId = sourceCard?.ownerUserId?.trim() || (
      card.type === 'Car' || card.type === 'Accommodation'
        ? this.assignedAssetManagerUserId(context.subEvent.id, card.type, card.sourceAssetId || '')
        : ''
    );
    if (managerUserId) {
      return {
        userId: managerUserId,
        name: sourceCard?.ownerName?.trim() || this.reportTargetName(managerUserId, 'Manager'),
        ownerType: 'asset'
      };
    }
    const eventRecord = this.eventsService.peekKnownRecordById(this.activeUser().id.trim(), context.ownerId);
    const organizerUserId = `${eventRecord?.creatorUserId ?? context.subEvent.createdByUserId ?? ''}`.trim();
    if (!organizerUserId) {
      return null;
    }
    return {
      userId: organizerUserId,
      name: eventRecord?.creatorName?.trim() || this.reportTargetName(organizerUserId, 'Organizer'),
      ownerType: 'event'
    };
  }

  private reportTargetName(userId: string, fallback: string): string {
    const normalizedUserId = userId.trim();
    return this.appCtx.userProfileStore.getUserProfile(normalizedUserId)?.name?.trim()
      || (normalizedUserId === this.activeUser().id.trim() ? this.activeUser().name?.trim() : '')
      || fallback;
  }

  private reportContextTimeframe(context: ResourcePopupContext): string {
    const start = context.subEvent.startAt?.trim();
    const end = context.subEvent.endAt?.trim();
    if (start && end) {
      return `${start} - ${end}`;
    }
    return start || end || '';
  }

  private buildServiceChatItem(input: {
    id: string;
    title: string;
    lastMessage: string;
    eventId: string;
    subEventId?: string;
    memberIds: string[];
    lastSenderId: string;
    avatarSource: string;
  }): ChatDTO & { ownerUserId?: string } {
    const activeUserId = this.activeUser().id.trim();
    return {
      id: input.id,
      avatar: AppUtils.initialsFromText(input.avatarSource || input.title),
      title: input.title,
      lastMessage: input.lastMessage,
      lastSenderId: input.lastSenderId || activeUserId,
      memberIds: [...new Set(input.memberIds.map(id => `${id ?? ''}`.trim()).filter(Boolean))],
      unread: 0,
      dateIso: new Date().toISOString(),
      channelType: 'serviceEvent',
      serviceContext: input.title.startsWith('Asset Service') ? 'asset' : 'event',
      eventId: input.eventId,
      subEventId: input.subEventId,
      ownerUserId: activeUserId
    };
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
      this.resourcePopupStore.assignedAssetIdsByKey[ActivityResourceBuilder.subEventAssetAssignmentKey(subEvent.id, type)] = [request.assetId];
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
    const { startAtIso, endAtIso } = ActivityResourceBuilder.defaultAssetExploreRange(context.subEvent);
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

  private closeAssignPopup(apply = false): void {
    if (apply) {
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
      this.resourcePopupStore.assignedAssetIdsByKey[ActivityResourceBuilder.subEventAssetAssignmentKey(normalizedState.subEventId, type)] = [
        ...(normalizedState.assetAssignmentIds[type] ?? [])
      ];
      this.resourcePopupStore.assignedAssetSettingsByKey[ActivityResourceBuilder.subEventAssetAssignmentKey(normalizedState.subEventId, type)] = {
        ...(normalizedState.assetSettingsByType[type] ?? {})
      };
    }
    for (const key of Object.keys(this.resourcePopupStore.supplyContributionEntriesByAssignmentKey)) {
      if (key.startsWith(`${normalizedState.subEventId}:`)) {
        delete this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[key];
      }
    }
    for (const [assetId, entries] of Object.entries(normalizedState.supplyContributionEntriesByAssetId)) {
      this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[ActivityResourceBuilder.subEventSupplyAssignmentKey(normalizedState.subEventId, assetId)] = entries
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

  closeResourcePopup(): void {
    this.abortPendingCapacitySaveRequest();
    this.abortPendingRouteSaveRequest();
    this.resourcePopupStore.closeResourcePopup();
    this.abortPendingAssignSaveRequest();
    this.resourcePopupStore.pendingAssignSaveRef.set(null);
    this.resourcePopupStore.assignContextRef.set(null);
    this.resourcePopupStore.selectedAssignAssetIdsRef.set([]);
    this.assetPopupStore.basketVisibleRef.set(false);
    this.ownedAssetsStore.closeAssetPopup();
    this.assetPopupStore.resetTicketState();
    this.assetPopupStore.primaryVisibleRef.set(false);
  }

  popupTitle(): string {
    const context = this.resourcePopupStore.popupContextRef();
    const subEvent = context?.subEvent;
    const typeLabel = APP_STATIC_DATA.assetTypeLabels[this.resourcePopupStore.resourceFilterRef()];
    if (!context || !subEvent) {
      return typeLabel;
    }
    const stageLabel = this.subEventStageLabel(subEvent);
    return stageLabel ? `${typeLabel} - ${stageLabel}` : typeLabel;
  }

  popupSubtitle(): string {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return 'Event';
    }
    const subEventName = this.subEventDisplayName(context.subEvent);
    if (context.parentTitle && subEventName) {
      return `${context.parentTitle} - ${subEventName}`;
    }
    return context.parentTitle || subEventName || 'Event';
  }

  popupSummary(): string {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return '0 members';
    }
    const metrics = this.subEventAssetCapacityMetrics(context.subEvent, this.resourcePopupStore.resourceFilterRef());
    if (metrics.pending <= 0) {
      return `${metrics.joined} members`;
    }
    return `${metrics.joined} members · ${metrics.pending} pending`;
  }

  canOpenAssetMembers(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return !!card.sourceAssetId && (card.type === 'Car' || card.type === 'Accommodation' || card.type === 'Supplies');
  }

  canOpenResourceBadgeDetails(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return !!card.sourceAssetId && (card.type === 'Car' || card.type === 'Accommodation' || card.type === 'Supplies');
  }

  openResourceBadgeDetails(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenResourceBadgeDetails(card)) {
      return;
    }
    if (card.type === 'Car' || card.type === 'Accommodation') {
      void this.openAssetMembersPopup(card);
      return;
    }
    this.openSupplyContributionsPopup(card, event);
  }

  resourceAssetView(): ResourceAssetViewState | null {
    const viewId = `${this.resourcePopupStore.resourceAssetViewIdRef() ?? ''}`.trim();
    if (!viewId) {
      return null;
    }
    const context = this.resourcePopupStore.popupContextRef();
    const card = this.resourceCards().find(item => item.id === viewId || `${item.sourceAssetId ?? ''}`.trim() === viewId) ?? null;
    if (card && context) {
      const source = card.sourceAssetId
        ? this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppConstants.AssetType, card.sourceAssetId)
        : null;
      return {
        card,
        mode: this.resourcePopupStore.resourceAssetViewModeRef(),
        source,
        memberLabel: this.occupancyLabel(card),
        memberCount: Math.max(0, Math.trunc(Number(card.accepted) || 0)),
        pendingCount: Math.max(0, Math.trunc(Number(card.pending) || 0)),
        canOpenMembers: this.canOpenAssetMembers(card),
        canEditCapacity: this.canEditCapacity(card),
        canEditRoute: this.canEditRoute(card)
      };
    }
    return null;
  }

  openResourceAssetView(
    card: AppDTOs.SubEventResourceCardDTO,
    mode: 'view' | 'edit',
    event?: Event
  ): void {
    event?.stopPropagation();
    const assetId = `${card.sourceAssetId ?? ''}`.trim();
    if (!assetId) {
      return;
    }
    this.resourcePopupStore.resourceAssetViewIdRef.set(assetId);
    this.resourcePopupStore.resourceAssetViewModeRef.set(mode === 'edit' && this.canEditRoute(card) ? 'edit' : 'view');
    this.resourcePopupStore.resourceAssetViewReturnToChatRef.set(false);
    this.resourcePopupStore.assetExplorePopupRef.set(null);
  }

  closeResourceAssetView(event?: Event): void {
    event?.stopPropagation();
    if (this.resourcePopupStore.resourceAssetViewReturnToChatRef()) {
      this.closeResourcePopup();
      return;
    }
    this.resourcePopupStore.resourceAssetViewIdRef.set(null);
    this.resourcePopupStore.resourceAssetViewModeRef.set('view');
  }

  async openAssetMembersPopup(card: AppDTOs.SubEventResourceCardDTO, event?: Event): Promise<void> {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation' && card.type !== 'Supplies')) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return;
    }
    const assetType: AppConstants.AssetType = card.type;
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, assetType);
    const managerUserId = settings[card.sourceAssetId]?.addedByUserId?.trim() || null;
    const fallbackMembers = this.assetMemberEntries(sourceCard, managerUserId, context.subEvent.id);
    const acceptedMembers = fallbackMembers.filter(member => member.status === 'accepted').length;
    const pendingMembers = fallbackMembers.filter(member => member.status === 'pending').length;
    const capacityTotal = settings[card.sourceAssetId]?.capacityMax ?? Math.max(0, sourceCard.capacityTotal);
    const subtitle = `${sourceCard.title} · ${this.subEventDisplayName(context.subEvent) || 'Sub Event'}`;
    this.popupCtx.popupStore.requestActivitiesNavigation({
      type: 'members',
      ownerId: sourceCard.id,
      ownerType: 'asset',
      subtitle,
      canManage: this.isAssetOwnedByActiveUser(sourceCard),
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      members: fallbackMembers,
      onMembersChanged: nextMembers => this.syncAssetRequestsFromMembers(sourceCard.id, assetType, nextMembers)
    });
  }

  openSupplyContributionsPopup(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || card.type !== 'Supplies' || !card.sourceAssetId) {
      return;
    }
    this.resourcePopupStore.supplyPopupRef.set({
      subEventId: context.subEvent.id,
      assetId: card.sourceAssetId,
      title: card.title
    });
    this.resourcePopupStore.bringDialogRef.set(null);
  }

  selectResourceFilter(filter: AppConstants.SubEventResourceFilter): void {
    if (filter === 'Members') {
      return;
    }
    this.resourcePopupStore.resourceFilterRef.set(filter);
    this.resourcePopupStore.resourceAssetViewIdRef.set(null);
    this.resourcePopupStore.resourceAssetViewModeRef.set('view');
    this.resourcePopupStore.capacityEditorRef.set(null);
    this.resourcePopupStore.routeEditorRef.set(null);
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
    this.resourcePopupStore.assetExplorePopupRef.set(null);
  }

  resourceCards(): AppDTOs.SubEventResourceCardDTO[] {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return [];
    }
    const type = this.resourcePopupStore.resourceFilterRef();
    const assignedIds = this.resolveSubEventAssignedAssetIds(context.subEvent.id, type);
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, type);
    const fallbackCards = context.fallbackCardsByType[type] ?? [];
    const fallbackCardById = new Map(fallbackCards.map(card => [card.id, card] as const));

    return assignedIds
      .map(id => (
        this.ownedAssetCards().find(card => card.id === id && card.type === type)
        ?? fallbackCardById.get(id)
        ?? null
      ))
      .filter((card): card is ResourceAssetDTO => card !== null)
      .map(card => {
      const managerUserId = (type === 'Car' || type === 'Accommodation' || type === 'Supplies')
        ? (`${settings[card.id]?.addedByUserId ?? ''}`.trim() || null)
        : null;
      return ({
      id: `subevent-${card.id}`,
      type: card.type,
      sourceAssetId: card.id,
      title: card.title,
      subtitle: card.subtitle,
      city: card.city,
      details: ActivityResourceBuilder.assetDetailText(card),
      imageUrl: card.imageUrl,
      sourceLink: ActivityResourceBuilder.assetSourceLink(card),
      routes: card.type === 'Accommodation'
        ? ActivityResourceBuilder.normalizeAssetRoutes(card.type, card.routes)
        : ActivityResourceBuilder.normalizeAssetRoutes(card.type, settings[card.id]?.routes ?? card.routes),
      capacityTotal: settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal),
      accepted: card.type === 'Supplies'
        ? this.subEventSupplyProvidedCount(card.id, context.subEvent.id)
        : this.assetAcceptedCount(card, context.subEvent.id, managerUserId),
      pending: this.assetPendingCount(card, context.subEvent.id, managerUserId),
      isMembers: false
      });
      });
  }

  occupancyLabel(card: AppDTOs.SubEventResourceCardDTO): string {
    const context = this.resourcePopupStore.popupContextRef();
    if (card.type === 'Supplies' && card.sourceAssetId && context) {
      return `${this.subEventSupplyProvidedCount(card.sourceAssetId, context.subEvent.id)} / 1 - ${card.capacityTotal}`;
    }
    return `${card.accepted} / ${card.capacityTotal}`;
  }

  private isAssignedAssetOwnedByActiveUser(card: AppDTOs.SubEventResourceCardDTO): boolean {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId) {
      return false;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type as AppConstants.AssetType, card.sourceAssetId);
    if (!sourceCard) {
      return false;
    }
    const ownerUserId = `${sourceCard.ownerUserId ?? ''}`.trim();
    const activeUserId = this.activeUser().id.trim();
    return this.isAssetOwnedByActiveUser(sourceCard, activeUserId, ownerUserId);
  }

  private assignedAssetManagerUserId(
    subEventId: string,
    type: 'Car' | 'Accommodation',
    assetId: string
  ): string | null {
    const settings = this.getSubEventAssignedAssetSettings(subEventId, type);
    const managerUserId = `${settings[assetId]?.addedByUserId ?? ''}`.trim();
    return managerUserId || null;
  }

  private isAssignedAssetManagedByActiveUser(card: AppDTOs.SubEventResourceCardDTO): boolean {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    return this.assignedAssetManagerUserId(context.subEvent.id, card.type, card.sourceAssetId) === this.activeUser().id;
  }

  private isAssetOwnedByActiveUser(
    card: ResourceAssetDTO,
    activeUserId = this.activeUser().id.trim(),
    ownerUserId = `${card.ownerUserId ?? ''}`.trim()
  ): boolean {
    return ownerUserId.length > 0
      ? ownerUserId === activeUserId
      : this.ownedAssetCards().some(item => item.id === card.id && item.type === card.type);
  }

  private isSubEventScopedAssetRequest(request: AppDTOs.AssetMemberRequestDTO, subEventId: string): boolean {
    return ActivityResourceBuilder.isSubEventScopedAssetRequest(request, subEventId);
  }

  private subEventScopedAssetRequests(
    card: ResourceAssetDTO,
    subEventId: string
  ): AppDTOs.AssetMemberRequestDTO[] {
    return card.requests
      .filter(request => this.isSubEventScopedAssetRequest(request, subEventId))
      .map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      }));
  }

  private findAssignedAssetJoinRequest(
    card: ResourceAssetDTO,
    subEventId: string,
    activeUserId = this.activeUser().id
  ): AppDTOs.AssetMemberRequestDTO | null {
    return this.subEventScopedAssetRequests(card, subEventId)
      .find(request =>
        request.requestKind !== 'manual'
        && AppUtils.resolveAssetRequestUserId(request, this.users) === activeUserId
      ) ?? null;
  }

  private assignedAssetJoinMemberCounts(
    card: ResourceAssetDTO,
    subEventId: string,
    activeUserId = this.activeUser().id,
    managerUserId: string | null = null
  ): { accepted: number; pending: number; shareMemberCount: number } {
    const relevantRequests = this.assetRequestsForView(card, subEventId, managerUserId);
    const relevantUserIds = new Set(
      relevantRequests
        .filter(request => request.status === 'accepted' || request.status === 'pending' || request.requestKind === 'manual')
        .map(request => AppUtils.resolveAssetRequestUserId(request, this.users) || request.userId || request.id)
        .filter(value => `${value ?? ''}`.trim().length > 0)
    );
    if (`${activeUserId ?? ''}`.trim().length > 0) {
      relevantUserIds.add(activeUserId);
    }
    return {
      accepted: relevantRequests.filter(request => request.status === 'accepted').length,
      pending: relevantRequests.filter(request => request.status === 'pending').length,
      shareMemberCount: Math.max(1, relevantUserIds.size)
    };
  }

  private assetRequestsForView(
    card: ResourceAssetDTO,
    subEventId: string,
    managerUserId: string | null = null
  ): AppDTOs.AssetMemberRequestDTO[] {
    const requests = this.subEventScopedAssetRequests(card, subEventId);
    const normalizedManagerUserId = `${managerUserId ?? ''}`.trim();
    if (!normalizedManagerUserId) {
      return requests;
    }
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    const managerOwnsAsset = this.isAssetOwnedByActiveUser(card, normalizedManagerUserId, ownerUserId);
    const visibleRequests = managerOwnsAsset
      ? requests.filter(request => {
          const requestUserId = AppUtils.resolveAssetRequestUserId(request, this.users) || `${request.userId ?? ''}`.trim();
          if (requestUserId !== normalizedManagerUserId) {
            return true;
          }
          return request.status === 'accepted' || request.requestKind === 'manual';
        })
      : requests;
    const hasManagerRequest = visibleRequests.some(request =>
      AppUtils.resolveAssetRequestUserId(request, this.users) === normalizedManagerUserId
      || `${request.userId ?? ''}`.trim() === normalizedManagerUserId
    );
    if (hasManagerRequest) {
      return visibleRequests;
    }
    const managerUser = this.userById.get(normalizedManagerUserId) ?? this.createFallbackUser(normalizedManagerUserId);
    return [
      {
        id: `manual:${subEventId}:${card.id}`,
        userId: managerUser.id,
        name: managerUser.name,
        initials: managerUser.initials,
        gender: managerUser.gender,
        status: managerOwnsAsset ? 'accepted' : 'pending',
        note: managerOwnsAsset ? 'Managing this asset for the sub-event.' : 'Waiting for lender approval.',
        requestKind: managerOwnsAsset ? 'manual' : 'borrow',
        requestedAtIso: '',
        booking: {
          subEventId
        }
      },
      ...visibleRequests
    ];
  }

  private resolveAssignedAssetJoinPricing(
    card: ResourceAssetDTO,
    subEvent: ContractTypes.SubEventDTO,
    activeUserId = this.activeUser().id,
    managerUserId: string | null = null
  ): AssignedAssetJoinPricingPreview {
    const startAtIso = `${subEvent.startAt ?? ''}`.trim();
    const endAtIso = `${subEvent.endAt ?? ''}`.trim();
    const normalized = PricingBuilder.compactPricingConfig(card.pricing, {
      context: 'asset',
      allowSlotFeatures: false
    });
    const basePricing = PricingBuilder.resolveAssetBorrowPricing({
      pricing: card.pricing,
      totalQuantity: AssetCardBuilder.storedQuantityValue(card),
      requestedQuantity: 1,
      startAtIso,
      endAtIso,
      requests: card.requests
    });
    const shareMemberCount = this.assignedAssetJoinMemberCounts(card, subEvent.id, activeUserId, managerUserId).shareMemberCount;
    if (!normalized.enabled || basePricing.amount <= 0) {
      return {
        totalAmount: 0,
        shareAmount: 0,
        shareMemberCount,
        currency: basePricing.currency,
        chargeType: normalized.chargeType ?? null
      };
    }
    const totalAmount = normalized.chargeType === 'per_attendee'
      ? Math.round(basePricing.amount * shareMemberCount * 100) / 100
      : basePricing.amount;
    const shareAmount = normalized.chargeType === 'per_attendee'
      ? basePricing.amount
      : Math.round((totalAmount / Math.max(1, shareMemberCount)) * 100) / 100;
    return {
      totalAmount,
      shareAmount,
      shareMemberCount,
      currency: basePricing.currency,
      chargeType: normalized.chargeType ?? null
    };
  }

  canOpenResourceMap(card: AppDTOs.SubEventResourceCardDTO): boolean {
    if (!card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    return ActivityResourceBuilder.normalizeAssetRoutes(card.type, card.routes).some(stop => stop.trim().length > 0);
  }

  openResourceMap(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenResourceMap(card)) {
      return;
    }
    const routes = ActivityResourceBuilder.normalizeAssetRoutes(card.type as AppConstants.AssetType, card.routes);
    if (card.type === 'Accommodation') {
      this.openGoogleMapsSearch(routes[0] ?? card.city);
      return;
    }
    this.openGoogleMapsDirections(routes);
  }

  canJoin(card: AppDTOs.SubEventResourceCardDTO): boolean {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    if (this.isAssignedAssetManagedByActiveUser(card)) {
      return false;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return false;
    }
    return !this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, this.activeUser().id);
  }

  join(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !this.canJoin(card) || !card.sourceAssetId) {
      return;
    }
    const type = card.type === 'Car' || card.type === 'Accommodation' ? card.type : null;
    if (!type) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, type, card.sourceAssetId);
    if (!sourceCard) {
      return;
    }
    const existingRequest = this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, this.activeUser().id);
    const validPolicyIds = new Set((sourceCard.policies ?? []).map(policy => policy.id));
    this.resourcePopupStore.assignedAssetJoinDialogRef.set({
      cardId: card.id,
      type,
      sourceAssetId: sourceCard.id,
      acceptedPolicyIds: [...new Set(existingRequest?.booking?.acceptedPolicyIds ?? [])]
        .map(item => `${item ?? ''}`.trim())
        .filter(item => item.length > 0 && validPolicyIds.has(item)),
      busy: false,
      error: null
    });
  }

  canLeave(card: AppDTOs.SubEventResourceCardDTO): boolean {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return false;
    }
    if (this.isAssignedAssetManagedByActiveUser(card)) {
      return false;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return false;
    }
    return !!this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, this.activeUser().id);
  }

  leave(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || (card.type !== 'Car' && card.type !== 'Accommodation')) {
      return;
    }
    if (this.isAssignedAssetManagedByActiveUser(card)) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return;
    }
    const currentRequest = this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, this.activeUser().id);
    if (!currentRequest) {
      return;
    }
    const nextRequests = sourceCard.requests
      .filter(request => request.id !== currentRequest.id)
      .map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      }));
    if (this.resourcePopupStore.assignedAssetJoinDialogRef()?.sourceAssetId === sourceCard.id) {
      this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
    }
    if (this.isAssetOwnedByActiveUser(sourceCard)) {
      const nextCards = this.ownedAssetCards().map(asset => (
        asset.id === sourceCard.id && asset.type === sourceCard.type
          ? {
              ...asset,
              requests: nextRequests
            }
          : asset
      ));
      if (this.ownedAssetsStore.applyAssetCards(nextCards, { mutation: true, reloadList: false })) {
        const ownerUserId = this.ownedAssetsStore.activeOwnerUserIdRef().trim()
          || this.appCtx.userProfileStore.getActiveUserId().trim();
        if (ownerUserId) {
          void this.assetsService.replaceOwnedAssets(ownerUserId, this.ownedAssetsStore.assetCards());
        }
      }
      this.syncPopupSubEventMetrics();
      return;
    }
    const activeContext = this.resourcePopupStore.popupContextRef();
    if (!activeContext || activeContext.subEvent.id !== context.subEvent.id) {
      return;
    }
    const nextFallbackCards = this.cloneFallbackCards(activeContext.fallbackCardsByType);
    const existingCards = nextFallbackCards[sourceCard.type] ?? [];
    const nextFallbackAsset = this.assignedFallbackAssetSnapshot(context.subEvent.id, {
      ...sourceCard,
      requests: nextRequests
    });
    nextFallbackCards[sourceCard.type] = existingCards.some(item => item.id === sourceCard.id)
      ? existingCards.map(item => item.id === sourceCard.id ? nextFallbackAsset : item)
      : [...existingCards, nextFallbackAsset];
    const nextContext = {
      ...activeContext,
      fallbackCardsByType: nextFallbackCards
    };
    this.resourcePopupStore.popupContextRef.set(nextContext);
    this.syncPopupSubEventMetrics(false);
    this.persistPopupResourceState(nextContext);
  }

  closeAssignedAssetJoinDialog(event?: Event): void {
    event?.stopPropagation();
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
  }

  toggleAssignedAssetJoinPolicy(policyId: string): void {
    const dialog = this.resourcePopupStore.assignedAssetJoinDialogRef();
    if (!dialog || dialog.busy) {
      return;
    }
    const normalizedPolicyId = `${policyId ?? ''}`.trim();
    if (!normalizedPolicyId) {
      return;
    }
    const nextAccepted = new Set(dialog.acceptedPolicyIds.map(item => item.trim()).filter(Boolean));
    if (nextAccepted.has(normalizedPolicyId)) {
      nextAccepted.delete(normalizedPolicyId);
    } else {
      nextAccepted.add(normalizedPolicyId);
    }
    this.resourcePopupStore.assignedAssetJoinDialogRef.set({
      ...dialog,
      acceptedPolicyIds: [...nextAccepted],
      error: null
    });
  }

  canSubmitAssignedAssetJoin(): boolean {
    const dialog = this.resourcePopupStore.assignedAssetJoinDialogRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !context || dialog.busy) {
      return false;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, dialog.type, dialog.sourceAssetId);
    if (!sourceCard) {
      return false;
    }
    const acceptedPolicyIds = new Set(dialog.acceptedPolicyIds.map(item => item.trim()).filter(Boolean));
    return !(sourceCard.policies ?? [])
      .some(policy => policy.required !== false && !acceptedPolicyIds.has(policy.id));
  }

  confirmAssignedAssetJoin(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.resourcePopupStore.assignedAssetJoinDialogRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !context) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, dialog.type, dialog.sourceAssetId);
    if (!sourceCard) {
      this.resourcePopupStore.assignedAssetJoinDialogRef.set({
        ...dialog,
        busy: false,
        error: 'This asset is no longer available in the resource popup.'
      });
      return;
    }
    if (!this.canSubmitAssignedAssetJoin()) {
      return;
    }
    const activeUser = this.activeUser();
    const pricing = this.resolveAssignedAssetJoinPricing(sourceCard, context.subEvent, activeUser.id);
    const validPolicyIds = new Set((sourceCard.policies ?? []).map(policy => policy.id));
    const acceptedPolicyIds = [...new Set(dialog.acceptedPolicyIds.map(item => item.trim()).filter(Boolean))]
      .filter(item => validPolicyIds.has(item));
    const existingRequest = this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, activeUser.id);
    const startAtIso = `${context.subEvent.startAt ?? ''}`.trim();
    const endAtIso = `${context.subEvent.endAt ?? ''}`.trim();
    const nextRequest: AppDTOs.AssetMemberRequestDTO = {
      id: existingRequest?.id ?? `borrow:${activeUser.id}:${sourceCard.id}:${context.subEvent.id}`,
      userId: activeUser.id,
      name: activeUser.name,
      initials: activeUser.initials,
      gender: activeUser.gender,
      status: 'pending',
      note: 'Join request from sub-event assets.',
      requestKind: 'borrow',
      requestedAtIso: existingRequest?.requestedAtIso ?? new Date().toISOString(),
      booking: this.assetRequestBookingForRange(
        context.subEvent,
        context.ownerId,
        context.parentTitle,
        startAtIso,
        endAtIso,
        1,
        {
          totalAmount: pricing.shareAmount,
          currency: pricing.currency,
          acceptedPolicyIds
        }
      )
    };
    const nextRequests: AppDTOs.AssetMemberRequestDTO[] = [
      nextRequest,
      ...sourceCard.requests
        .filter(request =>
          request.id !== nextRequest.id
          && AppUtils.resolveAssetRequestUserId(request, this.users) !== activeUser.id
        )
        .map(request => ({
          ...request,
          booking: request.booking
            ? {
                ...request.booking,
                acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
              }
            : null
        }))
    ];
    this.resourcePopupStore.assignedAssetJoinDialogRef.set({
      ...dialog,
      acceptedPolicyIds,
      busy: true,
      error: null
    });
    if (this.isAssetOwnedByActiveUser(sourceCard)) {
      const nextCards = this.ownedAssetCards().map(asset => (
        asset.id === sourceCard.id && asset.type === sourceCard.type
          ? {
              ...asset,
              requests: nextRequests
            }
          : asset
      ));
      if (this.ownedAssetsStore.applyAssetCards(nextCards, { mutation: true, reloadList: false })) {
        const ownerUserId = this.ownedAssetsStore.activeOwnerUserIdRef().trim()
          || this.appCtx.userProfileStore.getActiveUserId().trim();
        if (ownerUserId) {
          void this.assetsService.replaceOwnedAssets(ownerUserId, this.ownedAssetsStore.assetCards());
        }
      }
      this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
      this.syncPopupSubEventMetrics();
      return;
    }

    const activeContext = this.resourcePopupStore.popupContextRef();
    if (!activeContext || activeContext.subEvent.id !== context.subEvent.id) {
      return;
    }
    const nextFallbackCards = this.cloneFallbackCards(activeContext.fallbackCardsByType);
    const existingCards = nextFallbackCards[sourceCard.type] ?? [];
    const nextFallbackAsset = this.assignedFallbackAssetSnapshot(context.subEvent.id, {
      ...sourceCard,
      requests: nextRequests
    });
    nextFallbackCards[sourceCard.type] = existingCards.some(card => card.id === sourceCard.id)
      ? existingCards.map(card => card.id === sourceCard.id ? nextFallbackAsset : card)
      : [...existingCards, nextFallbackAsset];
    const nextContext = {
      ...activeContext,
      fallbackCardsByType: nextFallbackCards
    };
    this.resourcePopupStore.popupContextRef.set(nextContext);
    this.syncPopupSubEventMetrics(false);
    this.persistPopupResourceState(nextContext);
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
  }

  canEditCapacity(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return this.isAssignedAssetOwnedByActiveUser(card);
  }

  canEditRoute(card: AppDTOs.SubEventResourceCardDTO): boolean {
    return card.type === 'Car' && this.canEditCapacity(card);
  }

  openCapacityEditor(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || !card.sourceAssetId || !this.canEditCapacity(card)) {
      return;
    }
    const type = card.type as AppConstants.AssetType;
    const source = this.ownedAssetCards().find(item => item.id === card.sourceAssetId && item.type === type);
    if (!source) {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, type);
    const current = settings[card.sourceAssetId];
    const capacityLimit = Math.max(0, source.capacityTotal);
    const capacityMax = AppUtils.clampNumber(Math.trunc(current?.capacityMax ?? capacityLimit), 0, capacityLimit);
    const capacityMin = AppUtils.clampNumber(Math.trunc(current?.capacityMin ?? 0), 0, capacityMax);
    this.abortPendingCapacitySaveRequest();
    this.resourcePopupStore.capacityEditorRef.set({
      subEventId: context.subEvent.id,
      type,
      assetId: card.sourceAssetId,
      title: card.title,
      capacityMin,
      capacityMax,
      capacityLimit,
      busy: false,
      error: null
    });
    this.abortPendingRouteSaveRequest();
    this.resourcePopupStore.routeEditorRef.set(null);
  }

  closeCapacityEditor(event?: Event): void {
    event?.stopPropagation();
    this.abortPendingCapacitySaveRequest();
    this.resourcePopupStore.capacityEditorRef.set(null);
  }

  saveCapacityEditor(event?: Event): void {
    event?.stopPropagation();
    const editor = this.resourcePopupStore.capacityEditorRef();
    if (
      !editor
      || editor.busy
      || editor.capacityMin < 0
      || editor.capacityMax < editor.capacityMin
      || editor.capacityMax > editor.capacityLimit
    ) {
      return;
    }
    const nextState = this.buildPopupResourceState();
    if (!nextState) {
      return;
    }
    const nextSettings = {
      ...(nextState.assetSettingsByType[editor.type] ?? {})
    };
    const current = nextSettings[editor.assetId] ?? {
      capacityMin: 0,
      capacityMax: editor.capacityLimit,
      addedByUserId: this.activeUser().id,
      routes: []
    };
    nextSettings[editor.assetId] = {
      ...current,
      capacityMin: editor.capacityMin,
      capacityMax: editor.capacityMax
    };
    nextState.assetSettingsByType = {
      ...nextState.assetSettingsByType,
      [editor.type]: nextSettings
    };

    const requestVersion = ++this.pendingCapacitySaveRequestVersion;
    const abortController = new AbortController();
    this.pendingCapacitySaveAbortController = abortController;
    this.resourcePopupStore.capacityEditorRef.set({
      ...editor,
      busy: true,
      error: null
    });

    void this.activityResourcesService.replaceSubEventResourceState(nextState, abortController.signal)
      .then(savedState => {
        if (this.pendingCapacitySaveAbortController === abortController) {
          this.pendingCapacitySaveAbortController = null;
        }
        if (abortController.signal.aborted || requestVersion !== this.pendingCapacitySaveRequestVersion) {
          return;
        }
        const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
        this.applyPersistedPopupState(resolvedState);
        this.resourcePopupStore.capacityEditorRef.set(null);
        this.syncPopupSubEventMetrics(false);
      })
      .catch(error => {
        if (this.pendingCapacitySaveAbortController === abortController) {
          this.pendingCapacitySaveAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion !== this.pendingCapacitySaveRequestVersion) {
          return;
        }
        const currentEditor = this.resourcePopupStore.capacityEditorRef();
        if (!currentEditor || currentEditor.assetId !== editor.assetId || currentEditor.type !== editor.type) {
          return;
        }
        this.resourcePopupStore.capacityEditorRef.set({
          ...currentEditor,
          busy: false,
          error: 'Unable to save capacity changes.'
        });
      });
  }

  private abortPendingCapacitySaveRequest(): void {
    this.pendingCapacitySaveRequestVersion += 1;
    const controller = this.pendingCapacitySaveAbortController;
    this.pendingCapacitySaveAbortController = null;
    controller?.abort();
  }

  openRouteEditor(card: AppDTOs.SubEventResourceCardDTO, event: Event, mode: 'view' | 'edit' = 'edit'): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || card.type !== 'Car' || !card.sourceAssetId) {
      return;
    }
    const resolvedMode: 'view' | 'edit' = mode === 'edit' && this.canEditRoute(card) ? 'edit' : 'view';
    if (mode === 'edit' && resolvedMode !== 'edit') {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, 'Car');
    const source = this.ownedAssetCards().find(item => item.id === card.sourceAssetId && item.type === 'Car')
      ?? this.resourcePopupStore.assetExplorePopupRef()?.cards.find(item => item.id === card.sourceAssetId && item.type === 'Car')
      ?? null;
    const routes = this.resolveViewableCarRoutes(settings[card.sourceAssetId]?.routes, card.routes, this.assetRouteValues(source));
    if (resolvedMode === 'view' && routes.every(stop => stop.trim().length === 0)) {
      return;
    }
    this.abortPendingRouteSaveRequest();
    this.resourcePopupStore.routeEditorRef.set({
      subEventId: context.subEvent.id,
      type: 'Car',
      assetId: card.sourceAssetId,
      title: card.title,
      mode: resolvedMode,
      routes,
      routeRowIds: this.buildRouteEditorRowIds(routes),
      busy: false,
      error: null
    });
    this.abortPendingCapacitySaveRequest();
    this.resourcePopupStore.capacityEditorRef.set(null);
  }

  openAssetViewRouteEditor(
    view: ResourceAssetViewState,
    event: Event,
    mode: 'view' | 'edit' = 'view'
  ): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const card = view.card;
    const assetId = `${card.sourceAssetId ?? ''}`.trim();
    if (!context || card.type !== 'Car' || !assetId) {
      return;
    }
    const resolvedMode: 'view' | 'edit' = mode === 'edit' && view.canEditRoute ? 'edit' : 'view';
    if (mode === 'edit' && resolvedMode !== 'edit') {
      return;
    }
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, 'Car');
    const source = view.source?.type === 'Car'
      ? view.source
      : this.ownedAssetCards().find(item => item.id === assetId && item.type === 'Car')
        ?? this.resourcePopupStore.assetExplorePopupRef()?.cards.find(item => item.id === assetId && item.type === 'Car')
        ?? null;
    const routes = this.resolveViewableCarRoutes(settings[assetId]?.routes, card.routes, this.assetRouteValues(source));
    if (resolvedMode === 'view' && routes.every(stop => stop.trim().length === 0)) {
      return;
    }
    this.abortPendingRouteSaveRequest();
    this.resourcePopupStore.routeEditorRef.set({
      subEventId: context.subEvent.id,
      type: 'Car',
      assetId,
      title: card.title,
      mode: resolvedMode,
      routes,
      routeRowIds: this.buildRouteEditorRowIds(routes),
      busy: false,
      error: null
    });
    this.abortPendingCapacitySaveRequest();
    this.resourcePopupStore.capacityEditorRef.set(null);
  }

  private resolveViewableCarRoutes(
    settingsRoutes: string[] | undefined,
    cardRoutes: string[] | undefined,
    sourceRoutes: string[] | undefined
  ): string[] {
    const candidates = [settingsRoutes, cardRoutes, sourceRoutes]
      .map(routes => ActivityResourceBuilder.normalizeAssetRoutes('Car', routes).filter(stop => stop.trim().length > 0));
    return candidates.find(routes => routes.length > 0) ?? [''];
  }

  closeRouteEditor(event?: Event): void {
    event?.stopPropagation();
    this.abortPendingRouteSaveRequest();
    this.resourcePopupStore.routeEditorRef.set(null);
  }

  saveRouteEditor(event?: Event): void {
    event?.stopPropagation();
    const editor = this.resourcePopupStore.routeEditorRef();
    if (
      !editor
      || editor.busy
      || editor.mode === 'view'
      || !editor.routes.some(stop => stop.trim().length > 0)
    ) {
      return;
    }
    const nextState = this.buildPopupResourceState();
    if (!nextState) {
      return;
    }
    const nextSettings = {
      ...(nextState.assetSettingsByType[editor.type] ?? {})
    };
    const source = this.ownedAssetCards().find(item => item.id === editor.assetId && item.type === editor.type);
    const current = nextSettings[editor.assetId] ?? {
      capacityMin: 0,
      capacityMax: Math.max(0, source?.capacityTotal ?? 0),
      addedByUserId: this.activeUser().id,
      routes: []
    };
    nextSettings[editor.assetId] = {
      ...current,
      routes: ActivityResourceBuilder.normalizeAssetRoutes(editor.type, editor.routes)
    };
    nextState.assetSettingsByType = {
      ...nextState.assetSettingsByType,
      [editor.type]: nextSettings
    };

    const requestVersion = ++this.pendingRouteSaveRequestVersion;
    const abortController = new AbortController();
    this.pendingRouteSaveAbortController = abortController;
    this.resourcePopupStore.routeEditorRef.set({
      ...editor,
      busy: true,
      error: null
    });

    void this.activityResourcesService.replaceSubEventResourceState(nextState, abortController.signal)
      .then(savedState => {
        if (this.pendingRouteSaveAbortController === abortController) {
          this.pendingRouteSaveAbortController = null;
        }
        if (abortController.signal.aborted || requestVersion !== this.pendingRouteSaveRequestVersion) {
          return;
        }
        const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
        this.applyPersistedPopupState(resolvedState);
        this.resourcePopupStore.routeEditorRef.set(null);
        this.syncPopupSubEventMetrics(false);
      })
      .catch(error => {
        if (this.pendingRouteSaveAbortController === abortController) {
          this.pendingRouteSaveAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion !== this.pendingRouteSaveRequestVersion) {
          return;
        }
        const currentEditor = this.resourcePopupStore.routeEditorRef();
        if (!currentEditor || currentEditor.assetId !== editor.assetId || currentEditor.type !== editor.type) {
          return;
        }
        this.resourcePopupStore.routeEditorRef.set({
          ...currentEditor,
          busy: false,
          error: 'Unable to save route changes.'
        });
      });
  }

  private abortPendingRouteSaveRequest(): void {
    this.pendingRouteSaveRequestVersion += 1;
    const controller = this.pendingRouteSaveAbortController;
    this.pendingRouteSaveAbortController = null;
    controller?.abort();
  }

  private abortPendingAssignSaveRequest(): void {
    this.pendingAssignSaveRequestVersion += 1;
    const controller = this.pendingAssignSaveAbortController;
    this.pendingAssignSaveAbortController = null;
    controller?.abort();
  }

  requestDeleteResourceCard(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    if (!card.sourceAssetId || !this.isAssignableAssetType(card.type)) {
      return;
    }
    const pending: ResourceAssignmentRemovalRequest = {
      assetId: card.sourceAssetId,
      type: card.type,
      title: card.title
    };
    this.confirmationDialogStore.open({
      title: 'Remove assignment',
      message: `Remove "${pending.title}" from this event assignment?`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Remove',
      busyConfirmLabel: 'Removing...',
      confirmTone: 'danger',
      failureMessage: 'Unable to remove assignment.',
      onConfirm: () => this.removeResourceAssignment(pending)
    });
  }

  private async removeResourceAssignment(pending: ResourceAssignmentRemovalRequest): Promise<void> {
    const nextState = this.buildResourceAssignmentRemovalState(pending);
    if (!nextState) {
      throw new Error('Unable to remove assignment.');
    }
    const savedState = await this.activityResourcesService.replaceSubEventResourceState(nextState);
    const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
    this.applyPersistedPopupState(resolvedState);
    this.syncPopupSubEventMetrics({ persistAssetRequests: true });
  }

  private buildResourceAssignmentRemovalState(
    pending: ResourceAssignmentRemovalRequest
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    const context = this.resourcePopupStore.popupContextRef();
    const nextState = this.buildPopupResourceState(context);
    if (!context || !nextState) {
      return null;
    }
    const currentIds = nextState.assetAssignmentIds[pending.type] ?? [];
    const nextIds = currentIds.filter(assetId => assetId !== pending.assetId);
    if (nextIds.length === currentIds.length) {
      return null;
    }
    const nextSettings = { ...(nextState.assetSettingsByType[pending.type] ?? {}) };
    delete nextSettings[pending.assetId];
    nextState.assetAssignmentIds = {
      ...nextState.assetAssignmentIds,
      [pending.type]: nextIds
    };
    nextState.assetSettingsByType = {
      ...nextState.assetSettingsByType,
      [pending.type]: nextSettings
    };
    if (pending.type === 'Supplies') {
      const nextSupplyEntries = { ...nextState.supplyContributionEntriesByAssetId };
      delete nextSupplyEntries[pending.assetId];
      nextState.supplyContributionEntriesByAssetId = nextSupplyEntries;
    }
    return nextState;
  }

  private isAssignableAssetType(type: AppConstants.SubEventResourceFilter): type is AppConstants.AssetType {
    return type === 'Car' || type === 'Accommodation' || type === 'Supplies';
  }

  openAssignPopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    this.abortPendingAssignSaveRequest();
    this.resourcePopupStore.pendingAssignSaveRef.set(null);
    const type = this.resourcePopupStore.resourceFilterRef();
    this.resourcePopupStore.assignContextRef.set({ subEventId: context.subEvent.id, type });
    this.resourcePopupStore.selectedAssignAssetIdsRef.set([...this.resolveSubEventAssignedAssetIds(context.subEvent.id, type)]);
    this.ownedAssetsStore.openAssetPopup(type);
    this.assetPopupStore.primaryVisibleRef.set(true);
    this.assetPopupStore.stackedVisibleRef.set(false);
    this.assetPopupStore.basketVisibleRef.set(true);
  }

  openExplorePopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const type = this.resourcePopupStore.resourceFilterRef();
    const { startAtIso, endAtIso } = ActivityResourceBuilder.defaultAssetExploreRange(context.subEvent);
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

  readonly assignedAssetJoinDialogViewState = computed<AssignedAssetJoinDialogViewState | null>(() => {
    const dialog = this.resourcePopupStore.assignedAssetJoinDialogRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !context) {
      return null;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, dialog.type, dialog.sourceAssetId);
    if (!sourceCard) {
      return null;
    }
    const timeframe = ActivityResourceBuilder.assetRequestTimeframeLabel(
      `${context.subEvent.startAt ?? ''}`.trim(),
      `${context.subEvent.endAt ?? ''}`.trim()
    );
    const isOwnedAsset = this.isAssetOwnedByActiveUser(sourceCard);
    const managerUserId = this.assignedAssetManagerUserId(context.subEvent.id, dialog.type, dialog.sourceAssetId);
    const pricing = this.resolveAssignedAssetJoinPricing(sourceCard, context.subEvent, this.activeUser().id, managerUserId);
    const memberCounts = this.assignedAssetJoinMemberCounts(sourceCard, context.subEvent.id, this.activeUser().id, managerUserId);
    const shareLabel = pricing.chargeType === 'per_attendee'
      ? 'Per-member price'
      : (pricing.shareMemberCount === 1 ? 'Current share' : `Estimated share for ${pricing.shareMemberCount} members`);
    const shareHint = pricing.totalAmount > 0
      ? (pricing.chargeType === 'per_attendee'
          ? 'This asset charges per member, so your join keeps the same price even as the member list changes.'
          : 'This asset is priced as a shared booking, so the preview is split across the current member count for this subevent.')
      : 'No asset pricing is configured for this join request.';
    return {
      title: `Join ${sourceCard.title}`,
      subtitle: this.popupSubtitle(),
      timeframe: timeframe || 'Sub-event timeframe',
      pathLabel: isOwnedAsset ? 'Assigned own asset' : 'Borrowed item',
      memberSummary: memberCounts.pending > 0
        ? `${memberCounts.accepted} accepted · ${memberCounts.pending} pending`
        : `${memberCounts.accepted} accepted`,
      lineItems: [
        {
          id: `resource:${sourceCard.id}`,
          kind: 'resource',
          label: sourceCard.title,
          detail: isOwnedAsset ? 'Assigned asset join' : 'Borrowed item join',
          amount: pricing.shareAmount,
          currency: pricing.currency
        }
      ],
      totalAmount: pricing.totalAmount,
      shareAmount: pricing.shareAmount,
      shareMemberCount: pricing.shareMemberCount,
      currency: pricing.currency,
      shareLabel,
      shareHint,
      policies: (sourceCard.policies ?? []).map(item => ({ ...item })),
      acceptedPolicyIds: [...dialog.acceptedPolicyIds],
      submitLabel: 'Send join request',
      busyLabel: 'Sending request...',
      busy: dialog.busy,
      error: dialog.error
    };
  });

  private resourceFilterCounts(): Record<AppConstants.AssetType, number> {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return {
        Car: 0,
        Accommodation: 0,
        Supplies: 0
      };
    }
    return {
      Car: this.subEventAssetCapacityMetrics(context.subEvent, 'Car').pending,
      Accommodation: this.subEventAssetCapacityMetrics(context.subEvent, 'Accommodation').pending,
      Supplies: this.subEventAssetCapacityMetrics(context.subEvent, 'Supplies').pending
    };
  }

  private subEventAssignedAssetCards(subEventId: string, type: AppConstants.AssetType): ResourceAssetDTO[] {
    return this.resolveSubEventAssignedAssetIds(subEventId, type)
      .map(id => this.resolveSubEventAssignedAssetCard(subEventId, type, id))
      .filter((card): card is ResourceAssetDTO => card !== null);
  }

  private getSubEventAssignedAssetSettings(subEventId: string, type: AppConstants.AssetType): Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> {
    const key = ActivityResourceBuilder.subEventAssetAssignmentKey(subEventId, type);
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
        routes: ActivityResourceBuilder.normalizeAssetRoutes(type, previous?.routes)
      };
    }
    this.resourcePopupStore.assignedAssetSettingsByKey[key] = next;
    return next;
  }

  private resolveSubEventAssignedAssetIds(subEventId: string, type: AppConstants.AssetType): string[] {
    const key = ActivityResourceBuilder.subEventAssetAssignmentKey(subEventId, type);
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

  private subEventFallbackAssetCards(
    subEventId: string,
    type: AppConstants.AssetType
  ): ResourceAssetDTO[] {
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
      this.resourcePopupStore.assignedAssetIdsByKey[ActivityResourceBuilder.subEventAssetAssignmentKey(subEventId, type)] = [...normalized];
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

  private syncPopupSubEventMetrics(options: boolean | { persistResourceState?: boolean; persistAssetRequests?: boolean } = false): void {
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

  private syncAssetRequestsFromMembers(
    assetId: string,
    assetType: AppConstants.AssetType,
    members: readonly ActivityContracts.ActivityMemberEntry[]
  ): void {
    const context = this.resourcePopupStore.popupContextRef();
    const asset = this.ownedAssetCards().find(card => card.id === assetId && card.type === assetType)
      ?? (context ? this.subEventFallbackAssetCards(context.subEvent.id, assetType).find(card => card.id === assetId) ?? null : null);
    if (!asset) {
      return;
    }
    const isOwnedAsset = this.ownedAssetCards().some(card => card.id === asset.id && card.type === assetType);
    const existingById = new Map(asset.requests.map(request => [request.id, request] as const));
    const existingByUserId = new Map(
      asset.requests.map(request => [AppUtils.resolveAssetRequestUserId(request, this.users), request] as const)
    );
    const existingByName = new Map(asset.requests.map(request => [request.name.toLowerCase(), request] as const));
    const now = Date.now();
    const booking = this.currentAssetRequestBooking(1);
    const syncableMembers = members.filter(entry => entry.status === 'accepted' || entry.status === 'pending');
    const memberRequests: AppDTOs.AssetMemberRequestDTO[] = syncableMembers.map((entry, index) => {
      const existing =
        existingById.get(entry.id)
        ?? existingByUserId.get(entry.userId)
        ?? existingByName.get(entry.name.toLowerCase())
        ?? null;
      const requestId = existing?.id ?? (entry.id.trim() || `asset-member-${now}-${index}`);
      const note = entry.status !== 'pending'
        ? (existing?.note ?? 'Accepted for this asset.')
        : (entry.pendingSource === 'admin'
          ? 'Waiting for event admin approval.'
          : 'Waiting for owner approval.');
      const requestStatus: AppConstants.AssetRequestStatus = entry.status === 'pending' ? 'pending' : 'accepted';
      return {
        id: requestId,
        userId: entry.userId,
        name: entry.name,
        initials: entry.initials,
        gender: entry.gender,
        status: requestStatus,
        note,
        requestKind: existing?.requestKind ?? (isOwnedAsset ? 'borrow' : 'manual'),
        requestedAtIso: existing?.requestedAtIso ?? new Date().toISOString(),
        booking: existing?.booking
          ? {
              ...existing.booking,
              acceptedPolicyIds: [...(existing.booking.acceptedPolicyIds ?? [])]
            }
          : booking
      };
    });
    const manualRequests = isOwnedAsset
      ? asset.requests
        .filter(request => request.requestKind === 'manual')
        .map(request => ({
          ...request,
          booking: request.booking
            ? {
                ...request.booking,
                acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
              }
            : null
        }))
      : [];
    const nextRequests: AppDTOs.AssetMemberRequestDTO[] = [...manualRequests, ...memberRequests];
    const currentSignature = JSON.stringify(asset.requests.map(request => ActivityResourceBuilder.assetRequestSyncSignature(request)));
    const nextSignature = JSON.stringify(nextRequests.map(request => ActivityResourceBuilder.assetRequestSyncSignature(request)));
    if (currentSignature === nextSignature) {
      return;
    }
    if (!isOwnedAsset) {
      if (!context) {
        return;
      }
      const activeContext = this.resourcePopupStore.popupContextRef();
      if (!activeContext || activeContext.subEvent.id !== context.subEvent.id) {
        return;
      }
      const nextFallbackCards = this.cloneFallbackCards(activeContext.fallbackCardsByType);
      const nextCards = nextFallbackCards[assetType] ?? [];
      const nextAsset = this.assignedFallbackAssetSnapshot(context.subEvent.id, {
        ...asset,
        requests: nextRequests
      });
      nextFallbackCards[assetType] = nextCards.some(card => card.id === assetId)
        ? nextCards.map(card => card.id === assetId ? nextAsset : card)
        : [...nextCards, nextAsset];
      const nextContext = {
        ...activeContext,
        fallbackCardsByType: nextFallbackCards
      };
      this.resourcePopupStore.popupContextRef.set(nextContext);
      this.syncPopupSubEventMetrics(false);
      this.persistPopupResourceState(nextContext);
      return;
    }
    const nextCards = this.ownedAssetCards().map(card =>
      card.id === asset.id && card.type === asset.type
        ? { ...card, requests: nextRequests }
        : card
    );
    if (this.ownedAssetsStore.applyAssetCards(nextCards, { mutation: true, reloadList: false })) {
      const ownerUserId = this.ownedAssetsStore.activeOwnerUserIdRef().trim()
        || this.appCtx.userProfileStore.getActiveUserId().trim();
      if (ownerUserId) {
        void this.assetsService.replaceOwnedAssets(ownerUserId, this.ownedAssetsStore.assetCards());
      }
    }
    this.syncPopupSubEventMetrics();
  }

  private currentAssetRequestBooking(quantity: number): AppDTOs.AssetHireRequestBookingDTO | null {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return null;
    }
    const startAtIso = `${context.subEvent.startAt ?? ''}`.trim();
    const endAtIso = `${context.subEvent.endAt ?? ''}`.trim();
    return this.assetRequestBookingForRange(
      context.subEvent,
      context.ownerId,
      context.parentTitle,
      startAtIso,
      endAtIso,
      quantity
    );
  }

  private assetRequestBookingForSubEvent(
    subEvent: ContractTypes.SubEventDTO,
    quantity: number,
    ownerId: string,
    parentTitle: string
  ): AppDTOs.AssetHireRequestBookingDTO | null {
    const startAtIso = `${subEvent.startAt ?? ''}`.trim();
    const endAtIso = `${subEvent.endAt ?? ''}`.trim();
    return this.assetRequestBookingForRange(subEvent, ownerId, parentTitle, startAtIso, endAtIso, quantity);
  }

  private assetRequestBookingForRange(
    subEvent: ContractTypes.SubEventDTO,
    ownerId: string,
    parentTitle: string,
    startAtIso: string,
    endAtIso: string,
    quantity: number,
    options: {
      totalAmount?: number | null;
      currency?: string | null;
      acceptedPolicyIds?: string[];
      paymentSessionId?: string | null;
      inventoryApplied?: boolean | null;
    } = {}
  ): AppDTOs.AssetHireRequestBookingDTO | null {
    return {
      eventId: ownerId,
      eventTitle: parentTitle,
      subEventId: subEvent.id,
      subEventTitle: subEvent.name,
      slotKey: subEvent.id,
      slotLabel: subEvent.name,
      timeframe: ActivityResourceBuilder.assetRequestTimeframeLabel(startAtIso, endAtIso),
      startAtIso: startAtIso || undefined,
      endAtIso: endAtIso || undefined,
      quantity,
      totalAmount: options.totalAmount ?? null,
      currency: options.currency ?? null,
      acceptedPolicyIds: [...(options.acceptedPolicyIds ?? [])],
      paymentSessionId: options.paymentSessionId ?? null,
      inventoryApplied: options.inventoryApplied === true ? true : null
    };
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
        && preservedRequests.every((request, index) => ActivityResourceBuilder.assetRequestSyncSignature(request) === ActivityResourceBuilder.assetRequestSyncSignature(card.requests[index]));
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
    if (changed) {
      this.ownedAssetsStore.applyAssetCards(nextCards, { mutation: persist });
      if (persist) {
        for (const dirtyCard of dirtyCards) {
          void this.assetsService.saveOwnedAsset(activeUser.id, this.toAssetDetailDto(dirtyCard));
        }
      }
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

  private assetMemberEntries(
    card: ResourceAssetDTO,
    ownerUserId: string | null,
    subEventId?: string
  ): ActivityContracts.ActivityMemberEntry[] {
    const seedBaseDate = new Date('2026-02-24T12:00:00');
    const requests = subEventId
      ? this.assetRequestsForView(card, subEventId, ownerUserId)
      : [...card.requests];
    void this.usersService.warmCachedUsers(requests
      .map(request => AppUtils.resolveAssetRequestUserId(request, this.users))
      .filter(userId => `${userId}`.trim().length > 0));
    return requests
      .map(request => {
        const requestUserId = AppUtils.resolveAssetRequestUserId(request, this.users);
        const matchedUser =
          this.users.find(user => user.id === requestUserId)
          ?? this.users.find(user => user.name === request.name && user.initials === request.initials)
          ?? this.users.find(user => user.name === request.name)
          ?? null;
        const userId = matchedUser?.id ?? requestUserId;
        const note = `${request.note ?? ''}`.toLowerCase();
        const pendingRequiresAdminApproval = request.status === 'pending'
          && !note.includes('owner approval')
          && !note.includes('join request');
        const pendingSource: AppConstants.ActivityPendingSource = request.status === 'pending'
          ? (pendingRequiresAdminApproval ? 'admin' : 'member')
          : null;
        const requestKind: AppConstants.ActivityMemberRequestKind = request.status === 'pending'
          ? (pendingRequiresAdminApproval ? 'invite' : 'join')
          : null;
        const seed = AppUtils.hashText(`asset-members:${card.id}:${request.id}:${userId}`);
        const actionAtIso = AppUtils.toIsoDateTime(AppUtils.addDays(seedBaseDate, -((seed % 90) + 1)));
        return {
          id: request.id,
          userId,
          name: request.name,
          initials: request.initials,
          gender: request.gender,
          city: matchedUser?.city ?? card.city,
          statusText: request.note,
          role: ownerUserId && userId === ownerUserId ? ('Manager' as const) : ('Member' as const),
          status: request.status,
          pendingSource,
          requestKind,
          invitedByActiveUser: userId === this.activeUser().id,
          metAtIso: actionAtIso,
          actionAtIso,
          metWhere: card.title,
          avatarUrl: AppUtils.firstImageUrl(matchedUser?.images),
          profile: matchedUser ?? null
        };
      })
      .sort((left, right) => AppUtils.toSortableDate(right.actionAtIso) - AppUtils.toSortableDate(left.actionAtIso));
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

  private assetRouteValues(card: ResourceAssetDTO | AppDTOs.AssetDTO | null | undefined): string[] | undefined {
    return 'routes' in (card ?? {}) && Array.isArray((card as ResourceAssetDTO).routes)
      ? [...((card as ResourceAssetDTO).routes ?? [])]
      : undefined;
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
      details: ActivityResourceBuilder.assetDetailText(card),
      imageUrl: card.imageUrl,
      sourceLink: ActivityResourceBuilder.assetSourceLink(card),
      routes: ActivityResourceBuilder.normalizeAssetRoutes(card.type, card.routes),
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

  private buildRouteEditorRowIds(routes: string[]): string[] {
    return routes.map(() => this.nextRouteEditorRowId());
  }

  private nextRouteEditorRowId(): string {
    this.routeEditorRowIdSequence += 1;
    return `route-stop-${this.routeEditorRowIdSequence}`;
  }

  private assetPendingCount(
    card: ResourceAssetDTO,
    subEventId?: string,
    managerUserId: string | null = null
  ): number {
    const requests = subEventId
      ? this.assetRequestsForView(card, subEventId, managerUserId)
      : card.requests;
    return requests.filter(request => request.status === 'pending').length;
  }

  private assetAcceptedCount(
    card: ResourceAssetDTO,
    subEventId?: string,
    managerUserId: string | null = null
  ): number {
    const requests = subEventId
      ? this.assetRequestsForView(card, subEventId, managerUserId)
      : card.requests;
    return requests.filter(request => request.status === 'accepted').length;
  }

  private subEventSupplyContributionEntries(subEventId: string, cardId: string): AppDTOs.SubEventSupplyContributionEntryDTO[] {
    return this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[ActivityResourceBuilder.subEventSupplyAssignmentKey(subEventId, cardId)] ?? [];
  }

  private subEventSupplyProvidedCount(cardId: string, subEventId: string): number {
    return this.subEventSupplyContributionEntries(subEventId, cardId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  private subEventDisplayName(subEvent: ContractTypes.SubEventDTO | null | undefined): string {
    return `${subEvent?.name ?? ''}`.trim();
  }

  private subEventStageLabel(subEvent: ContractTypes.SubEventDTO | null | undefined): string {
    const name = this.subEventDisplayName(subEvent);
    return name || 'Sub Event';
  }

  private isAbortError(error: unknown): boolean {
    return !!error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError';
  }

  private openGoogleMapsSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed || typeof window === 'undefined') {
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  private openGoogleMapsDirections(stops: string[]): void {
    const normalized = stops.map(stop => stop.trim()).filter(Boolean);
    if (normalized.length === 0 || typeof window === 'undefined') {
      return;
    }
    if (normalized.length === 1) {
      this.openGoogleMapsSearch(normalized[0]);
      return;
    }
    const origin = normalized[0];
    const destination = normalized[normalized.length - 1];
    const waypoints = normalized.slice(1, -1);
    let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints.length > 0) {
      url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
