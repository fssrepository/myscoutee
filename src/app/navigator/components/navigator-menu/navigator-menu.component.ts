import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NavigatorActiveUser, NavigatorBindings, NavigatorService } from '../../navigator.service';

@Component({
  selector: 'app-navigator-menu',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './navigator-menu.component.html',
  styleUrl: './navigator-menu.component.scss'
})
export class NavigatorMenuComponent {
  private readonly navigatorService = inject(NavigatorService);

  protected get open(): boolean {
    return this.navigatorService.isMenuOpen();
  }

  protected get settingsOpen(): boolean {
    return this.navigatorService.isSettingsMenuOpen();
  }

  protected get activeUser(): NavigatorActiveUser {
    return this.navigatorService.activeUser();
  }

  protected get featuredImagePreview(): string | null {
    return this.navigatorService.featuredImagePreview();
  }

  protected get userBadgeCount(): number {
    return this.navigatorService.userBadgeCount();
  }

  protected get profileCompletionPercent(): number {
    return this.navigatorService.profileCompletionPercent();
  }

  protected get activeHostTier(): string {
    return this.navigatorService.activeHostTier();
  }

  protected get hostImpressionsBadge(): number {
    return this.navigatorService.hostImpressionsBadge();
  }

  protected get activeMemberTrait(): string {
    return this.navigatorService.activeMemberTrait();
  }

  protected get memberImpressionsBadge(): number {
    return this.navigatorService.memberImpressionsBadge();
  }

  protected get memberImpressionTitle(): string {
    return this.navigatorService.memberImpressionTitle();
  }

  protected get gameBadge(): number {
    return this.navigatorService.gameBadge();
  }

  protected get chatBadge(): number {
    return this.navigatorService.chatBadge();
  }

  protected get invitationsBadge(): number {
    return this.navigatorService.invitationsBadge();
  }

  protected get eventsBadge(): number {
    return this.navigatorService.eventsBadge();
  }

  protected get hostingBadge(): number {
    return this.navigatorService.hostingBadge();
  }

  protected get assetTicketsBadge(): number {
    return this.navigatorService.assetTicketsBadge();
  }

  protected get eventFeedbackBadge(): number {
    return this.navigatorService.eventFeedbackBadge();
  }

  protected get bindings(): NavigatorBindings | null {
    return this.navigatorService.bindings();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.navigatorService.isSettingsMenuOpen()) {
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
