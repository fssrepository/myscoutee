import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { AppPopupContext, type ActivityCounters, type UserImpressionChangeFlags } from '../../../shared/ui';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AppContext } from '../../../shared/ui';
import { ExplanationGuideService, HelpCenterService, PrivacyPolicyService, TermsPolicyService, USER_PROFILE_SAVE_CONTEXT_KEY, type UserDto } from '../../../shared/core';
import { USER_LOGOUT_CONTEXT_KEY } from '../../../shared/core/base/services/users.service';
import {
  resolveHostTierIcon, resolveMemberImpressionTitle, resolveTraitIcon
} from '../../navigator-presenters';
import {
  AppMenuComponent,
  ProgressIndicatorComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuModel,
  type AppMenuPalette,
  type AppMenuValueMap
} from '../../../shared/ui';
import { NavigatorService, type NavigatorSettingsPopup } from '../../navigator.service';
import { ActivitiesPopupStateService } from '../../../activity/services/activities-popup-state.service';
import type { ChatRecord } from '../../../shared/core/contracts/chat.interface';

interface NavigatorMenuUser extends Omit<UserDto, 'activities'> {
  activities: ActivityCounters;
  featuredImagePreview: string | null;
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
  selector: 'app-navigator-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatRippleModule, ProgressIndicatorComponent, AppMenuComponent],
  templateUrl: './navigator-menu.component.html',
  styleUrl: './navigator-menu.component.scss'
})
export class NavigatorMenuComponent {
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly helpCenter = inject(HelpCenterService);
  private readonly privacyPolicy = inject(PrivacyPolicyService);
  private readonly termsPolicy = inject(TermsPolicyService);
  private readonly router = inject(Router);
  private readonly navigatorService = inject(NavigatorService);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly profileSaveLoadState = this.appCtx.selectLoadingState(USER_PROFILE_SAVE_CONTEXT_KEY);
  private readonly userLogoutLoadState = this.appCtx.selectLoadingState(USER_LOGOUT_CONTEXT_KEY);
  protected readonly activeUser = this.appCtx.activeUserProfile;
  protected readonly explanationGuideEnabled = this.explanationGuide.enabled;
  protected readonly helpVersionLabel = this.helpCenter.activeVersionLabel;
  protected readonly hasActiveHelpRevision = this.helpCenter.hasActiveRevision;
  protected readonly privacyVersionLabel = this.privacyPolicy.activeVersionLabel;
  protected readonly termsVersionLabel = this.termsPolicy.activeVersionLabel;
  protected readonly isOnline = this.appCtx.isOnline;
  protected readonly isProfileSaving = computed(() => this.profileSaveLoadState().status === 'loading');
  protected readonly isLoggingOut = computed(() => this.userLogoutLoadState().status === 'loading');
  protected readonly isAvatarRingLoading = computed(() => this.isProfileSaving() || this.isLoggingOut());
  protected readonly hasProfileSaveError = computed(() => {
    const status = this.profileSaveLoadState().status;
    return status === 'error' || status === 'timeout';
  });
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
    const totalBadgeCount = this.isAdminProfile(activeUser)
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
      featuredImagePreview: this.resolveUserImageUrl(activeUser),
      impressionChangeFlags,
      memberImpressionTitle: resolveMemberImpressionTitle(activeUser.traitLabel ?? ''),
      totalBadgeCount
    };
  });
  protected readonly menuUiState = this.navigatorService.menuUiState;
  protected readonly isCoveredByAssetPopup = this.navigatorService.navigatorCoveredByAssetPopup;
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
          items: items
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
                  icon: this.getHostTierIcon(user.hostTier),
                  palette: this.hostTierPalette(user.hostTier)
                },
                {
                  id: 'member',
                  label: user.memberImpressionTitle.replace(' Attendee', ''),
                  description: 'Attendee',
                  icon: this.getTraitIcon(user.traitLabel),
                  palette: this.traitPalette(user.traitLabel)
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
    void this.helpCenter.preloadAll();
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
    } else {
      const shareUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + url)}`;
      window.location.href = shareUrl;
    }
  }

  protected onToggleExplanationGuide(event: Event): void {
    event.stopPropagation();
    this.explanationGuide.toggleEnabled();
  }

  protected profileStatusClass(status: string): string {
    switch (status) {
      case 'public':
        return 'status-public';
      case 'friends only':
        return 'status-friends';
      case 'host only':
        return 'status-host';
      case 'blocked':
        return 'status-blocked';
      default:
        return 'status-inactive';
    }
  }

  protected navigatorHeaderStatusClass(user: NavigatorMenuUser): string {
    return this.isAdminMode() ? 'status-friends' : this.profileStatusClass(user.profileStatus);
  }

  protected navigatorHeaderBadgeLabel(user: NavigatorMenuUser): string {
    return this.isAdminMode() ? 'ADMIN' : `${user.completion}%`;
  }

  protected navigatorHeaderName(user: NavigatorMenuUser): string {
    return this.isAdminMode() ? user.name : `${user.name}, ${user.age}`;
  }

  protected navigatorHeaderMetaIcon(): string {
    return this.isAdminMode() ? 'admin_panel_settings' : 'location_on';
  }

  protected navigatorHeaderMetaText(user: NavigatorMenuUser): string {
    return this.isAdminMode() ? 'Admin workspace' : user.city;
  }

  protected isNavigatorHeaderProfileDisabled(user: NavigatorMenuUser): boolean {
    return this.isAdminMode() ? !this.isOnline() : !this.isOnline() || this.isBlockedUser(user);
  }

  protected navigatorHeaderProfileLabel(): string {
    return this.isAdminMode() ? 'Open admin profile' : 'Open profile editor';
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

  protected completionBadgeStyle(percent: number): Record<string, string> | null {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
    const hue = Math.round((clamped / 100) * 120);
    return {
      background: `hsl(${hue}, 82%, 84%)`,
      borderColor: `hsl(${hue}, 70%, 58%)`,
      color: `hsl(${hue}, 74%, 24%)`
    };
  }

  private hostTierPalette(tier: string): AppMenuPalette {
    const normalizedTier = tier.toLowerCase();
    if (normalizedTier.includes('platinum')) {
      return 'sky';
    }
    if (normalizedTier.includes('gold')) {
      return 'gold';
    }
    if (normalizedTier.includes('silver')) {
      return 'slate';
    }
    if (normalizedTier.includes('bronze')) {
      return 'brown';
    }
    return 'blue';
  }

  private traitPalette(trait: string): AppMenuPalette {
    const normalizedTrait = trait.toLowerCase();
    if (normalizedTrait.includes('creative')) {
      return 'violet';
    }
    if (normalizedTrait.includes('empath')) {
      return 'pink';
    }
    if (normalizedTrait.includes('reliable')) {
      return 'green';
    }
    if (normalizedTrait.includes('adventurer')) {
      return 'sky';
    }
    if (normalizedTrait.includes('thinker')) {
      return 'blue';
    }
    if (normalizedTrait.includes('social')) {
      return 'teal';
    }
    if (normalizedTrait.includes('playful')) {
      return 'orange';
    }
    if (normalizedTrait.includes('ambitious')) {
      return 'purple';
    }
    return 'violet';
  }

  private openSettingsPopup(popup: NavigatorSettingsPopup): void {
    if (popup === 'help' && !this.hasActiveHelpRevision()) {
      return;
    }
    this.navigatorService.openSettingsPopup(popup);
  }

  protected getHostTierIcon(tier: string): string {
    return resolveHostTierIcon(tier);
  }

  protected getTraitIcon(trait: string): string {
    return resolveTraitIcon(trait);
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
    return (this.router.url || '').split('?')[0].startsWith('/admin');
  }

  private isAdminProfile(user: UserDto): boolean {
    return user.hostTier === 'Admin'
      || user.statusText === 'Admin workspace'
      || user.id === 'admin'
      || user.id.startsWith('admin-');
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

  private resolveUserImageUrl(user: UserDto | null): string | null {
    return user?.images?.find(image => image.trim().length > 0) ?? null;
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
}
