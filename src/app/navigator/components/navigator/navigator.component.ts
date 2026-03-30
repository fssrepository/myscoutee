import { CommonModule } from '@angular/common';
import { Component, HostListener, Type, effect, inject, signal } from '@angular/core';
import { AssetPopupStateService } from '../../../asset/asset-popup-state.service';
import { OwnedAssetsPopupFacadeService } from '../../../asset/owned-assets-popup-facade.service';
import { ActivitiesPopupStateService } from '../../../activity/services/activities-popup-state.service';
import { EventFeedbackPopupStateService } from '../../../activity/services/event-feedback-popup-state.service';
import { EventEditorPopupStateService } from '../../../activity/services/event-editor-popup-state.service';
import { AppContext, AppPopupContext } from '../../../shared/core';
import { ConfirmationDialogComponent } from '../../../shared/ui/components/confirmation-dialog/confirmation-dialog.component';
import { AvatarBtnComponent } from '../avatar-btn/avatar-btn.component';
import { NavigatorImpressionsPopupComponent } from '../navigator-impressions-popup/navigator-impressions-popup.component';
import { NavigatorMenuComponent } from '../navigator-menu/navigator-menu.component';
import { ProfileEditorComponent } from '../profile-editor/profile-editor.component';
import { NavigatorSettingsPopupsComponent } from '../navigator-settings-popups/navigator-settings-popups.component';
import { EventMembersPopupComponent } from '../../../activity/components/event-members-popup/event-members-popup.component';
import { EventResourcePopupComponent } from '../../../activity/components/event-resource-popup/event-resource-popup.component';
import { EventSupplyContributionsPopupComponent } from '../../../activity/components/event-supply-contributions-popup/event-supply-contributions-popup.component';
import { AssetMemberPickerPopupComponent } from '../../../asset/components/asset-member-picker-popup/asset-member-picker-popup.component';
import { SubEventResourcePopupService } from '../../../activity/services/sub-event-resource-popup.service';

@Component({
  selector: 'app-navigator',
  standalone: true,
  imports: [
    CommonModule,
    AvatarBtnComponent,
    NavigatorMenuComponent,
    NavigatorSettingsPopupsComponent,
    NavigatorImpressionsPopupComponent,
    ConfirmationDialogComponent,
    ProfileEditorComponent,
    EventMembersPopupComponent,
    EventResourcePopupComponent,
    EventSupplyContributionsPopupComponent,
    AssetMemberPickerPopupComponent
  ],
  templateUrl: './navigator.component.html',
  styleUrl: './navigator.component.scss'
})
export class NavigatorComponent {
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly activitiesContext = inject(ActivitiesPopupStateService);
  private readonly assetPopupService = inject(AssetPopupStateService);
  private readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);
  private readonly eventFeedbackPopupService = inject(EventFeedbackPopupStateService);
  private readonly eventEditorService = inject(EventEditorPopupStateService);
  protected readonly subEventResources = inject(SubEventResourcePopupService);
  private lastHandledActivitiesRequestMs = 0;
  private lastHandledAssetRequestMs = 0;
  private lastHandledEventFeedbackRequestMs = 0;
  private readonly eventEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly activitiesPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly assetPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly eventFeedbackPopupComponentRef = signal<Type<unknown> | null>(null);

  protected readonly eventEditorPopupComponent = this.eventEditorPopupComponentRef.asReadonly();
  protected readonly activitiesPopupComponent = this.activitiesPopupComponentRef.asReadonly();
  protected readonly assetPopupComponent = this.assetPopupComponentRef.asReadonly();
  protected readonly eventFeedbackPopupComponent = this.eventFeedbackPopupComponentRef.asReadonly();

  constructor() {
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
      const isActivitiesOpen = this.activitiesContext.activitiesOpen();
      if (isActivitiesOpen && !this.activitiesPopupComponentRef()) {
        void this.ensureActivitiesPopupLoaded();
      }
    });

    effect(() => {
      const isAssetPopupVisible = this.assetPopupService.visible();
      if (isAssetPopupVisible && !this.assetPopupComponentRef()) {
        void this.ensureAssetPopupLoaded();
      }
    });

    effect(() => {
      const request = this.popupCtx.navigatorActivitiesRequest();
      if (!request || request.updatedMs <= this.lastHandledActivitiesRequestMs) {
        return;
      }
      this.lastHandledActivitiesRequestMs = request.updatedMs;
      this.activitiesContext.openActivities(request.primaryFilter, request.eventScope);
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
      this.popupCtx.clearNavigatorEventFeedbackRequest();
      void this.openEventFeedbackPopupFromNavigatorRequest();
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

  private async openEventFeedbackPopupFromNavigatorRequest(): Promise<void> {
    await this.ensureEventFeedbackPopupLoaded();
    await new Promise<void>(resolve => {
      setTimeout(resolve, 0);
    });
    this.eventFeedbackPopupService.openPopup();
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
