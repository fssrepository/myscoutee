import { CommonModule } from '@angular/common';
import { Component, HostListener, Type, effect, inject, signal } from '@angular/core';
import { AssetPopupService } from '../../../asset/asset-popup.service';
import { ActivitiesDbContextService } from '../../../shared/activities-db-context.service';
import { EventEditorService } from '../../../shared/event-editor.service';
import { NavigatorAvatarComponent } from '../navigator-menubar/navigator-menubar.component';
import { NavigatorMenuComponent } from '../navigator-menu/navigator-menu.component';
import { NavigatorActiveUser, NavigatorBindings, NavigatorService } from '../../navigator.service';

@Component({
  selector: 'app-navigator',
  standalone: true,
  imports: [CommonModule, NavigatorAvatarComponent, NavigatorMenuComponent],
  templateUrl: './navigator.component.html',
  styleUrl: './navigator.component.scss'
})
export class NavigatorComponent {
  private static readonly FALLBACK_ACTIVE_USER: NavigatorActiveUser = {
    initials: '',
    gender: 'woman',
    name: '',
    age: 0,
    city: '',
    profileStatus: 'public'
  };

  private readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly assetPopupService = inject(AssetPopupService);
  private readonly eventEditorService = inject(EventEditorService);
  private readonly navigatorService = inject(NavigatorService);
  private readonly eventEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly activitiesPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly assetPopupComponentRef = signal<Type<unknown> | null>(null);

  protected readonly bindings = this.navigatorService.bindings;
  protected readonly hydratedUser = this.navigatorService.hydratedUser;
  protected readonly userMenuOpen = this.navigatorService.menuOpen;
  protected readonly eventEditorPopupComponent = this.eventEditorPopupComponentRef.asReadonly();
  protected readonly activitiesPopupComponent = this.activitiesPopupComponentRef.asReadonly();
  protected readonly assetPopupComponent = this.assetPopupComponentRef.asReadonly();

  constructor() {
    effect(() => {
      const isOpen = this.eventEditorService.isOpen();
      if (isOpen && !this.eventEditorPopupComponentRef()) {
        void this.ensureEventEditorPopupLoaded();
      }
    });

    effect(() => {
      const isActivitiesOpen = this.activitiesContext.activitiesOpen();
      const navigationRequest = this.activitiesContext.activitiesNavigationRequest();
      const hasInternalActivitiesRequest = navigationRequest?.type === 'members'
        || navigationRequest?.type === 'chatResource'
        || navigationRequest?.type === 'eventEditorMembers';
      const hasEventEditorResourceRequest = this.eventEditorService.subEventResourcePopupRequest() !== null;
      const shouldLoadActivitiesPopup = isActivitiesOpen || hasInternalActivitiesRequest || hasEventEditorResourceRequest;
      if (shouldLoadActivitiesPopup && !this.activitiesPopupComponentRef()) {
        void this.ensureActivitiesPopupLoaded();
      }
    });

    effect(() => {
      const isAssetPopupVisible = this.assetPopupService.visible();
      if (isAssetPopupVisible && !this.assetPopupComponentRef()) {
        void this.ensureAssetPopupLoaded();
      }
    });
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
    this.closeUserSettingsMenu();
  }

  protected get showUserMenu(): boolean {
    return this.navigatorService.isMenuOpen();
  }

  protected get showUserSettingsMenu(): boolean {
    return this.navigatorService.isSettingsMenuOpen();
  }

  protected get activeUser(): NavigatorActiveUser {
    const hydratedUser = this.hydratedUser();
    if (hydratedUser) {
      return {
        initials: (hydratedUser.initials ?? '').trim(),
        gender: hydratedUser.gender === 'man' ? 'man' : 'woman',
        name: (hydratedUser.name ?? '').trim(),
        age: Number.isFinite(hydratedUser.age) ? Math.max(0, Math.trunc(Number(hydratedUser.age))) : 0,
        city: (hydratedUser.city ?? '').trim(),
        profileStatus: hydratedUser.profileStatus ?? 'public'
      };
    }
    return this.bindings()?.activeUser() ?? NavigatorComponent.FALLBACK_ACTIVE_USER;
  }

  protected get featuredImagePreview(): string | null {
    const hydratedUser = this.hydratedUser();
    const hydratedImage = hydratedUser?.images?.find(image => image.trim().length > 0) ?? null;
    if (hydratedImage) {
      return hydratedImage;
    }
    return this.bindings()?.featuredImagePreview() ?? null;
  }

  protected get userBadgeCount(): number {
    return this.bindings()?.userBadgeCount() ?? 0;
  }

  protected get profileCompletionPercent(): number {
    return this.bindings()?.profileCompletionPercent() ?? 0;
  }

  protected get activeHostTier(): string {
    return this.bindings()?.activeHostTier() ?? '';
  }

  protected get hostImpressionsBadge(): number {
    return this.bindings()?.hostImpressionsBadge() ?? 0;
  }

  protected get activeMemberTrait(): string {
    return this.bindings()?.activeMemberTrait() ?? '';
  }

  protected get memberImpressionsBadge(): number {
    return this.bindings()?.memberImpressionsBadge() ?? 0;
  }

  protected get memberImpressionTitle(): string {
    return this.bindings()?.memberImpressionTitle() ?? '';
  }

  protected get gameBadge(): number {
    return this.bindings()?.gameBadge() ?? 0;
  }

  protected get chatBadge(): number {
    return this.bindings()?.chatBadge() ?? 0;
  }

  protected get invitationsBadge(): number {
    return this.bindings()?.invitationsBadge() ?? 0;
  }

  protected get eventsBadge(): number {
    return this.bindings()?.eventsBadge() ?? 0;
  }

  protected get hostingBadge(): number {
    return this.bindings()?.hostingBadge() ?? 0;
  }

  protected get assetTicketsBadge(): number {
    return this.bindings()?.assetTicketsBadge() ?? 0;
  }

  protected get eventFeedbackBadge(): number {
    return this.bindings()?.eventFeedbackBadge() ?? 0;
  }

  protected closeUserMenu(): void {
    this.navigatorService.closeMenu();
  }

  protected toggleUserSettingsMenu(): void {
    this.navigatorService.toggleSettingsMenu();
  }

  protected closeUserSettingsMenu(): void {
    this.navigatorService.closeSettingsMenu();
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
    const module = await import('../../../activity/components/event-activities-popup/event-activities-popup.component');
    this.activitiesPopupComponentRef.set(module.EventActivitiesPopupComponent);
  }

  private async ensureAssetPopupLoaded(): Promise<void> {
    if (this.assetPopupComponentRef()) {
      return;
    }
    const module = await import('../../../asset/components/asset-popup/asset-popup.component');
    this.assetPopupComponentRef.set(module.AssetPopupComponent);
  }
}
