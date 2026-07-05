import { DragDropModule, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  FormFlowPopupStore,
  type FormFlowRouteInputEditorState
} from '../../../flow/form-flow-popup.store';
import {
  PopupComponent,
  type PopupAction,
  type PopupActionEvent,
  type PopupModel
} from '../../../../popup';

@Component({
  selector: 'app-route-input-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatIconModule,
    PopupComponent
  ],
  templateUrl: './route-input-popup.component.html',
  styleUrl: './route-input-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RouteInputPopupComponent implements OnChanges {
  @Input() editor: FormFlowRouteInputEditorState | null = null;

  protected routes: string[] = [];
  protected routeRowIds: string[] = [];
  private locallyDirty = false;
  private rowIdSequence = 0;
  private readonly popupStore = inject(FormFlowPopupStore);

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['editor'] || !this.editor) {
      return;
    }
    this.routes = this.editor.routes.length > 0 ? [...this.editor.routes] : [''];
    this.routeRowIds = this.routes.map((_route, index) => this.editor?.routeRowIds[index] ?? this.nextRouteRowId());
    this.locallyDirty = this.editor.canSave;
  }

  protected routePopupModel(editor: FormFlowRouteInputEditorState): PopupModel {
    return {
      title: editor.title,
      subtitle: editor.subtitle,
      ariaLabel: 'Route setup',
      closeAriaLabel: 'Close route setup',
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      headerActions: this.routePopupHeaderActions(editor),
      onClose: event => this.close(editor, event),
      onAction: event => this.onRoutePopupAction(editor, event)
    };
  }

  protected visibleStops(editor: FormFlowRouteInputEditorState): string[] {
    return editor.readOnly
      ? this.routes.map(stop => stop.trim()).filter(Boolean)
      : this.routes;
  }

  protected routeStopTrack(stop: string, stopIndex: number): string {
    return this.editor?.readOnly
      ? stop
      : this.routeRowIds[stopIndex] ?? `route-stop-${stopIndex}`;
  }

  protected canSubmit(editor: FormFlowRouteInputEditorState): boolean {
    return !editor.readOnly
      && !editor.saving
      && (editor.canSave || this.locallyDirty)
      && this.hasEnteredRoute();
  }

  protected canOpenRouteMap(editor: FormFlowRouteInputEditorState): boolean {
    return !editor.saving && this.hasEnteredRoute();
  }

  protected saveErrorMessage(editor: FormFlowRouteInputEditorState): string {
    return editor.error?.trim() ?? '';
  }

  protected dropStop(editor: FormFlowRouteInputEditorState, event: CdkDragDrop<string[]>): void {
    if (editor.readOnly || editor.saving || event.previousIndex === event.currentIndex) {
      return;
    }
    const routes = [...this.routes];
    const rowIds = [...this.routeRowIds];
    const [route] = routes.splice(event.previousIndex, 1);
    const [rowId] = rowIds.splice(event.previousIndex, 1);
    routes.splice(event.currentIndex, 0, route);
    rowIds.splice(event.currentIndex, 0, rowId);
    this.replaceDraft(editor, routes, rowIds);
  }

  protected updateStop(editor: FormFlowRouteInputEditorState, index: number, value: string): void {
    if (editor.readOnly || editor.saving || index < 0 || index >= this.routes.length) {
      return;
    }
    const routes = [...this.routes];
    routes[index] = value;
    this.replaceDraft(editor, routes, this.routeRowIds);
  }

  protected addStop(editor: FormFlowRouteInputEditorState, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (editor.readOnly || editor.saving) {
      return;
    }
    this.replaceDraft(
      editor,
      [...this.routes, ''],
      [...this.routeRowIds, this.nextRouteRowId()]
    );
  }

  protected removeStop(editor: FormFlowRouteInputEditorState, index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (editor.readOnly || editor.saving || this.routes.length <= 1) {
      return;
    }
    this.replaceDraft(
      editor,
      this.routes.filter((_stop, stopIndex) => stopIndex !== index),
      this.routeRowIds.filter((_rowId, stopIndex) => stopIndex !== index)
    );
  }

  protected openStopMap(editor: FormFlowRouteInputEditorState, stop: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (editor.saving || !stop.trim()) {
      return;
    }
    this.openGoogleMapsSearch(stop);
  }

  protected openRouteMap(editor: FormFlowRouteInputEditorState, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canOpenRouteMap(editor)) {
      return;
    }
    this.openGoogleMapsDirections(this.routes);
  }

  private replaceDraft(
    _editor: FormFlowRouteInputEditorState,
    routes: readonly string[],
    routeRowIds: readonly string[],
  ): void {
    this.routes = routes.length > 0 ? [...routes] : [''];
    this.routeRowIds = this.routes.map((_route, index) => routeRowIds[index] ?? this.nextRouteRowId());
    this.locallyDirty = true;
  }

  private close(editor: FormFlowRouteInputEditorState, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.popupStore.requestRouteInputEditorClose(editor.ownerId, event);
  }

  private onRoutePopupAction(editor: FormFlowRouteInputEditorState, event: PopupActionEvent): void {
    if (event.action.id !== 'route-save') {
      return;
    }
    this.popupStore.requestRouteInputEditorSave(editor.ownerId, this.routes, this.routeRowIds, event.sourceEvent);
  }

  private routePopupHeaderActions(editor: FormFlowRouteInputEditorState): readonly PopupAction[] {
    if (editor.readOnly) {
      return [];
    }
    const canSave = this.canSubmit(editor);
    const hasError = this.saveErrorMessage(editor).length > 0;
    return [{
      id: 'route-save',
      icon: 'done',
      ariaLabel: 'Save route',
      palette: hasError || (!canSave && !editor.saving) ? 'danger' : 'success',
      disabled: !canSave
    }];
  }

  private hasEnteredRoute(): boolean {
    return this.routes.some(stop => stop.trim().length > 0);
  }

  private nextRouteRowId(): string {
    this.rowIdSequence += 1;
    return `route-stop-local-${Date.now()}-${this.rowIdSequence}`;
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

  private openGoogleMapsDirections(stops: readonly string[]): void {
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
