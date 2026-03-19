import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  AppContext,
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
import { NavigatorService } from '../../navigator.service';
import { NavigatorSettingsMenuComponent } from '../navigator-settings-menu/navigator-settings-menu.component';

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
  imports: [CommonModule, MatIconModule, NavigatorSettingsMenuComponent],
  templateUrl: './navigator-menu.component.html',
  styleUrl: './navigator-menu.component.scss'
})
export class NavigatorMenuComponent {
  private readonly appCtx = inject(AppContext);
  private readonly navigatorService = inject(NavigatorService);
  protected readonly activeUser = this.appCtx.activeUserProfile;
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
  protected readonly isCoveredByPopup = this.navigatorService.menuCoveredByPopup;

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
    this.navigatorService.openProfileEditor();
  }

  protected openHostImpressions(event?: Event): void {
    event?.stopPropagation();
    this.navigatorService.openImpressionsPopup();
  }

  protected openMemberImpressions(event?: Event): void {
    event?.stopPropagation();
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
    this.appCtx.openNavigatorAssetRequest('Car');
  }

  protected openAssetAccommodationPopup(event?: Event): void {
    event?.stopPropagation();
    this.appCtx.openNavigatorAssetRequest('Accommodation');
  }

  protected openAssetSuppliesPopup(event?: Event): void {
    event?.stopPropagation();
    this.appCtx.openNavigatorAssetRequest('Supplies');
  }

  protected openAssetTicketsPopup(event?: Event): void {
    event?.stopPropagation();
    this.appCtx.openNavigatorAssetRequest('Ticket');
  }

  protected openEventFeedbackPopup(event?: Event): void {
    event?.stopPropagation();
    this.appCtx.openNavigatorEventFeedbackRequest();
  }

  protected openReportUserFromFeedback(event?: Event): void {
    event?.stopPropagation();
    this.navigatorService.openSettingsPopup('report-user');
  }

  private resolveUserImageUrl(user: UserDto | null): string | null {
    return user?.images?.find(image => image.trim().length > 0) ?? null;
  }

  private openActivitiesShortcut(
    primaryFilter: 'rates' | 'chats' | 'events',
    eventScope?: 'active-events' | 'invitations' | 'my-events'
  ): void {
    this.appCtx.openNavigatorActivitiesRequest(primaryFilter, eventScope);
  }

  private resolveCompletionPercent(user: UserDto | null): number {
    return Number.isFinite(user?.completion) ? Math.max(0, Math.trunc(Number(user?.completion))) : 0;
  }
}
