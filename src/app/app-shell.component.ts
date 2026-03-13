import { Component, Type, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { App } from './app';
import { AssetPopupService } from './asset/asset-popup.service';
import { ActivitiesDbContextService } from './shared/activities-db-context.service';
import { EventEditorService } from './shared/event-editor.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, App],
  template: `
    <app-core></app-core>
    <ng-container *ngIf="activitiesPopupComponent() as activitiesComponent">
      <ng-container *ngComponentOutlet="activitiesComponent"></ng-container>
    </ng-container>
    <ng-container *ngIf="assetPopupComponent() as assetComponent">
      <ng-container *ngComponentOutlet="assetComponent"></ng-container>
    </ng-container>
    <ng-container *ngIf="eventEditorPopupComponent() as popupComponent">
      <ng-container *ngComponentOutlet="popupComponent"></ng-container>
    </ng-container>
  `
})
export class AppShellComponent {
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
    // Event editor popup lazy loading
    effect(() => {
      const isOpen = this.eventEditorService.isOpen();
      if (isOpen && !this.eventEditorPopupComponentRef()) {
        void this.ensureEventEditorPopupLoaded();
      }
    });
    
    // Activities popup lazy loading
    effect(() => {
      const isActivitiesOpen = this.activitiesContext.activitiesOpen();
      if (isActivitiesOpen && !this.activitiesPopupComponentRef()) {
        void this.ensureActivitiesPopupLoaded();
      }
      // Warm-load editor chunk while activities is open to avoid first-click flash.
      if (isActivitiesOpen && !this.eventEditorPopupComponentRef()) {
        //requestIdleCallback(() => {
          void this.ensureEventEditorPopupLoaded();
        //});
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
    const module = await import('./activity/components/event-editor-popup/event-editor-popup.component');
    this.eventEditorPopupComponentRef.set(module.EventEditorPopupComponent);
  }
  
  private async ensureActivitiesPopupLoaded(): Promise<void> {
    if (this.activitiesPopupComponentRef()) {
      return;
    }
    const module = await import('./activity/components/event-activities-popup/event-activities-popup.component');
    this.activitiesPopupComponentRef.set(module.EventActivitiesPopupComponent);
  }

  private async ensureAssetPopupLoaded(): Promise<void> {
    if (this.assetPopupComponentRef()) {
      return;
    }
    const module = await import('./asset/components/asset-popup.component');
    this.assetPopupComponentRef.set(module.AssetPopupComponent);
  }
}
