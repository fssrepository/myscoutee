import { CommonModule } from '@angular/common';
import { Component, Type, effect, inject, signal } from '@angular/core';
import { AssetPopupService } from '../../../asset/asset-popup.service';
import { OwnedAssetsPopupService } from '../../../asset/owned-assets-popup.service';
import { ActivitiesDbContextService } from '../../../activity/services/activities-db-context.service';
import { EventEditorService } from '../../../shared/event-editor.service';
import { AppContext } from '../../../shared/core';
import { AvatarBtnComponent } from '../avatar-btn/avatar-btn.component';
import { NavigatorImpressionsPopupComponent } from '../navigator-impressions-popup/navigator-impressions-popup.component';
import { NavigatorMenuComponent } from '../navigator-menu/navigator-menu.component';
import { ProfileEditorComponent } from '../profile-editor/profile-editor.component';
import { NavigatorSettingsPopupsComponent } from '../navigator-settings-popups/navigator-settings-popups.component';
import { NavigatorService } from '../../navigator.service';
import { EventMembersPopupComponent } from '../../../activity/components/event-members-popup/event-members-popup.component';

@Component({
  selector: 'app-navigator',
  standalone: true,
  imports: [
    CommonModule,
    AvatarBtnComponent,
    NavigatorMenuComponent,
    NavigatorSettingsPopupsComponent,
    NavigatorImpressionsPopupComponent,
    ProfileEditorComponent,
    EventMembersPopupComponent
  ],
  templateUrl: './navigator.component.html',
  styleUrl: './navigator.component.scss'
})
export class NavigatorComponent {
  private readonly appCtx = inject(AppContext);
  private readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly assetPopupService = inject(AssetPopupService);
  private readonly ownedAssets = inject(OwnedAssetsPopupService);
  private readonly eventEditorService = inject(EventEditorService);
  private readonly navigatorService = inject(NavigatorService);
  private lastHandledNavigatorMenuRequestMs = 0;
  private readonly eventEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly activitiesPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly assetPopupComponentRef = signal<Type<unknown> | null>(null);

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
      const hasInternalActivitiesRequest = navigationRequest?.type === 'chatResource';
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

    effect(() => {
      const request = this.appCtx.navigatorMenuRequest();
      if (!request || request.updatedMs <= this.lastHandledNavigatorMenuRequestMs) {
        return;
      }
      this.lastHandledNavigatorMenuRequestMs = request.updatedMs;
      if (request.type === 'activities' && request.primaryFilter) {
        this.activitiesContext.openActivities(request.primaryFilter, request.eventScope);
        this.appCtx.clearNavigatorMenuRequest();
        return;
      }
      if (request.type !== 'asset' || !request.assetFilter) {
        this.appCtx.clearNavigatorMenuRequest();
        return;
      }
      this.ownedAssets.openPopup(request.assetFilter);
      this.appCtx.clearNavigatorMenuRequest();
    });
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
}
