import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import {
  AppContext,
  AppPopupContext,
  USER_PROFILE_SAVE_CONTEXT_KEY,
  type ActivityCounters,
  type UserDto,
  type UserImpressionChangeFlags
} from '../../../shared/core';
import {
  resolveHostTierColorClass,
  resolveHostTierIcon,
  resolveHostTierToneClass,
  resolveMemberImpressionTitle,
  resolveTraitColorClass,
  resolveTraitIcon,
  resolveTraitToneClass
} from '../../navigator-presenters';
import { CounterBadgePipe } from '../../../shared/ui';
import { NavigatorService } from '../../navigator.service';
import { NavigatorSettingsMenuComponent } from '../navigator-settings-menu/navigator-settings-menu.component';
import { NavigatorContactsService } from '../../navigator-contacts.service';

interface NavigatorMenuUser extends Omit<UserDto, 'activities'> {
  activities: ActivityCounters;
  featuredImagePreview: string | null;
  impressionChangeFlags: UserImpressionChangeFlags;
  memberImpressionTitle: string;
  totalBadgeCount: number;
}

@Component({
  selector: 'app-navigator-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatRippleModule, NavigatorSettingsMenuComponent, CounterBadgePipe],
  templateUrl: './navigator-menu.component.html',
  styleUrl: './navigator-menu.component.scss'
})
export class NavigatorMenuComponent {
  private static readonly PROFILE_SAVE_RING_RADIUS = 51;
  private static readonly PROFILE_SAVE_RING_CIRCUMFERENCE = 2 * Math.PI * NavigatorMenuComponent.PROFILE_SAVE_RING_RADIUS;
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly navigatorService = inject(NavigatorService);
  private readonly navigatorContactsService = inject(NavigatorContactsService);
  private readonly profileSaveLoadState = this.appCtx.selectLoadingState(USER_PROFILE_SAVE_CONTEXT_KEY);
  protected readonly activeUser = this.appCtx.activeUserProfile;
  protected readonly isOnline = this.appCtx.isOnline;
  protected readonly profileSaveRingCircumference = NavigatorMenuComponent.PROFILE_SAVE_RING_CIRCUMFERENCE;
  protected readonly isProfileSaving = computed(() => this.profileSaveLoadState().status === 'loading');
  protected readonly hasProfileSaveError = computed(() => {
    const status = this.profileSaveLoadState().status;
    return status === 'error' || status === 'timeout';
  });
  protected readonly showProfileSaveRing = computed(() => this.isProfileSaving() || this.hasProfileSaveError());
  protected readonly profileSaveAvatarTitle = computed(() => {
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
      tickets: activityOverrides.tickets ?? 0,
      feedback: activityOverrides.feedback ?? 0
    };
    const impressionChangeFlags = this.appCtx.getUserImpressionChangeFlags(activeUser.id);
    return {
      ...activeUser,
      completion: this.resolveCompletionPercent(activeUser),
      impressions: this.appCtx.getUserImpressions(activeUser.id) ?? activeUser.impressions,
      activities: mergedActivities,
      featuredImagePreview: this.resolveUserImageUrl(activeUser),
      impressionChangeFlags,
      memberImpressionTitle: resolveMemberImpressionTitle(activeUser.traitLabel ?? ''),
      totalBadgeCount: (
        (impressionChangeFlags.host ? 1 : 0) +
        (impressionChangeFlags.member ? 1 : 0) +
        mergedActivities.game +
        mergedActivities.chat +
        mergedActivities.invitations +
        mergedActivities.events +
        mergedActivities.hosting +
        mergedActivities.tickets +
        mergedActivities.feedback
      )
    };
  });
  protected readonly menuUiState = this.navigatorService.menuUiState;
  protected readonly isCoveredByAssetPopup = this.navigatorService.navigatorCoveredByAssetPopup;

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.menuUiState().settingsOpen) {
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.closest('.user-settings-menu') || target.closest('.user-menu-settings-btn')) {
      return;
    }
    this.onCloseSettingsMenu();
  }

  protected onCloseMenu(): void {
    this.navigatorService.closeMenu();
  }

  protected onToggleSettingsMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.navigatorService.toggleSettingsMenu();
  }

  protected onCloseSettingsMenu(): void {
    this.navigatorService.closeSettingsMenu();
  }

  protected onShareProfile(event: MouseEvent): void {
    event.stopPropagation();
    const url = window.location.origin;
    const title = 'MyScoutee';
    const text = 'Please subscribe for the first priority based dating app, MyScoutee!';

    if (navigator.share) {
      void navigator.share({ title, text, url });
    } else {
      const shareUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + url)}`;
      window.location.href = shareUrl;
    }
  }

  protected profileStatusClass(status: string): string {
    switch (status) {
      case 'public':
        return 'status-public';
      case 'friends only':
        return 'status-friends';
      case 'host only':
        return 'status-host';
      default:
        return 'status-inactive';
    }
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

  protected getHostTierToneClass(tier: string): string {
    return resolveHostTierToneClass(tier);
  }

  protected getHostTierColorClass(tier: string): string {
    return resolveHostTierColorClass(tier);
  }

  protected getHostTierIcon(tier: string): string {
    return resolveHostTierIcon(tier);
  }

  protected getTraitToneClass(trait: string): string {
    return resolveTraitToneClass(trait);
  }

  protected getTraitColorClass(trait: string): string {
    return resolveTraitColorClass(trait);
  }

  protected getTraitIcon(trait: string): string {
    return resolveTraitIcon(trait);
  }

  protected openProfileEditor(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.navigatorService.openProfileEditor();
  }

  protected openHostImpressions(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.navigatorService.openImpressionsPopup();
  }

  protected openMemberImpressions(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
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
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openNavigatorAssetRequest('Car');
  }

  protected openAssetAccommodationPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openNavigatorAssetRequest('Accommodation');
  }

  protected openAssetSuppliesPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
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
    this.navigatorContactsService.openPopup();
  }

  protected openEventFeedbackPopup(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openNavigatorEventFeedbackRequest();
  }

  protected openReportUserFromFeedback(event?: Event): void {
    event?.stopPropagation();
    if (!this.isOnline()) {
      return;
    }
    this.navigatorService.openSettingsPopup('report-user');
  }

  private resolveUserImageUrl(user: UserDto | null): string | null {
    return user?.images?.find(image => image.trim().length > 0) ?? null;
  }

  private openActivitiesShortcut(
    primaryFilter: 'rates' | 'chats' | 'events',
    eventScope?: 'all' | 'active-events' | 'pending' | 'invitations' | 'my-events' | 'drafts' | 'trash'
  ): void {
    if (!this.isOnline()) {
      return;
    }
    this.popupCtx.openNavigatorActivitiesRequest(primaryFilter, eventScope);
  }

  private resolveCompletionPercent(user: UserDto | null): number {
    return Number.isFinite(user?.completion) ? Math.max(0, Math.trunc(Number(user?.completion))) : 0;
  }
}
