import { DragDropModule, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AppMenuComponent, type AppMenuItem, type AppMenuItemSelectEvent } from '../../../../shared/ui';
import type { RouteEditorState } from '../../../../shared/ui/context/sub-event-resource-popup.types';

type RouteEditorMenuContext = { menu: 'save' };

export interface RouteEditorStopMapRequest {
  editor: RouteEditorState;
  stop: string;
  stopIndex: number;
  sourceEvent: Event;
}

export interface RouteEditorStopChange {
  stopIndex: number;
  value: string;
}

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
  @Output() addStopRequested = new EventEmitter<void>();
  @Output() removeStopRequested = new EventEmitter<number>();
  @Output() stopChanged = new EventEmitter<RouteEditorStopChange>();
  @Output() stopsDropped = new EventEmitter<CdkDragDrop<string[]>>();
  @Output() routeMapRequested = new EventEmitter<Event | undefined>();
  @Output() stopMapRequested = new EventEmitter<RouteEditorStopMapRequest>();

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

  protected requestStopMap(editor: RouteEditorState, stop: string, stopIndex: number, event: Event): void {
    event.stopPropagation();
    this.stopMapRequested.emit({ editor, stop, stopIndex, sourceEvent: event });
  }
}
