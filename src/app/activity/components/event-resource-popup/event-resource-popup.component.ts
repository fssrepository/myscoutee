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
  SubEventResourcePopupStore,
  type SubEventResourceAssignmentQuantityUpdate
} from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import type {
  AssignedAssetJoinPricingPreview,
  EventResourcePopupOutletActionRequest,
  ResourceAssetDTO,
  ResourceAssetViewState,
  ResourcePopupContext,
  SubEventResourcePopupPresentationHeader,
  SubEventResourcePopupRequest
} from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import type { ChatDTO } from '../../../shared/core/contracts/chat.interface';
import type {
  AssignedAssetJoinDialogViewState
} from './assigned-asset-join-dialog/event-resource-assigned-asset-join-dialog.component';
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

  private pendingCapacitySaveAbortController: AbortController | null = null;
  private pendingCapacitySaveRequestVersion = 0;
  private pendingAssignSaveAbortController: AbortController | null = null;
  private pendingAssignSaveRequestVersion = 0;
  private lastResourcePopupOutletActionRequestId = 0;
  private ownedAssetsHydrationLoadedUserId = '';
  private ownedAssetsHydrationLoadingUserId = '';

  protected readonly resourceAssetViewOutletInputs = computed(() => ({
    view: this.resourceAssetView(),
    parentZIndex: this.resourcePopupZIndex()
  }));
  protected readonly capacityEditorOutletInputs = computed(() => ({
    editor: this.resourcePopupStore.capacityEditorRef()
  }));
  protected readonly assignedAssetJoinDialogOutletInputs = computed(() => ({
    dialog: this.assignedAssetJoinDialogViewState()
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
      if (this.resourcePopupStore.capacityEditorRef()) {
        void this.resourcePopupStore.ensureEventResourceCapacityEditorLoaded();
      }
    });

    effect(() => {
      if (this.assignedAssetJoinDialogViewState()) {
        void this.resourcePopupStore.ensureEventResourceAssignedAssetJoinDialogLoaded();
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
      case 'capacityEditorClose':
        this.closeCapacityEditor(request.event);
        return;
      case 'capacityEditorSave':
        this.saveCapacityEditor(request.event);
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
    const converterOptions = this.resourceInfoCardConverterOptions();
    const context = this.resourcePopupStore.popupContextRef();
    return {
      filter: this.resourcePopupStore.resourceFilterRef(),
      metricIdentity: context ? this.chatMetricIdentity(context) : '',
      filterCounts: this.resourceFilterCounts(),
      items: cards.map(card => ({
        card,
        infoCard: ActivitySubEventResourceInfoCardConverter.convert(
          card,
          converterOptions
        )
      }))
    };
  }

  private chatMetricIdentity(context: ResourcePopupContext): string {
    return this.chatMetricIdentityFromParts(context.ownerId, context.subEvent.id, context.groupId);
  }

  private chatMetricIdentityFromParts(
    ownerIdValue: string | null | undefined,
    subEventIdValue: string | null | undefined,
    groupIdValue?: string | null
  ): string {
    const ownerId = `${ownerIdValue ?? ''}`.trim();
    const subEventId = `${subEventIdValue ?? ''}`.trim();
    if (!ownerId || !subEventId) {
      return '';
    }
    const groupId = `${groupIdValue ?? ''}`.trim();
    const channelType: ContractTypes.ChatChannelType = groupId ? 'groupSubEvent' : 'optionalSubEvent';
    const chatOwnerId = groupId ? `${ownerId}:${subEventId}:${groupId}` : `${ownerId}:${subEventId}`;
    return ActivityChatSingleRowConverter.smartListKeyForIdentity(channelType, chatOwnerId, chatOwnerId);
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
      return `${ownerId}:${subEventId}:${groupId}`;
    }
    if (ownerId && subEventId) {
      return `${ownerId}:${subEventId}`;
    }
    return groupId || subEventId || ownerId;
  }

  private resourceInfoCardConverterOptions(): ActivitySubEventResourceInfoCardConverterOptions {
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
      eventCreatorUserId: eventRecord?.creatorUserId ?? null
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
    if (event.actionId === 'capacity') {
      this.openCapacityEditor(card, new Event('click'));
      return;
    }
    if (event.actionId === 'route') {
      this.openResourceAssetView(card, 'edit', new Event('click'));
      return;
    }
    if (event.actionId === 'askOrganizer') {
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
      card.type === AppConstants.ASSET_TYPE_TRANSPORT || card.type === AppConstants.ASSET_TYPE_ACCOMMODATION
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
    void this.openStackedResourceServiceChat(chat);
  }

  private async openStackedResourceServiceChat(chat: ChatDTO & { ownerUserId?: string }): Promise<void> {
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
      ownerId: input.eventId,
      ownerUserId: activeUserId
    };
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
      const bucket = request.item.metrics?.members ?? null;
      this.memberMenuStore.requestActivitiesNavigation({
        type: 'members',
        ownerId,
        ownerType: request.item.channelType === 'groupSubEvent' ? 'group' : 'subEvent',
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
      popupHeader: { title: 'Assets', subtitle: null },
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

  private openFromSubEventResourceRequest(request: SubEventResourcePopupRequest): void {
    if (request.type === 'Members') {
      const group = request.group ?? null;
      const ownerId = this.memberOwnerIdFromParts(request.ownerId, request.subEventId, group?.id);
      const groupLabel = group?.groupLabel?.trim() ?? '';
      const subEventTitle = this.requestSubEventTitle(request);
      this.memberMenuStore.requestActivitiesNavigation({
        type: 'members',
        ownerId,
        ownerType: group?.id ? 'group' : 'subEvent',
        subtitle: groupLabel || subEventTitle || request.parentTitle?.trim() || 'Event',
        canManage: group?.canManage === true,
        viewOnly: group?.id ? group.canManage !== true : undefined,
        acceptedMembers: Math.max(0, Math.trunc(Number(group?.accepted) || 0)),
        pendingMembers: Math.max(0, Math.trunc(Number(group?.pending) || 0)),
        capacityTotal: Math.max(0, Math.trunc(Number(group?.capacityMax) || 0)),
        metricIdentity: this.chatMetricIdentityFromParts(request.ownerId, request.subEventId, group?.id),
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
      request.popupHeader ?? null
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
    return {
      id: subEventId,
      name,
      description: `${header?.description ?? ''}`.trim(),
      location: `${header?.location ?? ''}`.trim(),
      startAt: `${header?.startAt ?? ''}`.trim(),
      endAt: `${header?.endAt ?? ''}`.trim(),
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
    popupHeader?: SubEventResourcePopupPresentationHeader | null
  ): ResourcePopupContext {
    const subEvent = this.cloneSubEvent(rawSubEvent);
    const scopedSubEvent = group?.id
      ? this.applyGroupScopedAssetSnapshot(subEvent, type, group)
      : subEvent;

    return {
      origin,
      ownerId: ownerId.trim(),
      parentTitle: parentTitle.trim() || 'Event',
      popupHeader: this.normalizePopupHeader(popupHeader, parentTitle),
      subEvent: scopedSubEvent,
      groupId: group?.id?.trim() || undefined,
      groupName: group?.groupLabel?.trim() || undefined,
      fallbackCardsByType: origin === 'subEventResource'
        ? {}
        : this.cloneFallbackCards(fallbackCardsByType)
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
      this.hydrateOwnedAssetsForResourcePopup();
    };
    applyState(this.activityResourcesService.peekSubEventResourceState(ownerId, subEventId, assetOwnerUserId));
    void this.activityResourcesService
      .querySubEventResourceState(ownerId, subEventId, assetOwnerUserId)
      .then(state => applyState(state));
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
    const activeContext = this.resourcePopupStore.popupContextRef();
    if (
      activeContext
      && activeContext.ownerId === normalizedState.ownerId
      && activeContext.subEvent.id === normalizedState.subEventId
    ) {
      this.resourcePopupStore.popupContextRef.set({
        ...activeContext,
        fallbackCardsByType: activeContext.origin === 'subEventResource'
          ? {}
          : this.mergePersistedFallbackCards(
              activeContext.fallbackCardsByType,
              normalizedState.fallbackAssetCardsByType,
              normalizedState.subEventId
            )
      });
    }
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
      fallbackAssetCardsByType: context.origin === 'subEventResource'
        ? {}
        : {
            [AppConstants.ASSET_TYPE_TRANSPORT]: this.persistedAssignedFallbackCards(context, AppConstants.ASSET_TYPE_TRANSPORT),
            [AppConstants.ASSET_TYPE_ACCOMMODATION]: this.persistedAssignedFallbackCards(context, AppConstants.ASSET_TYPE_ACCOMMODATION),
            [AppConstants.ASSET_TYPE_SUPPLIES]: this.persistedAssignedFallbackCards(context, AppConstants.ASSET_TYPE_SUPPLIES)
          }
    };
  }

  closeResourcePopup(): void {
    this.abortPendingCapacitySaveRequest();
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

  private assignedAssetRuntimeRouteState(
    subEventId: string,
    card: AppDTOs.SubEventResourceCardDTO,
    sourceCard: ResourceAssetDTO
  ): AssetEditorRuntimeRouteState | null {
    const assetId = `${card.sourceAssetId ?? sourceCard.id ?? ''}`.trim();
    if (card.type !== AppConstants.ASSET_TYPE_TRANSPORT || sourceCard.type !== AppConstants.ASSET_TYPE_TRANSPORT || !assetId) {
      return null;
    }
    const settings = this.getSubEventAssignedAssetSettings(subEventId, AppConstants.ASSET_TYPE_TRANSPORT);
    const routeSettings = settings[assetId] ?? null;
    const routes = this.resolveViewableCarRoutes(
      routeSettings?.routes,
      card.routes,
      this.assetRouteValues(sourceCard)
    ).map(stop => stop.trim()).filter(Boolean);
    return {
      routeEnabled: routeSettings?.routeEnabled ?? routes.length > 0,
      routes,
      editable: this.canEditAssignedAssetRuntimeRoute(subEventId, sourceCard, assetId),
      title: 'Route',
      subtitle: 'Runtime route for this event asset.',
      openLabel: 'Open Route Setup',
      emptyLabel: 'No route is set for this event asset.',
      readOnlyEmptyLabel: 'No route is set for this event asset.',
      popupTitle: `Route Setup - ${card.title}`,
      popupSubtitle: 'Set the route used by this transport for the selected event assignment.',
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
    const settings = this.getSubEventAssignedAssetSettings(subEventId, type);
    const quantityMax = this.assignedRuntimeQuantityMax(sourceCard);
    const quantity = this.normalizeAssignedRuntimeQuantity(settings[assetId]?.quantity, quantityMax);
    return {
      quantity,
      quantityMax,
      quantityLabel: 'Assigned quantity',
      quantityDescription: `Available: ${quantityMax}`,
      editable: this.canEditAssignedAssetRuntimeAssignment(subEventId, sourceCard, assetId),
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
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, assetType);
    const managerUserId = settings[card.sourceAssetId]?.addedByUserId?.trim() || null;
    const fallbackMembers = this.assetMemberEntries(sourceCard, managerUserId, context.subEvent.id);
    const acceptedMembers = fallbackMembers.filter(member => member.status === 'accepted').length;
    const pendingMembers = fallbackMembers.filter(member => member.status === 'pending').length;
    const capacityTotal = this.assignedAssetOccupancyCapacityTotal(sourceCard, settings[card.sourceAssetId]);
    const subtitle = `${sourceCard.title} · ${this.subEventDisplayName(context.subEvent) || 'Sub Event'}`;
    this.memberMenuStore.requestActivitiesNavigation({
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
    if (!context || card.type !== AppConstants.ASSET_TYPE_SUPPLIES || !card.sourceAssetId) {
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
    const assignedIds = this.resolveSubEventAssignedAssetIds(context.subEvent.id, type, {
      normalizeStore: false
    });
    const settings = this.getSubEventAssignedAssetSettings(context.subEvent.id, type, {
      normalizeStore: false
    });
    const fallbackCards = context.origin === 'subEventResource'
      ? []
      : context.fallbackCardsByType[type] ?? [];
    const fallbackCardById = new Map(fallbackCards.map(card => [card.id, card] as const));

    return assignedIds
      .map(id => (
        this.ownedAssetCards().find(card => card.id === id && card.type === type)
        ?? fallbackCardById.get(id)
        ?? null
      ))
      .filter((card): card is ResourceAssetDTO => card !== null)
      .map(card => {
        const assignmentSettings = settings[card.id];
        const managerUserId = AppConstants.isAssetType(type)
          ? (`${assignmentSettings?.addedByUserId ?? ''}`.trim() || null)
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
          routes: this.assignedResourceCardRoutes(card, assignmentSettings),
          capacityTotal: this.assignedAssetOccupancyCapacityTotal(card, assignmentSettings),
          accepted: card.type === AppConstants.ASSET_TYPE_SUPPLIES
            ? this.subEventSupplyProvidedCount(card.id, context.subEvent.id)
            : this.assetAcceptedCount(card, context.subEvent.id, managerUserId),
          pending: this.assetPendingCount(card, context.subEvent.id, managerUserId),
          isMembers: false
        });
      });
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
    const settings = this.getSubEventAssignedAssetSettings(subEventId, type);
    const managerUserId = `${settings[assetId]?.addedByUserId ?? ''}`.trim();
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
      if (this.assetStore.applyAssetCards(nextCards, { mutation: true, reloadList: false })) {
        const ownerUserId = this.assetStore.activeOwnerUserIdRef().trim()
          || this.userProfileStore.getActiveUserId().trim();
        if (ownerUserId) {
          void this.assetsService.replaceOwnedAssets(ownerUserId, this.assetStore.assetCards());
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
    return !(AssetCardBuilder.assetPoliciesEnabled(sourceCard) ? sourceCard.policies ?? [] : [])
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
      if (this.assetStore.applyAssetCards(nextCards, { mutation: true, reloadList: false })) {
        const ownerUserId = this.assetStore.activeOwnerUserIdRef().trim()
          || this.userProfileStore.getActiveUserId().trim();
        if (ownerUserId) {
          void this.assetsService.replaceOwnedAssets(ownerUserId, this.assetStore.assetCards());
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

  openCapacityEditor(card: AppDTOs.SubEventResourceCardDTO, event: Event): void {
    event.stopPropagation();
    const context = this.resourcePopupStore.popupContextRef();
    if (
      !context
      || !card.sourceAssetId
    ) {
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
    const source = this.resolveSubEventAssignedAssetCard(editor.subEventId, editor.type, editor.assetId)
      ?? this.ownedAssetCards().find(item => item.id === editor.assetId && item.type === editor.type)
      ?? null;
    const current = nextSettings[editor.assetId] ?? {
      capacityMin: 0,
      capacityMax: editor.capacityLimit,
      quantity: this.normalizeAssignedRuntimeQuantity(undefined, source ? this.assignedRuntimeQuantityMax(source) : 1),
      addedByUserId: this.activeUser().id,
      routeEnabled: false,
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
    const quantityMax = source ? this.assignedRuntimeQuantityMax(source) : 1;
    const quantity = this.normalizeAssignedRuntimeQuantity(state.quantity, quantityMax);
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

    const savedState = await this.activityResourcesService.replaceSubEventResourceState(nextState, signal);
    const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
    this.applyPersistedPopupState(resolvedState);
    this.syncSubEventManualAssetRequests(context.subEvent, true);
    this.syncPopupSubEventMetrics({
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
    if (!context) {
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
      policies: (AssetCardBuilder.assetPoliciesEnabled(sourceCard) ? sourceCard.policies ?? [] : []).map(item => ({ ...item })),
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
    if (context.origin === 'subEventResource') {
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
    const capacityMax = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal)), 0);
    const capacityMin = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMin ?? 0), 0);
    const pending = type === AppConstants.ASSET_TYPE_SUPPLIES
      ? 0
      : cards.reduce((sum, card) => (
        sum + ActivityResourceBuilder.subEventOccupancyRequestCount(card, subEvent.id, 'pending')
      ), 0);
    if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
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
    options: boolean | {
      persistResourceState?: boolean;
      persistAssetRequests?: boolean;
      assignmentQuantityUpdates?: readonly SubEventResourceAssignmentQuantityUpdate[];
    } = false
  ): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const persistResourceState = typeof options === 'boolean' ? options : options.persistResourceState === true;
    const persistAssetRequests = typeof options === 'boolean' ? options : options.persistAssetRequests === true;
    const assignmentQuantityUpdates = typeof options === 'boolean' ? [] : [...(options.assignmentQuantityUpdates ?? [])];
    const nextSubEvent = this.cloneSubEvent(context.subEvent);
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
    if (metricsChanged || assignmentQuantityUpdates.length > 0) {
      this.resourcePopupStore.publishSubEventResourceMetrics(nextContext, { assignmentQuantityUpdates });
    }
    this.syncSubEventManualAssetRequests(nextContext.subEvent, persistAssetRequests);
    if (persistResourceState) {
      this.persistPopupResourceState(nextContext);
    }
  }

  private syncAssetRequestsFromMembers(
    assetId: string,
    assetType: AppConstants.AssetType,
    members: readonly ActivityContracts.ActivityMemberDTO[]
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
    if (this.assetStore.applyAssetCards(nextCards, { mutation: true, reloadList: false })) {
      const ownerUserId = this.assetStore.activeOwnerUserIdRef().trim()
        || this.userProfileStore.getActiveUserId().trim();
      if (ownerUserId) {
        void this.assetsService.replaceOwnedAssets(ownerUserId, this.assetStore.assetCards());
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
    subEventId?: string
  ): ActivityContracts.ActivityMemberDTO[] {
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
