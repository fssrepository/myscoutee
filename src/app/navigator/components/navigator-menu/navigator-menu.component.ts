import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  AppContext,
  type ActivityCounters,
  type UserDto,
  type UserImpressionChangeFlags
} from '../../../shared/core';
import { NavigatorBindings, NavigatorService } from '../../navigator.service';

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
  imports: [CommonModule, MatIconModule],
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
      memberImpressionTitle: this.resolveMemberImpressionTitle(activeUser.traitLabel ?? ''),
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

  protected get bindings(): NavigatorBindings | null {
    return this.navigatorService.bindings();
  }

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

  protected onSettingsAction(action: 'help' | 'send-feedback' | 'gdpr' | 'delete-account' | 'logout', event?: Event): void {
    event?.stopPropagation();
    this.navigatorService.closeSettingsMenu();
    switch (action) {
      case 'help':
        this.bindings?.openHelpPopup();
        return;
      case 'send-feedback':
        this.bindings?.openSendFeedbackPopup();
        return;
      case 'gdpr':
        this.bindings?.openGdprPopup();
        return;
      case 'delete-account':
        this.bindings?.openDeleteAccountConfirm();
        return;
      case 'logout':
        this.bindings?.openLogoutConfirm();
        return;
      default:
        return;
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
    return this.bindings?.getHostTierToneClass(tier) ?? '';
  }

  protected getHostTierColorClass(tier: string): string {
    return this.bindings?.getHostTierColorClass(tier) ?? '';
  }

  protected getHostTierIcon(tier: string): string {
    return this.bindings?.getHostTierIcon(tier) ?? 'workspace_premium';
  }

  protected getTraitToneClass(trait: string): string {
    return this.bindings?.getTraitToneClass(trait) ?? '';
  }

  protected getTraitColorClass(trait: string): string {
    return this.bindings?.getTraitColorClass(trait) ?? '';
  }

  protected getTraitIcon(trait: string): string {
    return this.bindings?.getTraitIcon(trait) ?? 'psychiatry';
  }

  protected openProfileEditor(): void {
    this.navigatorService.openProfileEditor();
  }

  protected openHostImpressions(): void {
    this.bindings?.openHostImpressions();
  }

  protected openMemberImpressions(): void {
    this.bindings?.openMemberImpressions();
  }

  protected openRatesShortcut(): void {
    this.bindings?.openRatesShortcut();
  }

  protected openChatShortcut(): void {
    this.bindings?.openChatShortcut();
  }

  protected openInvitationShortcut(): void {
    this.bindings?.openInvitationShortcut();
  }

  protected openEventShortcut(): void {
    this.bindings?.openEventShortcut();
  }

  protected openHostingShortcut(): void {
    this.bindings?.openHostingShortcut();
  }

  protected openAssetCarPopup(): void {
    this.bindings?.openAssetCarPopup();
  }

  protected openAssetAccommodationPopup(): void {
    this.bindings?.openAssetAccommodationPopup();
  }

  protected openAssetSuppliesPopup(): void {
    this.bindings?.openAssetSuppliesPopup();
  }

  protected openAssetTicketsPopup(): void {
    this.bindings?.openAssetTicketsPopup();
  }

  protected openEventFeedbackPopup(event?: Event): void {
    this.bindings?.openEventFeedbackPopup(event);
  }

  protected openReportUserFromFeedback(event?: Event): void {
    this.bindings?.openReportUserFromFeedback(event);
  }

  private resolveUserImageUrl(user: UserDto | null): string | null {
    return user?.images?.find(image => image.trim().length > 0) ?? null;
  }

  private resolveCompletionPercent(user: UserDto | null): number {
    return Number.isFinite(user?.completion) ? Math.max(0, Math.trunc(Number(user?.completion))) : 0;
  }

  private resolveMemberImpressionTitle(traitLabel: string): string {
    const normalized = traitLabel.trim().toLowerCase();
    if (normalized.includes('empat') || normalized.includes('empath')) {
      return 'Empathetic Attendee';
    }
    if (normalized.includes('advent')) {
      return 'Adventurous Attendee';
    }
    if (normalized.includes('kreat') || normalized.includes('creative')) {
      return 'Creative Attendee';
    }
    if (normalized.includes('think')) {
      return 'Thoughtful Attendee';
    }
    if (normalized.includes('social')) {
      return 'Social Attendee';
    }
    if (normalized.includes('playful')) {
      return 'Playful Attendee';
    }
    if (normalized.includes('ambitious') || normalized.includes('goal')) {
      return 'Ambitious Attendee';
    }
    if (normalized.includes('megbizh') || normalized.includes('reliable')) {
      return 'Reliable Attendee';
    }
    return traitLabel ? `${traitLabel} Attendee` : 'Attendee';
  }
}
