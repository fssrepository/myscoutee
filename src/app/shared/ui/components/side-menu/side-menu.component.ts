import { ShareTokensService } from '../../../core/base/services/share-tokens.service';
import { GroupWorkspaceStore } from '../../context/stores/group-workspace.store';
import type { AppMenuPalette } from '../core/menu';
import { CommunityGroupsStore } from '../../context/stores/community-groups.store';
import { CommunityGroupsPopupComponent } from '../community-groups-popup/community-groups-popup.component';
import { ContentModerationStore } from '../../context/stores/content-moderation.store';
import { AdminNotificationsService } from '../../../core/base/services/admin-notifications.service';
import { ContentModerationService } from '../../../core/base/services/content-moderation.service';
import { PhotoFeedStore } from '../../context/stores/photo-feed.store';
import { PhotoFeedPopupComponent } from '../photo-feed-popup/photo-feed-popup.component';
import { ImageGalleryPopupComponent } from '../core/image-gallery/image-gallery-popup.component';
import { ImageGalleryStore } from '../../context/stores/image-gallery.store';
import { FollowingStore } from '../../context/stores/following.store';
import { backendUnavailable } from '../../../core/common/backend-connectivity';
import { AppSetupStore } from '../../context/stores/app-setup.store';
import { profileMenuBadgeCount } from '../../context/stores/app-context-store.utils';
import {
  CommonModule
} from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import {
  MatIconModule
} from '@angular/material/icon';
import {
  NavigationEnd,
  Router
} from '@angular/router';
import type { Subscription } from 'rxjs';
import type {
  ActivityCounters,
  ActivityCounterKey,
  AppMenuDragEvent,
  AppMenuDragPosition,
  AppMenuItem,
  AppMenuItemSelectEvent,
  AppMenuModel,
  AppMenuTrigger,
  AppMenuValueMap,
  HeaderCardModel,
  UserImpressionChangeFlags
} from '../..';
import { AppMenuComponent } from '../core/menu/menu.component';
import { HeaderCardComponent } from '../core/smart-list/card/header-card/header-card.component';
import { UiPollCoordinator } from '../../scheduler/ui-poll-coordinator';
import { UiTaskScheduler } from '../../scheduler/ui-task-scheduler';
import { ProfileHeaderCardConverter } from '../../converters/profile-header-card.converter';
import {
  cloneEventCounters,
  cloneSupportCaseCounters
} from '../../context/stores/app-context-store.utils';
import {
  AppUtils
} from '../../../app-utils';
import {
  AssetPopupStore
} from '../../context/stores/asset-popup.store';
import {
  ActivitiesPopupStore,
  eventChatHeaderStateFromChat,
  eventChatPopupRequestFromChat
} from '../../context/stores/activities-popup.store';
import {
  EventEditorPopupStore
} from '../../context/stores/event-editor-popup.store';
import {
  AssetStore
} from '../../context/stores/asset.store';
import {
  SubEventResourcePopupStore
} from '../../context/stores/sub-event-resource-popup.store';
import { ExplanationGuideService } from '../../../core/base/services/explanation-guide.service';
import { DeploymentConfigurationService } from '../../../core/base/services/deployment-configuration.service';
import { HelpCenterService } from '../../../core/base/services/help-center.service';
import { I18nService } from '../../../core/base/services/i18n.service';
import { PrivacyPolicyService } from '../../../core/base/services/privacy-policy.service';
import { SessionService } from '../../../core/base/services/session.service';
import { ChatsService } from '../../../core/base/services/chats.service';
import { TermsPolicyService } from '../../../core/base/services/terms-policy.service';
import {
  UsersService,
  USER_BY_ID_LOAD_CONTEXT_KEY,
  USER_PROFILE_SAVE_CONTEXT_KEY
} from '../../../core/base/services/users.service';
import type { HelpCenterRevisionDto, PrivacyConsentDto, UserDto } from '../../../core';
import {
  USER_LOGOUT_CONTEXT_KEY
} from '../../../core/base/services/users.service';
import * as AppConstants from '../../../core/common/constants';
import {
  DialogComponent
} from '../core/dialog/dialog.component';
import {
  ProfileSettingsPopupsComponent
} from '../../../../profile/components/settings-popups/settings-popups.component';
import {
  ProfileStore,
  type ProfileBindings
} from '../../context/stores/profile.store';
import {
  resolveSideMenuPresentation,
  navigatorContentMenuModel,
  navigatorTableMenuModel
} from './side-menu-presenters';
import {
  DialogStore
} from '../../context/stores/dialog.store';
import {
  APP_STORAGE_KEYS
} from '../../../core/common/storage-scope';
import { UserProfileStore } from '../../context/stores/user-profile.store';
import { AppRuntimeStore } from '../../context/stores/app-runtime.store';
import { ActivityStore } from '../../context/stores/activity.store';
import { MemberMenuStore } from '../../context/stores/member-menu.store';
import { ActivityInvitePopupStore } from '../../context/stores/activity-invite-popup.store';
import { AdminMenuStore } from '../../context/stores/admin-menu.store';
import { AdminWorkspaceStore } from '../../context/stores/admin-workspace.store';
import {
  OperatorMenuStore
} from '../../context/stores/operator-menu.store';
import { isNavigatorHydrationRoute } from './navigator-hydration-route';
import { hasOperatorRole } from '../../../core/common/user-role';
import { shouldApplyUserRealtimeDomainSnapshot } from './user-realtime-popup-policy';
import { NotificationCenterStore } from '../../context/stores/notification-center.store';
import { PopupPresenceStore } from '../../context/stores/popup-presence.store';
import { PaymentMethodsPopupStore } from '../../context/stores/payment-methods-popup.store';
import { PwaService } from '../../../core/base/services/pwa.service';
import { PopupComponent } from '../core/popup/popup.component';
import type { PopupModel } from '../core/popup';
import { IndicatorComponent } from '../core/indicator/indicator.component';
import { I18nPipe } from '../../pipes/i18n.pipe';
import { installSessionActiveUserSync } from './session-active-user-sync';
import { MingleStore } from '../../context/stores/mingle.store';
import { environment } from '../../../../../environments/environment';
import {
  NotificationCenterPopupComponent
} from '../notification-center-popup/notification-center-popup.component';

interface NavigatorAvatarState {
  badgeCount: number;
  imageUrl: string | null;
}

interface SideMenuUiState {
  open: boolean;
}

interface AdminNavigatorBadgeActivities {
  chat?: {
    supportCases?: {
      pending?: number | null;
      warned?: number | null;
      picked?: number | null;
      blocked?: number | null;
    } | null;
  } | null;
  adminJobs: number;
  adminMetrics: number;
}

type NavigatorAvatarMenuItemId = 'navigator-avatar';
type NavigatorAvatarMenuContext = { kind: 'toggle-menu' };
type NavigatorOperatorCommunityMenuItemId = 'operator-community';
type NotificationAttentionMenuItemId = 'notification-attention';
interface NavigatorMenuUser extends UserDto {
  activities: ActivityCounters;
  impressionChangeFlags: UserImpressionChangeFlags;
  memberImpressionTitle: string;
}

type NavigatorMenuShortcutId =
  | 'impressions'
  | 'feedback'
  | 'rates'
  | 'chat'
  | 'invitations'
  | 'events'
  | 'payment-history'
  | 'transport'
  | 'accommodation'
  | 'supplies'
  | 'tickets'
  | 'contacts';

type NavigatorAdminMenuShortcutId =
  | 'adminModeration'
  | 'adminReports'
  | 'adminFeedback'
  | 'adminChat'
  | 'adminJobs'
  | 'adminParams'
  | 'adminPaymentSimulator'
  | 'adminPaymentAuthorizations'
  | 'adminContent'
  | 'adminArticle'
  | 'adminStats'
  | 'adminMetrics'
  | 'adminGraph';

type NavigatorSettingsMenuItemId =
  | 'permissions'
  | 'help'
  | 'feedback'
  | 'report-bugs'
  | 'privacy'
  | 'terms'
  | 'delete-account'
  | 'logout';

type NavigatorHeaderActionMenuItemId =
  | 'notifications'
  | 'explanations'
  | 'share'
  | 'settings'
  | NavigatorSettingsMenuItemId;

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [
    ImageGalleryPopupComponent,
    PhotoFeedPopupComponent,
    CommunityGroupsPopupComponent,
    CommonModule,
    MatIconModule,
    AppMenuComponent,
    HeaderCardComponent,
    ProfileSettingsPopupsComponent,
    DialogComponent,
    NotificationCenterPopupComponent,
    PopupComponent,
    IndicatorComponent,
    I18nPipe
  ],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss'
})
export class SideMenuComponent implements OnDestroy {
  protected readonly moderationStore = inject(ContentModerationStore);
  private readonly moderationService = inject(ContentModerationService);
  private readonly adminNotificationsService = inject(AdminNotificationsService);
  protected readonly followingStore = inject(FollowingStore);
  protected openFollowedEvents(event: Event): void {
    event.stopPropagation();
    this.memberMenuStore.requestActivitiesNavigation({ type: 'eventExplore', followedOnly: true });
  }

  private static readonly ACCOUNT_REACTIVATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  private static readonly ADMIN_SESSION_STORAGE_KEY = APP_STORAGE_KEYS.adminSession;
  private static readonly USER_MENU_LOAD_DURATION_MS = 3000;
  private static readonly NOTIFICATION_DRAG_ACTIVATION_DELAY_MS = 350;
  private static readonly NOTIFICATION_DISMISS_TARGET_PADDING_PX = 10;

  @ViewChild('notificationDismissTarget')
  private notificationDismissTargetRef?: ElementRef<HTMLElement>;

  private readonly router = inject(Router);
  private readonly userProfileStore = inject(UserProfileStore);
  protected readonly runtimeStore = inject(AppRuntimeStore);
  private readonly activityStore = inject(ActivityStore);
  protected readonly memberMenuStore = inject(MemberMenuStore);
  private readonly sharedLinks = inject(ShareTokensService);
  protected readonly activityInviteStore = inject(ActivityInvitePopupStore);
  private readonly adminMenuStore = inject(AdminMenuStore);
  private readonly adminWorkspaceStore = inject(AdminWorkspaceStore);
  private readonly operatorMenuStore = inject(OperatorMenuStore);
  private readonly injector = inject(Injector);
  private readonly deploymentConfiguration = inject(DeploymentConfigurationService);
  protected readonly deploymentBranding = this.deploymentConfiguration.branding;
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly helpCenterService = inject(HelpCenterService);
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  private readonly termsPolicy = inject(TermsPolicyService);
  private readonly i18n = inject(I18nService);
  protected readonly pwaService = inject(PwaService);
  protected readonly mingleStore = inject(MingleStore);
  private readonly appSetupStore = inject(AppSetupStore);
  protected openAppSetup(): void {
    this.appSetupStore.open();
  }
  protected openCurrentMingleTable(event?: Event): void {
    event?.stopPropagation();
    void this.mingleStore.openCurrentTable();
  }
  protected readonly mingleTableLabel = computed(() => {
    this.i18n.revision();
    const tableNumber = this.mingleStore.state()?.tableNumber;
    return tableNumber == null
      ? this.i18n.translate('mingle.tables')
      : this.i18n.translateParams('mingle.table.number', { number: tableNumber });
  });
  protected readonly navigatorTableMenuModel = computed(() =>
    navigatorTableMenuModel(this.mingleTableLabel(), this.mingleStore.attention()));
  private readonly usersService = inject(UsersService);
  private readonly sessionService = inject(SessionService);
  private readonly chatsService = inject(ChatsService);
  private readonly dialogStore = inject(DialogStore);
  protected readonly groupWorkspaces = inject(GroupWorkspaceStore);
  protected readonly workspaceTrigger = computed<AppMenuTrigger>(() => {
    const workspace = this.groupWorkspaces.context.active();
    return { label: workspace?.name ?? 'groups.workspace.main', ariaLabel: 'groups.workspace.select',
      icon: workspace ? '' : 'public', rotateIcon: false,
      imageFallback: workspace ? AppUtils.initialsFromText(workspace.name) : '',
      imageShape: 'circle',
      palette: workspace ? this.groupWorkspaces.palette(workspace.groupId) : 'green',
      layout: 'pill', disabled: ['idle', 'loading'].includes(this.activeUserLoadState().status) };
  });
  protected readonly workspaceItems = computed(() => this.groupWorkspaces.menuItems(this.groupWorkspaces.context.active()?.groupId ?? 'main'));
  protected selectWorkspace(event: AppMenuItemSelectEvent): void {
    void this.groupWorkspaces.select(event.id === 'main' ? null : event.id);
  }
  protected readonly notificationCenterStore = inject(NotificationCenterStore);
  protected readonly popupPresenceStore = inject(PopupPresenceStore);
  protected readonly paymentMethodsPopupStore = inject(PaymentMethodsPopupStore);
  private readonly pollCoordinator = inject(UiPollCoordinator);
  protected readonly profileStore = inject(ProfileStore);
  protected readonly profileEditorLoadingModel: PopupModel = {
    title: 'Profile', ariaLabel: 'Profile', size: 'wide', height: 'full', bodyLayout: 'fill',
    onClose: () => this.profileStore.closeProfileEditor()
  };
  protected readonly activitiesStore = inject(ActivitiesPopupStore);
  protected readonly assetPopupStore = inject(AssetPopupStore);
  private readonly assetStore = inject(AssetStore);
  protected readonly communityGroups = inject(CommunityGroupsStore);
  protected readonly navigatorGroupsMenuModel = computed(() => navigatorContentMenuModel('groups',
    this.communityGroups.counters().hosting + this.communityGroups.counters().participation));
  protected readonly photoFeedStore = inject(PhotoFeedStore);
  protected readonly navigatorFeedMenuModel = computed(() =>
    navigatorContentMenuModel('feed', this.photoFeedStore.count()));
  protected readonly navigatorFollowedMenuModel = computed(() =>
    navigatorContentMenuModel('followed', this.followingStore.state().eventCount));
  protected readonly navigatorCommunityMenuModel = computed<AppMenuModel>(() => ({
    nodes: [{
      id: 'community', label: 'navigator.community', icon: 'diversity_2', palette: 'lime',
      items: [
        ...(this.mingleStore.visible() ? [this.navigatorTableMenuModel()] : []),
        this.navigatorFeedMenuModel(), this.navigatorFollowedMenuModel(), this.navigatorGroupsMenuModel()
      ].flatMap(model => model.nodes?.flatMap(node => node.items ?? []) ?? [])
    }]
  }));
  protected readonly imageGalleryStore = inject(ImageGalleryStore);
  protected readonly eventEditorStore = inject(EventEditorPopupStore);
  protected readonly subEventResourceStore = inject(SubEventResourcePopupStore);
  protected readonly stackedEventChatPopupInputs = computed(() => ({
    chatSession: this.activitiesStore.stackedEventChatSession(),
    chatHeader: this.activitiesStore.stackedEventChatHeader(),
    closeHostedChat: () => this.activitiesStore.closeStackedEventChat()
  }));
  private readonly notificationRouteUrl = signal(this.router.url);
  private openingNotificationChat = '';
  private openingNotificationMingleTable = '';
  private openingPartnerInvite = '';
  private readonly currentRoutePathRef = signal(AppUtils.normalizeRoutePath(this.router.url));
  private readonly menuOpenRef = signal(false);
  private readonly notificationDismissDraggingRef = signal(false);
  private readonly notificationDismissTargetedRef = signal(false);
  private readonly userMenuLoadOverdueRef = signal(false);
  private readonly activeUserLoadState = this.runtimeStore.selectLoadingState(USER_BY_ID_LOAD_CONTEXT_KEY);
  private readonly profileSaveLoadState = this.runtimeStore.selectLoadingState(USER_PROFILE_SAVE_CONTEXT_KEY);
  private readonly userLogoutLoadState = this.runtimeStore.selectLoadingState(USER_LOGOUT_CONTEXT_KEY);
  private readonly routerEventsSubscription: Subscription;
  private readonly hydrationRequestKeyRef = signal('');
  private readonly privacyConsentCheckKeyRef = signal('');
  private readonly profileBindings: ProfileBindings = {};
  private lastHandledActivitiesRequestMs = 0;
  private lastHandledAssetRequestMs = 0;
  private lastHandledEventFeedbackRequestMs = 0;
  private hydrationRequestVersion = 0;
  private realtimePollingUserId = '';
  private readonly userRealtimeScheduler = new UiTaskScheduler<string>({
    intervalMs: () => this.userRealtimePollIntervalMs(),
    state: () => this.userProfileStore.activeUserId().trim(),
    task: ({ state, signal }) => this.runUserRealtimeLongPollTick(state, signal),
    pollCoordinator: this.pollCoordinator,
    pollPriority: 'notification'
  });
  private reactivationPromptUserId = '';
  private privacyConsentCheckToken = 0;
  private userMenuLoadOverdueTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly avatarState = computed<NavigatorAvatarState>(() => {
    const user = this.userProfileStore.activeUserProfile();
    const session = this.sessionService.currentSession();
    const profileImage = AppUtils.firstImageUrl(user?.images);
    const previewMatches = session?.kind === 'firebase'
      && (!this.canToggleAvatarMenu() || session.avatarImageUrl === profileImage);
    const previewImage = previewMatches
      ? session.avatarImageDataUrl ?? session.avatarImageUrl
      : undefined;
    return {
      badgeCount: user ? this.resolveUserBadgeCount(user) : 0,
      imageUrl: AppUtils.mediaImageVariantUrl(previewImage ?? profileImage, 'small') || null
    };
  });
  protected readonly menuUiState = computed<SideMenuUiState>(() => ({
    open: this.menuOpenRef()
  }));
  protected readonly notificationDismissDragging = this.notificationDismissDraggingRef.asReadonly();
  protected readonly notificationDismissTargeted = this.notificationDismissTargetedRef.asReadonly();
  protected readonly notificationDragActivationDelayMs =
    SideMenuComponent.NOTIFICATION_DRAG_ACTIVATION_DELAY_MS;
  protected readonly isCoveredByAssetPopup = computed(() =>
    this.assetPopupStore.visible()
    || this.activityInviteStore.activityInvitePopup() !== null
    || this.activityInviteStore.externalInvite() !== null
  );
  protected readonly avatarVisible = computed(() => {
    const path = this.currentRoutePathRef();
    const activeUserId = this.userProfileStore.activeUserId().trim();
    return Boolean(activeUserId) && path !== '/' && !path.startsWith('/entry');
  });
  protected readonly hasBindings = computed(() => this.profileStore.bindings() !== null);
  protected readonly isMenuOpen = computed(() => this.menuUiState().open);
  protected readonly hasOfflineProfile = computed(() =>
    this.connectionOffline() && this.userProfileStore.activeUserProfile() !== null
  );
  protected readonly canToggleAvatarMenu = computed(() =>
    this.avatarVisible()
    && this.hasBindings()
    && (this.activeUserLoadState().status === 'success' || this.hasOfflineProfile())
  );
  protected readonly isProfileSaving = computed(() => this.profileSaveLoadState().status === 'loading');
  protected readonly hasProfileSaveError = computed(() => {
    const status = this.profileSaveLoadState().status;
    return status === 'error' || status === 'timeout';
  });
  protected readonly isLoggingOut = computed(() => this.userLogoutLoadState().status === 'loading');
  protected readonly isAvatarRingLoading = computed(() => this.isProfileSaving() || this.isLoggingOut());
  protected readonly showProfileSaveRing = computed(() => this.isAvatarRingLoading() || this.hasProfileSaveError());
  protected readonly profileSaveAvatarTitle = computed(() => {
    if (this.isLoggingOut()) {
      return 'Logging out';
    }
    if (this.isProfileSaving()) {
      return 'Saving profile';
    }
    if (this.hasProfileSaveError()) {
      return this.profileSaveLoadState().status === 'timeout'
        ? 'Profile save timed out'
        : 'Profile was not able to save';
    }
    return null;
  });
  protected readonly avatarLoading = computed(() => {
    if (!this.avatarVisible()) {
      return false;
    }
    if (!this.hasBindings()) {
      return true;
    }
    if (this.hasOfflineProfile()) {
      return this.isProfileSaving();
    }
    const status = this.activeUserLoadState().status;
    return status === 'idle' || status === 'loading' || this.isProfileSaving();
  });
  protected readonly avatarLoadError = computed(() => {
    if (!this.avatarVisible() || !this.hasBindings()) {
      return false;
    }
    if (this.hasOfflineProfile()) {
      return this.hasProfileSaveError();
    }
    const status = this.activeUserLoadState().status;
    return status === 'error' || status === 'timeout' || this.userMenuLoadOverdueRef() || this.hasProfileSaveError();
  });
  protected readonly showAvatarLoadRing = computed(() =>
    this.avatarVisible() && (this.groupWorkspaces.context.switching() || !this.canToggleAvatarMenu() || this.isProfileSaving() || this.hasProfileSaveError())
  );
  protected readonly avatarBadgeCount = computed(() =>
    this.canToggleAvatarMenu() ? this.avatarState().badgeCount : 0
  );
  protected readonly avatarAriaLabel = computed(() => {
    if (this.canToggleAvatarMenu() && this.isProfileSaving()) {
      return 'Saving profile';
    }
    if (this.canToggleAvatarMenu() && this.hasProfileSaveError()) {
      return 'Profile save failed';
    }
    if (this.canToggleAvatarMenu()) {
      return this.isMenuOpen() ? 'Close user menu' : 'Open user menu';
    }
    if (this.avatarLoadError()) {
      return 'Profile failed to load';
    }
    return 'Loading profile';
  });
  protected readonly avatarMenuItems = computed<readonly AppMenuItem<NavigatorAvatarMenuItemId, NavigatorAvatarMenuContext>[]>(() => {
    const user = this.userProfileStore.activeUserProfile();
    const canToggle = this.canToggleAvatarMenu();
    const imageUrl = this.avatarState().imageUrl ?? '';
    const icon = this.avatarLoading() ? 'schedule' : this.avatarLoadError() ? 'person_off' : '';
    const badgeCount = this.avatarBadgeCount();
    return [{
      id: 'navigator-avatar',
      kind: 'action',
      layout: 'image',
      palette: canToggle && user?.gender === 'man' ? 'blue' : canToggle ? 'pink' : 'neutral',
      imageUrl,
      imageAlt: this.avatarAriaLabel(),
      imageFallback: !imageUrl && canToggle ? user?.initials ?? '' : '',
      icon,
      ariaLabel: this.avatarAriaLabel(),
      disabled: !canToggle,
      counter: canToggle && badgeCount > 0 ? { value: badgeCount, max: 9 } : null,
      progress: this.showAvatarLoadRing()
        ? {
            state: this.avatarLoadError() ? 'error' : 'loading',
            shape: 'circle',
            durationMs: SideMenuComponent.USER_MENU_LOAD_DURATION_MS
          }
        : null,
      context: { kind: 'toggle-menu' }
    }];
  });
  protected readonly operatorCommunityMenuModel = computed<
    AppMenuModel<NavigatorOperatorCommunityMenuItemId>
  >(() => ({
    layout: 'grid',
    density: 'compact',
    groups: [{
      id: 'operator-community-launcher',
      items: [{
        id: 'operator-community',
        label: 'operator.community',
        icon: 'forum',
        palette: 'teal',
        active: this.operatorMenuStore.activePopup() === 'community',
        disabled: !this.canToggleAvatarMenu(),
        ariaLabel: 'operator.community.open'
      }]
    }]
  }));
  private readonly offlineAttentionDismissed = signal(false);
  protected readonly connectionOffline = computed(() => !this.runtimeStore.isOnline() || backendUnavailable());
  private readonly serverActionsUnavailable = computed(() => this.groupWorkspaces.context.switching() || !this.runtimeStore.isDataSourceAvailable()
    || this.userProfileStore.activeUserLocationMissing()
    || (environment.activitiesDataSource === 'http' && backendUnavailable()));
  protected readonly notificationAttentionVisible = computed(() =>
    !this.userProfileStore.activeUserLocationMissing()
      && (this.notificationCenterStore.attentionVisible() || (this.connectionOffline()
        && !this.offlineAttentionDismissed() && !this.notificationCenterStore.isOpen()))
  );
  protected readonly notificationAttentionTrigger = computed<AppMenuTrigger>(() => {
    const unreadCount = this.notificationCenterStore.unreadCount();
    const offline = this.connectionOffline();
    return {
      id: 'notification-attention',
      icon: offline ? 'cloud_off' : 'notifications_active',
      palette: offline ? 'offline' : 'violet',
      action: 'custom',
      hideLabel: true,
      counter: unreadCount > 0 ? { value: unreadCount, max: 99 } : null,
      ariaLabel: this.notificationLauncherAriaLabel(unreadCount, false) + (offline ? ' — Offline' : '')
    };
  });
  protected readonly menuUser = computed<NavigatorMenuUser | null>(() => {
    const activeUser = this.userProfileStore.activeUserProfile();
    if (!activeUser) {
      return null;
    }
    const activityOverrides = this.activityStore.getUserCounterOverrides(activeUser.id);
    const eventCounters = activityOverrides.event ?? activeUser.activities?.event;
    const mergedActivities: ActivityCounters = {
      game: activityOverrides.game ?? activeUser.activities?.game ?? 0,
      chats: activityOverrides.chats ?? activeUser.activities?.chats ?? 0,
      invitations: activityOverrides.invitations ?? activeUser.activities?.invitations ?? 0,
      events: activityOverrides.events ?? activeUser.activities?.events ?? 0,
      hosting: activityOverrides.hosting ?? activeUser.activities?.hosting ?? 0,
      cars: activityOverrides.cars ?? activeUser.activities?.cars ?? 0,
      accommodation: activityOverrides.accommodation ?? activeUser.activities?.accommodation ?? 0,
      supplies: activityOverrides.supplies ?? activeUser.activities?.supplies ?? 0,
      tickets: activityOverrides.tickets ?? activeUser.activities?.tickets ?? 0,
      contacts: activityOverrides.contacts ?? activeUser.activities?.contacts ?? 0,
      contactRequestsPending: activityOverrides.contactRequestsPending ?? activeUser.activities?.contactRequestsPending ?? 0,
      feedback: activityOverrides.feedback ?? activeUser.activities?.feedback ?? 0,
      notifications: activityOverrides.notifications ?? activeUser.activities?.notifications ?? 0,
      paymentRefundsPending: activityOverrides.paymentRefundsPending ?? activeUser.activities?.paymentRefundsPending ?? 0,
      chat: {
        all: activityOverrides.chat?.all ?? activeUser.activities?.chat?.all ?? 0,
        event: activityOverrides.chat?.event ?? activeUser.activities?.chat?.event ?? 0,
        subEvent: activityOverrides.chat?.subEvent ?? activeUser.activities?.chat?.subEvent ?? 0,
        group: activityOverrides.chat?.group ?? activeUser.activities?.chat?.group ?? 0,
        service: activityOverrides.chat?.service ?? activeUser.activities?.chat?.service ?? 0,
        appSupport: activityOverrides.chat?.appSupport ?? activeUser.activities?.chat?.appSupport ?? 0,
        contacts: activityOverrides.chat?.contacts ?? activeUser.activities?.chat?.contacts ?? 0,
        groupSupport: activityOverrides.chat?.groupSupport ?? activeUser.activities?.chat?.groupSupport ?? 0,
        supportCases: cloneSupportCaseCounters(
          activityOverrides.chat?.supportCases ?? activeUser.activities?.chat?.supportCases
        )
      },
      ...(eventCounters ? { event: cloneEventCounters(eventCounters) } : {}),
      adminJobs: activityOverrides.adminJobs ?? activeUser.activities?.adminJobs ?? 0,
      adminMetrics: activityOverrides.adminMetrics ?? activeUser.activities?.adminMetrics ?? 0
    };
    const impressionChangeFlags = this.userProfileStore.getUserImpressionChangeFlags(activeUser.id);
    const traitPresentation = resolveSideMenuPresentation('trait', activeUser.traitLabel ?? '');
    return {
      ...activeUser,
      completion: this.resolveCompletionPercent(activeUser),
      impressions: this.userProfileStore.getUserImpressions(activeUser.id) ?? activeUser.impressions,
      activities: mergedActivities,
      impressionChangeFlags,
      memberImpressionTitle: traitPresentation.memberTitle ?? 'Attendee'
    };
  });
  protected readonly settingsMenuItems = computed<readonly AppMenuItem<NavigatorHeaderActionMenuItemId>[]>(() => {
    const items: AppMenuItem<NavigatorHeaderActionMenuItemId>[] = [];
    if (!this.isPrivilegedWorkspaceMode()) {
      items.push({
        id: 'permissions',
        label: 'install.app',
        icon: 'install_desktop',
        ariaLabel: 'install.app'
      });
    }
    items.push({
      id: 'help',
      label: 'Help',
      icon: 'help_outline',
      counter: this.helpCenterService.activeVersionLabel(),
      disabled: !this.helpCenterService.hasActiveRevision(),
      ariaLabel: 'Open help'
    });
    if (!this.isPrivilegedWorkspaceMode()) {
      items.push({
        id: 'feedback',
        label: 'Send Feedback',
        icon: 'feedback',
        ariaLabel: 'Send feedback'
      });
    }
    items.push(
      {
        id: 'report-bugs',
        label: 'Report Bugs',
        icon: 'bug_report',
        href: 'https://github.com/fssrepository/myscoutee/issues',
        target: '_blank',
        rel: 'noopener noreferrer',
        ariaLabel: 'Report bugs'
      },
      {
        id: 'privacy',
        label: 'Privacy',
        icon: 'policy',
        counter: this.privacyPolicy.activeVersionLabel(),
        ariaLabel: 'Open privacy'
      },
      {
        id: 'terms',
        label: 'Terms',
        icon: 'rule',
        counter: this.termsPolicy.activeVersionLabel(),
        ariaLabel: 'Open terms'
      }
    );
    if (!this.isPrivilegedWorkspaceMode()) {
      items.push({
        id: 'delete-account',
        label: 'Delete account',
        icon: 'delete_forever',
        palette: 'danger',
        ariaLabel: 'Delete account'
      });
    }
    items.push({
      id: 'logout',
      label: 'Logout',
      icon: 'logout',
      ariaLabel: 'Logout'
    });
    return items;
  });
  private readonly accountLocationMissing = computed(() => {
    const user = this.userProfileStore.getUserProfile(this.groupWorkspaces.context.accountId(this.userProfileStore.activeUserId()));
    return !!user && !this.isPrivilegedWorkspaceMode() && (!Number.isFinite(user.locationCoordinates?.latitude) || !Number.isFinite(user.locationCoordinates?.longitude));
  });
  protected readonly navigatorHeaderActionMenuModel = computed<AppMenuModel<NavigatorHeaderActionMenuItemId>>(() => {
    const notificationCount = this.notificationCenterStore.unreadCount();
    const notificationsMuted = this.notificationCenterStore.muted();
    const items: AppMenuItem<NavigatorHeaderActionMenuItemId>[] = [];
    if (!this.isOperatorMode()) {
      items.push({
        id: 'notifications',
        label: 'Notifications',
        disabled: this.notificationCenterStore.permissionActionPending() || this.accountLocationMissing(),
        progress: { state: this.notificationCenterStore.permissionBusy() ? 'loading' : null },
        icon: this.connectionOffline() ? 'cloud_off' : this.accountLocationMissing() || notificationsMuted ? 'notifications_off' : 'notifications',
        palette: this.connectionOffline() ? 'offline' : this.accountLocationMissing() || notificationsMuted ? 'slate' : notificationCount > 0 ? 'violet' : 'neutral',
        counter: notificationCount > 0 ? { value: notificationCount, max: 99 } : null,
        counterTone: 'alert',
        ariaLabel: this.notificationLauncherAriaLabel(
          notificationCount,
          notificationsMuted
        ) + (this.connectionOffline() ? ' — Offline' : this.accountLocationMissing()
          ? ' — ' + this.i18n.translate('game.location.required.title') : '')
      });
    }
    if (!this.isPrivilegedWorkspaceMode()) {
      items.push(
        {
          id: 'explanations',
          label: 'Explanations',
          icon: 'tips_and_updates',
          kind: 'toggle',
          checked: this.explanationGuide.enabled(),
          ariaLabel: this.explanationGuide.enabled() ? 'Turn explanations off' : 'Turn explanations on'
        },
        {
          id: 'share',
          label: `Share ${this.deploymentBranding().productName}`,
          icon: 'share',
          ariaLabel: `Share ${this.deploymentBranding().productName}`
        }
      );
    }
    items.push({
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      ariaLabel: this.isOperatorMode()
        ? 'Open operator settings menu'
        : this.isAdminMode()
          ? 'Open admin settings menu'
          : 'Open settings menu',
      items: this.settingsMenuItems()
    });
    return {
      nodes: [
        {
          id: 'navigator-header-actions',
          items
        }
      ]
    };
  });
  protected readonly navigatorMenuValues = computed<AppMenuValueMap<NavigatorMenuShortcutId>>(() => {
    const user = this.menuUser();
    if (!user) {
      return {};
    }
    return {
      impressions: this.impressionShortcutBadgeCount(user),
      feedback: user.activities.feedback,
      rates: user.activities.game,
      chat: user.activities.chats,
      invitations: user.activities.invitations,
      events: user.activities.event?.all ?? 0,
      transport: user.activities.cars,
      accommodation: user.activities.accommodation,
      supplies: user.activities.supplies,
      tickets: user.activities.tickets,
      contacts: user.activities.contactRequestsPending ?? 0
    };
  });
  protected readonly adminNavigatorMenuValues = computed<AppMenuValueMap<NavigatorAdminMenuShortcutId>>(() => {
    const user = this.menuUser();
    if (!user) {
      return {};
    }
    const reviewCounts = this.adminWorkspaceStore.menuReviewCounts();
    return {
      adminModeration: this.moderationStore.snapshot()?.pendingCount ?? 0,
      adminReports: reviewCounts.reports,
      adminFeedback: reviewCounts.feedback,
      adminChat: this.adminSupportCaseMenuCount(user.activities.chat),
      adminJobs: user.activities.adminJobs,
      adminMetrics: user.activities.adminMetrics
    };
  });

  private adminSupportCaseMenuCount(chat: AdminNavigatorBadgeActivities['chat']): number {
    const counters = chat?.supportCases;
    const count = (value: unknown): number => Math.max(0, Math.trunc(Number(value) || 0));
    return count(counters?.pending)
      + count(counters?.warned)
      + count(counters?.picked)
      + count(counters?.blocked);
  }

  private adminNavigatorBadgeCount(
    activities: AdminNavigatorBadgeActivities
  ): number {
    const reviewCounts = this.adminWorkspaceStore.menuReviewCounts();
    return reviewCounts.reports
      + reviewCounts.feedback
      + this.adminSupportCaseMenuCount(activities.chat)
      + activities.adminJobs
      + activities.adminMetrics;
  }

  protected readonly navigatorMenuModel = computed<AppMenuModel<NavigatorMenuShortcutId>>(() => {
    const user = this.menuUser();
    if (!user) {
      return { nodes: [] };
    }
    const hostTierPresentation = resolveSideMenuPresentation('hostTier', user.hostTier);
    const traitPresentation = resolveSideMenuPresentation('trait', user.traitLabel);
    const primaryDisabled = this.isPrimaryMenuDisabled(user);
    return {
      nodes: [
        {
          id: 'impressions',
          label: 'Impressions',
          icon: 'psychology',
          palette: 'violet',
          items: [
            {
              id: 'impressions',
              span: 4,
              ariaLabel: 'Open impressions',
              disabled: primaryDisabled,
              segments: [
                {
                  id: 'host',
                  label: user.hostTier.replace(' Host', ''),
                  description: 'Host',
                  icon: hostTierPresentation.icon,
                  palette: hostTierPresentation.menuPalette
                },
                {
                  id: 'member',
                  label: user.memberImpressionTitle.replace(' Attendee', ''),
                  description: 'Attendee',
                  icon: traitPresentation.icon,
                  palette: traitPresentation.menuPalette
                }
              ]
            },
            {
              id: 'feedback',
              label: 'Feedback',
              icon: 'rate_review',
              palette: 'purple',
              ariaLabel: 'Open feedback',
              disabled: primaryDisabled
            }
          ]
        },
        {
          id: 'activities',
          label: 'Activities',
          icon: 'local_activity',
          palette: 'blue',
          items: [
            {
              id: 'rates',
              label: 'Rates',
              icon: 'star',
              palette: 'gold',
              ariaLabel: 'Open rates',
              disabled: primaryDisabled
            },
            {
              id: 'chat',
              label: 'Chats',
              icon: 'chat',
              palette: 'blue',
              ariaLabel: 'Open chat',
              disabled: this.serverActionsUnavailable()
            },
            {
              id: 'invitations',
              label: 'Invitations',
              icon: 'mail',
              palette: 'purple',
              ariaLabel: 'Open invitations',
              disabled: primaryDisabled
            },
            {
              id: 'events',
              label: 'Events',
              icon: 'event',
              palette: 'blue',
              ariaLabel: 'Open events',
              disabled: primaryDisabled
            },
            {
              id: 'payment-history',
              label: 'payment.history.menu',
              icon: 'receipt_long',
              palette: 'green',
              counter: this.menuUser()?.activities?.paymentRefundsPending || undefined,
              ariaLabel: 'payment.history.open',
              disabled: primaryDisabled
            }
          ]
        },
        {
          id: 'assets',
          label: 'My Assets',
          icon: 'inventory_2',
          palette: 'brown',
          items: [
            {
              id: 'transport',
              label: AppConstants.ASSET_TYPE_TRANSPORT,
              icon: 'directions_car',
              palette: 'blue',
              ariaLabel: AppConstants.ASSET_TYPE_TRANSPORT,
              disabled: primaryDisabled
            },
            {
              id: 'accommodation',
              label: AppConstants.ASSET_TYPE_ACCOMMODATION,
              icon: 'apartment',
              palette: 'green',
              ariaLabel: AppConstants.ASSET_TYPE_ACCOMMODATION,
              disabled: primaryDisabled
            },
            {
              id: 'supplies',
              label: AppConstants.ASSET_TYPE_SUPPLIES,
              icon: 'inventory_2',
              palette: 'brown',
              ariaLabel: AppConstants.ASSET_TYPE_SUPPLIES,
              disabled: primaryDisabled
            },
            {
              id: 'tickets',
              label: AppConstants.ASSET_FILTER_TICKET,
              icon: 'qr_code_2',
              palette: 'blue',
              ariaLabel: AppConstants.ASSET_FILTER_TICKET,
              disabled: this.isBlockedUser(user)
            },
            {
              id: 'contacts',
              counter: user.activities.contactRequestsPending || undefined,
              counterTone: 'alert',
              label: 'Contacts',
              icon: 'contacts',
              palette: 'teal',
              ariaLabel: 'Contacts',
              disabled: primaryDisabled
            }
          ]
        }
      ]
    };
  });
  protected readonly adminNavigatorMenuModel = computed<AppMenuModel<NavigatorAdminMenuShortcutId>>(() => {
    const disabled = this.serverActionsUnavailable();
    const paymentSimulatorConfigUrl = `${environment.paymentSimulatorConfigUrl ?? ''}`.trim();
    const activeSession = this.sessionService.session();
    const activeUserId = activeSession?.kind === 'demo'
      ? activeSession.userId.trim()
      : '';
    const showPaymentSimulator = activeUserId.startsWith('admin-demo-');
    return {
      nodes: [
        {
          id: 'admin-moderation',
          label: 'Moderation & support',
          icon: 'admin_panel_settings',
          palette: 'orange',
          items: [
            {
              id: 'adminModeration', label: 'moderation.title', icon: 'fact_check', palette: 'teal', ariaLabel: 'moderation.title', disabled
            },
            {
              id: 'adminReports',
              label: 'Reports',
              icon: 'report',
              palette: 'orange',
              ariaLabel: 'Open reports',
              disabled
            },
            {
              id: 'adminFeedback',
              label: 'Feedback',
              icon: 'feedback',
              palette: 'purple',
              ariaLabel: 'Open application feedback',
              disabled
            },
            {
              id: 'adminChat',
              label: 'Chats',
              icon: 'chat',
              palette: 'blue',
              ariaLabel: 'Open admin chats',
              disabled
            }
          ]
        },
        {
          id: 'admin-configuration',
          label: 'Configuration',
          icon: 'tune',
          palette: 'teal',
          items: [
            {
              id: 'adminJobs',
              label: 'jobs',
              icon: 'pending_actions',
              palette: 'blue',
              ariaLabel: 'Open jobs',
              disabled
            },
            {
              id: 'adminParams',
              label: 'params',
              icon: 'tune',
              palette: 'purple',
              ariaLabel: 'Open parameters',
              disabled
            },
            {
              id: 'adminContent',
              label: 'Content',
              icon: 'edit_note',
              palette: 'green',
              ariaLabel: 'Open content editor',
              disabled
            },
            {
              id: 'adminArticle',
              label: 'Article',
              icon: 'tips_and_updates',
              palette: 'gold',
              ariaLabel: 'Open article editor',
              disabled
            }
          ]
        },
        {
          id: 'admin-monitoring',
          label: 'monitoring',
          icon: 'monitoring',
          palette: 'blue',
          items: [
            {
              id: 'adminStats',
              label: 'stats',
              icon: 'query_stats',
              palette: 'green',
              ariaLabel: 'Open stats',
              disabled
            },
            {
              id: 'adminMetrics',
              label: 'metrics',
              icon: 'monitoring',
              palette: 'cyan',
              ariaLabel: 'Open monitoring metrics',
              disabled
            },
            {
              id: 'adminGraph',
              label: 'Graph',
              icon: 'hub',
              palette: 'violet',
              ariaLabel: 'Open affinity graph',
              disabled
            }
          ]
        },
        ...(showPaymentSimulator ? [{
          id: 'admin-testing',
          label: 'admin.testing',
          icon: 'science',
          palette: 'cyan' as const,
          items: [{
            id: 'adminPaymentSimulator' as const,
            label: 'admin.payment.simulator',
            icon: 'credit_card_gear',
            palette: 'cyan' as const,
            ariaLabel: 'admin.payment.simulator.open',
            disabled: disabled || !paymentSimulatorConfigUrl
          }, {
            id: 'adminPaymentAuthorizations' as const,
            label: 'admin.payment.simulator.3ds',
            icon: 'verified_user',
            palette: 'green' as const,
            ariaLabel: 'admin.payment.simulator.authorization.open',
            disabled: disabled || !paymentSimulatorConfigUrl
          }]
        }] : [])
      ]
    };
  });
  constructor() {
    effect(() => this.moderationService.setWorkerActive(!!this.sessionService.session()));
    effect(() => this.adminNotificationsService.setWorkerActive(!!this.sessionService.session()));
    effect(() => {
      const adminId = this.adminWorkspaceStore.dashboard()?.activeAdmin.id;
      this.moderationStore.clearGlobal();
      if (adminId) void this.moderationService.snapshot(adminId).then(snapshot => {
        if (this.adminWorkspaceStore.dashboard()?.activeAdmin.id === adminId) this.moderationStore.apply(snapshot);
      }).catch(() => {});
    });
    effect(() => this.mingleStore.activate(this.userProfileStore.activeUserId()));
    effect(() => {
      if (this.sessionService.session() && this.userProfileStore.activeUserId()) {
        this.pwaService.offerInstallAfterLogin();
      }
    });
    effect(() => { if (!this.connectionOffline()) this.offlineAttentionDismissed.set(false); });
    this.profileStore.registerBindings(this.profileBindings);

    this.routerEventsSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentRoutePathRef.set(AppUtils.normalizeRoutePath(event.urlAfterRedirects));
        this.notificationRouteUrl.set(event.urlAfterRedirects);
      }
    });

    effect(() => {
      const userId = this.userProfileStore.activeUserId().trim();
      const url = this.notificationRouteUrl();
      if (userId && !this.groupWorkspaces.context.switching() && this.userProfileStore.activeUserProfile()?.id === userId) {
        void this.openNotificationRoute(url);
        void this.openPartnerInviteTarget(url, userId);
        void this.openSharedAssetTarget(url, userId);
      }
    });

    installSessionActiveUserSync(
      this.sessionService.session,
      this.userProfileStore.activeUserId,
      userId => this.userProfileStore.setActiveUserId(userId)
    );

    effect(() => {
      const session = this.sessionService.session();
      const activeUserId = this.userProfileStore.activeUserId().trim();
      const routeUrl = this.currentRoutePathRef();

      if (!session) {
        this.clearHydrationState();
        return;
      }
      if (this.isAdminWorkspaceRoute(routeUrl) || !this.isNavigatorHydrationRoute(routeUrl)) {
        this.clearHydrationState();
        return;
      }

      const requestKey = session.kind === 'firebase'
        ? `firebase:${session.profile.id}`
        : session.kind === 'operator-bootstrap'
          ? `operator-bootstrap:${session.email}`
          : `demo:${session.userId}`;

      if (!requestKey || this.hydrationRequestKeyRef() === requestKey) {
        return;
      }

      this.hydrationRequestKeyRef.set(requestKey);
      void this.hydrateUserAfterLogin(this.sessionService.activeUserId() || undefined);
    });

    effect(() => {
      const session = this.sessionService.session();
      const activeUserId = this.userProfileStore.activeUserId().trim();

      if (!session || !activeUserId) {
        this.stopUserRealtimeLongPoll();
        this.profileStore.closeImpressionsPopup();
        this.profileStore.closeContactsPopup();
        return;
      }
      if (this.isOperatorMode()) {
        this.stopUserRealtimeLongPoll();
        this.profileStore.closeImpressionsPopup();
        this.profileStore.closeContactsPopup();
        return;
      }
      if (this.isAdminWorkspaceRoute() || this.userProfileStore.activeUserIsAdmin()) {
        this.profileStore.closeImpressionsPopup();
        this.profileStore.closeContactsPopup();
        this.activateUserRealtimeLongPoll(activeUserId);
        return;
      }

      this.activateUserRealtimeLongPoll(activeUserId);
    });

    effect(() => {
      const session = this.sessionService.session();
      const user = this.userProfileStore.activeUserProfile();
      const activeUserId = this.userProfileStore.activeUserId().trim();
      if (
        this.isOperatorMode()
        || !session
        || !user
        || !activeUserId
        || user.id.trim() !== activeUserId
      ) {
        this.notificationCenterStore.reset();
        return;
      }
      void this.notificationCenterStore.initialize(
        this.groupWorkspaces.context.accountId(activeUserId),
        Math.max(0, Math.trunc(Number((this.userProfileStore.getUserProfile(this.groupWorkspaces.context.accountId(activeUserId)) ?? user).activities?.notifications) || 0)),
        (this.userProfileStore.getUserProfile(this.groupWorkspaces.context.accountId(activeUserId)) ?? user).notificationPreferences?.muted === true
      );
    });

    effect(() => {
      if (
        this.popupPresenceStore.visible()
        && !this.notificationCenterStore.isOpen()
      ) {
        this.notificationCenterStore.requestAttention();
      }
    });

    effect(() => {
      const session = this.sessionService.session();
      const activeUserId = this.groupWorkspaces.context.accountId(this.userProfileStore.activeUserId());
      const revision = this.privacyPolicy.activeRevision();
      const shouldCheckPrivacyConsent = Boolean(activeUserId)
        && (Boolean(session) || this.isAdminWorkspaceRoute());

      if (!shouldCheckPrivacyConsent) {
        this.privacyConsentCheckKeyRef.set('');
        this.profileStore.clearPrivacyConsentRequirement();
        return;
      }
      if (!revision) {
        void this.privacyPolicy.prepareOpen();
        return;
      }

      const checkKey = this.privacyConsentKey(activeUserId, revision);
      if (this.privacyConsentCheckKeyRef() === checkKey) {
        return;
      }

      this.privacyConsentCheckKeyRef.set(checkKey);
      void this.ensureActivePrivacyConsent(activeUserId, revision, checkKey);
    });

    effect(() => {
      const isInternal = this.avatarVisible();
      const hasBindings = this.hasBindings();
      const status = this.activeUserLoadState().status;

      if (!isInternal) {
        this.closeSideMenu();
        this.clearUserMenuLoadState();
        return;
      }

      if (!hasBindings || status === 'loading' || status === 'idle') {
        void this.helpCenterService.preloadAll();
        this.beginUserMenuLoadWindow();
        return;
      }

      if (status === 'success') {
        this.clearUserMenuLoadState();
        return;
      }

      this.markUserMenuLoadOverdue();
    });

    effect(() => {
      const isOpen = this.profileStore.impressionsPopupOpen();
      if (isOpen) {
        void this.profileStore.ensureImpressionsPopupLoaded();
      }
    });

    effect(() => {
      const isOpen = this.profileStore.profileEditorOpen();
      if (isOpen) {
        void this.profileStore.ensureProfileEditorLoaded();
      }
    });

    effect(() => {
      const isOpen = this.profileStore.profileViewOpen();
      if (isOpen) {
        void this.profileStore.ensureProfileViewPopupLoaded();
      }
    });

    effect(() => {
      const isOpen = this.eventEditorStore.isOpen();
      if (isOpen) {
        void this.eventEditorStore.ensureEventEditorPopupLoaded();
      }
    });

    effect(() => {
      const request = this.memberMenuStore.activitiesNavigationRequest();
      if (!request || (request.type !== 'eventEditorCreate' && request.type !== 'eventEditor')) {
        return;
      }
      void this.eventEditorStore.ensureEventEditorPopupLoaded();
    });

    effect(() => {
      const request = this.memberMenuStore.activitiesNavigationRequest();
      if (!request || (request.type !== 'members' && request.type !== 'eventEditorMembers')) {
        return;
      }
      void this.activitiesStore.ensureEventMembersPopupLoaded();
    });

    effect(() => {
      const request = this.memberMenuStore.activitiesNavigationRequest();
      if (!request || (request.type !== 'eventExplore' && request.type !== 'eventCheckoutDraft')) {
        return;
      }
      void this.activitiesStore.ensureActivitiesPopupLoaded();
      void this.activitiesStore.ensureEventExplorePopupLoaded();
    });

    effect(() => {
      const request = this.memberMenuStore.activitiesNavigationRequest();
      if (!request || request.type !== 'assetExplore' || this.activitiesStore.eventChatSession()) {
        return;
      }
      void this.subEventResourceStore.ensureEventResourcePopupLoaded();
    });

    effect(() => {
      const session = this.activitiesStore.eventChatSession();
      if (session) {
        void this.activitiesStore.ensureEventChatPopupLoaded();
      }
    });

    effect(() => {
      const isActivitiesOpen = this.activitiesStore.activitiesOpen();
      if (isActivitiesOpen) {
        void this.activitiesStore.ensureActivitiesPopupLoaded();
      }
    });

    effect(() => {
      const isContactsOpen = this.profileStore.contactsPopupOpen();
      if (isContactsOpen) {
        void this.profileStore.ensureContactsPopupLoaded();
      }
    });

    effect(() => {
      const isAssetPopupVisible = this.assetPopupStore.visible() || this.assetStore.showAssetForm();
      if (isAssetPopupVisible) {
        void this.assetPopupStore.ensureAssetPopupLoaded();
      }
    });

    effect(() => {
      const resourcePopupVisible = !this.activitiesStore.eventChatSession()
        && this.subEventResourceStore.popupContextRef()?.origin === 'chat';
      if (resourcePopupVisible) {
        void this.subEventResourceStore.ensureEventResourcePopupLoaded();
      }
    });

    effect(() => {
      const assetExploreVisible = !this.activitiesStore.eventChatSession()
        && this.subEventResourceStore.popupContextRef()?.origin === 'chat'
        && this.subEventResourceStore.assetExplorePopupRef() !== null;
      if (assetExploreVisible) {
        void this.subEventResourceStore.ensureEventResourceAssetExploreLoaded();
      }
    });

    effect(() => {
      const supplyContributionsVisible = !this.activitiesStore.eventChatSession()
        && this.subEventResourceStore.popupContextRef()?.origin === 'chat'
        && !this.subEventResourceStore.assetExploreOnlyRef()
        && this.subEventResourceStore.supplyPopupRef() !== null;
      if (supplyContributionsVisible) {
        void this.subEventResourceStore.ensureEventSupplyContributionsPopupLoaded();
      }
    });

    effect(() => {
      const activityInvitePopup = this.activityInviteStore.activityInvitePopup();
      if (activityInvitePopup?.ownerId?.trim()) {
        void this.activityInviteStore.ensureAssetMemberPickerPopupLoaded();
      }
    });

    effect(() => {
      const request = this.memberMenuStore.navigatorActivitiesRequest();
      if (!request || request.updatedMs <= this.lastHandledActivitiesRequestMs) {
        return;
      }
      this.lastHandledActivitiesRequestMs = request.updatedMs;
      this.activitiesStore.openActivities(request.primaryFilter, request.eventScope, undefined, false, {
        adminServiceOnly: request.adminServiceOnly === true
      });
      this.memberMenuStore.clearNavigatorActivitiesRequest();
    });

    effect(() => {
      const request = this.memberMenuStore.navigatorAssetRequest();
      if (!request || request.updatedMs <= this.lastHandledAssetRequestMs) {
        return;
      }
      this.lastHandledAssetRequestMs = request.updatedMs;
      this.assetStore.openAssetPopup(request.assetFilter);
      this.assetPopupStore.primaryVisibleRef.set(true);
      this.memberMenuStore.clearNavigatorAssetRequest();
    });

    effect(() => {
      const request = this.memberMenuStore.navigatorEventFeedbackRequest();
      if (!request || request.updatedMs <= this.lastHandledEventFeedbackRequestMs) {
        return;
      }
      this.lastHandledEventFeedbackRequestMs = request.updatedMs;
      void this.openEventFeedbackPopupFromNavigatorRequest();
    });

    effect(() => {
      const isVisible = this.explanationGuide.hasVisiblePopup();
      if (isVisible) {
        void this.profileStore.ensureExplanationPopupLoaded();
      }
    });
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected closeLoadingProfile(event: Event): void {
    if (this.profileStore.profileEditorOpen() && !this.profileStore.profileEditorComponent()) {
      event.stopPropagation();
      this.profileStore.closeProfileEditor();
    }
  }

  @HostListener('window:online')
  protected onWindowOnline(): void {
    this.runtimeStore.setOnlineState(true);
  }

  @HostListener('window:offline')
  protected onWindowOffline(): void {
    this.runtimeStore.setOnlineState(false);
  }

  protected onAvatarMenuSelect(
    event: AppMenuItemSelectEvent<NavigatorAvatarMenuItemId, NavigatorAvatarMenuContext>
  ): void {
    if (event.context?.kind !== 'toggle-menu' || !this.canToggleAvatarMenu()) {
      return;
    }
    this.menuOpenRef.update(open => !open);
  }

  protected onOperatorCommunityMenuSelect(
    event: AppMenuItemSelectEvent<NavigatorOperatorCommunityMenuItemId>
  ): void {
    if (event.id !== 'operator-community' || !this.canToggleAvatarMenu()) {
      return;
    }
    event.sourceEvent.stopPropagation();
    this.operatorMenuStore.open('community');
  }

  protected onNotificationAttentionSelect(
    event: AppMenuItemSelectEvent<string>
  ): void {
    if (event.id !== 'notification-attention') {
      return;
    }
    this.openNotificationCenter(event.sourceEvent);
  }

  protected onNotificationDragPositionChange(position: AppMenuDragPosition): void {
    this.notificationCenterStore.setDragPosition(position);
  }

  protected onNotificationDragStateChange(event: AppMenuDragEvent): void {
    switch (event.phase) {
      case 'start':
        this.notificationDismissDraggingRef.set(true);
        this.notificationDismissTargetedRef.set(false);
        return;
      case 'move':
        this.notificationDismissTargetedRef.set(this.isNotificationDismissTargetHit(event));
        return;
      case 'cancel':
        this.clearNotificationDismissDragState();
        return;
      case 'end': {
        const shouldDismiss = this.isNotificationDismissTargetHit(event);
        this.clearNotificationDismissDragState();
        if (!shouldDismiss) {
          return;
        }
        this.notificationCenterStore.setDragPosition({ x: 0, y: 0 });
        this.notificationCenterStore.dismissAttention();
        this.offlineAttentionDismissed.set(true);
      }
    }
  }

  private isNotificationDismissTargetHit(event: AppMenuDragEvent): boolean {
    const target = this.notificationDismissTargetRef?.nativeElement;
    if (!target) {
      return false;
    }
    const rect = target.getBoundingClientRect();
    const targetCenterX = rect.left + (rect.width / 2);
    const targetCenterY = rect.top + (rect.height / 2);
    const hitRadius = (Math.max(rect.width, rect.height) / 2)
      + SideMenuComponent.NOTIFICATION_DISMISS_TARGET_PADDING_PX;
    return Math.hypot(
      event.centerX - targetCenterX,
      event.centerY - targetCenterY
    ) <= hitRadius;
  }

  private clearNotificationDismissDragState(): void {
    this.notificationDismissDraggingRef.set(false);
    this.notificationDismissTargetedRef.set(false);
  }

  protected onCloseMenu(): void {
    this.closeSideMenu();
  }

  protected onNavigatorHeaderActionMenuSelect(event: AppMenuItemSelectEvent<NavigatorHeaderActionMenuItemId>): void {
    switch (event.id) {
      case 'notifications':
        this.openNotificationCenter(event.sourceEvent);
        return;
      case 'explanations':
        this.onToggleExplanationGuide(event.sourceEvent);
        return;
      case 'share':
        this.onShareProfile(event.sourceEvent);
        return;
      case 'settings':
        return;
      case 'permissions':
        this.openAppSetup();
        return;
      case 'help':
      case 'feedback':
      case 'privacy':
      case 'terms':
        this.openSettingsPopup(event.id);
        return;
      case 'delete-account':
        this.openDeleteAccountConfirm();
        return;
      case 'logout':
        this.openLogoutConfirm();
        return;
      case 'report-bugs':
        return;
    }
  }

  protected onNavigatorCommunityMenuSelect(event: AppMenuItemSelectEvent): void {
    event.sourceEvent.stopPropagation();
    switch (event.id) {
      case 'table': this.openCurrentMingleTable(event.sourceEvent); return;
      case 'feed': this.photoFeedStore.open(); return;
      case 'followed': this.openFollowedEvents(event.sourceEvent); return;
      case 'groups': this.communityGroups.open(); return;
    }
  }

  protected onNavigatorMenuSelect(event: AppMenuItemSelectEvent<NavigatorMenuShortcutId>): void {
    switch (event.id) {
      case 'impressions':
        this.openImpressions(event.sourceEvent);
        return;
      case 'feedback':
        this.openEventFeedbackPopup(event.sourceEvent);
        return;
      case 'rates':
        this.openRatesShortcut(event.sourceEvent);
        return;
      case 'chat':
        this.openChatShortcut(event.sourceEvent);
        return;
      case 'invitations':
        this.openInvitationShortcut(event.sourceEvent);
        return;
      case 'events':
        this.openEventShortcut(event.sourceEvent);
        return;
      case 'payment-history':
        this.openPaymentHistoryShortcut(event.sourceEvent);
        return;
      case 'transport':
        this.openAssetTransportPopup(event.sourceEvent);
        return;
      case 'accommodation':
        this.openAssetAccommodationPopup(event.sourceEvent);
        return;
      case 'supplies':
        this.openAssetSuppliesPopup(event.sourceEvent);
        return;
      case 'tickets':
        this.openAssetTicketsPopup(event.sourceEvent);
        return;
      case 'contacts':
        this.openContactsPopup(event.sourceEvent);
        return;
    }
  }

  protected onAdminNavigatorMenuSelect(event: AppMenuItemSelectEvent<NavigatorAdminMenuShortcutId>): void {
    switch (event.id) {
      case 'adminModeration':
        this.adminMenuStore.openContentModeration();
        return;
      case 'adminReports':
        this.openAdminReportsShortcut(event.sourceEvent);
        return;
      case 'adminFeedback':
        this.openAdminFeedbackShortcut(event.sourceEvent);
        return;
      case 'adminChat':
        this.openAdminChatShortcut(event.sourceEvent);
        return;
      case 'adminJobs':
        this.openAdminNotificationsShortcut(event.sourceEvent);
        return;
      case 'adminParams':
        this.openAdminParamsShortcut(event.sourceEvent);
        return;
      case 'adminPaymentSimulator':
        this.openAdminPaymentSimulatorShortcut(event.sourceEvent);
        return;
      case 'adminPaymentAuthorizations':
        this.openAdminPaymentAuthorizationsShortcut(event.sourceEvent);
        return;
      case 'adminContent':
        this.openAdminHelpEditorShortcut(event.sourceEvent);
        return;
      case 'adminArticle':
        this.openAdminIdeaEditorShortcut(event.sourceEvent);
        return;
      case 'adminStats':
        this.openAdminStatsShortcut(event.sourceEvent);
        return;
      case 'adminMetrics':
        this.openAdminMonitoringShortcut(event.sourceEvent);
        return;
      case 'adminGraph':
        this.openAdminAffinityGraphShortcut(event.sourceEvent);
        return;
    }
  }

  protected onShareProfile(event: Event): void {
    event.stopPropagation();
    const baseHref = document.querySelector('base')?.getAttribute('href') ?? '/';
    const url = new URL(baseHref, window.location.origin).toString();
    const title = this.deploymentBranding().productName;
    const text = 'Connect with people through shared activities and experiences.';

    if (navigator.share) {
      void navigator.share({ title, text, url });
      return;
    }
    const shareUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
    window.location.href = shareUrl;
  }

  protected onToggleExplanationGuide(event: Event): void {
    event.stopPropagation();
    this.explanationGuide.toggleEnabled();
  }

  protected navigatorHeaderCardModel(user: NavigatorMenuUser): HeaderCardModel {
    const admin = this.isAdminMode();
    if (this.isOperatorMode()) {
      return {
        ...ProfileHeaderCardConverter.convert(user, {
          admin: true,
          headline: this.i18n.translate('operator.workspace.title'),
          showEdit: !this.serverActionsUnavailable(),
          editDisabled: false,
          editAriaLabel: this.i18n.translate('operator.profile.open')
        }),
        badgeLabel: this.i18n.translate('operator'),
        meta: this.i18n.translate('operator.workspace.title'),
        metaIcon: 'settings_input_component'
      };
    }
    return ProfileHeaderCardConverter.convert(user, {
      admin,
      showEdit: !this.serverActionsUnavailable(),
      editDisabled: admin ? this.serverActionsUnavailable() : this.serverActionsUnavailable() || this.isBlockedUser(user),
      editAriaLabel: admin ? 'Open admin profile' : 'Open profile editor',
      showRing: !admin && (this.showProfileSaveRing() || this.groupWorkspaces.context.switching()),
      ringState: this.hasProfileSaveError() ? 'error' : 'loading',
      ringTitle: admin ? null : this.profileSaveAvatarTitle()
    });
  }

  protected openNavigatorHeaderProfile(event: Event): void {
    if (this.isOperatorMode()) {
      event.stopPropagation();
      if (this.serverActionsUnavailable()) {
        return;
      }
      this.operatorMenuStore.closePopup();
      this.closeSideMenu();
      this.profileStore.openProfileEditor();
      return;
    }
    if (this.isAdminMode()) {
      this.openAdminProfileShortcut(event);
      return;
    }
    this.openProfileEditor(event);
  }

  protected isBlockedUser(user: NavigatorMenuUser | UserDto | null = this.menuUser()): boolean {
    return user?.profileStatus === 'blocked';
  }

  protected isPrimaryMenuDisabled(user: NavigatorMenuUser): boolean {
    return this.serverActionsUnavailable() || this.isBlockedUser(user);
  }

  protected openProfileEditor(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable() || this.isBlockedUser()) {
      return;
    }
    if (this.isAdminMode()) {
      this.profileStore.openProfileEditor();
      return;
    }
    this.profileStore.openProfileEditor();
  }

  protected impressionShortcutBadgeCount(user: NavigatorMenuUser): number {
    return Number(user.impressionChangeFlags.host) + Number(user.impressionChangeFlags.member);
  }

  protected openImpressions(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable() || this.isBlockedUser()) {
      return;
    }
    this.openImpressionsPopup();
  }

  protected openRatesShortcut(event?: Event): void {
    event?.stopPropagation();
    this.openActivitiesShortcut('rates');
  }

  protected openChatShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.isBlockedUser()) {
      this.openBlockedUserSupportChat();
      return;
    }
    this.openActivitiesShortcut('chats');
  }

  protected openInvitationShortcut(event?: Event): void {
    event?.stopPropagation();
    this.openActivitiesShortcut('events', 'invitations');
  }

  protected openEventShortcut(event?: Event): void {
    event?.stopPropagation();
    this.openActivitiesShortcut('events', 'all');
  }

  protected openPaymentHistoryShortcut(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.closeSideMenu();
    void this.paymentMethodsPopupStore.openHistory();
  }

  protected openAssetTransportPopup(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable() || this.isBlockedUser()) {
      return;
    }
    this.memberMenuStore.openNavigatorAssetRequest(AppConstants.ASSET_TYPE_TRANSPORT);
  }

  protected openAssetAccommodationPopup(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable() || this.isBlockedUser()) {
      return;
    }
    this.memberMenuStore.openNavigatorAssetRequest(AppConstants.ASSET_TYPE_ACCOMMODATION);
  }

  protected openAssetSuppliesPopup(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable() || this.isBlockedUser()) {
      return;
    }
    this.memberMenuStore.openNavigatorAssetRequest(AppConstants.ASSET_TYPE_SUPPLIES);
  }

  protected openAssetTicketsPopup(event?: Event): void {
    event?.stopPropagation();
    this.memberMenuStore.openNavigatorAssetRequest(AppConstants.ASSET_FILTER_TICKET);
  }

  protected openContactsPopup(event?: Event): void {
    event?.stopPropagation();
    if (this.userProfileStore.activeUserId().trim()) {
      this.profileStore.openContactsPopup();
    }
  }

  protected openEventFeedbackPopup(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable() || this.isBlockedUser()) {
      return;
    }
    this.memberMenuStore.openNavigatorEventFeedbackRequest();
  }

  protected isAdminMode(): boolean {
    return this.currentRoutePathRef().startsWith('/admin');
  }

  protected isOperatorMode(): boolean {
    return this.currentRoutePathRef().startsWith('/operator');
  }

  protected isPrivilegedWorkspaceMode(): boolean {
    return this.isAdminMode() || this.isOperatorMode();
  }

  protected openAdminReportsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openReports();
  }

  protected openAdminFeedbackShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openFeedback();
  }

  protected openAdminChatShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.memberMenuStore.openNavigatorActivitiesRequest('chats', undefined, { adminServiceOnly: true });
  }

  protected openAdminProfileShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.profileStore.openProfileEditor();
  }

  protected openAdminHelpEditorShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openHelpEditor();
  }

  protected openAdminIdeaEditorShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openIdeaEditor();
  }

  protected openAdminNotificationsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openNotifications();
  }

  protected openAdminParamsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openParams();
  }

  protected openAdminPaymentSimulatorShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openPaymentSimulator();
  }

  protected openAdminPaymentAuthorizationsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openPaymentAuthorizations();
  }

  protected openAdminStatsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openStats();
  }

  protected openAdminAffinityGraphShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openAffinityGraph();
  }

  protected openAdminMonitoringShortcut(event?: Event): void {
    event?.stopPropagation();
    if (this.serverActionsUnavailable()) {
      return;
    }
    this.adminMenuStore.openMonitoring();
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription.unsubscribe();
    this.profileStore.clearBindings(this.profileBindings);
    this.userRealtimeScheduler.destroy();
    this.userProfileStore.setUserRealtimePollInFlight(false);
    this.clearUserMenuLoadState();
  }

  private async hydrateUserAfterLogin(userId?: string): Promise<UserDto | null> {
    if (this.isAdminWorkspaceRoute()) {
      return null;
    }
    const requestVersion = ++this.hydrationRequestVersion;
    const sessionKind = this.sessionService.currentSession()?.kind;
    const serverIdentifiedSession = sessionKind === 'firebase'
      || sessionKind === 'operator-bootstrap';
    const loadedProfileExt = await this.usersService.loadProfileExtById(
      serverIdentifiedSession ? undefined : userId
    );
    const loadedUser = loadedProfileExt?.profile ?? null;
    if (!loadedUser || requestVersion !== this.hydrationRequestVersion) {
      return null;
    }
    if (this.shouldPromptDeletedAccountReactivation(loadedUser)) {
      this.profileStore.setDeletedAccountReactivationPending(true);
      this.openDeletedAccountReactivationPrompt(loadedUser, requestVersion);
      return loadedUser;
    }

    this.syncHydratedUser(loadedUser);
    void this.helpCenterService.preload('help');
    if (hasOperatorRole(loadedUser)) {
      void this.preloadOperatorUpdate(requestVersion);
    }
    return loadedUser;
  }

  private async preloadOperatorUpdate(requestVersion: number): Promise<void> {
    const { OperatorWorkspaceStore } = await import('../../context/stores/operator-workspace.store');
    if (requestVersion !== this.hydrationRequestVersion) return;
    await this.injector.get(OperatorWorkspaceStore).preloadDeploymentUpdate();
  }

  private shouldPromptDeletedAccountReactivation(user: UserDto): boolean {
    if (user.profileStatus !== 'deleted') {
      return false;
    }
    const deletedAtMs = Date.parse(`${user.deletedAtIso ?? ''}`.trim());
    if (!Number.isFinite(deletedAtMs)) {
      return true;
    }
    return Date.now() - deletedAtMs <= SideMenuComponent.ACCOUNT_REACTIVATION_WINDOW_MS;
  }

  private openDeletedAccountReactivationPrompt(user: UserDto, requestVersion: number): void {
    const userId = user.id.trim();
    if (!userId || this.reactivationPromptUserId === userId) {
      return;
    }
    this.reactivationPromptUserId = userId;
    this.dialogStore.open({
      title: 'Reactivate account?',
      message: this.i18n.translateParams(
        'account.reactivation.message',
        { productName: this.deploymentBranding().productName }
      ),
      cancelLabel: 'Cancel',
      confirmLabel: 'Reactivate',
      busyConfirmLabel: 'Reactivating...',
      confirmTone: 'accent',
      allowBackdropClose: false,
      allowEscapeClose: false,
      failureMessage: 'Unable to reactivate account.',
      onCancel: async () => {
        this.reactivationPromptUserId = '';
        this.profileStore.setDeletedAccountReactivationPending(false);
        this.clearHydratedUser();
        await this.sessionService.logout().finally(() => this.router.navigate(['/entry']));
      },
      onConfirm: async () => {
        const restoredProfileStatus = this.resolveReactivatedProfileStatus(user);
        const reactivatedUser: UserDto = {
          ...user,
          profileStatus: restoredProfileStatus,
          previousProfileStatus: null,
          deletedAtIso: null
        };
        const saved = await this.usersService.saveUserProfile(reactivatedUser);
        if (!saved) {
          throw new Error('Unable to reactivate account.');
        }
        this.reactivationPromptUserId = '';
        setTimeout(() => {
          if (requestVersion === this.hydrationRequestVersion) {
            this.syncHydratedUser(saved);
          }
          this.profileStore.setDeletedAccountReactivationPending(false);
        }, 0);
      }
    });
  }

  private async ensureActivePrivacyConsent(userId: string, revision: HelpCenterRevisionDto, checkKey: string): Promise<void> {
    const requestToken = ++this.privacyConsentCheckToken;
    try {
      const existingConsent = await this.privacyPolicy.loadConsent(userId, revision.id, revision.version);
      if (!this.isCurrentPrivacyConsentCheck(checkKey, requestToken)) {
        return;
      }
      if (this.isPrivacyConsentCurrent(existingConsent, revision)) {
        this.profileStore.clearPrivacyConsentRequirement();
        return;
      }

      const syncedAnonymousConsent = await this.privacyPolicy.syncAnonymousEntryConsent(userId, revision);
      if (!this.isCurrentPrivacyConsentCheck(checkKey, requestToken)) {
        return;
      }
      if (syncedAnonymousConsent) {
        this.profileStore.clearPrivacyConsentRequirement();
        return;
      }

      this.profileStore.setPrivacyConsentRequiredKey(checkKey);
      this.openSettingsPopup('privacy');
    } catch {
      if (this.isCurrentPrivacyConsentCheck(checkKey, requestToken)) {
        this.profileStore.setPrivacyConsentRequiredKey(checkKey);
        this.openSettingsPopup('privacy');
      }
    }
  }

  private isCurrentPrivacyConsentCheck(checkKey: string, requestToken: number): boolean {
    return this.privacyConsentCheckToken === requestToken
      && this.privacyConsentCheckKeyRef() === checkKey;
  }

  private isPrivacyConsentCurrent(consent: PrivacyConsentDto | null, revision: HelpCenterRevisionDto): boolean {
    if (!consent) {
      return false;
    }
    const consentRevisionId = `${consent.revisionId ?? ''}`.trim();
    const consentVersion = Math.trunc(Number(consent.revisionVersion) || 0);
    const currentVersion = Math.trunc(Number(revision.version) || 0);
    return consentRevisionId === revision.id && consentVersion >= currentVersion && currentVersion > 0;
  }

  private privacyConsentKey(userId: string, revision: HelpCenterRevisionDto): string {
    return `${userId.trim()}::${revision.id}:v${revision.version}`;
  }

  private isActivePrivacyConsentRequired(): boolean {
    const requiredKey = this.profileStore.privacyConsentRequiredKey();
    const activeUserId = this.groupWorkspaces.context.accountId(this.userProfileStore.activeUserId());
    const revision = this.privacyPolicy.activeRevision();
    if (!requiredKey || !activeUserId || !revision) {
      return false;
    }
    return requiredKey === this.privacyConsentKey(activeUserId, revision);
  }

  private resolveReactivatedProfileStatus(user: UserDto): UserDto['profileStatus'] {
    switch (user.previousProfileStatus) {
      case 'blocked':
      case 'friends only':
      case 'host only':
      case 'inactive':
      case 'public':
        return user.previousProfileStatus;
      default:
        return 'public';
    }
  }

  private syncHydratedUser(user: UserDto): void {
    this.userProfileStore.setActiveUserProfile(user);
    this.profileStore.bindings()?.syncHydratedUser?.(user);
  }

  private clearHydrationState(): void {
    this.hydrationRequestVersion += 1;
    this.hydrationRequestKeyRef.set('');
    this.profileStore.setDeletedAccountReactivationPending(false);
  }

  private clearHydratedUser(): void {
    this.clearHydrationState();
  }

  private closeSettingsPopup(): void {
    this.profileStore.closeSettingsPopup({
      keepPrivacyOpen: this.isActivePrivacyConsentRequired()
    });
  }

  private closeSideMenu(): void {
    this.menuOpenRef.set(false);
  }

  private openImpressionsPopup(userId?: string): void {
    const normalizedUserId = `${userId ?? ''}`.trim() || this.userProfileStore.activeUserId().trim();
    const activeUserId = this.userProfileStore.activeUserId().trim();
    const cachedUser = normalizedUserId
      ? (this.userProfileStore.getUserProfile(normalizedUserId)
        ?? (normalizedUserId === activeUserId ? this.userProfileStore.activeUserProfile() : null))
      : null;
    if (normalizedUserId && !cachedUser) {
      void this.usersService.loadUserById(normalizedUserId);
    }
    this.profileStore.openImpressionsPopup(normalizedUserId, {
      contextLabel: 'My Impressions'
    });
  }

  private openDeleteAccountConfirm(): void {
    const activeUserName = this.userProfileStore.getUserProfile(this.groupWorkspaces.context.accountId(this.userProfileStore.activeUserId()))?.name?.trim() || 'this account';
    this.dialogStore.open({
      title: 'Delete account?',
      message: activeUserName,
      warningMessage: 'You can reactivate within 30 days. After that, the account is permanently purged.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      confirmTone: 'danger',
      onConfirm: async () => {
        this.closeSideMenu();
        this.closeSettingsPopup();
        this.profileStore.closeProfileEditor();
        this.closeImpressionsPopup();
        this.profileStore.closeContactsPopup();
        if (AppUtils.normalizeRoutePath(this.router.url).startsWith('/admin')) {
          this.clearHydratedUser();
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(SideMenuComponent.ADMIN_SESSION_STORAGE_KEY);
          }
          window.dispatchEvent(new CustomEvent('adminLogoutRequested'));
          await this.sessionService.logout().finally(() => this.router.navigate(['/']));
          return;
        }
        const activeUserId = this.groupWorkspaces.context.accountId(this.userProfileStore.activeUserId());
        if (activeUserId) {
          const result = await this.usersService.deleteUser(activeUserId);
          if (!result.submitted) {
            this.dialogStore.openInfo(
              result.message ?? 'Unable to delete account.',
              {
                title: 'Delete account',
                confirmLabel: 'OK',
                confirmTone: 'danger'
              }
            );
            return;
          }
        }
        this.clearHydratedUser();
        await this.sessionService.logout().finally(() => this.router.navigate(['/entry']));
      }
    });
  }

  private openLogoutConfirm(): void {
    const activeUserName = this.userProfileStore.getUserProfile(this.groupWorkspaces.context.accountId(this.userProfileStore.activeUserId()))?.name?.trim() || '';
    this.dialogStore.open({
      title: 'logout.question',
      message: activeUserName,
      cancelLabel: 'Cancel',
      confirmLabel: 'Logout',
      confirmTone: 'accent',
      onConfirm: async () => {
        this.closeSideMenu();
        this.closeSettingsPopup();
        this.profileStore.closeProfileEditor();
        this.closeImpressionsPopup();
        this.profileStore.closeContactsPopup();
        const activeUserId = this.groupWorkspaces.context.accountId(this.userProfileStore.activeUserId());
        if (AppUtils.normalizeRoutePath(this.router.url).startsWith('/admin')) {
          if (activeUserId) {
            const result = await this.usersService.logoutUser(activeUserId);
            if (!result.submitted) {
              this.dialogStore.openInfo(
                result.message ?? 'Unable to log out.',
                {
                  title: 'Logout',
                  confirmLabel: 'OK',
                  confirmTone: 'neutral'
                }
              );
              return;
            }
          }
          this.clearHydratedUser();
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(SideMenuComponent.ADMIN_SESSION_STORAGE_KEY);
          }
          window.dispatchEvent(new CustomEvent('adminLogoutRequested'));
          await this.sessionService.logout().finally(() => this.router.navigate(['/']));
          return;
        }
        if (activeUserId) {
          const result = await this.usersService.logoutUser(activeUserId);
          if (!result.submitted) {
            this.dialogStore.openInfo(
              result.message ?? 'Unable to log out.',
              {
                title: 'Logout',
                confirmLabel: 'OK',
                confirmTone: 'neutral'
              }
            );
            return;
          }
        }
        this.clearHydratedUser();
        await this.sessionService.logout().finally(() => this.router.navigate(['/entry']));
      }
    });
  }

  private closeImpressionsPopup(): void {
    const userId = this.profileStore.impressionsPopupUserId().trim() || this.userProfileStore.activeUserId().trim();
    this.userProfileStore.markUserRealtimeImpressionsClosed(userId);
    this.profileStore.closeImpressionsPopup();
  }

  private activateUserRealtimeLongPoll(userId: string): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || this.userProfileStore.activeUserId().trim() !== normalizedUserId) {
      return;
    }
    const immediate = this.realtimePollingUserId !== normalizedUserId;
    this.realtimePollingUserId = normalizedUserId;
    this.userRealtimeScheduler.restart({ immediate });
  }

  private stopUserRealtimeLongPoll(): void {
    this.realtimePollingUserId = '';
    this.userRealtimeScheduler.stop({ abort: true });
    this.userProfileStore.setUserRealtimePollInFlight(false);
  }

  private userRealtimePollIntervalMs(): number {
    return this.sessionService.session() && this.userProfileStore.activeUserId().trim()
      ? this.usersService.realtimePollIntervalMs()
      : 0;
  }

  private isAdminWorkspaceRoute(routeUrl = this.currentRoutePathRef()): boolean {
    const path = AppUtils.normalizeRoutePath(routeUrl);
    return path === '/admin'
      || path === '/admin/'
      || path === '/admin/workspace'
      || path === '/admin/workspace/';
  }

  private isNavigatorHydrationRoute(routeUrl = this.currentRoutePathRef()): boolean {
    return isNavigatorHydrationRoute(routeUrl);
  }

  private async runUserRealtimeLongPollTick(userId: string, signal?: AbortSignal): Promise<void> {
    if (!userId || signal?.aborted) {
      return;
    }
    const followingRevision = this.followingStore.captureRevision();
    const notificationSyncToken = this.notificationCenterStore.captureUnreadSyncToken();
    const counterSyncToken = this.activityStore.captureUserCounterSyncToken(userId);
    this.userProfileStore.setUserRealtimePollInFlight(true);
    try {
      const cursor = this.userProfileStore.getUserRealtimeCursor(userId);
      const snapshot = await this.usersService.pollUserRealtimeSnapshot(userId, cursor);
      if (
        !snapshot
        || this.userProfileStore.activeUserId().trim() !== userId
        || signal?.aborted
      ) {
        return;
      }
      this.moderationStore.apply(snapshot.contentModeration);
      this.followingStore.applySnapshot(snapshot.userId, snapshot.following, followingRevision);
      this.photoFeedStore.applyCounters(snapshot.userId, snapshot.feedCounters);
      this.deploymentConfiguration.applyPaymentCardsAvailable(snapshot.paymentCardsAvailable);
      this.userProfileStore.applyUserRealtimeProfileStatus(snapshot.userId, snapshot.profileStatus);
      this.userProfileStore.applyUserRealtimeLocation(snapshot.userId, snapshot.locationCoordinates);
      this.userProfileStore.applyUserRealtimeNotificationDevices(snapshot.userId, snapshot.notificationDevices);
      const nextNotificationCount = Number(snapshot.counters?.notifications);
      const {
        notifications: _notificationCount,
        ...nonNotificationCounters
      } = snapshot.counters;
      const nonNotificationSnapshot = {
        ...snapshot,
        counters: nonNotificationCounters
      };
      if (shouldApplyUserRealtimeDomainSnapshot(this.popupPresenceStore.visible())) {
        this.userProfileStore.applyUserRealtimeSnapshot(userId, {
          ...nonNotificationSnapshot
        }, counterSyncToken);
      } else if (this.activitiesStore.activitiesOpen()) {
        this.activityStore.applyInactiveActivitiesCounterSnapshot(
          counterSyncToken,
          nonNotificationCounters,
          this.activitiesStore.activitiesPrimaryFilter()
        );
      }
      if (Number.isFinite(nextNotificationCount)) {
        this.notificationCenterStore.applyRealtimeUnreadCount(
          notificationSyncToken,
          nextNotificationCount
        );
      }
    } finally {
      this.userProfileStore.setUserRealtimePollInFlight(false);
    }
  }

  private beginUserMenuLoadWindow(): void {
    if (this.userMenuLoadOverdueTimer || this.userMenuLoadOverdueRef()) {
      return;
    }
    this.userMenuLoadOverdueRef.set(false);
    this.userMenuLoadOverdueTimer = setTimeout(() => {
      this.userMenuLoadOverdueTimer = null;
      this.userMenuLoadOverdueRef.set(true);
    }, SideMenuComponent.USER_MENU_LOAD_DURATION_MS);
  }

  private clearUserMenuLoadState(): void {
    if (this.userMenuLoadOverdueTimer) {
      clearTimeout(this.userMenuLoadOverdueTimer);
      this.userMenuLoadOverdueTimer = null;
    }
    this.userMenuLoadOverdueRef.set(false);
  }

  private markUserMenuLoadOverdue(): void {
    if (this.userMenuLoadOverdueTimer) {
      clearTimeout(this.userMenuLoadOverdueTimer);
      this.userMenuLoadOverdueTimer = null;
    }
    this.userMenuLoadOverdueRef.set(true);
  }

  private resolveUserBadgeCount(user: UserDto): number {
    if (this.userProfileStore.isAdminUserProfile(user)) {
      const activityOverrides = this.activityStore.getUserCounterOverrides(user.id);
      return this.adminNavigatorBadgeCount({
        chat: activityOverrides.chat ?? user.activities?.chat,
        adminJobs: this.resolveActivityBadge(user, 'adminJobs'),
        adminMetrics: this.resolveActivityBadge(user, 'adminMetrics')
      });
    }
    const impressionFlags = this.userProfileStore.getUserImpressionChangeFlags(user.id);
    const activityOverrides = this.activityStore.getUserCounterOverrides(user.id);
    return profileMenuBadgeCount(user, activityOverrides, impressionFlags);
  }

  private notificationLauncherAriaLabel(unreadCount: number, muted: boolean): string {
    const normalizedCount = Math.max(0, Math.trunc(Number(unreadCount) || 0));
    if (normalizedCount > 0) {
      return `Open notifications, ${normalizedCount} new${muted ? ', alerts muted' : ''}`;
    }
    return muted ? 'Open notifications, alerts muted' : 'Open notifications';
  }

  private openNotificationCenter(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.accountLocationMissing()) return;
    this.closeSideMenu();
    this.notificationCenterStore.open();
  }

  private resolveActivityBadge(user: UserDto, key: ActivityCounterKey): number {
    const override = this.activityStore.getUserCounterOverride(user.id, key);
    if (override !== null) {
      return override;
    }
    return user.activities?.[key] ?? 0;
  }

  private openSettingsPopup(popup: NavigatorSettingsMenuItemId): void {
    if (popup === 'help' && !this.helpCenterService.hasActiveRevision()) {
      return;
    }
    if (popup === 'permissions' || popup === 'report-bugs' || popup === 'delete-account' || popup === 'logout') {
      return;
    }
    if (popup === 'privacy') {
      void this.privacyPolicy.prepareOpen();
    }
    if (popup === 'terms') {
      void this.termsPolicy.prepareOpen();
    }
    if (popup === 'help') {
      void this.helpCenterService.preload('help');
    }
    this.profileStore.openSettingsPopup(popup);
  }

  private openActivitiesShortcut(
    primaryFilter: 'rates' | 'chats' | 'events',
    eventScope?: 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'watchlist' | 'trash'
  ): void {
    if (this.serverActionsUnavailable() || (primaryFilter !== 'chats' && this.isBlockedUser())) {
      return;
    }
    this.memberMenuStore.openNavigatorActivitiesRequest(primaryFilter, eventScope);
  }

  private openingNotificationRoute = '';
  private async openNotificationRoute(url: string): Promise<void> {
    if (AppUtils.normalizeRoutePath(url) !== '/game' || this.openingNotificationRoute === url) return;
    const params = this.router.parseUrl(url).queryParams;
    if (!params['chatId'] && !params['mingleEventId']) return;
    const accountId = this.groupWorkspaces.context.accountUserId();
    this.openingNotificationRoute = url;
    try {
      const groupId = `${params['workspaceGroupId'] ?? ''}`.trim() || null;
      if (!await this.groupWorkspaces.select(groupId) || this.router.url !== url
          || this.groupWorkspaces.context.accountUserId() !== accountId) return;
      const userId = this.userProfileStore.activeUserId();
      await this.openNotificationChatTarget(url, userId);
      await this.openNotificationMingleTarget(url, userId);
    } finally {
      if (this.openingNotificationRoute === url) this.openingNotificationRoute = '';
    }
  }

  private async openNotificationChatTarget(url: string, userId: string): Promise<void> {
    if (AppUtils.normalizeRoutePath(url) !== '/game') return;
    const tree = this.router.parseUrl(url);
    const chatId = `${tree.queryParams['chatId'] ?? ''}`.trim();
    const targetMessageId = `${tree.queryParams['messageId'] ?? ''}`.trim();
    if (!chatId) return;
    const key = `${userId}:${chatId}:${targetMessageId}`;
    if (this.openingNotificationChat === key) return;
    this.openingNotificationChat = key;
    try {
      const chat = await this.chatsService.queryChatById(chatId);
      if (this.userProfileStore.activeUserId() !== userId || this.router.url !== url) return;
      if (!chat) return;
      await this.activitiesStore.ensureEventChatPopupLoaded();
      if (this.userProfileStore.activeUserId() !== userId || this.router.url !== url) return;
      delete tree.queryParams['chatId'];
      delete tree.queryParams['messageId'];
      delete tree.queryParams['workspaceGroupId'];
      await this.router.navigateByUrl(tree, { replaceUrl: true });
      if (this.userProfileStore.activeUserId() !== userId) return;
      this.activitiesStore.openEventChat(
        { ...eventChatPopupRequestFromChat(chat), targetMessageId: targetMessageId || null },
        eventChatHeaderStateFromChat(chat)
      );
    } finally {
      if (this.openingNotificationChat === key) this.openingNotificationChat = '';
    }
  }

  private openingSharedAsset = '';
  private async openSharedAssetTarget(url: string, userId: string): Promise<void> {
    if (AppUtils.normalizeRoutePath(url) !== '/game' || this.openingSharedAsset === url) return;
    const tree = this.router.parseUrl(url);
    const token = `${tree.queryParams['sharedAsset'] ?? ''}`.trim();
    if (!token) return;
    this.openingSharedAsset = url;
    try {
      const item = await this.sharedLinks.resolveToken(token, userId);
      if (this.router.url !== url || this.userProfileStore.activeUserId() !== userId) return;
      if (!item || item.kind !== 'asset' || !AppConstants.isAssetType(item.assetType)) throw new Error('Unavailable');
      delete tree.queryParams['sharedAsset']; delete tree.queryParams['affiliate'];
      await this.router.navigateByUrl(tree, {replaceUrl: true});
      this.memberMenuStore.requestActivitiesNavigation({type: 'assetExplore', assetId: item.entityId, assetType: item.assetType, viewOnly: true});
    } catch {
      if (this.router.url === url) this.dialogStore.open({title: 'invite.external.title', message: 'invite.external.failed', confirmLabel: 'OK'});
    } finally { if (this.openingSharedAsset === url) this.openingSharedAsset = ''; }
  }

  private async openPartnerInviteTarget(url: string, userId: string): Promise<void> {
    if (AppUtils.normalizeRoutePath(url) !== '/game') return;
    const tree = this.router.parseUrl(url);
    const token = `${tree.queryParams['partnerInvite'] ?? ''}`.trim();
    if (!token) return;
    const accountId = this.groupWorkspaces.context.accountId(userId);
    const key = `${accountId}:${token}`;
    if (this.openingPartnerInvite === key) return;
    this.openingPartnerInvite = key;
    try {
      const claim = await this.usersService.claimPartnerInvite(accountId, token);
      if (this.userProfileStore.activeUserId() !== userId || this.router.url !== url) return;
      if (claim.invitationAvailable && claim.groupId) {
        await this.groupWorkspaces.refresh(accountId);
        if (this.userProfileStore.activeUserId() !== userId || this.router.url !== url) return;
        if (!await this.groupWorkspaces.select(claim.groupId)) throw new Error('groups.switch.failed');
        if (this.groupWorkspaces.context.accountUserId() !== accountId || this.router.url !== url) return;
        delete tree.queryParams['partnerInvite'];
        delete tree.queryParams['affiliate'];
        await this.router.navigateByUrl(tree, { replaceUrl: true });
        return;
      }
      delete tree.queryParams['partnerInvite'];
        delete tree.queryParams['affiliate'];
      await this.router.navigateByUrl(tree, { replaceUrl: true });
      if (!claim.invitationAvailable) return;
      await this.usersService.loadUserById(userId);
      if (this.userProfileStore.activeUserId() === userId) {
        this.activitiesStore.openActivities('events', 'all');
      }
    } catch {
      if (this.groupWorkspaces.context.accountId(this.userProfileStore.activeUserId()) === accountId) this.dialogStore.open({
        title: 'event.partner.invite', message: 'event.partner.invite.failed', confirmLabel: 'OK'
      });
    } finally {
      if (this.openingPartnerInvite === key) this.openingPartnerInvite = '';
    }
  }

  private async openNotificationMingleTarget(url: string, userId: string): Promise<void> {
    if (AppUtils.normalizeRoutePath(url) !== '/game') return;
    const tree = this.router.parseUrl(url);
    const eventId = `${tree.queryParams['mingleEventId'] ?? ''}`.trim();
    if (!eventId) return;
    const key = `${userId}:${eventId}`;
    if (this.openingNotificationMingleTable === key) return;
    this.openingNotificationMingleTable = key;
    try {
      const opened = await this.mingleStore.openCurrentTable(eventId);
      if (!opened || this.userProfileStore.activeUserId() !== userId || this.router.url !== url) return;
      delete tree.queryParams['mingleEventId'];
      delete tree.queryParams['workspaceGroupId'];
      await this.router.navigateByUrl(tree, { replaceUrl: true });
    } finally {
      if (this.openingNotificationMingleTable === key) this.openingNotificationMingleTable = '';
    }
  }

  private async openBlockedUserSupportChat(): Promise<void> {
    const user = this.menuUser();
    if (!user || this.serverActionsUnavailable()) {
      return;
    }
    const activeUserId = user.id.trim();
    if (!activeUserId) {
      return;
    }
    const chat = await this.chatsService
      .queryChatById(`c-support-admin-${activeUserId}`)
      .catch(() => null);
    if (!chat) {
      this.dialogStore.openInfo('The support chat could not be found. Please contact MyScoutee support.', {
        title: 'Unable to open support chat'
      });
      return;
    }
    this.activitiesStore.openActivities('chats');
    this.activitiesStore.openEventChat(
      eventChatPopupRequestFromChat(chat),
      eventChatHeaderStateFromChat(chat)
    );
  }

  private resolveCompletionPercent(user: UserDto | null): number {
    return Number.isFinite(user?.completion) ? Math.max(0, Math.trunc(Number(user?.completion))) : 0;
  }

  private async openEventFeedbackPopupFromNavigatorRequest(): Promise<void> {
    await this.activitiesStore.ensureEventFeedbackPopupLoaded();
  }

  @HostListener('window:openFeaturePopup', ['$event'])
  protected onGlobalPopupRequest(event: Event): void {
    const popupEvent = event as CustomEvent<{ type?: 'eventEditor' | 'eventExplore' }>;
    if (popupEvent.detail?.type === 'eventExplore') {
      this.memberMenuStore.requestActivitiesNavigation({ type: 'eventExplore' });
      void this.activitiesStore.ensureEventExplorePopupLoaded();
      return;
    }
    if (popupEvent.detail?.type !== 'eventEditor') {
      return;
    }
    this.memberMenuStore.requestActivitiesNavigation({
      type: 'eventEditorCreate',
      target: 'events'
    });
    void this.eventEditorStore.ensureEventEditorPopupLoaded();
  }
}
