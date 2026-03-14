import { CommonModule } from '@angular/common';
import { Component, Type, effect, inject, signal } from '@angular/core';
import { AssetPopupService } from '../../../asset/asset-popup.service';
import { ActivitiesDbContextService } from '../../../shared/activities-db-context.service';
import { EventEditorService } from '../../../shared/event-editor.service';
import { AvatarBtnComponent } from '../avatar-btn/avatar-btn.component';
import { NavigatorMenuComponent } from '../navigator-menu/navigator-menu.component';
import { ProfileEditorComponent } from '../profile-editor/profile-editor.component';
import { NavigatorSettingsPopupsComponent } from '../navigator-settings-popups/navigator-settings-popups.component';

@Component({
  selector: 'app-navigator',
  standalone: true,
  imports: [CommonModule, AvatarBtnComponent, NavigatorMenuComponent, NavigatorSettingsPopupsComponent, ProfileEditorComponent],
  templateUrl: './navigator.component.html',
  styleUrl: './navigator.component.scss'
})
export class NavigatorComponent {
  private readonly activitiesContext = inject(ActivitiesDbContextService);
  private readonly assetPopupService = inject(AssetPopupService);
  private readonly eventEditorService = inject(EventEditorService);
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
