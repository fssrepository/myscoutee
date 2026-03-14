import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NavigatorActiveUser, NavigatorBindings } from '../../navigator.service';

@Component({
  selector: 'app-navigator-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './navigator-menu.component.html',
  styleUrl: './navigator-menu.component.scss'
})
export class NavigatorMenuComponent {
  @Input() open = false;
  @Input() settingsOpen = false;
  @Input() activeUser: NavigatorActiveUser = {
    initials: '',
    gender: 'woman',
    name: '',
    age: 0,
    city: '',
    profileStatus: 'Public'
  };
  @Input() featuredImagePreview: string | null = null;
  @Input() userBadgeCount = 0;
  @Input() profileCompletionPercent = 0;
  @Input() activeHostTier = '';
  @Input() hostImpressionsBadge = 0;
  @Input() activeMemberTrait = '';
  @Input() memberImpressionsBadge = 0;
  @Input() memberImpressionTitle = '';
  @Input() gameBadge = 0;
  @Input() chatBadge = 0;
  @Input() invitationsBadge = 0;
  @Input() eventsBadge = 0;
  @Input() hostingBadge = 0;
  @Input() assetTicketsBadge = 0;
  @Input() eventFeedbackBadge = 0;
  @Input() bindings: NavigatorBindings | null = null;

  @Output() readonly closeMenu = new EventEmitter<void>();
  @Output() readonly toggleSettingsMenu = new EventEmitter<void>();
  @Output() readonly closeSettingsMenu = new EventEmitter<void>();

  protected onCloseMenu(): void {
    this.closeMenu.emit();
  }

  protected onToggleSettingsMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.toggleSettingsMenu.emit();
  }

  protected onCloseSettingsMenu(): void {
    this.closeSettingsMenu.emit();
  }

  protected onSettingsAction(action: 'help' | 'send-feedback' | 'gdpr' | 'delete-account' | 'logout', event?: Event): void {
    event?.stopPropagation();
    this.closeSettingsMenu.emit();
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
    return this.bindings?.profileStatusClass(status) ?? '';
  }

  protected completionBadgeStyle(percent: number): Record<string, string> | null {
    return this.bindings?.completionBadgeStyle(percent) ?? null;
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
    this.bindings?.openProfileEditor();
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
}
