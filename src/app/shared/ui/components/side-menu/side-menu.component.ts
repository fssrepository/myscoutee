import {
  CommonModule
} from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
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
import {
  type ActivityCounters,
  AppMenuComponent,
  type ActivityCounterKey,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuValueMap,
  HeaderCardComponent,
  type HeaderCardModel,
  UiTaskScheduler,
  type UserImpressionChangeFlags
} from '../..';
import {
  ProfileHeaderCardConverter
} from '../../converters';
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
import {
  ExplanationGuideService,
  HelpCenterService,
  PrivacyPolicyService,
  SessionService,
  TermsPolicyService,
  UsersService,
  USER_BY_ID_LOAD_CONTEXT_KEY,
  USER_PROFILE_SAVE_CONTEXT_KEY,
  type HelpCenterRevisionDto,
  type PrivacyConsentDto,
  type UserDto
} from '../../../core';
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
  resolveSideMenuPresentation
} from './side-menu-presenters';
import type { ChatDTO } from '../../../core/contracts/chat.interface';
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

interface NavigatorAvatarState {
  badgeCount: number;
  imageUrl: string | null;
}

interface SideMenuUiState {
  open: boolean;
}

type NavigatorAvatarMenuItemId = 'navigator-avatar';
type NavigatorAvatarMenuContext = { kind: 'toggle-menu' };

interface NavigatorMenuUser extends UserDto {
  activities: ActivityCounters;
  impressionChangeFlags: UserImpressionChangeFlags;
  memberImpressionTitle: string;
  totalBadgeCount: number;
}

type NavigatorMenuShortcutId =
  | 'impressions'
  | 'feedback'
  | 'rates'
  | 'chat'
  | 'invitations'
  | 'events'
  | 'hosting'
  | 'transport'
  | 'accommodation'
  | 'supplies'
  | 'tickets'
  | 'contacts';

type NavigatorAdminMenuShortcutId =
  | 'adminReports'
  | 'adminFeedback'
  | 'adminChat'
  | 'adminJobs'
  | 'adminParams'
  | 'adminContent'
  | 'adminArticle'
  | 'adminStats'
  | 'adminMetrics'
  | 'adminGraph';

type NavigatorSettingsMenuItemId =
  | 'help'
  | 'feedback'
  | 'report-bugs'
  | 'privacy'
  | 'terms'
  | 'delete-account'
  | 'logout';

type NavigatorHeaderActionMenuItemId =
  | 'explanations'
  | 'share'
  | 'settings'
  | NavigatorSettingsMenuItemId;

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    AppMenuComponent,
    HeaderCardComponent,
    ProfileSettingsPopupsComponent,
    DialogComponent
  ],
  templateUrl: './side-menu.component.html',
  styleUrl: './side-menu.component.scss'
})
export class SideMenuComponent implements OnDestroy {
  private static readonly USER_REALTIME_POLL_INTERVAL_MS = 30000;

  private static readonly ACCOUNT_REACTIVATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
  private static readonly ADMIN_SESSION_STORAGE_KEY = APP_STORAGE_KEYS.adminSession;
  private static readonly USER_MENU_LOAD_DURATION_MS = 3000;

  private readonly router = inject(Router);
  private readonly userProfileStore = inject(UserProfileStore);
  protected readonly runtimeStore = inject(AppRuntimeStore);
  private readonly activityStore = inject(ActivityStore);
  protected readonly memberMenuStore = inject(MemberMenuStore);
  protected readonly activityInviteStore = inject(ActivityInvitePopupStore);
  private readonly adminMenuStore = inject(AdminMenuStore);
  private readonly adminWorkspaceStore = inject(AdminWorkspaceStore);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly helpCenterService = inject(HelpCenterService);
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  private readonly termsPolicy = inject(TermsPolicyService);
  private readonly usersService = inject(UsersService);
  private readonly sessionService = inject(SessionService);
  private readonly dialogStore = inject(DialogStore);
  protected readonly profileStore = inject(ProfileStore);
  protected readonly activitiesStore = inject(ActivitiesPopupStore);
  protected readonly assetPopupStore = inject(AssetPopupStore);
  private readonly assetStore = inject(AssetStore);
  protected readonly eventEditorStore = inject(EventEditorPopupStore);
  protected readonly subEventResourceStore = inject(SubEventResourcePopupStore);
  protected readonly stackedEventChatPopupInputs = computed(() => ({
    chatSession: this.activitiesStore.stackedEventChatSession(),
    chatHeader: this.activitiesStore.stackedEventChatHeader(),
    closeHostedChat: () => this.activitiesStore.closeStackedEventChat()
  }));
  private readonly currentRoutePathRef = signal(AppUtils.normalizeRoutePath(this.router.url));
  private readonly menuOpenRef = signal(false);
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
  private readonly userRealtimeScheduler = new UiTaskScheduler<string>({
    intervalMs: () => this.userRealtimePollIntervalMs(),
    state: () => this.userProfileStore.activeUserId().trim(),
    task: ({ state }) => this.runUserRealtimeLongPollTick(state)
  });
  private reactivationPromptUserId = '';
  private privacyConsentCheckToken = 0;
  private userMenuLoadOverdueTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly avatarState = computed<NavigatorAvatarState>(() => {
    const user = this.userProfileStore.activeUserProfile();
    return {
      badgeCount: user ? this.resolveUserBadgeCount(user) : 0,
      imageUrl: AppUtils.firstImageUrl(user?.images) || null
    };
  });
  protected readonly menuUiState = computed<SideMenuUiState>(() => ({
    open: this.menuOpenRef()
  }));
  protected readonly isCoveredByAssetPopup = computed(() =>
    this.assetPopupStore.visible()
    || this.activityInviteStore.activityInvitePopup() !== null
  );
  protected readonly avatarVisible = computed(() => {
    const path = this.currentRoutePathRef();
    const activeUserId = this.userProfileStore.activeUserId().trim();
    return Boolean(activeUserId) && path !== '/' && !path.startsWith('/entry');
  });
  protected readonly hasBindings = computed(() => this.profileStore.bindings() !== null);
  protected readonly isMenuOpen = computed(() => this.menuUiState().open);
  protected readonly hasOfflineProfile = computed(() =>
    !this.runtimeStore.isOnline() && this.userProfileStore.activeUserProfile() !== null
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
    this.avatarVisible() && (!this.canToggleAvatarMenu() || this.isProfileSaving() || this.hasProfileSaveError())
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
    const imageUrl = canToggle ? this.avatarState().imageUrl ?? '' : '';
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
  protected readonly menuUser = computed<NavigatorMenuUser | null>(() => {
    const activeUser = this.userProfileStore.activeUserProfile();
    if (!activeUser) {
      return null;
    }
    const activityOverrides = this.activityStore.getUserCounterOverrides(activeUser.id);
    const mergedActivities: ActivityCounters = {
      game: activityOverrides.game ?? activeUser.activities?.game ?? 0,
      chat: activityOverrides.chat ?? activeUser.activities?.chat ?? 0,
      invitations: activityOverrides.invitations ?? activeUser.activities?.invitations ?? 0,
      events: activityOverrides.events ?? activeUser.activities?.events ?? 0,
      hosting: activityOverrides.hosting ?? activeUser.activities?.hosting ?? 0,
      cars: activityOverrides.cars ?? activeUser.activities?.cars ?? 0,
      accommodation: activityOverrides.accommodation ?? activeUser.activities?.accommodation ?? 0,
      supplies: activityOverrides.supplies ?? activeUser.activities?.supplies ?? 0,
      tickets: activityOverrides.tickets ?? activeUser.activities?.tickets ?? 0,
      contacts: activityOverrides.contacts ?? activeUser.activities?.contacts ?? 0,
      feedback: activityOverrides.feedback ?? activeUser.activities?.feedback ?? 0,
      adminJobs: activityOverrides.adminJobs ?? activeUser.activities?.adminJobs ?? 0,
      adminMetrics: activityOverrides.adminMetrics ?? activeUser.activities?.adminMetrics ?? 0
    };
    const impressionChangeFlags = this.userProfileStore.getUserImpressionChangeFlags(activeUser.id);
    const traitPresentation = resolveSideMenuPresentation('trait', activeUser.traitLabel ?? '');
    const totalBadgeCount = this.userProfileStore.isAdminUserProfile(activeUser)
      ? (
        mergedActivities.game +
        mergedActivities.feedback +
        mergedActivities.chat +
        mergedActivities.adminJobs +
        mergedActivities.adminMetrics
      )
      : (
        (impressionChangeFlags.host ? 1 : 0) +
        (impressionChangeFlags.member ? 1 : 0) +
        mergedActivities.game +
        mergedActivities.chat +
        mergedActivities.invitations +
        mergedActivities.events +
        mergedActivities.hosting +
        mergedActivities.cars +
        mergedActivities.accommodation +
        mergedActivities.supplies +
        mergedActivities.tickets +
        mergedActivities.contacts +
        mergedActivities.feedback
      );
    return {
      ...activeUser,
      completion: this.resolveCompletionPercent(activeUser),
      impressions: this.userProfileStore.getUserImpressions(activeUser.id) ?? activeUser.impressions,
      activities: mergedActivities,
      impressionChangeFlags,
      memberImpressionTitle: traitPresentation.memberTitle ?? 'Attendee',
      totalBadgeCount
    };
  });
  protected readonly settingsMenuItems = computed<readonly AppMenuItem<NavigatorHeaderActionMenuItemId>[]>(() => {
    const items: AppMenuItem<NavigatorHeaderActionMenuItemId>[] = [
      {
        id: 'help',
        label: 'Help',
        icon: 'help_outline',
        counter: this.helpCenterService.activeVersionLabel(),
        disabled: !this.helpCenterService.hasActiveRevision(),
        ariaLabel: 'Open help'
      }
    ];
    if (!this.isAdminMode()) {
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
    if (!this.isAdminMode()) {
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
  protected readonly navigatorHeaderActionMenuModel = computed<AppMenuModel<NavigatorHeaderActionMenuItemId>>(() => {
    const items: AppMenuItem<NavigatorHeaderActionMenuItemId>[] = [];
    if (!this.isAdminMode()) {
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
          label: 'Share MyScoutee',
          icon: 'share',
          ariaLabel: 'Share MyScoutee'
        }
      );
    }
    items.push({
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      ariaLabel: this.isAdminMode() ? 'Open admin settings menu' : 'Open settings menu',
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
      chat: user.activities.chat,
      invitations: user.activities.invitations,
      events: user.activities.events,
      hosting: user.activities.hosting,
      transport: user.activities.cars,
      accommodation: user.activities.accommodation,
      supplies: user.activities.supplies,
      tickets: user.activities.tickets,
      contacts: user.activities.contacts
    };
  });
  protected readonly adminNavigatorMenuValues = computed<AppMenuValueMap<NavigatorAdminMenuShortcutId>>(() => {
    const user = this.menuUser();
    if (!user) {
      return {};
    }
    return {
      adminReports: user.activities.game,
      adminFeedback: user.activities.feedback,
      adminChat: user.activities.chat,
      adminJobs: user.activities.adminJobs,
      adminMetrics: user.activities.adminMetrics
    };
  });
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
              disabled: !this.runtimeStore.isOnline()
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
              palette: 'orange',
              ariaLabel: 'Open events',
              disabled: primaryDisabled
            },
            {
              id: 'hosting',
              label: 'My Events',
              icon: 'stadium',
              palette: 'teal',
              ariaLabel: 'Open my events',
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
              disabled: primaryDisabled
            },
            {
              id: 'contacts',
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
    const disabled = !this.runtimeStore.isOnline();
    return {
      nodes: [
        {
          id: 'admin-moderation',
          label: 'Moderation & support',
          icon: 'admin_panel_settings',
          palette: 'orange',
          items: [
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
        }
      ]
    };
  });

  constructor() {
    this.profileStore.registerBindings(this.profileBindings);

    this.routerEventsSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentRoutePathRef.set(AppUtils.normalizeRoutePath(event.urlAfterRedirects));
      }
    });

    effect(() => {
      const session = this.sessionService.session();
      const sessionUserId = session?.kind === 'firebase'
        ? session.profile.id.trim()
        : session?.userId.trim() ?? '';
      if (this.userProfileStore.activeUserId().trim() === sessionUserId) {
        return;
      }
      this.userProfileStore.setActiveUserId(sessionUserId);
    });

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
        : (activeUserId ? `demo:${activeUserId}` : '');

      if (!requestKey || this.hydrationRequestKeyRef() === requestKey) {
        return;
      }

      this.hydrationRequestKeyRef.set(requestKey);
      void this.hydrateUserAfterLogin(activeUserId || undefined);
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
      const activeUserId = this.userProfileStore.activeUserId().trim();
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

  protected onCloseMenu(): void {
    this.closeSideMenu();
  }

  protected onNavigatorHeaderActionMenuSelect(event: AppMenuItemSelectEvent<NavigatorHeaderActionMenuItemId>): void {
    switch (event.id) {
      case 'explanations':
        this.onToggleExplanationGuide(event.sourceEvent);
        return;
      case 'share':
        this.onShareProfile(event.sourceEvent);
        return;
      case 'settings':
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
      case 'hosting':
        this.openHostingShortcut(event.sourceEvent);
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
    const title = 'MyScoutee';
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
    return ProfileHeaderCardConverter.convert(user, {
      admin,
      showEdit: true,
      editDisabled: admin ? !this.runtimeStore.isOnline() : !this.runtimeStore.isOnline() || this.isBlockedUser(user),
      editAriaLabel: admin ? 'Open admin profile' : 'Open profile editor',
      showRing: !admin && this.showProfileSaveRing(),
      ringState: this.hasProfileSaveError() ? 'error' : 'loading',
      ringTitle: admin ? null : this.profileSaveAvatarTitle()
    });
  }

  protected openNavigatorHeaderProfile(event: Event): void {
    if (this.isAdminMode()) {
      this.openAdminProfileShortcut(event);
      return;
    }
    this.openProfileEditor(event);
  }

  protected navigatorOfflineNote(): string {
    return this.isAdminMode()
      ? 'Offline mode is active. Admin actions wait for the connection to return.'
      : 'Offline mode is active. Tickets stay available, while the other menu actions wait for the connection to return.';
  }

  protected isBlockedUser(user: NavigatorMenuUser | UserDto | null = this.menuUser()): boolean {
    return user?.profileStatus === 'blocked';
  }

  protected isPrimaryMenuDisabled(user: NavigatorMenuUser): boolean {
    return !this.runtimeStore.isOnline() || this.isBlockedUser(user);
  }

  protected openProfileEditor(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline() || this.isBlockedUser()) {
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
    if (!this.runtimeStore.isOnline() || this.isBlockedUser()) {
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
    this.openActivitiesShortcut('events', 'active-events');
  }

  protected openHostingShortcut(event?: Event): void {
    event?.stopPropagation();
    this.openActivitiesShortcut('events', 'my-events');
  }

  protected openAssetTransportPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline() || this.isBlockedUser()) {
      return;
    }
    this.memberMenuStore.openNavigatorAssetRequest(AppConstants.ASSET_TYPE_TRANSPORT);
  }

  protected openAssetAccommodationPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline() || this.isBlockedUser()) {
      return;
    }
    this.memberMenuStore.openNavigatorAssetRequest(AppConstants.ASSET_TYPE_ACCOMMODATION);
  }

  protected openAssetSuppliesPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline() || this.isBlockedUser()) {
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
    if (!this.runtimeStore.isOnline() || this.isBlockedUser()) {
      return;
    }
    this.memberMenuStore.openNavigatorEventFeedbackRequest();
  }

  protected isAdminMode(): boolean {
    return this.currentRoutePathRef().startsWith('/admin');
  }

  protected openAdminReportsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
      return;
    }
    this.adminMenuStore.openReports(this.adminWorkspaceStore.dashboard()?.reportedUsers[0] ?? null);
  }

  protected openAdminFeedbackShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
      return;
    }
    this.adminMenuStore.openFeedback();
  }

  protected openAdminChatShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
      return;
    }
    this.memberMenuStore.openNavigatorActivitiesRequest('chats', undefined, { adminServiceOnly: true });
  }

  protected openAdminProfileShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
      return;
    }
    this.profileStore.openProfileEditor();
  }

  protected openAdminHelpEditorShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
      return;
    }
    this.adminMenuStore.openHelpEditor();
  }

  protected openAdminIdeaEditorShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
      return;
    }
    this.adminMenuStore.openIdeaEditor();
  }

  protected openAdminNotificationsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
      return;
    }
    this.adminMenuStore.openNotifications();
  }

  protected openAdminParamsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
      return;
    }
    this.adminMenuStore.openParams();
  }

  protected openAdminStatsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
      return;
    }
    this.adminMenuStore.openStats();
  }

  protected openAdminAffinityGraphShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
      return;
    }
    this.adminMenuStore.openAffinityGraph();
  }

  protected openAdminMonitoringShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.runtimeStore.isOnline()) {
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
    const isFirebaseSession = this.sessionService.currentSession()?.kind === 'firebase';
    const loadedProfileExt = await this.usersService.loadProfileExtById(isFirebaseSession ? undefined : userId);
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
    return loadedUser;
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
      message: 'This account is scheduled for deletion. You can reactivate it within 30 days and continue using MyScoutee normally.',
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
    const activeUserId = this.userProfileStore.activeUserId().trim();
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
    this.profileStore.openImpressionsPopup(normalizedUserId);
  }

  private openDeleteAccountConfirm(): void {
    const activeUserName = this.userProfileStore.activeUserProfile()?.name?.trim() || 'this account';
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
          await this.sessionService.logout().finally(() => this.router.navigate(['/admin']));
          return;
        }
        const activeUserId = this.userProfileStore.activeUserId().trim();
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
    const activeUserName = this.userProfileStore.activeUserProfile()?.name?.trim() || '';
    this.dialogStore.open({
      title: 'Logout?',
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
        const activeUserId = this.userProfileStore.activeUserId().trim();
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
          await this.sessionService.logout().finally(() => this.router.navigate(['/admin']));
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
    this.userRealtimeScheduler.restart();
  }

  private stopUserRealtimeLongPoll(): void {
    this.userRealtimeScheduler.stop({ abort: true });
    this.userProfileStore.setUserRealtimePollInFlight(false);
  }

  private userRealtimePollIntervalMs(): number {
    return this.sessionService.session() && this.userProfileStore.activeUserId().trim()
      ? SideMenuComponent.USER_REALTIME_POLL_INTERVAL_MS
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
    const path = AppUtils.normalizeRoutePath(routeUrl);
    return path !== '/' && !path.startsWith('/entry') && !path.startsWith('/admin');
  }

  private async runUserRealtimeLongPollTick(userId: string): Promise<void> {
    if (!userId) {
      return;
    }
    this.userProfileStore.setUserRealtimePollInFlight(true);
    try {
      const cursor = this.userProfileStore.getUserRealtimeCursor(userId);
      const snapshot = await this.usersService.pollUserRealtimeSnapshot(userId, cursor);
      if (!snapshot || this.userProfileStore.activeUserId().trim() !== userId) {
        return;
      }
      this.userProfileStore.applyUserRealtimeSnapshot(userId, snapshot);
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
      return (
        this.resolveActivityBadge(user, 'game') +
        this.resolveActivityBadge(user, 'chat') +
        this.resolveActivityBadge(user, 'feedback') +
        this.resolveActivityBadge(user, 'adminJobs') +
        this.resolveActivityBadge(user, 'adminMetrics')
      );
    }
    const impressionFlags = this.userProfileStore.getUserImpressionChangeFlags(user.id);
    return (
      (impressionFlags.host ? 1 : 0) +
      (impressionFlags.member ? 1 : 0) +
      this.resolveActivityBadge(user, 'game') +
      this.resolveActivityBadge(user, 'chat') +
      this.resolveActivityBadge(user, 'invitations') +
      this.resolveActivityBadge(user, 'events') +
      this.resolveActivityBadge(user, 'hosting') +
      this.resolveActivityBadge(user, 'cars') +
      this.resolveActivityBadge(user, 'accommodation') +
      this.resolveActivityBadge(user, 'supplies') +
      this.resolveActivityBadge(user, 'tickets') +
      this.resolveActivityBadge(user, 'contacts') +
      this.resolveActivityBadge(user, 'feedback')
    );
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
    if (popup === 'report-bugs' || popup === 'delete-account' || popup === 'logout') {
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
    eventScope?: 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'trash'
  ): void {
    if (!this.runtimeStore.isOnline() || (primaryFilter !== 'chats' && this.isBlockedUser())) {
      return;
    }
    this.memberMenuStore.openNavigatorActivitiesRequest(primaryFilter, eventScope);
  }

  private openBlockedUserSupportChat(): void {
    const user = this.menuUser();
    if (!user || !this.runtimeStore.isOnline()) {
      return;
    }
    const activeUserId = user.id.trim();
    const adminUserId = 'myscoutee-admin';
    const chat: ChatDTO & { ownerUserId?: string } = {
      id: `c-support-blocked-${activeUserId}`,
      avatar: 'MS',
      title: 'MyScoutee Support',
      lastMessage: 'Your account is blocked. You can message MyScoutee support here.',
      lastSenderId: adminUserId,
      memberIds: [activeUserId, adminUserId],
      unread: 1,
      dateIso: new Date().toISOString(),
      channelType: 'appSupport',
      ownerUserId: activeUserId
    };
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
