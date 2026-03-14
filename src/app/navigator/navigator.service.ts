import { Injectable, signal } from '@angular/core';

export interface NavigatorActiveUser {
  initials: string;
  gender: 'woman' | 'man';
  name: string;
  age: number;
  city: string;
  profileStatus: string;
}

export interface NavigatorBindings {
  activeUser(): NavigatorActiveUser;
  featuredImagePreview(): string | null;
  userBadgeCount(): number;
  profileCompletionPercent(): number;
  activeHostTier(): string;
  hostImpressionsBadge(): number;
  activeMemberTrait(): string;
  memberImpressionsBadge(): number;
  memberImpressionTitle(): string;
  gameBadge(): number;
  chatBadge(): number;
  invitationsBadge(): number;
  eventsBadge(): number;
  hostingBadge(): number;
  assetTicketsBadge(): number;
  eventFeedbackBadge(): number;
  profileStatusClass(status: string): string;
  completionBadgeStyle(percent: number): Record<string, string> | null;
  getHostTierToneClass(tier: string): string;
  getHostTierColorClass(tier: string): string;
  getHostTierIcon(tier: string): string;
  getTraitToneClass(trait: string): string;
  getTraitColorClass(trait: string): string;
  getTraitIcon(trait: string): string;
  openProfileEditor(): void;
  openHostImpressions(): void;
  openMemberImpressions(): void;
  openRatesShortcut(): void;
  openChatShortcut(): void;
  openInvitationShortcut(): void;
  openEventShortcut(): void;
  openHostingShortcut(): void;
  openAssetCarPopup(): void;
  openAssetAccommodationPopup(): void;
  openAssetSuppliesPopup(): void;
  openAssetTicketsPopup(): void;
  openEventFeedbackPopup(event?: Event): void;
  openReportUserFromFeedback(event?: Event): void;
  openHelpPopup(): void;
  openSendFeedbackPopup(): void;
  openGdprPopup(): void;
  openDeleteAccountConfirm(): void;
  openLogoutConfirm(): void;
}

@Injectable({
  providedIn: 'root'
})
export class NavigatorService {
  private readonly bindingsRef = signal<NavigatorBindings | null>(null);
  private readonly menuOpenRef = signal(false);
  private readonly settingsMenuOpenRef = signal(false);

  readonly bindings = this.bindingsRef.asReadonly();
  readonly menuOpen = this.menuOpenRef.asReadonly();
  readonly settingsMenuOpen = this.settingsMenuOpenRef.asReadonly();

  registerBindings(bindings: NavigatorBindings): void {
    this.bindingsRef.set(bindings);
  }

  clearBindings(bindings?: NavigatorBindings): void {
    if (bindings && this.bindingsRef() !== bindings) {
      return;
    }
    this.bindingsRef.set(null);
    this.closeMenu();
  }

  isMenuOpen(): boolean {
    return this.menuOpenRef();
  }

  isSettingsMenuOpen(): boolean {
    return this.settingsMenuOpenRef();
  }

  openMenu(): void {
    this.menuOpenRef.set(true);
  }

  closeMenu(): void {
    this.menuOpenRef.set(false);
    this.settingsMenuOpenRef.set(false);
  }

  toggleMenu(): void {
    if (this.menuOpenRef()) {
      this.closeMenu();
      return;
    }
    this.openMenu();
  }

  closeSettingsMenu(): void {
    this.settingsMenuOpenRef.set(false);
  }

  toggleSettingsMenu(): void {
    this.settingsMenuOpenRef.update(open => !open);
  }
}
