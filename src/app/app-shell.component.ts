import { Component, Type, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { App } from './app';
import { EventEditorService } from './shared/event-editor.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, App],
  template: `
    <app-core></app-core>
    <ng-container *ngIf="eventEditorPopupComponent() as popupComponent">
      <ng-container *ngComponentOutlet="popupComponent"></ng-container>
    </ng-container>
  `
})
export class AppShellComponent {
  private readonly eventEditorService = inject(EventEditorService);
  private readonly eventEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  protected readonly eventEditorPopupComponent = this.eventEditorPopupComponentRef.asReadonly();

  constructor() {
    effect(() => {
      const isOpen = this.eventEditorService.isOpen();
      if (isOpen && !this.eventEditorPopupComponentRef()) {
        void this.ensureEventEditorPopupLoaded();
      }
    });
  }

  private async ensureEventEditorPopupLoaded(): Promise<void> {
    if (this.eventEditorPopupComponentRef()) {
      return;
    }
    const module = await import('./event-editor/event-editor-popup.component');
    this.eventEditorPopupComponentRef.set(module.EventEditorPopupComponent);
  }
}
