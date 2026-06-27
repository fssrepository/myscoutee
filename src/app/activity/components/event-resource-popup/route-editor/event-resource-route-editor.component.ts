import { DragDropModule, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AppMenuComponent, type AppMenuItem, type AppMenuItemSelectEvent } from '../../../../shared/ui';
import { SubEventResourcePopupStore } from '../../../../shared/ui/context/stores/sub-event-resource-popup.store';
import type { RouteEditorState } from '../../../../shared/ui/context/sub-event-resource-popup.types';

type RouteEditorMenuContext = { menu: 'save' };

@Component({
  selector: 'app-event-resource-route-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, MatIconModule, AppMenuComponent],
  templateUrl: './event-resource-route-editor.component.html',
  styleUrl: './event-resource-route-editor.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventResourceRouteEditorComponent {
  @Input() editor: RouteEditorState | null = null;

  @Output() closeRequested = new EventEmitter<Event | undefined>();
  @Output() saveRequested = new EventEmitter<Event | undefined>();

  private readonly resourcePopupStore = inject(SubEventResourcePopupStore);
  private routeEditorRowIdSequence = 0;

  protected routeStopTrack(stop: string, stopIndex: number): string {
    const editor = this.editor;
    return editor?.mode === 'view'
      ? stop
      : editor?.routeRowIds[stopIndex] ?? `route-stop-${stopIndex}`;
  }

  protected supportsMultiRoute(editor: RouteEditorState): boolean {
    return editor !== null;
  }

  protected isReadOnly(editor: RouteEditorState): boolean {
    return editor.mode === 'view';
  }

  protected isSavePending(editor: RouteEditorState): boolean {
    return editor.busy === true;
  }

  protected saveErrorMessage(editor: RouteEditorState): string {
    return editor.error?.trim() ?? '';
  }

  protected visibleStops(editor: RouteEditorState): string[] {
    return editor.mode === 'view'
      ? editor.routes.map(stop => stop.trim()).filter(Boolean)
      : editor.routes;
  }

  protected canSubmit(editor: RouteEditorState): boolean {
    return editor.mode !== 'view'
      && !editor.busy
      && editor.routes.some(stop => stop.trim().length > 0);
  }

  protected routeEditorSaveMenuItems(editor: RouteEditorState): readonly AppMenuItem<string, RouteEditorMenuContext>[] {
    const canSave = this.canSubmit(editor);
    const hasError = this.saveErrorMessage(editor).length > 0;
    return [{
      id: 'route-editor-save',
      icon: 'done',
      layout: 'action',
      palette: hasError || (!canSave && !this.isSavePending(editor)) ? 'danger' : 'success',
      disabled: !canSave,
      ariaLabel: 'Save route',
      progress: this.isSavePending(editor)
        ? { state: 'loading', shape: 'circle' }
        : (hasError ? { state: 'error', shape: 'circle' } : null),
      context: { menu: 'save' }
    }];
  }

  protected onRouteEditorMenuSelect(event: AppMenuItemSelectEvent<string, RouteEditorMenuContext>): void {
    if (event.context?.menu === 'save') {
      this.save(event.sourceEvent);
    }
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.closeRequested.emit(event);
  }

  protected save(event?: Event): void {
    event?.stopPropagation();
    this.saveRequested.emit(event);
  }

  protected addStop(): void {
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view') {
      return;
    }
    this.resourcePopupStore.routeEditorRef.set({
      ...editor,
      routes: [...editor.routes, ''],
      routeRowIds: [...editor.routeRowIds, this.nextRouteEditorRowId()],
      error: null
    });
  }

  protected removeStop(index: number): void {
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view' || index < 0 || index >= editor.routes.length) {
      return;
    }
    this.resourcePopupStore.routeEditorRef.set({
      ...editor,
      routes: editor.routes.filter((_stop, stopIndex) => stopIndex !== index),
      routeRowIds: editor.routeRowIds.filter((_routeRowId, stopIndex) => stopIndex !== index),
      error: null
    });
  }

  protected dropStop(event: CdkDragDrop<string[]>): void {
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view' || event.previousIndex === event.currentIndex) {
      return;
    }
    const routes = [...editor.routes];
    const routeRowIds = [...editor.routeRowIds];
    const [moved] = routes.splice(event.previousIndex, 1);
    const [movedRouteRowId] = routeRowIds.splice(event.previousIndex, 1);
    routes.splice(event.currentIndex, 0, moved);
    routeRowIds.splice(event.currentIndex, 0, movedRouteRowId);
    this.resourcePopupStore.routeEditorRef.set({
      ...editor,
      routes,
      routeRowIds,
      error: null
    });
  }

  protected updateStop(index: number, value: string): void {
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor || editor.busy || editor.mode === 'view' || index < 0 || index >= editor.routes.length) {
      return;
    }
    const routes = [...editor.routes];
    routes[index] = value;
    this.resourcePopupStore.routeEditorRef.set({
      ...editor,
      routes,
      error: null
    });
  }

  protected openStopMap(editor: RouteEditorState, stop: string, stopIndex: number, event: Event): void {
    event.stopPropagation();
    this.openGoogleMapsSearch(editor.mode === 'view' ? stop : editor.routes[stopIndex] ?? stop);
  }

  protected openRouteMap(event?: Event): void {
    event?.stopPropagation();
    const editor = this.resourcePopupStore.routeEditorRef();
    if (!editor) {
      return;
    }
    this.openGoogleMapsDirections(editor.routes);
  }

  private nextRouteEditorRowId(): string {
    this.routeEditorRowIdSequence += 1;
    return `route-stop-local-${Date.now()}-${this.routeEditorRowIdSequence}`;
  }

  private openGoogleMapsSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed || typeof window === 'undefined') {
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  private openGoogleMapsDirections(stops: string[]): void {
    const normalized = stops.map(stop => stop.trim()).filter(Boolean);
    if (normalized.length === 0 || typeof window === 'undefined') {
      return;
    }
    if (normalized.length === 1) {
      this.openGoogleMapsSearch(normalized[0]);
      return;
    }
    const origin = normalized[0];
    const destination = normalized[normalized.length - 1];
    const waypoints = normalized.slice(1, -1);
    let url = `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    if (waypoints.length > 0) {
      url += `&waypoints=${encodeURIComponent(waypoints.join('|'))}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
