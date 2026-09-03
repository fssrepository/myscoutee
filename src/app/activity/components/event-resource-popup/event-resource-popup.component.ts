import {
  CommonModule
} from '@angular/common';
import {
  Component,
  HostListener,
  Input,
  computed,
  effect,
  inject,
  untracked
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  ActivityResourceBuilder
} from '../../../shared/core/base/builders/activity-resource.builder';
import {
  AssetCardBuilder
} from '../../../shared/core/base/builders/asset-card.builder';
import {
  AssetDefaultsBuilder
} from '../../../shared/core/base/builders/asset-defaults.builder';
import {
  PricingBuilder
} from '../../../shared/core/base/builders/pricing.builder';
import {
  ActivityResourcesService
} from '../../../shared/core/base/services/activity-resources.service';
import {
  ChatsService
} from '../../../shared/core/base/services/chats.service';
import {
  AssetsService as SharedAssetsService
} from '../../../shared/core/base/services/assets.service';
import {
  EventsService
} from '../../../shared/core/base/services/events.service';
import {
  ShareTokensService
} from '../../../shared/core/base/services/share-tokens.service';
import {
  UsersService
} from '../../../shared/core/base/services/users.service';
import {
  I18nService
} from '../../../shared/core/base/services/i18n.service';
import type * as ContractTypes from '../../../shared/core/contracts';
import type * as ActivityContracts from '../../../shared/core/contracts/activity.interface';
import type { UserDto } from '../../../shared/core/contracts/user.interface';
import {
  AppUtils
} from '../../../shared/app-utils';
import {
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import type { CardMenuActionEvent, InfoCardData } from '../../../shared/ui/components/core/smart-list/card/card.types';
import {
  PopupComponent,
  type PopupModel
} from '../../../shared/ui/components/core/popup';
import {
  ActivityChatSingleRowConverter,
  ActivitySubEventResourceInfoCardConverter,
  type ActivitySubEventResourceInfoCardConverterOptions
} from '../../../shared/ui/converters';
import {
  type ActivitiesNavigationRequest
} from '../../../shared/ui/context/stores/member-menu.store';
import {
  AssetStore,
  type AssetEditorCheckoutState,
  type AssetEditorRuntimeAssignmentState,
  type AssetEditorRuntimeRouteState
} from '../../../shared/ui/context/stores/asset.store';
import {
  AssetPopupStore
} from '../../../shared/ui/context/stores/asset-popup.store';
import {
  ProfileStore
} from '../../../shared/ui/context/stores/profile.store';
import {
  DialogStore
} from '../../../shared/ui/context/stores/dialog.store';
import {
  ActivitiesPopupStore,
  eventChatHeaderStateFromChat,
  eventChatPopupRequestFromChat
} from '../../../shared/ui/context/stores/activities-popup.store';
import {
  ActivityStore,
  type ActivityMembersSyncState
} from '../../../shared/ui/context/stores/activity.store';
import {
  SubEventResourcePopupStore,
  type SubEventResourceAssignmentQuantityUpdate
} from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import type {
  AssignedAssetJoinDialogState,
  AssignedAssetJoinPricingPreview,
  EventResourcePopupOutletActionRequest,
  ResourceAssetDTO,
  ResourceAssetViewState,
  ResourcePopupContext,
  SubEventResourcePopupPresentationHeader,
  SubEventResourcePopupRequest
} from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import type { ChatDTO } from '../../../shared/core/contracts/chat.interface';
import {
  EventResourceListComponent,
  type EventResourceListModel
} from './resource-list/event-resource-list.component';

import type * as AppDTOs from '../../../shared/core/contracts';
import * as AppConstants from '../../../shared/core/common/constants';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
import { MemberMenuStore } from '../../../shared/ui/context/stores/member-menu.store';

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
    PopupComponent,
    EventResourceListComponent
  ],
  templateUrl: './event-resource-popup.component.html',
  styleUrls: ['./event-resource-popup.component.scss']
})
export class EventResourcePopupComponent {
  protected readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  protected readonly activitiesStore = inject(ActivitiesPopupStore);

  private readonly userProfileStore = inject(UserProfileStore);
  private readonly memberMenuStore = inject(MemberMenuStore);
  private readonly assetPopupStore = inject(AssetPopupStore);
  private readonly assetStore = inject(AssetStore);
  private readonly assetsService = inject(SharedAssetsService);
  private readonly eventsService = inject(EventsService);
  private readonly usersService = inject(UsersService);
  private readonly profileStore = inject(ProfileStore);
  private readonly dialogStore = inject(DialogStore);
  private readonly shareTokensService = inject(ShareTokensService);
  private readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly chatsService = inject(ChatsService);
  private readonly activityStore = inject(ActivityStore);
  private readonly i18n = inject(I18nService);

  @Input() parentZIndex = 2500;

  private get users(): UserDto[] {
    return this.usersService.peekCachedUsers();
  }

  private ownedAssetCards(): ResourceAssetDTO[] {
    return this.assetStore.assetCards();
  }

  private get userById(): Map<string, UserDto> {
    return new Map(this.users.map(user => [user.id, user]));
  }

  private pendingAssignSaveAbortController: AbortController | null = null;
  private pendingAssignSaveRequestVersion = 0;
  private lastResourcePopupOutletActionRequestId = 0;
  private ownedAssetsHydrationLoadedUserId = '';
  private ownedAssetsHydrationLoadingUserId = '';

  protected readonly resourceAssetViewOutletInputs = computed(() => ({
    view: this.resourceAssetView(),
    parentZIndex: this.resourcePopupZIndex()
  }));
  protected readonly membersPopupOutletInputs = computed(() => ({
    parentZIndex: this.resourcePopupZIndex()
  }));

  protected resourcePopupZIndex(): number {
    return this.parentZIndex + 100;
  }

  constructor() {
    effect(() => {
      const deletedAssetEvent = this.assetStore.deletedAssetEvent();
      if (!deletedAssetEvent) {
        return;
      }
      this.handleOwnedAssetDeleted(deletedAssetEvent.cardId);
    });

    effect(() => {
      const request = this.memberMenuStore.activitiesNavigationRequest();
      if (!request || (request.type !== 'chatResource' && request.type !== 'assetExplore')) {
        return;
      }
      this.memberMenuStore.clearActivitiesNavigationRequest();
      if (request.type === 'assetExplore') {
        this.openStandaloneAssetExploreRequest(request);
        return;
      }
      this.openFromChatRequest(request);
    });

    effect(() => {
      const request = this.memberMenuStore.activitiesNavigationRequest();
      if (!request || (request.type !== 'members' && request.type !== 'eventEditorMembers')) {
        return;
      }
      void this.activitiesStore.ensureEventMembersPopupLoaded();
    });

    effect(() => {
      const request = this.resourcePopupStore.subEventResourcePopupRequest();
      if (!request) {
        return;
      }
      this.resourcePopupStore.clearSubEventResourcePopupRequest();
      this.openFromSubEventResourceRequest(request);
    });

    effect(() => {
      if (this.resourceAssetView()) {
        void this.resourcePopupStore.ensureEventResourceAssetViewLoaded();
      }
    });

    effect(() => {
      const request = this.resourcePopupStore.eventResourcePopupOutletActionRequest();
      if (!request || request.requestId <= this.lastResourcePopupOutletActionRequestId) {
        return;
      }
      this.lastResourcePopupOutletActionRequestId = request.requestId;
      untracked(() => this.handleResourcePopupOutletActionRequest(request));
    });
  }

  private handleResourcePopupOutletActionRequest(request: EventResourcePopupOutletActionRequest): void {
    switch (request.kind) {
      case 'assetViewClose':
        this.closeResourceAssetView(request.event);
        return;
      case 'assetViewMembers':
        this.openAssetViewMembers(request.view, request.event);
        return;
      case 'assignedAssetJoinClose':
        this.closeAssignedAssetJoinDialog(request.event);
        return;
      case 'assignedAssetJoinPolicyToggle':
        this.toggleAssignedAssetJoinPolicy(request.policyId);
        return;
      case 'assignedAssetJoinConfirm':
        this.confirmAssignedAssetJoin(request.event);
        return;
    }
  }

  protected resourcePopupModel(): PopupModel {
    const showHeader = !this.resourcePopupStore.resourceAssetViewReturnToChatRef()
      && !this.resourcePopupStore.assetExploreOnlyRef();
    return {
      title: this.popupTitle(),
      subtitle: this.popupSubtitle(),
      secondarySubtitle: this.popupSummary(),
      size: 'wide',
      height: 'full',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      showHeader,
      closeAriaLabel: 'Close resource assignment',
      onClose: () => this.closeResourcePopup()
    };
  }

  protected resourceListModel(): EventResourceListModel {
    const cards = this.resourceCards();
    const context = this.resourcePopupStore.popupContextRef();
    const memberSyncByOwnerId = this.activityStore.activityMembersSyncByOwnerId();
    const converterOptions = this.resourceInfoCardConverterOptions(memberSyncByOwnerId);
    return {
      filter: this.resourcePopupStore.resourceFilterRef(),
      metricIdentity: context ? this.chatMetricIdentity(context) : '',
      filterCounts: this.resourceFilterCounts(),
      canAssign: context?.viewOnly !== true,
      items: cards.map(card => {
        const memberSync = this.assignedAssetMembersSync(card.sourceAssetId ?? '', context);
        const displayCard = memberSync
          ? {
              ...card,
              accepted: memberSync.acceptedMembers,
              pending: card.type === AppConstants.ASSET_TYPE_SUPPLIES
                ? card.pending
                : memberSync.pendingMembers
            }
          : card;
        return {
          card: displayCard,
          infoCard: ActivitySubEventResourceInfoCardConverter.convert(
            displayCard,
            converterOptions
          )
        };
      })
    };
  }

  private chatMetricIdentity(context: ResourcePopupContext): string {
    return this.chatMetricIdentityFromParts(
      context.ownerId,
      context.subEvent.id,
      context.groupId,
      context.subEvent.runtimeKind,
      context.subEvent.eventId
    );
  }

  private chatMetricIdentityFromParts(
    ownerIdValue: string | null | undefined,
    subEventIdValue: string | null | undefined,
    groupIdValue?: string | null,
    runtimeKindValue?: string | null,
    eventIdValue?: string | null
  ): string {
    const scope = ActivityResourceBuilder.runtimeResourceScopeIdentity({
      ownerId: ownerIdValue,
      subEventId: subEventIdValue,
      groupId: groupIdValue,
      runtimeKind: runtimeKindValue,
      eventId: eventIdValue
    });
    if (!scope.chatChannelType || !scope.chatOwnerId) {
      return '';
    }
    return ActivityChatSingleRowConverter.smartListKeyForIdentity(
      scope.chatChannelType,
      scope.chatOwnerId,
      scope.chatOwnerId
    );
  }

  private memberOwnerIdFromParts(
    ownerIdValue: string | null | undefined,
    subEventIdValue: string | null | undefined,
    groupIdValue?: string | null
  ): string {
    const ownerId = `${ownerIdValue ?? ''}`.trim();
    const subEventId = `${subEventIdValue ?? ''}`.trim();
    const groupId = `${groupIdValue ?? ''}`.trim();
    if (ownerId && subEventId && groupId) {
      return this.scopedGroupOwnerId(ownerId, subEventId, groupId);
    }
    if (ownerId && subEventId) {
      return `${ownerId}:${subEventId}`;
    }
    return groupId || subEventId || ownerId;
  }

  private scopedGroupOwnerId(ownerId: string, subEventId: string, groupId: string): string {
    const suffix = `:${subEventId}:${groupId}`;
    return ownerId.endsWith(suffix) ? ownerId : `${ownerId}${suffix}`;
  }

  private parentEventOwnerId(
    ownerIdValue: string | null | undefined,
    subEventIdValue: string | null | undefined,
    groupIdValue?: string | null
  ): string {
    const ownerId = `${ownerIdValue ?? ''}`.trim();
    const subEventId = `${subEventIdValue ?? ''}`.trim();
    const groupId = `${groupIdValue ?? ''}`.trim();
    const suffix = subEventId
      ? groupId ? `:${subEventId}:${groupId}` : `:${subEventId}`
      : '';
    return suffix && ownerId.endsWith(suffix)
      ? ownerId.slice(0, -suffix.length)
      : ownerId;
  }

  private resourceMemberParent(context: ResourcePopupContext): ActivityContracts.ActivityMemberOwnerRef {
    return ActivityResourceBuilder.runtimeResourceScopeIdentity({
      ownerId: context.ownerId,
      subEventId: context.subEvent.id,
      groupId: context.groupId,
      memberOwnerId: context.groupMemberOwnerId,
      memberOwnerType: context.groupMemberOwnerType,
      runtimeKind: context.subEvent.runtimeKind,
      eventId: context.subEvent.eventId
    }).memberOwner ?? {
      ownerId: this.memberOwnerIdFromParts(context.ownerId, context.subEvent.id),
      ownerType: 'subEvent'
    };
  }

  private resourceInfoCardConverterOptions(
    memberSyncByOwnerId = this.activityStore.activityMembersSyncByOwnerId()
  ): ActivitySubEventResourceInfoCardConverterOptions {
    const context = this.resourcePopupStore.popupContextRef();
    const activeUserId = this.activeUser().id.trim();
    const eventRecord = context
      ? this.eventsService.peekKnownRecordById(activeUserId, context.ownerId)
      : null;
    return {
      context,
      activeUserId,
      activeUserAssets: this.ownedAssetCards(),
      assetSettingsByKey: this.resourcePopupStore.assignedAssetSettingsByKey,
      users: this.users,
      eventCreatorUserId: eventRecord?.creatorUserId ?? context?.assetOwnerUserId ?? null,
      memberSyncByOwnerId
    };
  }

  protected openAssetViewMembers(view: ResourceAssetViewState, event: Event): void {
    event.stopPropagation();
    this.openAssetMembersPopup(view.card, event);
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
    if (event.actionId === 'route') {
      this.openResourceAssetView(card, 'edit', new Event('click'));
      return;
    }
    if (event.actionId === 'askOrganizer') {
      void this.openResourceServiceChat(card, new Event('click'));
      return;
    }
    if (event.actionId === 'shareAsset') {
      this.openResourceShareDialog(card);
      return;
    }
    if (event.actionId === 'paymentSummary') {
      void this.openBorrowedAssetPaymentSummary(card, new Event('click'));
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
    if (this.resourcePopupStore.assignedAssetJoinDialogRef()) {
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
    if (!sourceAssetId || !AppConstants.isAssetType(card.type)) {
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
    this.dialogStore.open({
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

  private async openResourceServiceChat(card: AppDTOs.SubEventResourceCardDTO, event: Event): Promise<void> {
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
      card.type === AppConstants.ASSET_TYPE_TRANSPORT || card.type === AppConstants.ASSET_TYPE_ACCOMMODATION
        ? this.assignedAssetManagerUserId(context.subEvent.id, card.type, card.sourceAssetId || '')
        : null
    );
    const target = this.resolveResourceReportTarget(card);
    const targetUserId = target?.userId.trim() || managerUserId || '';
    if (!targetUserId || targetUserId === activeUserId) {
      return;
    }
    const titlePrefix = sourceCard ? 'Asset Service' : 'Event Service';
    const chat = await this.chatsService.ensureServiceChat({
      serviceContext: sourceCard ? 'asset' : 'event',
      eventId: context.ownerId,
      subEventId: context.subEvent.id,
      assetId: sourceCard?.id ?? null,
      targetUserId,
      title: `${titlePrefix} · ${card.title}`,
      lastMessage: sourceCard
        ? `Service chat with the ${card.type.toLowerCase()} manager for ${card.title}.`
        : `Service chat with the organizer for ${context.parentTitle}.`,
      avatarSource: sourceCard?.ownerName || target?.name || sourceCard?.title || card.title
    });
    if (!chat) {
      this.dialogStore.open({
        title: 'Unable to open chat',
        message: 'The service chat could not be created. Please try again.',
        confirmLabel: 'OK'
      });
      return;
    }
    await this.openStackedResourceServiceChat(chat);
  }

  private async openStackedResourceServiceChat(chat: ChatDTO): Promise<void> {
    await this.activitiesStore.ensureEventChatPopupLoaded();
    this.activitiesStore.openStackedEventChat(
      {
        ...eventChatPopupRequestFromChat(chat),
        parentZIndex: this.resourcePopupZIndex()
      },
      eventChatHeaderStateFromChat(chat)
    );
  }

  private reportResourceManager(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const target = this.resolveResourceReportTarget(card);
    if (!context || !target || target.userId === this.activeUser().id.trim()) {
      return;
    }
    this.profileStore.openReportUserPopup({
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
      card.type === AppConstants.ASSET_TYPE_TRANSPORT || card.type === AppConstants.ASSET_TYPE_ACCOMMODATION
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
    return this.userProfileStore.getUserProfile(normalizedUserId)?.name?.trim()
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

  private activeUser(): UserDto {
    const activeUserId = this.userProfileStore.activeUserId().trim();
    return this.userProfileStore.activeUserProfile()
      ?? this.usersService.peekCachedUserById(activeUserId)
      ?? this.users[0]
      ?? this.createFallbackUser(activeUserId);
  }

  private openFromChatRequest(request: Extract<ActivitiesNavigationRequest, { type: 'chatResource' }>): void {
    if (request.resourceType === 'Members') {
      const ownerId = `${request.item.ownerId ?? ''}`.trim()
        || this.memberOwnerIdFromParts(request.ownerId, request.subEvent.id, request.group?.id);
      const ownerType = request.item.channelType === 'groupSubEvent' ? 'group' : 'subEvent';
      const parentOwnerId = this.parentEventOwnerId(ownerId, request.subEvent.id, request.group?.id);
      const bucket = request.item.metrics?.members ?? null;
      this.memberMenuStore.requestActivitiesNavigation({
        type: 'members',
        ownerId,
        ownerType,
        parentOwnerId,
        parentOwnerType: 'event',
        eventId: parentOwnerId,
        subEventId: request.subEvent.id,
        subtitle: `${request.group?.groupLabel ?? request.subEvent.name ?? request.item.title ?? ''}`.trim() || 'Members',
        canManage: request.group?.canManage === true,
        viewOnly: request.group?.id ? request.group.canManage !== true : undefined,
        acceptedMembers: Math.max(0, Math.trunc(Number(bucket?.accepted ?? request.group?.accepted ?? request.subEvent.membersAccepted) || 0)),
        pendingMembers: Math.max(0, Math.trunc(Number(bucket?.pending ?? request.group?.pending ?? request.subEvent.membersPending) || 0)),
        capacityTotal: Math.max(
          0,
          Math.trunc(Number(bucket?.capacityMax ?? request.group?.capacityMax ?? request.subEvent.capacityMax) || 0)
        ),
        metricIdentity: ActivityChatSingleRowConverter.smartListKeyForIdentity(
          request.item.channelType ?? null,
          ownerId,
          request.item.id
        )
      });
      return;
    }

    const context = this.buildPopupContext(
      'chat',
      request.ownerId?.trim() || request.item.ownerId?.trim() || '',
      request.item.title,
      request.resourceType,
      request.subEvent,
      request.group ?? null,
      request.assetCardsByType,
      request.popupHeader ?? null
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
    const type = request.assetType === AppConstants.ASSET_TYPE_ACCOMMODATION || request.assetType === AppConstants.ASSET_TYPE_SUPPLIES
      ? request.assetType
      : AppConstants.ASSET_TYPE_TRANSPORT;
    const requestedAssetId = `${request.assetId ?? ''}`.trim();
    const initialCard = request.fallbackAsset
      ?? this.ownedAssetCards().find(card => card.id === requestedAssetId)
      ?? null;
    if (request.viewOnly && requestedAssetId && initialCard) {
      this.resourcePopupStore.closeResourcePopup();
      this.resourcePopupStore.assetExploreOnlyRef.set(true);
      void this.openReadonlyStandaloneAssetEditor(initialCard, requestedAssetId);
      return;
    }
    const now = new Date();
    const end = new Date(now);
    end.setHours(end.getHours() + 2);
    const startAtIso = `${request.startAtIso ?? ''}`.trim() || AppUtils.toIsoDateTimeLocal(now);
    const endAtIso = `${request.endAtIso ?? ''}`.trim() || AppUtils.toIsoDateTimeLocal(end);
    const subEvent: ContractTypes.SubEventDTO = {
      id: `asset-explore-${this.activeUser().id || 'user'}`,
      name: 'Asset Explore',
      description: '',
      startAt: startAtIso,
      endAt: endAtIso,
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
      popupHeader: { title: 'Assets', subtitle: null },
      subEvent,
      fallbackCardsByType: request.fallbackAsset ? { [type]: [this.cloneAsset(request.fallbackAsset)] } : {}
    }, type, { hydrate: !request.viewOnly });
    this.resourcePopupStore.assetExploreOnlyRef.set(true);
    this.openInitialExplorePopup();
  }

  private async openReadonlyStandaloneAssetEditor(
    card: ResourceAssetDTO,
    assetId: string
  ): Promise<void> {
    const normalizedAssetId = assetId.trim() || card.id;
    const viewerUserId = `${this.activeUser().id ?? ''}`.trim();
    const generation = this.assetStore.openAssetEditorEdit({
      cardId: normalizedAssetId,
      form: AssetCardBuilder.buildAssetFormFromCard(card),
      visibility: AssetCardBuilder.visibilityFromCard(card),
      loading: Boolean(viewerUserId),
      readOnly: true,
      parentZIndex: this.parentZIndex
    });
    void this.assetPopupStore.ensureAssetPopupLoaded();
    if (!viewerUserId) {
      this.assetStore.setAssetEditorLoading(false);
      return;
    }
    try {
      const loadedCard = await this.assetsService.loadOwnedAssetDetailById(viewerUserId, normalizedAssetId);
      if (!this.assetStore.isCurrentAssetEditorLoad(generation, normalizedAssetId)) {
        return;
      }
      if (loadedCard) {
        this.assetStore.applyAssetEditorForm(
          loadedCard.id,
          AssetCardBuilder.visibilityFromCard(loadedCard),
          AssetCardBuilder.buildAssetFormFromCard(loadedCard)
        );
      }
      this.assetStore.setAssetEditorLoading(false);
    } catch {
      if (this.assetStore.isCurrentAssetEditorLoad(generation, normalizedAssetId)) {
        this.assetStore.setAssetEditorLoading(false);
      }
    }
  }

  private openFromSubEventResourceRequest(request: SubEventResourcePopupRequest): void {
    if (request.type === 'Members') {
      const group = request.group ?? null;
      const scope = ActivityResourceBuilder.runtimeResourceScopeIdentity({
        ownerId: request.ownerId,
        subEventId: request.subEventId,
        groupId: group?.id,
        memberOwnerId: group?.memberOwnerId,
        memberOwnerType: group?.memberOwnerType,
        runtimeKind: request.runtimeKind,
        eventId: request.eventId
      });
      const owner = scope.memberOwner;
      const parentOwnerId = scope.eventId
        || this.parentEventOwnerId(request.ownerId, request.subEventId, group?.id);
      if (!owner) {
        return;
      }
      const groupLabel = group?.groupLabel?.trim() ?? '';
      const subEventTitle = this.requestSubEventTitle(request);
      this.memberMenuStore.requestActivitiesNavigation({
        type: 'members',
        ownerId: owner.ownerId,
        ownerType: owner.ownerType,
        parentOwnerId,
        parentOwnerType: 'event',
        eventId: parentOwnerId,
        subEventId: scope.isMainEvent ? '' : `${request.subEventId ?? ''}`.trim(),
        subtitle: groupLabel || subEventTitle || request.parentTitle?.trim() || 'Event',
        canManage: group?.canManage === true,
        viewOnly: group?.id ? group.canManage !== true : undefined,
        acceptedMembers: Math.max(0, Math.trunc(Number(group?.accepted) || 0)),
        pendingMembers: Math.max(0, Math.trunc(Number(group?.pending) || 0)),
        capacityTotal: Math.max(0, Math.trunc(Number(group?.capacityMax) || 0)),
        metricIdentity: this.chatMetricIdentityFromParts(
          request.ownerId,
          request.subEventId,
          group?.id,
          request.runtimeKind,
          request.eventId
        ),
        onMembersChanged: group?.onMembersChanged
      });
      return;
    }

    const subEvent = this.subEventFromResourceRequest(request);
    if (!subEvent) {
      return;
    }
    const context = this.buildPopupContext(
      'subEventResource',
      request.ownerId.trim(),
      request.parentTitle?.trim() || 'Event',
      request.type,
      subEvent,
      request.group ?? null,
      undefined,
      request.popupHeader ?? null,
      request.assetOwnerUserId,
      request.viewOnly
    );
    this.openPopupContext(context, request.type);
  }

  private subEventFromResourceRequest(
    request: SubEventResourcePopupRequest
  ): ContractTypes.SubEventDTO | null {
    const subEventId = `${request.subEventId ?? ''}`.trim();
    if (!subEventId) {
      return null;
    }
    const header = request.subEventHeader ?? null;
    const name = this.requestSubEventTitle(request) || 'Sub Event';
    return ActivityResourceBuilder.runtimeResourceTarget({
      ownerId: request.ownerId,
      subEventId,
      runtimeKind: request.runtimeKind,
      eventId: request.eventId,
      name,
      description: `${header?.description ?? ''}`.trim(),
      location: `${header?.location ?? ''}`.trim(),
      startAt: `${header?.startAt ?? ''}`.trim(),
      endAt: `${header?.endAt ?? ''}`.trim()
    });
  }

  private requestSubEventTitle(request: SubEventResourcePopupRequest): string {
    const header = request.subEventHeader ?? null;
    return `${header?.title ?? header?.name ?? ''}`.trim();
  }

  private buildPopupContext(
    origin: ResourcePopupContext['origin'],
    ownerId: string,
    parentTitle: string,
    type: AppConstants.AssetType,
    rawSubEvent: ContractTypes.SubEventDTO,
    group: SubEventResourcePopupRequest['group'],
    fallbackCardsByType?: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>>,
    popupHeader?: SubEventResourcePopupPresentationHeader | null,
    assetOwnerUserId?: string | null,
    viewOnly = false
  ): ResourcePopupContext {
    const subEvent = this.cloneSubEvent(rawSubEvent);
    const scopedSubEvent = group?.id
      ? this.applyGroupScopedAssetSnapshot(subEvent, type, group)
      : subEvent;

    return {
      origin,
      ownerId: ownerId.trim(),
      assetOwnerUserId: `${assetOwnerUserId ?? ''}`.trim() || undefined,
      viewOnly,
      parentTitle: parentTitle.trim() || 'Event',
      popupHeader: this.normalizePopupHeader(popupHeader, parentTitle),
      subEvent: scopedSubEvent,
      groupId: group?.id?.trim() || undefined,
      groupName: group?.groupLabel?.trim() || undefined,
      groupMemberOwnerId: `${group?.memberOwnerId ?? ''}`.trim() || undefined,
      groupMemberOwnerType: group?.memberOwnerType ?? undefined,
      fallbackCardsByType: this.cloneFallbackCards(fallbackCardsByType)
    };
  }

  private normalizePopupHeader(
    popupHeader: SubEventResourcePopupPresentationHeader | null | undefined,
    fallbackTitle: string
  ): SubEventResourcePopupPresentationHeader {
    const title = `${popupHeader?.title ?? ''}`.trim() || fallbackTitle.trim() || 'Event';
    const subtitle = `${popupHeader?.subtitle ?? ''}`.trim();
    return {
      title,
      subtitle: subtitle || null
    };
  }

  private openPopupContext(
    context: ResourcePopupContext,
    type: AppConstants.AssetType,
    options: { hydrate?: boolean } = {}
  ): void {
    this.hydrateOwnedAssetsForResourcePopup();
    this.resourcePopupStore.openResourcePopup(context, type);
    this.closeAssignPopup(false);
    if (context.groupId) {
      void this.activityResourcesService.markResourceTypeRead(
        context.ownerId,
        context.subEvent.id,
        type,
        this.activeUser().id
      );
    }
    if (options.hydrate !== false) {
      this.hydratePopupResourceState(context);
    }
  }

  private openInitialExplorePopup(): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const type = this.resourcePopupStore.resourceFilterRef();
    const { startAtIso, endAtIso } = ActivityResourceBuilder.defaultAssetExploreRange(context.subEvent);
    this.closeAssignedAssetJoinDialog();
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
    const assetOwnerUserId = `${context.assetOwnerUserId ?? this.activeUser().id}`.trim();
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return;
    }
    const applyScope = (scope: AppDTOs.ActivitySubEventResourceScopeDTO | null): void => {
      const activeContext = this.resourcePopupStore.popupContextRef();
      const activeAssetOwnerUserId = `${activeContext?.assetOwnerUserId ?? this.activeUser().id}`.trim();
      if (
        !scope
        || !activeContext
        || activeContext.ownerId !== ownerId
        || activeContext.subEvent.id !== subEventId
        || activeAssetOwnerUserId !== assetOwnerUserId
        || scope.viewerState.assetOwnerUserId !== assetOwnerUserId
      ) {
        return;
      }
      this.resourcePopupStore.setVisibleResourceStates(scope.visibleStates);
      this.applyPersistedPopupState(scope.viewerState);
      this.hydrateOwnedAssetsForResourcePopup();
    };
    applyScope(this.activityResourcesService.peekSubEventResourceScope(
      ownerId,
      subEventId,
      assetOwnerUserId
    ));
    void this.activityResourcesService
      .querySubEventResourceScope(ownerId, subEventId, assetOwnerUserId)
      .then(scope => applyScope(scope));
  }

  private hydrateOwnedAssetsForResourcePopup(): void {
    const activeUserId = this.activeUser().id.trim();
    if (!activeUserId) {
      return;
    }
    const peekedCards = this.assetsService.peekOwnedAssetsByUser(activeUserId);
    const ownerChanged = this.assetStore.activeOwnerUserIdRef().trim() !== activeUserId;
    if (ownerChanged) {
      this.assetStore.setActiveOwnerUserId(activeUserId);
    }
    if (ownerChanged || (this.assetStore.assetCards().length === 0 && peekedCards.length > 0)) {
      this.assetStore.applyAssetCards(peekedCards, { reloadList: false });
    }
    if (
      this.ownedAssetsHydrationLoadedUserId === activeUserId
      || this.ownedAssetsHydrationLoadingUserId === activeUserId
    ) {
      return;
    }
    this.ownedAssetsHydrationLoadingUserId = activeUserId;
    void this.assetsService.queryOwnedAssetsByUser(activeUserId)
      .then(cards => {
        if (this.activeUser().id.trim() !== activeUserId) {
          return;
        }
        this.assetStore.setActiveOwnerUserId(activeUserId);
        this.assetStore.applyAssetCards(cards, { reloadList: false });
        this.ownedAssetsHydrationLoadedUserId = activeUserId;
      })
      .finally(() => {
        if (this.ownedAssetsHydrationLoadingUserId === activeUserId) {
          this.ownedAssetsHydrationLoadingUserId = '';
        }
      });
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
    this.assetStore.closeAssetPopup();
    this.assetPopupStore.resetTicketState();
    this.assetPopupStore.primaryVisibleRef.set(false);
  }

  private applyPersistedPopupState(state: AppDTOs.ActivitySubEventResourceStateDTO): void {
    const normalizedState = ActivityResourceBuilder.normalizeState(state, state);
    if (!normalizedState) {
      return;
    }
    this.resourcePopupStore.upsertVisibleResourceState(normalizedState);
    const activeContext = this.resourcePopupStore.popupContextRef();
    const nextContext = (
      activeContext
      && activeContext.ownerId === normalizedState.ownerId
      && activeContext.subEvent.id === normalizedState.subEventId
    )
      ? {
        ...activeContext,
        fallbackCardsByType: this.mergePersistedFallbackCards(
          activeContext.fallbackCardsByType,
          normalizedState.fallbackAssetCardsByType,
          normalizedState.subEventId
        )
      }
      : null;
    for (const type of AppConstants.ASSET_TYPES) {
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
    if (nextContext) {
      // Publish the reactive context only after the assignment maps are complete so
      // the resulting render observes the fetched IDs and fallback cards together.
      this.resourcePopupStore.popupContextRef.set(nextContext);
    }
  }

  private persistPopupResourceState(context: ResourcePopupContext | null = this.resourcePopupStore.popupContextRef()): void {
    if (context?.viewOnly) {
      return;
    }
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
    const assetOwnerUserId = `${context.assetOwnerUserId ?? this.activeUser().id}`.trim();
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return null;
    }
    return {
      ownerId,
      subEventId,
      assetOwnerUserId,
      assetAssignmentIds: {
        [AppConstants.ASSET_TYPE_TRANSPORT]: [...this.resolveSubEventAssignedAssetIds(subEventId, AppConstants.ASSET_TYPE_TRANSPORT)],
        [AppConstants.ASSET_TYPE_ACCOMMODATION]: [...this.resolveSubEventAssignedAssetIds(subEventId, AppConstants.ASSET_TYPE_ACCOMMODATION)],
        [AppConstants.ASSET_TYPE_SUPPLIES]: [...this.resolveSubEventAssignedAssetIds(subEventId, AppConstants.ASSET_TYPE_SUPPLIES)]
      },
      assetSettingsByType: {
        [AppConstants.ASSET_TYPE_TRANSPORT]: { ...this.getSubEventAssignedAssetSettings(subEventId, AppConstants.ASSET_TYPE_TRANSPORT) },
        [AppConstants.ASSET_TYPE_ACCOMMODATION]: { ...this.getSubEventAssignedAssetSettings(subEventId, AppConstants.ASSET_TYPE_ACCOMMODATION) },
        [AppConstants.ASSET_TYPE_SUPPLIES]: { ...this.getSubEventAssignedAssetSettings(subEventId, AppConstants.ASSET_TYPE_SUPPLIES) }
      },
      supplyContributionEntriesByAssetId: Object.fromEntries(
        this.resolveSubEventAssignedAssetIds(subEventId, AppConstants.ASSET_TYPE_SUPPLIES).map(assetId => [
          assetId,
          this.subEventSupplyContributionEntries(subEventId, assetId).map(entry => ({ ...entry }))
        ])
      ),
      fallbackAssetCardsByType: {
        [AppConstants.ASSET_TYPE_TRANSPORT]: this.persistedAssignedFallbackCards(context, AppConstants.ASSET_TYPE_TRANSPORT),
        [AppConstants.ASSET_TYPE_ACCOMMODATION]: this.persistedAssignedFallbackCards(context, AppConstants.ASSET_TYPE_ACCOMMODATION),
        [AppConstants.ASSET_TYPE_SUPPLIES]: this.persistedAssignedFallbackCards(context, AppConstants.ASSET_TYPE_SUPPLIES)
      }
    };
  }

  closeResourcePopup(): void {
    this.resourcePopupStore.closeResourcePopup();
    this.abortPendingAssignSaveRequest();
    this.resourcePopupStore.pendingAssignSaveRef.set(null);
    this.resourcePopupStore.assignContextRef.set(null);
    this.resourcePopupStore.selectedAssignAssetIdsRef.set([]);
    this.assetPopupStore.basketVisibleRef.set(false);
    this.assetStore.closeAssetPopup();
    this.assetPopupStore.resetTicketState();
    this.assetPopupStore.primaryVisibleRef.set(false);
  }

  popupTitle(): string {
    const context = this.resourcePopupStore.popupContextRef();
    const typeLabel = APP_STATIC_DATA.assetTypeLabels[this.resourcePopupStore.resourceFilterRef()];
    return `${context?.popupHeader?.title ?? ''}`.trim() || typeLabel;
  }

  popupSubtitle(): string {
    const context = this.resourcePopupStore.popupContextRef();
    return `${context?.popupHeader?.subtitle ?? ''}`.trim();
  }

  popupSummary(): string | null {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return null;
    }
    const metrics = this.subEventAssetCapacityMetrics(context.subEvent, this.resourcePopupStore.resourceFilterRef(), {
      normalizeStore: false
    });
    if (metrics.joined <= 0 && metrics.pending <= 0) {
      return null;
    }
    if (metrics.pending <= 0) {
      return `${metrics.joined} members`;
    }
    return `${metrics.joined} members · ${metrics.pending} pending`;
  }

  openResourceBadgeDetails(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void {
    event?.stopPropagation();
    if (card.type === AppConstants.ASSET_TYPE_TRANSPORT || card.type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      void this.openAssetMembersPopup(card);
      return;
    }
    if (card.type === AppConstants.ASSET_TYPE_SUPPLIES) {
      this.openSupplyContributionsPopup(card, event);
    }
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
        source
      };
    }
    return null;
  }

  openResourceAssetView(
    card: AppDTOs.SubEventResourceCardDTO,
    _mode: 'view' | 'edit',
    event?: Event
  ): void {
    event?.stopPropagation();
    void this.openReadonlyResourceAssetEditor(card);
  }

  private async openReadonlyResourceAssetEditor(card: AppDTOs.SubEventResourceCardDTO): Promise<void> {
    const context = this.resourcePopupStore.popupContextRef();
    const assetId = `${card.sourceAssetId ?? ''}`.trim();
    if (!context || !assetId || !this.isAssignableAssetType(card.type)) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, assetId);
    if (!sourceCard) {
      return;
    }
    this.resourcePopupStore.resourceAssetViewIdRef.set(null);
    this.resourcePopupStore.resourceAssetViewModeRef.set('view');
    this.resourcePopupStore.assetExplorePopupRef.set(null);
    const ownerUserId = `${sourceCard.ownerUserId ?? ''}`.trim();
    const generation = this.assetStore.openAssetEditorEdit({
      cardId: sourceCard.id,
      form: AssetCardBuilder.buildAssetFormFromCard(sourceCard),
      visibility: AssetCardBuilder.visibilityFromCard(sourceCard),
      loading: Boolean(ownerUserId),
      readOnly: true,
      parentZIndex: this.resourcePopupZIndex(),
      runtimeRoute: this.assignedAssetRuntimeRouteState(context.subEvent.id, card, sourceCard),
      runtimeAssignment: this.assignedAssetRuntimeAssignmentState(context.subEvent.id, card, sourceCard)
    });
    void this.assetPopupStore.ensureAssetPopupLoaded();
    if (!ownerUserId) {
      this.assetStore.setAssetEditorLoading(false);
      return;
    }
    try {
      const loadedCard = await this.assetsService.loadOwnedAssetDetailById(ownerUserId, sourceCard.id);
      if (!this.assetStore.isCurrentAssetEditorLoad(generation, sourceCard.id)) {
        return;
      }
      if (loadedCard) {
        this.assetStore.applyAssetEditorForm(
          loadedCard.id,
          AssetCardBuilder.visibilityFromCard(loadedCard),
          AssetCardBuilder.buildAssetFormFromCard(loadedCard)
        );
      }
      this.assetStore.setAssetEditorLoading(false);
    } catch {
      if (this.assetStore.isCurrentAssetEditorLoad(generation, sourceCard.id)) {
        this.assetStore.setAssetEditorLoading(false);
      }
    }
  }

  private async openBorrowedAssetPaymentSummary(
    card: AppDTOs.SubEventResourceCardDTO,
    event?: Event
  ): Promise<void> {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    const assetId = `${card.sourceAssetId ?? ''}`.trim();
    if (!context || !assetId || !this.isAssignableAssetType(card.type)) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, assetId);
    const request = sourceCard
      ? this.findBorrowedAssetRequest(sourceCard, context.subEvent.id)
      : null;
    if (!sourceCard || !request) {
      return;
    }
    const defaultRange = ActivityResourceBuilder.defaultAssetExploreRange(context.subEvent);
    const startAtIso = `${request.booking?.startAtIso ?? defaultRange.startAtIso}`.trim() || defaultRange.startAtIso;
    const endAtIso = `${request.booking?.endAtIso ?? defaultRange.endAtIso}`.trim() || defaultRange.endAtIso;
    const quantity = Math.max(1, Math.trunc(Number(request.booking?.quantity) || 1));
    const paymentSessionId = `${request.booking?.paymentSessionId ?? ''}`.trim();
    const paymentAudit = paymentSessionId
      ? await this.eventsService.loadCheckoutPaymentAudit(
          this.activeUser().id,
          sourceCard.id,
          paymentSessionId
        )
      : null;
    const calculatedPricing = PricingBuilder.resolveAssetBorrowPricing({
      pricing: sourceCard.pricing,
      totalQuantity: this.assignedBorrowTotalQuantity(sourceCard, request),
      requestedQuantity: quantity,
      startAtIso,
      endAtIso,
      requests: sourceCard.requests
    });
    const amount = paymentAudit
      ? Math.max(0, Number(paymentAudit.amount) || 0)
      : Number.isFinite(request.booking?.totalAmount)
      ? Math.max(0, Number(request.booking?.totalAmount))
      : calculatedPricing.amount;
    const currency = `${paymentAudit?.currency ?? request.booking?.currency ?? calculatedPricing.currency ?? 'USD'}`.trim() || 'USD';
    const timeframe = ActivityResourceBuilder.assetRequestTimeframeLabel(startAtIso, endAtIso);
    const auditRows = paymentAudit
      ? (paymentAudit.pricingSummaryRows.length > 0
          ? paymentAudit.pricingSummaryRows.map(row => ({ ...row }))
          : paymentAudit.lineItems.map((lineItem, index) => ({
              key: `base-payment-audit-${lineItem.id || index}`,
              label: lineItem.label,
              detail: lineItem.detail || timeframe,
              amount: Math.max(0, Number(lineItem.amount) || 0),
              currency: lineItem.currency?.trim() || currency,
              multiplier: null
            })))
      : [];
    const useCalculatedRows = !paymentAudit && (
      !Number.isFinite(request.booking?.totalAmount)
      || amount === calculatedPricing.amount
    );
    const checkout: AssetEditorCheckoutState = {
      sourceId: sourceCard.id,
      mode: 'payment-summary',
      phase: 'payment',
      title: this.i18n.translate('event.checkout.payment.summary'),
      subtitle: sourceCard.title,
      dateRange: {
        startAt: startAtIso,
        endAt: endAtIso,
        precision: 'minute'
      },
      dateRangeModel: {
        mode: 'range',
        precision: 'minute',
        valueFormat: 'iso-date-time',
        range: {
          start: { label: this.i18n.translate('asset.borrow.start') },
          end: { label: this.i18n.translate('asset.borrow.end') }
        }
      },
      availableQuantity: quantity,
      pricingPreview: {
        rows: paymentAudit
          ? (auditRows.length > 0
              ? auditRows
              : [{
                  key: 'base-payment-audit',
                  label: sourceCard.title,
                  detail: timeframe,
                  amount,
                  currency
                }])
          : useCalculatedRows
            ? calculatedPricing.rows.map(row => ({ ...row }))
            : [{
              key: 'base-borrow',
              label: 'pricing.base',
              detail: timeframe,
              amount,
              currency
            }],
        totalAmount: amount,
        currency
      },
      acceptedPolicyIds: [...(request.booking?.acceptedPolicyIds ?? [])],
      footerItems: [],
      busy: false,
      error: null,
      paymentProviderLabel: paymentAudit ? 'event.editor.payment.recorded' : null,
      paymentStatusLabel: paymentAudit
        ? (paymentAudit.auditKind === 'booking_price_revision'
            ? 'event.editor.payment.recorded.revised'
            : paymentAudit.status === 'approved' || paymentAudit.bookingStatus === 'joined'
            ? 'event.editor.payment.recorded.approved'
            : paymentAudit.status)
        : null,
      paymentNote: paymentAudit
        ? (paymentAudit.auditKind === 'booking_price_revision'
            ? 'event.editor.payment.recorded.revision.note'
            : 'event.editor.payment.recorded.note')
        : null
    };
    const ownerUserId = `${sourceCard.ownerUserId ?? ''}`.trim();
    const generation = this.assetStore.openAssetEditorEdit({
      cardId: sourceCard.id,
      form: AssetCardBuilder.buildAssetFormFromCard(sourceCard),
      visibility: AssetCardBuilder.visibilityFromCard(sourceCard),
      loading: Boolean(ownerUserId),
      readOnly: true,
      parentZIndex: this.resourcePopupZIndex(),
      runtimeAssignment: {
        quantity,
        quantityMax: quantity,
        quantityLabel: this.i18n.translate('quantity'),
        quantityDescription: timeframe,
        editable: false
      },
      checkout
    });
    void this.assetPopupStore.ensureAssetPopupLoaded();
    if (!ownerUserId) {
      this.assetStore.setAssetEditorLoading(false);
      return;
    }
    try {
      const loadedCard = await this.assetsService.loadOwnedAssetDetailById(ownerUserId, sourceCard.id);
      if (!this.assetStore.isCurrentAssetEditorLoad(generation, sourceCard.id)) {
        return;
      }
      if (loadedCard) {
        this.assetStore.applyAssetEditorForm(
          loadedCard.id,
          AssetCardBuilder.visibilityFromCard(loadedCard),
          AssetCardBuilder.buildAssetFormFromCard(loadedCard)
        );
      }
      this.assetStore.setAssetEditorLoading(false);
    } catch {
      if (this.assetStore.isCurrentAssetEditorLoad(generation, sourceCard.id)) {
        this.assetStore.setAssetEditorLoading(false);
      }
    }
  }

  private assignedAssetRuntimeRouteState(
    subEventId: string,
    card: AppDTOs.SubEventResourceCardDTO,
    sourceCard: ResourceAssetDTO
  ): AssetEditorRuntimeRouteState | null {
    const assetId = `${card.sourceAssetId ?? sourceCard.id ?? ''}`.trim();
    if (card.type !== AppConstants.ASSET_TYPE_TRANSPORT || sourceCard.type !== AppConstants.ASSET_TYPE_TRANSPORT || !assetId) {
      return null;
    }
    const routeSettings = this.visibleAssignedAssetSettings(
      subEventId,
      AppConstants.ASSET_TYPE_TRANSPORT,
      assetId,
      card.assetOwnerUserId
    ) ?? null;
    const routes = this.resolveViewableCarRoutes(
      routeSettings?.routes,
      card.routes,
      this.assetRouteValues(sourceCard)
    ).map(stop => stop.trim()).filter(Boolean);
    return {
      routeEnabled: routeSettings?.routeEnabled ?? routes.length > 0,
      routes,
      editable: this.canEditAssignedAssetRuntimeRoute(subEventId, sourceCard, assetId),
      title: this.i18n.translate('route'),
      subtitle: this.i18n.translate('asset.assignment.route.subtitle'),
      openLabel: this.i18n.translate('asset.assignment.route.open'),
      emptyLabel: this.i18n.translate('asset.assignment.route.empty'),
      readOnlyEmptyLabel: this.i18n.translate('asset.assignment.route.empty'),
      popupTitle: this.i18n.translateParams('asset.assignment.route.popup.title', { asset: card.title }),
      popupSubtitle: this.i18n.translate('asset.assignment.route.popup.subtitle'),
      parentZIndex: this.resourcePopupZIndex()
    };
  }

  private assignedAssetRuntimeAssignmentState(
    subEventId: string,
    card: AppDTOs.SubEventResourceCardDTO,
    sourceCard: ResourceAssetDTO
  ): AssetEditorRuntimeAssignmentState | null {
    const assetId = `${card.sourceAssetId ?? sourceCard.id ?? ''}`.trim();
    if (!assetId || !this.isAssignableAssetType(card.type) || sourceCard.type !== card.type) {
      return null;
    }
    const type = card.type;
    const assignment = this.visibleAssignedAssetSettings(
      subEventId,
      type,
      assetId,
      card.assetOwnerUserId
    );
    const bounds = this.assignedRuntimeQuantityBounds(sourceCard, subEventId, assignment);
    const quantity = this.normalizeAssignedRuntimeQuantity(
      assignment?.quantity,
      bounds.quantityMax,
      bounds.reservedQuantity
    );
    return {
      quantity,
      quantityMax: bounds.quantityMax,
      quantityLabel: this.i18n.translate('asset.assignment.quantity'),
      quantityDescription: this.assignedRuntimeQuantityDescription(
        bounds.quantityMax,
        quantity,
        sourceCard,
        bounds.reservation
      ),
      editable: this.canEditAssignedAssetRuntimeAssignment(subEventId, sourceCard, assetId),
      onChange: nextQuantity => {
        this.assetStore.setAssetEditorRuntimeAssignmentState({
          quantityDescription: this.assignedRuntimeQuantityDescription(
            bounds.quantityMax,
            nextQuantity,
            sourceCard,
            bounds.reservation
          )
        });
      },
      onSave: state => this.saveAssignedAssetRuntimeAssignment(subEventId, type, assetId, state)
    };
  }

  private canEditAssignedAssetRuntimeRoute(
    subEventId: string,
    sourceCard: ResourceAssetDTO,
    assetId: string
  ): boolean {
    return this.canEditAssignedAssetRuntimeAssignment(subEventId, sourceCard, assetId);
  }

  private canEditAssignedAssetRuntimeAssignment(
    subEventId: string,
    sourceCard: ResourceAssetDTO,
    assetId: string
  ): boolean {
    const activeUserId = this.activeUser().id.trim();
    if (!activeUserId) {
      return false;
    }
    if (this.isAssetOwnedByActiveUser(sourceCard, activeUserId)) {
      return true;
    }
    const managerUserId = this.assignedAssetManagerUserId(subEventId, sourceCard.type, assetId);
    if (managerUserId === activeUserId) {
      return true;
    }
    const request = this.findAssignedAssetJoinRequest(sourceCard, subEventId, activeUserId);
    return request !== null;
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
    if (!context || !card.sourceAssetId || !AppConstants.isAssetType(card.type)) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return;
    }
    const assetType: AppConstants.AssetType = card.type;
    const assignmentSettings = this.visibleAssignedAssetSettings(
      context.subEvent.id,
      assetType,
      card.sourceAssetId,
      card.assetOwnerUserId
    );
    const managerUserId = assignmentSettings?.addedByUserId?.trim() || null;
    const fallbackMembers = this.assetMemberEntries(sourceCard, managerUserId, context.subEvent.id, context.ownerId);
    const acceptedMembers = fallbackMembers.filter(member => member.status === 'accepted').length;
    const pendingMembers = fallbackMembers.filter(member => member.status === 'pending').length;
    const capacityTotal = this.assignedAssetOccupancyCapacityTotal(sourceCard, assignmentSettings);
    const subtitle = `${sourceCard.title} · ${this.subEventDisplayName(context.subEvent) || 'Sub Event'}`;
    const parentOwner = this.resourceMemberParent(context);
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'members',
      ownerId: sourceCard.id,
      ownerType: 'asset',
      parentOwnerId: parentOwner.ownerId,
      parentOwnerType: parentOwner.ownerType,
      eventId: context.ownerId,
      subEventId: context.subEvent.id,
      resourceType: assetType,
      subtitle,
      canManage: this.canManageAssignedAssetMembers(sourceCard, context.subEvent.id),
      acceptedMembers,
      pendingMembers,
      capacityTotal,
      members: fallbackMembers
    });
  }

  openSupplyContributionsPopup(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || card.type !== AppConstants.ASSET_TYPE_SUPPLIES || !card.sourceAssetId) {
      return;
    }
    this.resourcePopupStore.supplyPopupRef.set({
      subEventId: context.subEvent.id,
      assetId: card.sourceAssetId,
      assetOwnerUserId: `${card.assetOwnerUserId ?? this.activeUser().id}`.trim(),
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
    this.closeAssignedAssetJoinDialog();
    this.resourcePopupStore.assetExploreBorrowDialogRef.set(null);
    this.resourcePopupStore.assetExplorePopupRef.set(null);
  }

  resourceCards(): AppDTOs.SubEventResourceCardDTO[] {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return [];
    }
    const type = this.resourcePopupStore.resourceFilterRef();
    const visibleStates = this.visibleResourceStates(context);
    const states = visibleStates.length > 0
      ? visibleStates
      : [this.currentViewerResourceState(context)];
    const cardsByAssignment = new Map<string, AppDTOs.SubEventResourceCardDTO>();
    for (const state of states) {
      const fallbackCardById = new Map(
        (state.fallbackAssetCardsByType?.[type] ?? []).map(card => [card.id, card] as const)
      );
      for (const assetId of state.assetAssignmentIds[type] ?? []) {
        const card = this.ownedAssetCards().find(item => item.id === assetId && item.type === type)
          ?? fallbackCardById.get(assetId)
          ?? null;
        if (!card) {
          continue;
        }
        const assignmentSettings = state.assetSettingsByType[type]?.[card.id];
        const managerUserId = AppConstants.isAssetType(type)
          ? (`${assignmentSettings?.addedByUserId ?? ''}`.trim() || null)
          : null;
        cardsByAssignment.set(`${state.assetOwnerUserId}:${card.id}`, {
          id: `subevent-${state.assetOwnerUserId}-${card.id}`,
          type: card.type,
          sourceAssetId: card.id,
          assetOwnerUserId: state.assetOwnerUserId,
          title: card.title,
          subtitle: card.subtitle,
          city: card.city,
          details: ActivityResourceBuilder.assetDetailText(card),
          imageUrl: card.imageUrl,
          sourceLink: ActivityResourceBuilder.assetSourceLink(card),
          routes: this.assignedResourceCardRoutes(card, assignmentSettings),
          capacityTotal: this.assignedAssetOccupancyCapacityTotal(card, assignmentSettings),
          accepted: card.type === AppConstants.ASSET_TYPE_SUPPLIES
            ? (state.supplyContributionEntriesByAssetId[card.id] ?? [])
                .reduce((sum, entry) => sum + Math.max(0, Math.trunc(Number(entry.quantity) || 0)), 0)
            : this.assetAcceptedCount(card, context.subEvent.id, managerUserId),
          pending: this.assetPendingCount(card, context.subEvent.id, managerUserId),
          isMembers: false
        });
      }
    }
    return [...cardsByAssignment.values()];
  }

  private visibleResourceStates(context: ResourcePopupContext): AppDTOs.ActivitySubEventResourceStateDTO[] {
    return this.resourcePopupStore.visibleResourceStates().filter(state => (
      state.ownerId === context.ownerId
      && state.subEventId === context.subEvent.id
    ));
  }

  private currentViewerResourceState(context: ResourcePopupContext): AppDTOs.ActivitySubEventResourceStateDTO {
    const subEventId = context.subEvent.id;
    return {
      ownerId: context.ownerId,
      subEventId,
      assetOwnerUserId: `${context.assetOwnerUserId ?? this.activeUser().id}`.trim(),
      assetAssignmentIds: Object.fromEntries(AppConstants.ASSET_TYPES.map(type => [
        type,
        this.resolveSubEventAssignedAssetIds(subEventId, type, { normalizeStore: false })
      ])),
      assetSettingsByType: Object.fromEntries(AppConstants.ASSET_TYPES.map(type => [
        type,
        this.getSubEventAssignedAssetSettings(subEventId, type, { normalizeStore: false })
      ])),
      supplyContributionEntriesByAssetId: Object.fromEntries(
        this.resolveSubEventAssignedAssetIds(
          subEventId,
          AppConstants.ASSET_TYPE_SUPPLIES,
          { normalizeStore: false }
        ).map(assetId => [assetId, this.subEventSupplyContributionEntries(subEventId, assetId)])
      ),
      fallbackAssetCardsByType: {
        [AppConstants.ASSET_TYPE_TRANSPORT]: this.persistedAssignedFallbackCards(
          context,
          AppConstants.ASSET_TYPE_TRANSPORT
        ),
        [AppConstants.ASSET_TYPE_ACCOMMODATION]: this.persistedAssignedFallbackCards(
          context,
          AppConstants.ASSET_TYPE_ACCOMMODATION
        ),
        [AppConstants.ASSET_TYPE_SUPPLIES]: this.persistedAssignedFallbackCards(
          context,
          AppConstants.ASSET_TYPE_SUPPLIES
        )
      }
    };
  }

  private visibleAssignedAssetSettings(
    subEventId: string,
    type: AppConstants.AssetType,
    assetId: string,
    assetOwnerUserId?: string | null
  ): AppDTOs.SubEventAssignedAssetSettingsDTO | undefined {
    const normalizedAssetOwnerUserId = `${assetOwnerUserId ?? ''}`.trim();
    const state = this.resourcePopupStore.visibleResourceStates().find(candidate => (
      candidate.subEventId === subEventId
      && (!normalizedAssetOwnerUserId || candidate.assetOwnerUserId === normalizedAssetOwnerUserId)
      && (candidate.assetAssignmentIds[type] ?? []).includes(assetId)
    ));
    return state?.assetSettingsByType[type]?.[assetId]
      ?? this.getSubEventAssignedAssetSettings(subEventId, type)[assetId];
  }

  private assignedResourceCardRoutes(
    card: ResourceAssetDTO,
    settings: AppDTOs.SubEventAssignedAssetSettingsDTO | undefined
  ): string[] {
    if (card.type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return ActivityResourceBuilder.normalizeAssetRoutes(card.type, card.routes);
    }
    if (card.type !== AppConstants.ASSET_TYPE_TRANSPORT) {
      return ActivityResourceBuilder.normalizeAssetRoutes(card.type, settings?.routes ?? card.routes);
    }
    const routes = ActivityResourceBuilder.normalizeAssetRoutes(card.type, settings?.routes ?? card.routes);
    const routeEnabled = settings?.routeEnabled ?? routes.length > 0;
    return routeEnabled ? routes : [];
  }

  private assignedAssetManagerUserId(
    subEventId: string,
    type: AppConstants.AssetType,
    assetId: string
  ): string | null {
    const managerUserId = `${this.visibleAssignedAssetSettings(subEventId, type, assetId)?.addedByUserId ?? ''}`.trim();
    return managerUserId || null;
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

  private canManageAssignedAssetMembers(
    card: ResourceAssetDTO,
    subEventId: string,
    activeUserId = this.activeUser().id.trim()
  ): boolean {
    if (!activeUserId) {
      return false;
    }
    if (this.isAssetOwnedByActiveUser(card, activeUserId)) {
      return true;
    }
    return this.findBorrowedAssetRequest(card, subEventId, activeUserId)?.status === 'accepted';
  }

  private isSubEventScopedAssetRequest(
    request: AppDTOs.AssetMemberRequestDTO,
    subEventId: string,
    eventId = `${this.resourcePopupStore.popupContextRef()?.ownerId ?? ''}`.trim()
  ): boolean {
    return ActivityResourceBuilder.isSubEventScopedAssetRequest(request, subEventId, eventId);
  }

  private subEventScopedAssetRequests(
    card: ResourceAssetDTO,
    subEventId: string,
    eventId = `${this.resourcePopupStore.popupContextRef()?.ownerId ?? ''}`.trim()
  ): AppDTOs.AssetMemberRequestDTO[] {
    return card.requests
      .filter(request => this.isSubEventScopedAssetRequest(request, subEventId, eventId))
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

  private findBorrowedAssetRequest(
    card: ResourceAssetDTO,
    subEventId: string,
    activeUserId = this.activeUser().id
  ): AppDTOs.AssetMemberRequestDTO | null {
    return this.subEventScopedAssetRequests(card, subEventId)
      .find(request =>
        request.requestKind === 'borrow'
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
    managerUserId: string | null = null,
    eventId = `${this.resourcePopupStore.popupContextRef()?.ownerId ?? ''}`.trim()
  ): AppDTOs.AssetMemberRequestDTO[] {
    const requests = this.subEventScopedAssetRequests(card, subEventId, eventId);
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

  openResourceMap(card: AppDTOs.SubEventResourceCardDTO, event?: Event): void {
    event?.stopPropagation();
    if (card.type !== AppConstants.ASSET_TYPE_TRANSPORT && card.type !== AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return;
    }
    const routes = ActivityResourceBuilder.normalizeAssetRoutes(card.type as AppConstants.AssetType, card.routes);
    if (card.type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
      this.openGoogleMapsSearch(routes[0] ?? card.city);
      return;
    }
    this.openGoogleMapsDirections(routes);
  }

  join(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (
      !context
      || !card.sourceAssetId
    ) {
      return;
    }
    const type = card.type === AppConstants.ASSET_TYPE_TRANSPORT || card.type === AppConstants.ASSET_TYPE_ACCOMMODATION
      ? card.type
      : null;
    if (!type) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, type, card.sourceAssetId);
    if (!sourceCard) {
      return;
    }
    const existingRequest = this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, this.activeUser().id);
    const activePolicies = AssetCardBuilder.assetPoliciesEnabled(sourceCard) ? sourceCard.policies ?? [] : [];
    const validPolicyIds = new Set(activePolicies.map(policy => policy.id));
    const dialog: AssignedAssetJoinDialogState = {
      cardId: card.id,
      type,
      sourceAssetId: sourceCard.id,
      acceptedPolicyIds: [...new Set(existingRequest?.booking?.acceptedPolicyIds ?? [])]
        .map(item => `${item ?? ''}`.trim())
        .filter(item => item.length > 0 && validPolicyIds.has(item)),
      busy: false,
      error: null
    };
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(dialog);
    void this.openAssignedAssetJoinCheckoutEditor(card, sourceCard, dialog);
  }

  private async openAssignedAssetJoinCheckoutEditor(
    resourceCard: AppDTOs.SubEventResourceCardDTO,
    sourceCard: ResourceAssetDTO,
    dialog: AssignedAssetJoinDialogState,
    options: { loadDetail?: boolean } = {}
  ): Promise<void> {
    const context = this.resourcePopupStore.popupContextRef();
    if (
      !context
      || this.resourcePopupStore.assignedAssetJoinDialogRef()?.sourceAssetId !== sourceCard.id
    ) {
      return;
    }
    const runtimeRoute = this.assignedAssetRuntimeRouteState(
      context.subEvent.id,
      resourceCard,
      sourceCard
    );
    const ownerUserId = `${sourceCard.ownerUserId ?? ''}`.trim();
    const loadDetail = ownerUserId.length > 0 && options.loadDetail !== false;
    const generation = this.assetStore.openAssetEditorEdit({
      cardId: sourceCard.id,
      form: AssetCardBuilder.buildAssetFormFromCard(sourceCard),
      visibility: AssetCardBuilder.visibilityFromCard(sourceCard),
      loading: loadDetail,
      readOnly: true,
      parentZIndex: this.resourcePopupZIndex(),
      runtimeRoute: runtimeRoute ? { ...runtimeRoute, editable: false } : null,
      checkout: this.assignedAssetJoinCheckoutState(sourceCard, dialog, context)
    });
    void this.assetPopupStore.ensureAssetPopupLoaded();
    if (!loadDetail) {
      this.assetStore.setAssetEditorLoading(false);
      return;
    }
    try {
      const loadedCard = await this.assetsService.loadOwnedAssetDetailById(ownerUserId, sourceCard.id);
      if (!this.assetStore.isCurrentAssetEditorLoad(generation, sourceCard.id)) {
        return;
      }
      if (loadedCard) {
        this.assetStore.applyAssetEditorForm(
          loadedCard.id,
          AssetCardBuilder.visibilityFromCard(loadedCard),
          AssetCardBuilder.buildAssetFormFromCard(loadedCard)
        );
      }
      this.assetStore.setAssetEditorLoading(false);
    } catch {
      if (this.assetStore.isCurrentAssetEditorLoad(generation, sourceCard.id)) {
        this.assetStore.setAssetEditorLoading(false);
      }
    }
  }

  private assignedAssetJoinCheckoutState(
    sourceCard: ResourceAssetDTO,
    dialog: AssignedAssetJoinDialogState,
    context: ResourcePopupContext
  ): AssetEditorCheckoutState {
    const startAtIso = `${context.subEvent.startAt ?? ''}`.trim();
    const endAtIso = `${context.subEvent.endAt ?? ''}`.trim();
    const timeframe = ActivityResourceBuilder.assetRequestTimeframeLabel(startAtIso, endAtIso);
    const managerUserId = this.assignedAssetManagerUserId(
      context.subEvent.id,
      dialog.type,
      dialog.sourceAssetId
    );
    const pricing = this.resolveAssignedAssetJoinPricing(
      sourceCard,
      context.subEvent,
      this.activeUser().id,
      managerUserId
    );
    const hasError = !dialog.busy && Boolean(dialog.error);
    return {
      sourceId: sourceCard.id,
      mode: 'join',
      phase: 'review',
      title: `Join ${sourceCard.title}`,
      subtitle: this.popupSubtitle(),
      dateRange: {
        startAt: startAtIso,
        endAt: endAtIso,
        precision: 'minute'
      },
      dateRangeModel: {
        mode: 'range',
        precision: 'minute',
        valueFormat: 'iso-date-time',
        range: {
          start: { label: this.i18n.translate('asset.borrow.start') },
          end: { label: this.i18n.translate('asset.borrow.end') }
        }
      },
      availableQuantity: 1,
      pricingPreview: {
        rows: [{
          key: `assigned-asset-join:${sourceCard.id}`,
          label: pricing.chargeType === 'per_attendee' ? 'Per-member price' : 'Your share',
          detail: timeframe,
          amount: pricing.shareAmount,
          currency: pricing.currency
        }],
        totalAmount: pricing.shareAmount,
        currency: pricing.currency
      },
      acceptedPolicyIds: [...dialog.acceptedPolicyIds],
      footerItems: [
        {
          id: 'join-cancel',
          label: this.i18n.translate('cancel'),
          layout: 'action',
          palette: 'neutral',
          disabled: dialog.busy
        },
        {
          id: 'join-confirm',
          label: dialog.busy ? 'Sending request...' : 'Send join request',
          layout: 'action',
          palette: hasError ? 'danger' : 'blue',
          disabled: !this.canSubmitAssignedAssetJoin(),
          progress: dialog.busy || hasError
            ? {
                state: dialog.busy ? 'loading' : 'error',
                shape: 'button'
              }
            : null
        }
      ],
      pendingFooterItemId: 'join-confirm',
      pendingFooterLabel: 'Sending request...',
      busy: dialog.busy,
      error: dialog.error,
      onPolicyToggle: policyId => this.toggleAssignedAssetJoinPolicy(policyId),
      onFooterItemSelect: (itemId, sourceEvent) => {
        if (itemId === 'join-cancel') {
          this.closeAssignedAssetJoinDialog(sourceEvent);
          return;
        }
        void this.confirmAssignedAssetJoin(sourceEvent);
      },
      onClose: () => this.closeAssignedAssetJoinDialog()
    };
  }

  private syncAssignedAssetJoinCheckoutEditor(dialog: AssignedAssetJoinDialogState): void {
    const checkout = this.assetStore.assetFormCheckout();
    const context = this.resourcePopupStore.popupContextRef();
    if (
      checkout?.mode !== 'join'
      || checkout.sourceId !== dialog.sourceAssetId
      || !context
    ) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(
      context.subEvent.id,
      dialog.type,
      dialog.sourceAssetId
    );
    if (!sourceCard) {
      return;
    }
    this.assetStore.setAssetEditorCheckoutState(
      this.assignedAssetJoinCheckoutState(sourceCard, dialog, context)
    );
  }

  private restoreAssignedAssetJoinAfterFailure(dialog: AssignedAssetJoinDialogState): void {
    this.assetStore.setAssetEditorCheckoutPending(false);
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(dialog);
    this.syncAssignedAssetJoinCheckoutEditor(dialog);
  }

  leave(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (
      !context
      || !card.sourceAssetId
      || (card.type !== AppConstants.ASSET_TYPE_TRANSPORT && card.type !== AppConstants.ASSET_TYPE_ACCOMMODATION)
    ) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, card.type, card.sourceAssetId);
    if (!sourceCard) {
      return;
    }
    const currentRequest = this.findAssignedAssetJoinRequest(sourceCard, context.subEvent.id, this.activeUser().id);
    const syncedStatus = this.assignedAssetMemberStatusChange(sourceCard.id, context)?.status ?? null;
    if (!currentRequest && syncedStatus !== 'accepted' && syncedStatus !== 'pending') {
      return;
    }
    const isPending = syncedStatus === 'pending' || (!syncedStatus && currentRequest?.status === 'pending');
    this.dialogStore.open({
      title: `Leave ${sourceCard.title}?`,
      message: isPending
        ? 'You will leave this asset and withdraw your pending request.'
        : 'You will leave this asset.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Leave',
      busyConfirmLabel: 'Leaving...',
      confirmTone: 'danger',
      failureMessage: 'Unable to leave this asset.',
      onConfirm: () => this.confirmAssignedAssetLeave(
        sourceCard.id,
        sourceCard.type,
        context.ownerId,
        context.subEvent.id
      )
    });
  }

  private async confirmAssignedAssetLeave(
    assetId: string,
    assetType: AppConstants.AssetType,
    eventId: string,
    subEventId: string
  ): Promise<void> {
    const activeUserId = this.activeUser().id.trim();
    if (!activeUserId) {
      throw new Error('Unable to resolve the active member.');
    }
    const change = await this.assetsService.applyMemberStatusChange({
      assetId,
      eventId,
      subEventId,
      actorUserId: activeUserId,
      action: 'leave'
    });
    if (!change || change.status !== 'deleted') {
      throw new Error('The asset membership was not removed.');
    }
    this.applyAssignedAssetMemberStatusChange(assetType, change);
    if (this.resourcePopupStore.assignedAssetJoinDialogRef()?.sourceAssetId === assetId) {
      this.closeAssignedAssetJoinDialog();
    }
  }

  closeAssignedAssetJoinDialog(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.resourcePopupStore.assignedAssetJoinDialogRef();
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(null);
    this.assetStore.setAssetEditorCheckoutPending(false);
    const checkout = this.assetStore.assetFormCheckout();
    if (checkout?.mode === 'join' && (!dialog || checkout.sourceId === dialog.sourceAssetId)) {
      this.assetStore.closeAssetEditor();
    }
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
    const nextDialog: AssignedAssetJoinDialogState = {
      ...dialog,
      acceptedPolicyIds: [...nextAccepted],
      error: null
    };
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(nextDialog);
    this.syncAssignedAssetJoinCheckoutEditor(nextDialog);
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
    return !(AssetCardBuilder.assetPoliciesEnabled(sourceCard) ? sourceCard.policies ?? [] : [])
      .some(policy => policy.required !== false && !acceptedPolicyIds.has(policy.id));
  }

  async confirmAssignedAssetJoin(event?: Event): Promise<void> {
    event?.stopPropagation();
    const dialog = this.resourcePopupStore.assignedAssetJoinDialogRef();
    const context = this.resourcePopupStore.popupContextRef();
    if (!dialog || !context) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(context.subEvent.id, dialog.type, dialog.sourceAssetId);
    if (!sourceCard) {
      const nextDialog: AssignedAssetJoinDialogState = {
        ...dialog,
        busy: false,
        error: 'This asset is no longer available in the resource popup.'
      };
      this.resourcePopupStore.assignedAssetJoinDialogRef.set(nextDialog);
      this.syncAssignedAssetJoinCheckoutEditor(nextDialog);
      return;
    }
    if (!this.canSubmitAssignedAssetJoin()) {
      return;
    }
    const activeUser = this.activeUser();
    const pricing = this.resolveAssignedAssetJoinPricing(sourceCard, context.subEvent, activeUser.id);
    const activePolicies = AssetCardBuilder.assetPoliciesEnabled(sourceCard) ? sourceCard.policies ?? [] : [];
    const validPolicyIds = new Set(activePolicies.map(policy => policy.id));
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
    const busyDialog: AssignedAssetJoinDialogState = {
      ...dialog,
      acceptedPolicyIds,
      busy: true,
      error: null
    };
    this.resourcePopupStore.assignedAssetJoinDialogRef.set(busyDialog);
    this.assetStore.setAssetEditorCheckoutPending(true);
    const activeContext = this.resourcePopupStore.popupContextRef();
    if (!activeContext || activeContext.subEvent.id !== context.subEvent.id) {
      this.restoreAssignedAssetJoinAfterFailure({
        ...dialog,
        acceptedPolicyIds,
        busy: false,
        error: 'Unable to save the join request.'
      });
      return;
    }
    try {
      const change = await this.assetsService.applyMemberStatusChange({
        assetId: sourceCard.id,
        eventId: context.ownerId,
        subEventId: context.subEvent.id,
        actorUserId: activeUser.id,
        action: 'join',
        request: nextRequest
      });
      if (!change || (change.status !== 'pending' && change.status !== 'accepted')) {
        throw new Error('The asset join request was not saved.');
      }
      this.applyAssignedAssetMemberStatusChange(sourceCard.type, change);
      this.closeAssignedAssetJoinDialog();
    } catch {
      const nextDialog: AssignedAssetJoinDialogState = {
        ...dialog,
        acceptedPolicyIds,
        busy: false,
        error: 'Unable to save the join request.'
      };
      this.restoreAssignedAssetJoinAfterFailure(nextDialog);
    }
  }

  private resolveViewableCarRoutes(
    settingsRoutes: string[] | undefined,
    cardRoutes: string[] | undefined,
    sourceRoutes: string[] | undefined
  ): string[] {
    const candidates = [settingsRoutes, cardRoutes, sourceRoutes]
      .map(routes => ActivityResourceBuilder.normalizeAssetRoutes(AppConstants.ASSET_TYPE_TRANSPORT, routes).filter(stop => stop.trim().length > 0));
    return candidates.find(routes => routes.length > 0) ?? [''];
  }

  private assignedRuntimeQuantityMax(card: ResourceAssetDTO): number {
    return Math.max(1, AssetCardBuilder.storedQuantityValue(card));
  }

  private assignedRuntimeQuantityBounds(
    card: ResourceAssetDTO,
    subEventId: string,
    settings: AppDTOs.SubEventAssignedAssetSettingsDTO | null | undefined
  ): {
    quantityMax: number;
    reservedQuantity: number;
    reservation: AppDTOs.AssetMemberRequestDTO | null;
  } {
    const remainingQuantity = Math.max(0, AssetCardBuilder.storedQuantityValue(card));
    const reservation = this.assignedAssetReservationRequest(card, subEventId, settings?.addedByUserId);
    const reservedQuantity = reservation
      ? this.assignedRuntimeQuantityValue(reservation.booking?.quantity, settings?.quantity)
      : 0;
    const reservedInventoryQuantity = reservation?.booking?.inventoryApplied === true
      ? reservedQuantity
      : 0;
    return {
      quantityMax: Math.max(1, remainingQuantity + reservedInventoryQuantity),
      reservedQuantity,
      reservation
    };
  }

  private assignedAssetReservationRequest(
    card: ResourceAssetDTO,
    subEventId: string,
    assignedByUserId?: string | null
  ): AppDTOs.AssetMemberRequestDTO | null {
    const scopedRequests = this.subEventScopedAssetRequests(card, subEventId);
    const normalizedAssignedByUserId = `${assignedByUserId ?? ''}`.trim();
    const assignedByRequest = normalizedAssignedByUserId
      ? scopedRequests.find(request =>
          (request.requestKind === 'borrow' || request.requestKind === 'manual')
          && AppUtils.resolveAssetRequestUserId(request, this.users) === normalizedAssignedByUserId
        ) ?? null
      : null;
    return assignedByRequest
      ?? scopedRequests.find(request => request.requestKind === 'borrow' && request.booking?.inventoryApplied === true)
      ?? scopedRequests.find(request => request.requestKind === 'manual')
      ?? null;
  }

  private assignedRuntimeQuantityDescription(
    quantityMax: number,
    quantity: number,
    card?: ResourceAssetDTO | null,
    reservation?: AppDTOs.AssetMemberRequestDTO | null
  ): string {
    const availableLabel = this.i18n.translateParams('asset.assignment.available', {
      count: Math.max(0, Math.trunc(quantityMax) - Math.max(1, Math.trunc(quantity)))
    });
    const priceDelta = this.assignedRuntimeQuantityPriceDelta(card, reservation, quantity);
    if (!priceDelta || Math.abs(priceDelta.amount) < 0.005) {
      return availableLabel;
    }
    return this.i18n.translateParams('asset.assignment.available.price', {
      available: availableLabel,
      price: this.signedCurrencyAmount(priceDelta.amount, priceDelta.currency)
    });
  }

  private assignedRuntimeQuantityPriceDelta(
    card: ResourceAssetDTO | null | undefined,
    reservation: AppDTOs.AssetMemberRequestDTO | null | undefined,
    nextQuantity: number
  ): { amount: number; currency: string } | null {
    if (!card || !reservation?.booking?.paymentSessionId) {
      return null;
    }
    const currentQuantity = this.assignedRuntimeQuantityValue(reservation.booking.quantity);
    const normalizedNextQuantity = this.assignedRuntimeQuantityValue(nextQuantity);
    if (currentQuantity === normalizedNextQuantity) {
      return null;
    }
    const startAtIso = `${reservation.booking.startAtIso ?? ''}`.trim();
    const endAtIso = `${reservation.booking.endAtIso ?? ''}`.trim();
    const pricingOptions = {
      pricing: card.pricing,
      totalQuantity: this.assignedBorrowTotalQuantity(card, reservation),
      startAtIso,
      endAtIso,
      requests: card.requests
    };
    const currentPricing = PricingBuilder.resolveAssetBorrowPricing({
      ...pricingOptions,
      requestedQuantity: currentQuantity
    });
    const nextPricing = PricingBuilder.resolveAssetBorrowPricing({
      ...pricingOptions,
      requestedQuantity: normalizedNextQuantity
    });
    return {
      amount: Math.round((nextPricing.amount - currentPricing.amount) * 100) / 100,
      currency: nextPricing.currency || currentPricing.currency || 'USD'
    };
  }

  private signedCurrencyAmount(amount: number, currency: string): string {
    const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
    const absoluteAmount = Math.abs(Number(amount) || 0);
    try {
      return `${sign}${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: `${currency ?? 'USD'}`.trim() || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(absoluteAmount)}`;
    } catch {
      return `${sign}${`${currency ?? 'USD'}`.trim() || 'USD'} ${absoluteAmount.toFixed(2)}`;
    }
  }

  private assignedRuntimeQuantityValue(value: unknown, fallback = 1): number {
    const parsed = Math.trunc(Number(value));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    const fallbackValue = Math.trunc(Number(fallback));
    return Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : 1;
  }

  private assignedAssetOccupancyCapacityTotal(
    card: ResourceAssetDTO,
    settings: AppDTOs.SubEventAssignedAssetSettingsDTO | null | undefined
  ): number {
    const capacity = Math.max(0, Math.trunc(Number(card.capacityTotal) || 0));
    return capacity * this.assignedRuntimeQuantityValue(settings?.quantity);
  }

  private normalizeAssignedRuntimeQuantity(value: unknown, max: unknown, fallback = 1): number {
    const parsedMax = Math.trunc(Number(max));
    const limit = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 1;
    const parsed = Math.trunc(Number(value));
    const fallbackValue = Math.trunc(Number(fallback));
    const resolved = Number.isFinite(parsed) && parsed > 0
      ? parsed
      : (Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : 1);
    return Math.min(limit, Math.max(1, resolved));
  }

  private async saveAssignedAssetRuntimeAssignment(
    subEventId: string,
    type: AppConstants.AssetType,
    assetId: string,
    state: { quantity: number; routeEnabled: boolean; routes: readonly string[] },
    signal?: AbortSignal
  ): Promise<{ quantity: number; routeEnabled: boolean; routes: string[] }> {
    const context = this.resourcePopupStore.popupContextRef();
    const normalizedSubEventId = subEventId.trim();
    const normalizedAssetId = assetId.trim();
    if (!context || context.subEvent.id !== normalizedSubEventId || !normalizedAssetId) {
      throw new Error('Unable to save route changes.');
    }
    const nextState = this.buildPopupResourceState(context);
    if (!nextState) {
      throw new Error('Unable to save route changes.');
    }
    const normalizedRoutes = ActivityResourceBuilder.normalizeAssetRoutes(type, state.routes);
    const nextSettings = {
      ...(nextState.assetSettingsByType[type] ?? {})
    };
    const source = this.resolveSubEventAssignedAssetCard(normalizedSubEventId, type, normalizedAssetId)
      ?? this.ownedAssetCards().find(item => item.id === normalizedAssetId && item.type === type)
      ?? null;
    const currentSettings = nextSettings[normalizedAssetId];
    const quantityBounds = source
      ? this.assignedRuntimeQuantityBounds(source, normalizedSubEventId, currentSettings)
      : { quantityMax: 1, reservedQuantity: 0, reservation: null };
    const quantityMax = quantityBounds.quantityMax;
    const quantity = this.normalizeAssignedRuntimeQuantity(
      state.quantity,
      quantityMax,
      quantityBounds.reservedQuantity
    );
    const persistedSource = source
      ? await this.persistAssignedBorrowQuantity(
          source,
          normalizedSubEventId,
          quantityBounds.reservation,
          quantity
        )
      : null;
    const current = nextSettings[normalizedAssetId] ?? {
      capacityMin: 0,
      capacityMax: Math.max(0, source?.capacityTotal ?? 0),
      quantity,
      addedByUserId: this.activeUser().id,
      routeEnabled: false,
      routes: []
    };
    nextSettings[normalizedAssetId] = {
      ...current,
      quantity,
      routeEnabled: type === AppConstants.ASSET_TYPE_TRANSPORT && state.routeEnabled === true,
      routes: type === AppConstants.ASSET_TYPE_TRANSPORT ? normalizedRoutes : []
    };
    nextState.assetSettingsByType = {
      ...nextState.assetSettingsByType,
      [type]: nextSettings
    };
    if (
      persistedSource
      && !this.ownedAssetCards().some(item => item.id === normalizedAssetId && item.type === type)
    ) {
      nextState.fallbackAssetCardsByType = {
        ...(nextState.fallbackAssetCardsByType ?? {}),
        [type]: [
          ...(nextState.fallbackAssetCardsByType?.[type] ?? [])
            .filter(item => item.id !== normalizedAssetId),
          this.toAssetDetailDto(this.assignedFallbackAssetSnapshot(normalizedSubEventId, persistedSource))
        ]
      };
    }

    const savedState = await this.activityResourcesService.replaceSubEventResourceState(nextState, signal);
    const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
    this.applyPersistedPopupState(resolvedState);
    this.syncSubEventManualAssetRequests(context.subEvent, true);
    this.syncPopupSubEventMetrics({
      persistedState: resolvedState,
      assignmentQuantityUpdates: [{
        assetId: normalizedAssetId,
        type,
        subEventId: normalizedSubEventId,
        quantity
      }]
    });
    const savedSettings = resolvedState.assetSettingsByType[type]?.[normalizedAssetId] ?? null;
    return {
      quantity: this.normalizeAssignedRuntimeQuantity(savedSettings?.quantity ?? quantity, quantityMax),
      routeEnabled: type === AppConstants.ASSET_TYPE_TRANSPORT && (savedSettings?.routeEnabled ?? state.routeEnabled === true),
      routes: type === AppConstants.ASSET_TYPE_TRANSPORT
        ? ActivityResourceBuilder.normalizeAssetRoutes(type, savedSettings?.routes ?? normalizedRoutes)
        : []
    };
  }

  private async persistAssignedBorrowQuantity(
    card: ResourceAssetDTO,
    subEventId: string,
    reservation: AppDTOs.AssetMemberRequestDTO | null,
    quantity: number
  ): Promise<ResourceAssetDTO> {
    if (!reservation || reservation.requestKind !== 'borrow' || !reservation.booking) {
      return card;
    }
    const previousQuantity = this.assignedRuntimeQuantityValue(reservation.booking.quantity);
    if (quantity === previousQuantity) {
      return card;
    }
    const quantityDelta = quantity - previousQuantity;
    const remainingQuantity = Math.max(0, AssetCardBuilder.storedQuantityValue(card));
    if (reservation.booking.inventoryApplied === true && quantityDelta > remainingQuantity) {
      throw new Error('The requested quantity is no longer available.');
    }
    const nextRemainingQuantity = reservation.booking.inventoryApplied === true
      ? Math.max(0, remainingQuantity - quantityDelta)
      : remainingQuantity;
    const startAtIso = `${reservation.booking.startAtIso ?? ''}`.trim();
    const endAtIso = `${reservation.booking.endAtIso ?? ''}`.trim();
    const pricing = PricingBuilder.resolveAssetBorrowPricing({
      pricing: card.pricing,
      totalQuantity: this.assignedBorrowTotalQuantity(card, reservation),
      requestedQuantity: quantity,
      startAtIso,
      endAtIso,
      requests: card.requests
    });
    const previousPricing = PricingBuilder.resolveAssetBorrowPricing({
      pricing: card.pricing,
      totalQuantity: this.assignedBorrowTotalQuantity(card, reservation),
      requestedQuantity: previousQuantity,
      startAtIso,
      endAtIso,
      requests: card.requests
    });
    const nextRequests = card.requests.map(request => (
      request.id === reservation.id
        ? {
            ...request,
            booking: request.booking
              ? {
                  ...request.booking,
                  quantity,
                  totalAmount: pricing.amount,
                  previousTotalAmount: previousPricing.amount,
                  currency: pricing.currency,
                  acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
                }
              : null
          }
        : {
            ...request,
            booking: request.booking
              ? {
                  ...request.booking,
                  acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
                }
              : null
          }
    ));
    const nextCard: ResourceAssetDTO = {
      ...card,
      quantity: nextRemainingQuantity,
      requests: nextRequests
    };
    await this.persistLocalAssignedBorrowPriceRevision(
      card,
      reservation,
      quantity,
      pricing
    );
    const ownerUserId = `${card.ownerUserId ?? ''}`.trim();
    if (!ownerUserId) {
      return nextCard;
    }
    const savedCard = await this.assetsService.saveOwnedAsset(ownerUserId, this.toAssetDetailDto(nextCard));
    const persistedCard: ResourceAssetDTO = {
      ...nextCard,
      ...savedCard,
      sourceLink: nextCard.sourceLink,
      routes: [...(nextCard.routes ?? [])],
      topics: [...(nextCard.topics ?? [])],
      policiesEnabled: nextCard.policiesEnabled,
      policies: (nextCard.policies ?? []).map(policy => ({ ...policy })),
      pricing: nextCard.pricing ? PricingBuilder.clonePricingConfig(nextCard.pricing) : nextCard.pricing,
      requests: savedCard.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      }))
    };
    if (this.ownedAssetCards().some(item => item.id === card.id && item.type === card.type)) {
      this.assetStore.replaceAssetCard(persistedCard, { mutation: true, reloadList: false });
    }
    return persistedCard;
  }

  private async persistLocalAssignedBorrowPriceRevision(
    card: ResourceAssetDTO,
    reservation: AppDTOs.AssetMemberRequestDTO,
    quantity: number,
    pricing: ReturnType<typeof PricingBuilder.resolveAssetBorrowPricing>
  ): Promise<void> {
    const booking = reservation.booking;
    const userId = AppUtils.resolveAssetRequestUserId(reservation, this.users)
      || `${reservation.userId ?? ''}`.trim();
    const paymentSessionId = `${booking?.paymentSessionId ?? ''}`.trim();
    if (!this.eventsService.localModeEnabled || !booking || !userId || !paymentSessionId) {
      return;
    }
    const timeframe = ActivityResourceBuilder.assetRequestTimeframeLabel(
      `${booking.startAtIso ?? ''}`.trim(),
      `${booking.endAtIso ?? ''}`.trim()
    );
    await this.eventsService.saveCheckoutBasket({
      userId,
      sourceId: card.id,
      slotSourceId: null,
      optionalSubEventIds: [],
      assetSelections: booking.subEventId
        ? [{ subEventId: booking.subEventId, resourceType: card.type }]
        : [],
      acceptedPolicyIds: [...(booking.acceptedPolicyIds ?? [])],
      appliedPromoCodes: [],
      basketItems: [],
      pricingSummaryRows: pricing.rows.map(row => ({ ...row })),
      checkoutState: 'pay',
      lineItems: [{
        id: `resource:${card.id}`,
        kind: 'resource',
        label: card.title,
        detail: quantity > 1
          ? this.i18n.translateParams('asset.borrow.quantity.detail', {
              timeframe,
              quantity
            })
          : timeframe,
        amount: pricing.amount,
        currency: pricing.currency
      }],
      totalAmount: pricing.amount,
      currency: pricing.currency
    });
    await this.eventsService.updateCheckoutBasketState({
      userId,
      sourceId: card.id,
      slotSourceId: null,
      checkoutState: 'pay',
      resultState: 'succeeded',
      checkoutSessionId: paymentSessionId
    });
  }

  private assignedBorrowTotalQuantity(
    card: ResourceAssetDTO,
    reservation: AppDTOs.AssetMemberRequestDTO
  ): number {
    const remainingQuantity = Math.max(0, AssetCardBuilder.storedQuantityValue(card));
    const reservedQuantity = reservation.booking?.inventoryApplied === true
      ? this.assignedRuntimeQuantityValue(reservation.booking.quantity)
      : 0;
    return Math.max(1, remainingQuantity + reservedQuantity);
  }

  private abortPendingAssignSaveRequest(): void {
    this.pendingAssignSaveRequestVersion += 1;
    const controller = this.pendingAssignSaveAbortController;
    this.pendingAssignSaveAbortController = null;
    controller?.abort();
  }

  requestDeleteResourceCard(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (
      !context
      || !card.sourceAssetId
      || !this.isAssignableAssetType(card.type)
    ) {
      return;
    }
    const sourceCard = this.resolveSubEventAssignedAssetCard(
      context.subEvent.id,
      card.type,
      card.sourceAssetId
    );
    if (!sourceCard || !this.canRemoveAssignedAsset(context.subEvent.id, sourceCard, card.sourceAssetId)) {
      return;
    }
    const pending: ResourceAssignmentRemovalRequest = {
      assetId: card.sourceAssetId,
      type: card.type,
      title: card.title
    };
    this.dialogStore.open({
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

  private canRemoveAssignedAsset(
    subEventId: string,
    sourceCard: ResourceAssetDTO,
    assetId: string
  ): boolean {
    const activeUserId = this.activeUser().id.trim();
    return activeUserId.length > 0
      && (
        this.isAssetOwnedByActiveUser(sourceCard, activeUserId)
        || this.assignedAssetManagerUserId(subEventId, sourceCard.type, assetId) === activeUserId
      );
  }

  private async removeResourceAssignment(pending: ResourceAssignmentRemovalRequest): Promise<void> {
    const nextState = this.buildResourceAssignmentRemovalState(pending);
    if (!nextState) {
      throw new Error('Unable to remove assignment.');
    }
    const savedState = await this.activityResourcesService.replaceSubEventResourceState(nextState);
    const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
    this.applyPersistedPopupState(resolvedState);
    this.syncPopupSubEventMetrics({ persistAssetRequests: true, persistedState: resolvedState });
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
    if (pending.type === AppConstants.ASSET_TYPE_SUPPLIES) {
      const nextSupplyEntries = { ...nextState.supplyContributionEntriesByAssetId };
      delete nextSupplyEntries[pending.assetId];
      nextState.supplyContributionEntriesByAssetId = nextSupplyEntries;
    }
    return nextState;
  }

  private isAssignableAssetType(type: AppConstants.SubEventResourceFilter): type is AppConstants.AssetType {
    return AppConstants.isAssetType(type);
  }

  openAssignPopup(event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (!context || context.viewOnly) {
      return;
    }
    this.abortPendingAssignSaveRequest();
    this.resourcePopupStore.pendingAssignSaveRef.set(null);
    const type = this.resourcePopupStore.resourceFilterRef();
    this.resourcePopupStore.assignContextRef.set({ subEventId: context.subEvent.id, type });
    this.resourcePopupStore.selectedAssignAssetIdsRef.set([...this.resolveSubEventAssignedAssetIds(context.subEvent.id, type)]);
    this.assetStore.openAssetPopup(type);
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
    this.closeAssignedAssetJoinDialog();
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

  private resourceFilterCounts(): Record<AppConstants.AssetType, number> {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return {
        [AppConstants.ASSET_TYPE_TRANSPORT]: 0,
        [AppConstants.ASSET_TYPE_ACCOMMODATION]: 0,
        [AppConstants.ASSET_TYPE_SUPPLIES]: 0
      };
    }
    return {
      [AppConstants.ASSET_TYPE_TRANSPORT]: this.subEventAssetCapacityMetrics(context.subEvent, AppConstants.ASSET_TYPE_TRANSPORT, { normalizeStore: false }).pending,
      [AppConstants.ASSET_TYPE_ACCOMMODATION]: this.subEventAssetCapacityMetrics(context.subEvent, AppConstants.ASSET_TYPE_ACCOMMODATION, { normalizeStore: false }).pending,
      [AppConstants.ASSET_TYPE_SUPPLIES]: this.subEventAssetCapacityMetrics(context.subEvent, AppConstants.ASSET_TYPE_SUPPLIES, { normalizeStore: false }).pending
    };
  }

  private subEventAssignedAssetCards(
    subEventId: string,
    type: AppConstants.AssetType,
    options: { normalizeStore?: boolean } = {}
  ): ResourceAssetDTO[] {
    return this.resolveSubEventAssignedAssetIds(subEventId, type, options)
      .map(id => this.resolveSubEventAssignedAssetCard(subEventId, type, id))
      .filter((card): card is ResourceAssetDTO => card !== null);
  }

  private getSubEventAssignedAssetSettings(
    subEventId: string,
    type: AppConstants.AssetType,
    options: { normalizeStore?: boolean } = {}
  ): Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> {
    const key = ActivityResourceBuilder.subEventAssetAssignmentKey(subEventId, type);
    const normalizeStore = options.normalizeStore !== false;
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEventId, type, { normalizeStore });
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
        quantity: this.assignedRuntimeQuantityValue(previous?.quantity),
        addedByUserId: previous?.addedByUserId ?? this.activeUser().id,
        routeEnabled: previous?.routeEnabled ?? ActivityResourceBuilder.normalizeAssetRoutes(type, previous?.routes).length > 0,
        routes: ActivityResourceBuilder.normalizeAssetRoutes(type, previous?.routes)
      };
    }
    if (normalizeStore) {
      this.resourcePopupStore.assignedAssetSettingsByKey[key] = next;
    }
    return next;
  }

  private resolveSubEventAssignedAssetIds(
    subEventId: string,
    type: AppConstants.AssetType,
    options: { normalizeStore?: boolean } = {}
  ): string[] {
    const key = ActivityResourceBuilder.subEventAssetAssignmentKey(subEventId, type);
    const normalizeStore = options.normalizeStore !== false;
    const eligibleIds = [
      ...this.ownedAssetCards().filter(card => card.type === type).map(card => card.id),
      ...this.subEventFallbackAssetCards(subEventId, type).map(card => card.id)
    ];
    const eligible = new Set(eligibleIds);
    const stored = this.resourcePopupStore.assignedAssetIdsByKey[key];
    if (!stored) {
      if (normalizeStore) {
        this.resourcePopupStore.assignedAssetIdsByKey[key] = [];
      }
      return [];
    }
    const normalized = stored.filter(id => eligible.has(id));
    if (normalizeStore && normalized.length !== stored.length) {
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
      ?? this.resourcePopupStore.visibleResourceStates()
        .flatMap(state => state.fallbackAssetCardsByType?.[type] ?? [])
        .find(card => card.id === assetId && card.type === type)
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
    for (const type of AppConstants.ASSET_TYPES) {
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
    type: AppConstants.AssetType,
    options: { normalizeStore?: boolean } = {}
  ): { joined: number; capacityMin: number; capacityMax: number; pending: number } {
    const cards = this.subEventAssignedAssetCards(subEvent.id, type, options);
    const settings = this.getSubEventAssignedAssetSettings(subEvent.id, type, options);
    const memberCount = (
      card: ResourceAssetDTO,
      status: 'accepted' | 'pending'
    ): number => {
      const memberSync = type === AppConstants.ASSET_TYPE_SUPPLIES
        ? null
        : this.assignedAssetMembersSync(card.id);
      if (memberSync) {
        return status === 'accepted'
          ? memberSync.acceptedMembers
          : memberSync.pendingMembers;
      }
      const managerUserId = `${settings[card.id]?.addedByUserId ?? ''}`.trim() || null;
      return status === 'accepted'
        ? this.assetAcceptedCount(card, subEvent.id, managerUserId)
        : this.assetPendingCount(card, subEvent.id, managerUserId);
    };
    const capacityMax = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal)), 0);
    const capacityMin = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMin ?? 0), 0);
    const pending = cards.reduce((sum, card) => sum + memberCount(card, 'pending'), 0);
    if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
      return {
        joined: cards.reduce((sum, card) => sum + this.subEventSupplyProvidedCount(card.id, subEvent.id), 0),
        capacityMin,
        capacityMax,
        pending
      };
    }
    return {
      joined: cards.reduce((sum, card) => sum + memberCount(card, 'accepted'), 0),
      capacityMin,
      capacityMax,
      pending
    };
  }

  private syncPopupSubEventMetrics(
    options: boolean | {
      persistResourceState?: boolean;
      persistAssetRequests?: boolean;
      syncManualAssetRequests?: boolean;
      persistedState?: AppDTOs.ActivitySubEventResourceStateDTO | null;
      activityDelta?: number;
      assignmentQuantityUpdates?: readonly SubEventResourceAssignmentQuantityUpdate[];
    } = false
  ): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const persistResourceState = typeof options === 'boolean' ? options : options.persistResourceState === true;
    const persistAssetRequests = typeof options === 'boolean' ? options : options.persistAssetRequests === true;
    const syncManualAssetRequests = typeof options === 'boolean' || options.syncManualAssetRequests !== false;
    const persistedState = typeof options === 'boolean' ? null : options.persistedState ?? null;
    const activityDelta = typeof options === 'boolean' || options.activityDelta === undefined
      ? undefined
      : Math.trunc(Number(options.activityDelta) || 0);
    const assignmentQuantityUpdates = typeof options === 'boolean' ? [] : [...(options.assignmentQuantityUpdates ?? [])];
    let nextSubEvent = this.cloneSubEvent(context.subEvent);
    const cars = this.subEventAssetCapacityMetrics(nextSubEvent, AppConstants.ASSET_TYPE_TRANSPORT, { normalizeStore: false });
    const accommodation = this.subEventAssetCapacityMetrics(nextSubEvent, AppConstants.ASSET_TYPE_ACCOMMODATION, { normalizeStore: false });
    const supplies = this.subEventAssetCapacityMetrics(nextSubEvent, AppConstants.ASSET_TYPE_SUPPLIES, { normalizeStore: false });
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
    nextSubEvent = ActivityResourceBuilder.withPersistedResourceMetrics(nextSubEvent, persistedState);
    const metricsChanged = context.subEvent.carsAccepted !== nextSubEvent.carsAccepted
      || context.subEvent.carsPending !== nextSubEvent.carsPending
      || context.subEvent.carsCapacityMin !== nextSubEvent.carsCapacityMin
      || context.subEvent.carsCapacityMax !== nextSubEvent.carsCapacityMax
      || context.subEvent.accommodationAccepted !== nextSubEvent.accommodationAccepted
      || context.subEvent.accommodationPending !== nextSubEvent.accommodationPending
      || context.subEvent.accommodationCapacityMin !== nextSubEvent.accommodationCapacityMin
      || context.subEvent.accommodationCapacityMax !== nextSubEvent.accommodationCapacityMax
      || context.subEvent.suppliesAccepted !== nextSubEvent.suppliesAccepted
      || context.subEvent.suppliesPending !== nextSubEvent.suppliesPending
      || context.subEvent.suppliesCapacityMin !== nextSubEvent.suppliesCapacityMin
      || context.subEvent.suppliesCapacityMax !== nextSubEvent.suppliesCapacityMax;
    const nextContext = metricsChanged
      ? {
          ...context,
          subEvent: nextSubEvent
        }
      : context;
    if (metricsChanged) {
      this.resourcePopupStore.popupContextRef.set(nextContext);
    }
    if (metricsChanged || assignmentQuantityUpdates.length > 0 || activityDelta !== undefined) {
      this.resourcePopupStore.publishSubEventResourceMetrics(nextContext, {
        activityDelta,
        assignmentQuantityUpdates
      });
    }
    if (syncManualAssetRequests) {
      this.syncSubEventManualAssetRequests(nextContext.subEvent, persistAssetRequests);
    }
    if (persistResourceState) {
      this.persistPopupResourceState(nextContext);
    }
  }

  private applyAssignedAssetMemberStatusChange(
    assetType: AppConstants.AssetType,
    change: AppDTOs.AssetMemberStatusChangeDTO
  ): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (
      !context
      || change.eventId !== context.ownerId
      || change.subEventId !== context.subEvent.id
      || change.userId !== this.activeUser().id.trim()
    ) {
      return;
    }
    const card = this.resourceCards().find(item => (
      item.sourceAssetId === change.assetId && item.type === assetType
    )) ?? null;
    if (!card) {
      return;
    }
    const memberSync = this.activityStore.cacheActivityMemberStatusChange(change, {
      acceptedMembers: card.accepted,
      pendingMembers: card.pending,
      capacityTotal: card.capacityTotal
    });
    if (!memberSync) {
      return;
    }

    if (change.acceptedMemberDelta === 0 && change.pendingMemberDelta === 0) {
      return;
    }
    this.syncPopupSubEventMetrics({
      syncManualAssetRequests: false,
      activityDelta: change.pendingMemberDelta
    });
  }

  private assignedAssetMemberStatusChange(
    assetId: string,
    context = this.resourcePopupStore.popupContextRef()
  ): AppDTOs.AssetMemberStatusChangeDTO | null {
    const change = this.activityStore.activityMembersSyncByOwnerId()[assetId]?.memberStatusChange ?? null;
    if (
      !context
      || !change
      || change.assetId !== assetId
      || change.eventId !== context.ownerId
      || change.subEventId !== context.subEvent.id
      || change.userId !== this.activeUser().id.trim()
    ) {
      return null;
    }
    return change;
  }

  private assignedAssetMembersSync(
    assetId: string,
    context = this.resourcePopupStore.popupContextRef()
  ): ActivityMembersSyncState | null {
    const normalizedAssetId = assetId.trim();
    const sync = normalizedAssetId
      ? this.activityStore.activityMembersSyncByOwnerId()[normalizedAssetId] ?? null
      : null;
    if (!context || !sync) {
      return null;
    }
    const eventId = `${sync.memberStatusChange?.eventId ?? sync.eventId ?? ''}`.trim();
    const subEventId = `${sync.memberStatusChange?.subEventId ?? sync.subEventId ?? ''}`.trim();
    return eventId === context.ownerId && subEventId === context.subEvent.id
      ? sync
      : null;
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
      this.assetStore.applyAssetCards(nextCards, { mutation: persist });
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
    if (card.type === AppConstants.ASSET_TYPE_SUPPLIES) {
      const assignedSupplyIds = new Set(this.resolveSubEventAssignedAssetIds(subEvent.id, AppConstants.ASSET_TYPE_SUPPLIES));
      if (!assignedSupplyIds.has(card.id)) {
        return null;
      }
      const settings = this.getSubEventAssignedAssetSettings(subEvent.id, AppConstants.ASSET_TYPE_SUPPLIES)[card.id];
      const quantityMax = this.assignedRuntimeQuantityMax(card);
      const quantity = this.subEventSupplyProvidedCount(card.id, subEvent.id)
        || this.normalizeAssignedRuntimeQuantity(settings?.quantity, quantityMax);
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
    if (card.type !== AppConstants.ASSET_TYPE_TRANSPORT && card.type !== AppConstants.ASSET_TYPE_ACCOMMODATION) {
      return null;
    }
    const assignedIds = new Set(this.resolveSubEventAssignedAssetIds(subEvent.id, card.type));
    if (!assignedIds.has(card.id)) {
      return null;
    }
    const settings = this.getSubEventAssignedAssetSettings(subEvent.id, card.type)[card.id];
    const quantity = this.normalizeAssignedRuntimeQuantity(
      settings?.quantity,
      this.assignedRuntimeQuantityMax(card)
    );
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

  private assetMemberEntries(
    card: ResourceAssetDTO,
    ownerUserId: string | null,
    subEventId?: string,
    eventId?: string
  ): ActivityContracts.ActivityMemberDTO[] {
    const seedBaseDate = new Date('2026-02-24T12:00:00');
    const requests = subEventId
      ? this.assetRequestsForView(card, subEventId, ownerUserId, eventId)
      : [...card.requests];
    void this.usersService.warmCachedUsers(requests
      .map(request => AppUtils.resolveAssetRequestUserId(request, this.users))
      .filter(userId => `${userId}`.trim().length > 0));
    const entries = requests.map(request => {
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
          invitedByUserId: pendingRequiresAdminApproval ? ownerUserId : null,
          invitedByActiveUser: pendingRequiresAdminApproval
            && ownerUserId === this.activeUser().id,
          metAtIso: actionAtIso,
          actionAtIso,
          metWhere: card.title,
          avatarUrl: AppUtils.firstImageUrl(matchedUser?.images),
          profile: matchedUser ?? null
        };
      });
    return entries;
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
        chats: 0,
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

  private cloneSubEvent(subEvent: ContractTypes.SubEventDTO): ContractTypes.SubEventDTO {
    return {
      ...subEvent,
      pricing: subEvent.pricing ? PricingBuilder.clonePricingConfig(subEvent.pricing) : undefined
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
      policiesEnabled: AssetCardBuilder.assetPoliciesEnabled(card),
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
    for (const type of AppConstants.ASSET_TYPES) {
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
    for (const type of AppConstants.ASSET_TYPES) {
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
    if (type === AppConstants.ASSET_TYPE_TRANSPORT) {
      return {
        ...subEvent,
        carsPending: scopedPending ?? subEvent.carsPending,
        carsCapacityMin: scopedMin ?? subEvent.carsCapacityMin,
        carsCapacityMax: scopedMax ?? subEvent.carsCapacityMax
      };
    }
    if (type === AppConstants.ASSET_TYPE_ACCOMMODATION) {
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

  private assetPendingCount(
    card: ResourceAssetDTO,
    subEventId?: string,
    managerUserId: string | null = null
  ): number {
    const requests = subEventId
      ? this.assetRequestsForView(card, subEventId, managerUserId)
      : card.requests;
    return requests
      .filter(request => request.status === 'pending')
      .length;
  }

  private assetAcceptedCount(
    card: ResourceAssetDTO,
    subEventId?: string,
    managerUserId: string | null = null
  ): number {
    const requests = subEventId
      ? this.assetRequestsForView(card, subEventId, managerUserId)
      : card.requests;
    return requests
      .filter(request => request.status === 'accepted')
      .length;
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
