import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, Type, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router } from '@angular/router';
import type { Subscription } from 'rxjs';
import {
  type ActivityCounters,
  AppContext,
  AppMenuComponent,
  AppPopupContext,
  type ActivityCounterKey,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuValueMap,
  HeaderCardComponent,
  type HeaderCardModel,
  type UserImpressionChangeFlags
} from '../../../shared/ui';
import { ProfileHeaderCardConverter } from '../../../shared/ui/converters';
import { AppUtils } from '../../../shared/app-utils';
import { AssetPopupStateService } from '../../../asset/asset-popup-state.service';
import { OwnedAssetsPopupFacadeService } from '../../../asset/owned-assets-popup-facade.service';
import { ActivitiesPopupStateService } from '../../../activity/services/activities-popup-state.service';
import { EventEditorPopupStateService } from '../../../activity/services/event-editor-popup-state.service';
import {
  ExplanationGuideService,
  HelpCenterService,
  PrivacyPolicyService,
  TermsPolicyService,
  USER_BY_ID_LOAD_CONTEXT_KEY,
  USER_PROFILE_SAVE_CONTEXT_KEY,
  type UserDto
} from '../../../shared/core';
import { USER_LOGOUT_CONTEXT_KEY } from '../../../shared/core/base/services/users.service';
import { ConfirmationDialogComponent } from '../../../shared/ui/components/confirmation-dialog/confirmation-dialog.component';
import { NavigatorSettingsPopupsComponent } from '../navigator-settings-popups/navigator-settings-popups.component';
import { SubEventResourcePopupController } from '../../../activity/services/sub-event-resource-popup.controller';
import { NavigatorService } from '../../navigator.service';
import { resolveNavigatorPresentation } from '../../navigator-presenters';
import type { ChatRecord } from '../../../shared/core/contracts/chat.interface';

interface NavigatorAvatarState {
  badgeCount: number;
  imageUrl: string | null;
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
  | 'car'
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
  selector: 'app-navigator',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    AppMenuComponent,
    HeaderCardComponent,
    NavigatorSettingsPopupsComponent,
    ConfirmationDialogComponent
  ],
  templateUrl: './navigator.component.html',
  styleUrl: './navigator.component.scss'
})
export class NavigatorComponent implements OnDestroy {
  private static readonly USER_MENU_LOAD_DURATION_MS = 3000;

  private readonly router = inject(Router);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly helpCenterService = inject(HelpCenterService);
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  private readonly termsPolicy = inject(TermsPolicyService);
  private readonly navigatorService = inject(NavigatorService);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly assetPopupService = inject(AssetPopupStateService);
  private readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);
  private readonly eventEditorService = inject(EventEditorPopupStateService);
  protected readonly subEventResources = inject(SubEventResourcePopupController);
  private readonly currentRoutePathRef = signal(AppUtils.normalizeRoutePath(this.router.url));
  private readonly userMenuLoadOverdueRef = signal(false);
  private readonly activeUserLoadState = this.appCtx.selectLoadingState(USER_BY_ID_LOAD_CONTEXT_KEY);
  private readonly profileSaveLoadState = this.appCtx.selectLoadingState(USER_PROFILE_SAVE_CONTEXT_KEY);
  private readonly userLogoutLoadState = this.appCtx.selectLoadingState(USER_LOGOUT_CONTEXT_KEY);
  private readonly routerEventsSubscription: Subscription;
  private lastHandledActivitiesRequestMs = 0;
  private lastHandledAssetRequestMs = 0;
  private lastHandledEventFeedbackRequestMs = 0;
  private userMenuLoadOverdueTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly navigatorImpressionsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly profileEditorComponentRef = signal<Type<unknown> | null>(null);
  private readonly profileViewPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventMembersPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventResourcePopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventSupplyContributionsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly assetMemberPickerPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly activitiesPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly assetPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventFeedbackPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly contactsPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly explanationPopupComponentRef = signal<Type<unknown> | null>(null);

  protected readonly navigatorImpressionsPopupComponent = this.navigatorImpressionsPopupComponentRef.asReadonly();
  protected readonly profileEditorComponent = this.profileEditorComponentRef.asReadonly();
  protected readonly profileViewPopupComponent = this.profileViewPopupComponentRef.asReadonly();
  protected readonly eventMembersPopupComponent = this.eventMembersPopupComponentRef.asReadonly();
  protected readonly eventResourcePopupComponent = this.eventResourcePopupComponentRef.asReadonly();
  protected readonly eventSupplyContributionsPopupComponent = this.eventSupplyContributionsPopupComponentRef.asReadonly();
  protected readonly assetMemberPickerPopupComponent = this.assetMemberPickerPopupComponentRef.asReadonly();
  protected readonly eventEditorPopupComponent = this.eventEditorPopupComponentRef.asReadonly();
  protected readonly activitiesPopupComponent = this.activitiesPopupComponentRef.asReadonly();
  protected readonly assetPopupComponent = this.assetPopupComponentRef.asReadonly();
  protected readonly eventFeedbackPopupComponent = this.eventFeedbackPopupComponentRef.asReadonly();
  protected readonly contactsPopupComponent = this.contactsPopupComponentRef.asReadonly();
  protected readonly explanationPopupComponent = this.explanationPopupComponentRef.asReadonly();
  protected readonly bindings = this.navigatorService.bindings;
  protected readonly activeUser = this.appCtx.activeUserProfile;
  protected readonly explanationGuideEnabled = this.explanationGuide.enabled;
  protected readonly helpVersionLabel = this.helpCenterService.activeVersionLabel;
  protected readonly hasActiveHelpRevision = this.helpCenterService.hasActiveRevision;
  protected readonly privacyVersionLabel = this.privacyPolicy.activeVersionLabel;
  protected readonly termsVersionLabel = this.termsPolicy.activeVersionLabel;
  protected readonly isOnline = this.appCtx.isOnline;
  protected readonly avatarState = computed<NavigatorAvatarState>(() => {
    const user = this.activeUser();
    return {
      badgeCount: user ? this.resolveUserBadgeCount(user) : 0,
      imageUrl: AppUtils.firstImageUrl(user?.images) || null
    };
  });
  protected readonly menuUiState = this.navigatorService.menuUiState;
  protected readonly isCoveredByAssetPopup = this.navigatorService.navigatorCoveredByAssetPopup;
  protected readonly avatarVisible = computed(() => {
    const path = this.currentRoutePathRef();
    return path !== '/' && !path.startsWith('/entry');
  });
  protected readonly hasBindings = computed(() => this.bindings() !== null);
  protected readonly isMenuOpen = computed(() => this.menuUiState().open);
  protected readonly hasOfflineProfile = computed(() =>
    !this.appCtx.isOnline() && this.activeUser() !== null
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
    const user = this.activeUser();
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
            durationMs: NavigatorComponent.USER_MENU_LOAD_DURATION_MS
          }
        : null,
      context: { kind: 'toggle-menu' }
    }];
  });
  protected readonly menuUser = computed<NavigatorMenuUser | null>(() => {
    const activeUser = this.appCtx.activeUserProfile();
    if (!activeUser) {
      return null;
    }
    const activityOverrides = this.appCtx.getUserCounterOverrides(activeUser.id);
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
    const impressionChangeFlags = this.appCtx.getUserImpressionChangeFlags(activeUser.id);
    const traitPresentation = resolveNavigatorPresentation('trait', activeUser.traitLabel ?? '');
    const totalBadgeCount = this.appCtx.isAdminUserProfile(activeUser)
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
      impressions: this.appCtx.getUserImpressions(activeUser.id) ?? activeUser.impressions,
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
        counter: this.helpVersionLabel(),
        disabled: !this.hasActiveHelpRevision(),
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
        counter: this.privacyVersionLabel(),
        ariaLabel: 'Open privacy'
      },
      {
        id: 'terms',
        label: 'Terms',
        icon: 'rule',
        counter: this.termsVersionLabel(),
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
          checked: this.explanationGuideEnabled(),
          ariaLabel: this.explanationGuideEnabled() ? 'Turn explanations off' : 'Turn explanations on'
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
      car: user.activities.cars,
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
    const hostTierPresentation = resolveNavigatorPresentation('hostTier', user.hostTier);
    const traitPresentation = resolveNavigatorPresentation('trait', user.traitLabel);
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
              disabled: !this.isOnline()
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
              id: 'car',
              label: 'Car',
              icon: 'directions_car',
              palette: 'blue',
              ariaLabel: 'Car',
              disabled: primaryDisabled
            },
            {
              id: 'accommodation',
              label: 'Property',
              icon: 'apartment',
              palette: 'green',
              ariaLabel: 'Property',
              disabled: primaryDisabled
            },
            {
              id: 'supplies',
              label: 'Supplies',
              icon: 'inventory_2',
              palette: 'brown',
              ariaLabel: 'Supplies',
              disabled: primaryDisabled
            },
            {
              id: 'tickets',
              label: 'Ticket',
              icon: 'qr_code_2',
              palette: 'blue',
              ariaLabel: 'Ticket',
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
    const disabled = !this.isOnline();
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
    this.routerEventsSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.currentRoutePathRef.set(AppUtils.normalizeRoutePath(event.urlAfterRedirects));
      }
    });

    effect(() => {
      const isInternal = this.avatarVisible();
      const hasBindings = this.hasBindings();
      const status = this.activeUserLoadState().status;

      if (!isInternal) {
        this.navigatorService.closeMenu();
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
      const isOpen = this.navigatorService.impressionsPopupOpen();
      if (isOpen && !this.navigatorImpressionsPopupComponentRef()) {
        void this.ensureNavigatorImpressionsPopupLoaded();
      }
    });

    effect(() => {
      const isOpen = this.navigatorService.profileEditorOpen();
      if (isOpen && !this.profileEditorComponentRef()) {
        void this.ensureProfileEditorLoaded();
      }
    });

    effect(() => {
      const isOpen = this.navigatorService.profileViewOpen();
      if (isOpen && !this.profileViewPopupComponentRef()) {
        void this.ensureProfileViewPopupLoaded();
      }
    });

    effect(() => {
      const isOpen = this.eventEditorService.isOpen();
      if (isOpen && !this.eventEditorPopupComponentRef()) {
        void this.ensureEventEditorPopupLoaded();
      }
    });

    effect(() => {
      const request = this.popupCtx.activitiesNavigationRequest();
      if (!request || (request.type !== 'eventEditorCreate' && request.type !== 'eventEditor')) {
        return;
      }
      void this.ensureEventEditorPopupLoaded();
    });

    effect(() => {
      const request = this.popupCtx.activitiesNavigationRequest();
      if (!request || (request.type !== 'members' && request.type !== 'eventEditorMembers')) {
        return;
      }
      void this.ensureEventMembersPopupLoaded();
    });

    effect(() => {
      const isActivitiesOpen = this.activitiesContext.activitiesOpen();
      if (isActivitiesOpen && !this.activitiesPopupComponentRef()) {
        void this.ensureActivitiesPopupLoaded();
      }
    });

    effect(() => {
      const isContactsOpen = this.navigatorService.contactsPopupOpen();
      if (isContactsOpen && !this.contactsPopupComponentRef()) {
        void this.ensureContactsPopupLoaded();
      }
    });

    effect(() => {
      const isAssetPopupVisible = this.assetPopupService.visible();
      if (isAssetPopupVisible && !this.assetPopupComponentRef()) {
        void this.ensureAssetPopupLoaded();
      }
    });

    effect(() => {
      const resourceHost = this.subEventResources.resourceHost();
      if (resourceHost && !this.eventResourcePopupComponentRef()) {
        void this.ensureEventResourcePopupLoaded();
      }
    });

    effect(() => {
      const supplyContributionsHost = this.subEventResources.supplyContributionsHost();
      if (supplyContributionsHost && !this.eventSupplyContributionsPopupComponentRef()) {
        void this.ensureEventSupplyContributionsPopupLoaded();
      }
    });

    effect(() => {
      const activityInvitePopup = this.popupCtx.activityInvitePopup();
      if (activityInvitePopup?.ownerId?.trim() && !this.assetMemberPickerPopupComponentRef()) {
        void this.ensureAssetMemberPickerPopupLoaded();
      }
    });

    effect(() => {
      const request = this.popupCtx.navigatorActivitiesRequest();
      if (!request || request.updatedMs <= this.lastHandledActivitiesRequestMs) {
        return;
      }
      this.lastHandledActivitiesRequestMs = request.updatedMs;
      this.activitiesContext.openActivities(request.primaryFilter, request.eventScope, undefined, false, {
        adminServiceOnly: request.adminServiceOnly === true
      });
      this.popupCtx.clearNavigatorActivitiesRequest();
    });

    effect(() => {
      const request = this.popupCtx.navigatorAssetRequest();
      if (!request || request.updatedMs <= this.lastHandledAssetRequestMs) {
        return;
      }
      this.lastHandledAssetRequestMs = request.updatedMs;
      this.ownedAssets.openPopup(request.assetFilter);
      this.popupCtx.clearNavigatorAssetRequest();
    });

    effect(() => {
      const request = this.popupCtx.navigatorEventFeedbackRequest();
      if (!request || request.updatedMs <= this.lastHandledEventFeedbackRequestMs) {
        return;
      }
      this.lastHandledEventFeedbackRequestMs = request.updatedMs;
      void this.openEventFeedbackPopupFromNavigatorRequest();
    });

    effect(() => {
      const isVisible = this.explanationGuide.hasVisiblePopup();
      if (isVisible && !this.explanationPopupComponentRef()) {
        void this.ensureExplanationPopupLoaded();
      }
    });
  }

  @HostListener('window:online')
  protected onWindowOnline(): void {
    this.appCtx.setOnlineState(true);
  }

  @HostListener('window:offline')
  protected onWindowOffline(): void {
    this.appCtx.setOnlineState(false);
  }

  protected onAvatarMenuSelect(
    event: AppMenuItemSelectEvent<NavigatorAvatarMenuItemId, NavigatorAvatarMenuContext>
  ): void {
    if (event.context?.kind !== 'toggle-menu' || !this.canToggleAvatarMenu()) {
      return;
    }
    this.navigatorService.toggleMenu();
  }

  protected onCloseMenu(): void {
    this.navigatorService.closeMenu();
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
        this.navigatorService.openDeleteAccountConfirm();
        return;
      case 'logout':
        this.navigatorService.openLogoutConfirm();
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
      case 'car':
        this.openAssetCarPopup(event.sourceEvent);
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
      editDisabled: admin ? !this.isOnline() : !this.isOnline() || this.isBlockedUser(user),
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
    return !this.isOnline() || this.isBlockedUser(user);
  }

  protected openProfileEditor(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline() || this.isBlockedUser()) {
      return;
    }
    if (this.isAdminMode()) {
      this.popupCtx.openAdminNavigatorRequest('profile');
      return;
    }
    this.navigatorService.openProfileEditor();
  }

  protected impressionShortcutBadgeCount(user: NavigatorMenuUser): number {
    return Number(user.impressionChangeFlags.host) + Number(user.impressionChangeFlags.member);
  }

  protected openImpressions(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline() || this.isBlockedUser()) {
      return;
    }
    this.navigatorService.openImpressionsPopup();
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

  protected openAssetCarPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline() || this.isBlockedUser()) {
      return;
    }
    this.popupCtx.openNavigatorAssetRequest('Car');
  }

  protected openAssetAccommodationPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline() || this.isBlockedUser()) {
      return;
    }
    this.popupCtx.openNavigatorAssetRequest('Accommodation');
  }

  protected openAssetSuppliesPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline() || this.isBlockedUser()) {
      return;
    }
    this.popupCtx.openNavigatorAssetRequest('Supplies');
  }

  protected openAssetTicketsPopup(event?: Event): void {
    event?.stopPropagation();
    this.popupCtx.openNavigatorAssetRequest('Ticket');
  }

  protected openContactsPopup(event?: Event): void {
    event?.stopPropagation();
    this.navigatorService.openContactsPopup();
  }

  protected openEventFeedbackPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline() || this.isBlockedUser()) {
      return;
    }
    this.popupCtx.openNavigatorEventFeedbackRequest();
  }

  protected isAdminMode(): boolean {
    return this.currentRoutePathRef().startsWith('/admin');
  }

  protected openAdminReportsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('reports');
  }

  protected openAdminFeedbackShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('feedback');
  }

  protected openAdminChatShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('chat');
  }

  protected openAdminProfileShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('profile');
  }

  protected openAdminHelpEditorShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('help-editor');
  }

  protected openAdminIdeaEditorShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('idea-editor');
  }

  protected openAdminNotificationsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('notifications');
  }

  protected openAdminParamsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('params');
  }

  protected openAdminStatsShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('stats');
  }

  protected openAdminAffinityGraphShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('affinity-graph');
  }

  protected openAdminMonitoringShortcut(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openAdminNavigatorRequest('monitoring');
  }

  ngOnDestroy(): void {
    this.routerEventsSubscription.unsubscribe();
    this.clearUserMenuLoadState();
  }

  private beginUserMenuLoadWindow(): void {
    if (this.userMenuLoadOverdueTimer || this.userMenuLoadOverdueRef()) {
      return;
    }
    this.userMenuLoadOverdueRef.set(false);
    this.userMenuLoadOverdueTimer = setTimeout(() => {
      this.userMenuLoadOverdueTimer = null;
      this.userMenuLoadOverdueRef.set(true);
    }, NavigatorComponent.USER_MENU_LOAD_DURATION_MS);
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
    if (this.appCtx.isAdminUserProfile(user)) {
      return (
        this.resolveActivityBadge(user, 'game') +
        this.resolveActivityBadge(user, 'chat') +
        this.resolveActivityBadge(user, 'feedback') +
        this.resolveActivityBadge(user, 'adminJobs') +
        this.resolveActivityBadge(user, 'adminMetrics')
      );
    }
    const impressionFlags = this.appCtx.getUserImpressionChangeFlags(user.id);
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
    const override = this.appCtx.getUserCounterOverride(user.id, key);
    if (override !== null) {
      return override;
    }
    return user.activities?.[key] ?? 0;
  }

  private openSettingsPopup(popup: NavigatorSettingsMenuItemId): void {
    if (popup === 'help' && !this.hasActiveHelpRevision()) {
      return;
    }
    if (popup === 'report-bugs' || popup === 'delete-account' || popup === 'logout') {
      return;
    }
    this.navigatorService.openSettingsPopup(popup);
  }

  private openActivitiesShortcut(
    primaryFilter: 'rates' | 'chats' | 'events',
    eventScope?: 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'trash'
  ): void {
    if (!this.isOnline() || (primaryFilter !== 'chats' && this.isBlockedUser())) {
      return;
    }
    this.popupCtx.openNavigatorActivitiesRequest(primaryFilter, eventScope);
  }

  private openBlockedUserSupportChat(): void {
    const user = this.menuUser();
    if (!user || !this.isOnline()) {
      return;
    }
    const activeUserId = user.id.trim();
    const adminUserId = 'myscoutee-admin';
    const chat: ChatRecord & { ownerUserId?: string } = {
      id: `c-support-blocked-${activeUserId}`,
      avatar: 'MS',
      title: 'MyScoutee Support',
      lastMessage: 'Your account is blocked. You can message MyScoutee support here.',
      lastSenderId: adminUserId,
      memberIds: [activeUserId, adminUserId],
      unread: 1,
      dateIso: new Date().toISOString(),
      channelType: 'serviceEvent',
      serviceContext: 'notification',
      ownerUserId: activeUserId
    };
    this.activitiesContext.openActivities('chats');
    this.activitiesContext.openEventChat(chat);
  }

  private resolveCompletionPercent(user: UserDto | null): number {
    return Number.isFinite(user?.completion) ? Math.max(0, Math.trunc(Number(user?.completion))) : 0;
  }

  private async ensureNavigatorImpressionsPopupLoaded(): Promise<void> {
    if (this.navigatorImpressionsPopupComponentRef()) {
      return;
    }
    const module = await import('../navigator-impressions-popup/navigator-impressions-popup.component');
    this.navigatorImpressionsPopupComponentRef.set(module.NavigatorImpressionsPopupComponent);
  }

  private async ensureProfileEditorLoaded(): Promise<void> {
    if (this.profileEditorComponentRef()) {
      return;
    }
    const module = await import('../profile-editor/profile-editor.component');
    this.profileEditorComponentRef.set(module.ProfileEditorComponent);
  }

  private async ensureProfileViewPopupLoaded(): Promise<void> {
    if (this.profileViewPopupComponentRef()) {
      return;
    }
    const module = await import('../profile-view-popup/profile-view-popup.component');
    this.profileViewPopupComponentRef.set(module.ProfileViewPopupComponent);
  }

  private async ensureEventMembersPopupLoaded(): Promise<void> {
    if (this.eventMembersPopupComponentRef()) {
      return;
    }
    const module = await import('../../../activity/components/event-members-popup/event-members-popup.component');
    this.eventMembersPopupComponentRef.set(module.EventMembersPopupComponent);
  }

  private async ensureEventResourcePopupLoaded(): Promise<void> {
    if (this.eventResourcePopupComponentRef()) {
      return;
    }
    const module = await import('../../../activity/components/event-resource-popup/event-resource-popup.component');
    this.eventResourcePopupComponentRef.set(module.EventResourcePopupComponent);
  }

  private async ensureEventSupplyContributionsPopupLoaded(): Promise<void> {
    if (this.eventSupplyContributionsPopupComponentRef()) {
      return;
    }
    const module = await import('../../../activity/components/event-supply-contributions-popup/event-supply-contributions-popup.component');
    this.eventSupplyContributionsPopupComponentRef.set(module.EventSupplyContributionsPopupComponent);
  }

  private async ensureAssetMemberPickerPopupLoaded(): Promise<void> {
    if (this.assetMemberPickerPopupComponentRef()) {
      return;
    }
    const module = await import('../../../asset/components/asset-member-picker-popup/asset-member-picker-popup.component');
    this.assetMemberPickerPopupComponentRef.set(module.AssetMemberPickerPopupComponent);
  }

  private async ensureEventEditorPopupLoaded(): Promise<void> {
    if (this.eventEditorPopupComponentRef()) {
      return;
    }
    const module = await import('../../../activity/components/event-editor-popup/event-editor-popup.component');
    this.eventEditorPopupComponentRef.set(module.EventEditorPopupComponent);
  }

  private async ensureActivitiesPopupLoaded(): Promise<void> {
    if (this.activitiesPopupComponentRef()) {
      return;
    }
    const module = await import('../../../activity/components/activities-popup/activities-popup.component');
    this.activitiesPopupComponentRef.set(module.ActivitiesPopupComponent);
  }

  private async ensureAssetPopupLoaded(): Promise<void> {
    if (this.assetPopupComponentRef()) {
      return;
    }
    const module = await import('../../../asset/components/asset-popup/asset-popup.component');
    this.assetPopupComponentRef.set(module.AssetPopupComponent);
  }

  private async ensureEventFeedbackPopupLoaded(): Promise<void> {
    if (this.eventFeedbackPopupComponentRef()) {
      return;
    }
    const module = await import('../../../activity/components/event-feedback-popup/event-feedback-popup.component');
    this.eventFeedbackPopupComponentRef.set(module.EventFeedbackPopupComponent);
  }

  private async ensureContactsPopupLoaded(): Promise<void> {
    if (this.contactsPopupComponentRef()) {
      return;
    }
    const module = await import('../contacts-popup/contacts-popup.component');
    this.contactsPopupComponentRef.set(module.ContactsPopupComponent);
  }

  private async ensureExplanationPopupLoaded(): Promise<void> {
    if (this.explanationPopupComponentRef()) {
      return;
    }
    const module = await import('../../../shared/ui/components/explanation-popup/explanation-popup.component');
    this.explanationPopupComponentRef.set(module.ExplanationPopupComponent);
  }

  private async openEventFeedbackPopupFromNavigatorRequest(): Promise<void> {
    await this.ensureEventFeedbackPopupLoaded();
  }

  @HostListener('window:openFeaturePopup', ['$event'])
  protected onGlobalPopupRequest(event: Event): void {
    const popupEvent = event as CustomEvent<{ type?: 'eventEditor' | 'eventExplore' }>;
    if (popupEvent.detail?.type !== 'eventEditor') {
      return;
    }
    this.popupCtx.requestActivitiesNavigation({
      type: 'eventEditorCreate',
      target: 'events'
    });
    void this.ensureEventEditorPopupLoaded();
  }
}
