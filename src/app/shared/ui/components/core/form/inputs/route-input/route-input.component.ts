import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  Type,
  computed,
  effect,
  forwardRef,
  inject,
  untracked
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  FormFlowPopupStore,
  type FormFlowRouteInputEditorActionRequest
} from '../../flow/form-flow-popup.store';

export type RouteInputConfigValue<TValue> = TValue | (() => TValue);

export interface RouteInputSaveValue {
  routeEnabled: boolean;
  routes: readonly string[];
}

export interface RouteInputConfig {
  title?: RouteInputConfigValue<string>;
  subtitle?: RouteInputConfigValue<string>;
  openLabel?: RouteInputConfigValue<string>;
  emptyLabel?: RouteInputConfigValue<string>;
  readOnlyEmptyLabel?: RouteInputConfigValue<string>;
  popupTitle?: RouteInputConfigValue<string>;
  popupSubtitle?: RouteInputConfigValue<string>;
  enabled?: RouteInputConfigValue<boolean | null>;
  editable?: RouteInputConfigValue<boolean | null>;
  parentZIndex?: RouteInputConfigValue<number | null>;
  onSave?: (value: RouteInputSaveValue) => void | RouteInputSaveValue | Promise<void | RouteInputSaveValue>;
}

@Component({
  selector: 'app-route-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatIconModule,
    PopupComponent
  ],
  templateUrl: './route-input.component.html',
  styleUrl: './route-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RouteInputComponent),
      multi: true
    }
  ]
})
export class RouteInputComponent implements ControlValueAccessor {
  @Input() readOnly = false;
  @Input() disabled = false;
  @Input() config: RouteInputConfig = {};

  protected routes: string[] = [];
  protected saving = false;
  protected error = '';

  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly formFlowPopupStore = inject(FormFlowPopupStore);
  protected readonly routeEditorOutletInputs = computed(() => ({
    editor: this.formFlowPopupStore.routeInputEditorRef()
  }));

  private rowIdSequence = 0;
  private controlDisabled = false;
  private workingRoutes: string[] = [];
  private routeRowIds: string[] = [];
  private onModelChange: (value: string[]) => void = () => {};
  private onModelTouched: () => void = () => {};
  private lastRouteEditorActionRequestId = 0;
  private readonly destroyEffects: Array<{ destroy: () => void }> = [];

  constructor() {
    this.destroyEffects.push(
      effect(() => {
        if (this.formFlowPopupStore.routeInputEditorRef()) {
          void this.formFlowPopupStore.ensureRouteInputEditorLoaded();
        }
      }),
      effect(() => {
        const request = this.formFlowPopupStore.routeInputEditorActionRequest();
        if (!request || request.requestId <= this.lastRouteEditorActionRequestId) {
          return;
        }
        this.lastRouteEditorActionRequestId = request.requestId;
        untracked(() => this.handleRouteEditorActionRequest(request));
      })
    );
  }

  ngOnDestroy(): void {
    this.destroyEffects.forEach(item => item.destroy());
    if (this.routeEditorIsOpen()) {
      this.formFlowPopupStore.closeRouteInputEditor();
    }
  }

  writeValue(value: readonly string[] | null | undefined): void {
    this.routes = this.normalizeRoutes(value);
    if (this.routeEditorIsOpen() && !this.saving) {
      this.resetWorkingRoutes();
      this.updateEditorState();
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onModelChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onModelTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.controlDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  protected locked(): boolean {
    return this.readOnly || this.disabled || this.controlDisabled || this.editable() === false;
  }

  protected panelTitle(): string {
    return this.resolveConfigValue(this.config.title, 'Route');
  }

  protected panelSubtitle(): string {
    return this.resolveConfigValue(this.config.subtitle, 'Runtime route for this event asset.');
  }

  protected openRouteLabel(): string {
    return this.resolveConfigValue(this.config.openLabel, 'Open Route Setup');
  }

  protected emptyRouteLabel(): string {
    return this.locked()
      ? this.resolveConfigValue(this.config.readOnlyEmptyLabel, 'No route is set for this event asset.')
      : this.resolveConfigValue(this.config.emptyLabel, 'No route is set for this event asset.');
  }

  protected routeCountLabel(): string {
    const count = this.visibleRoutes().length;
    return count === 1 ? '1 stop' : `${count} stops`;
  }

  protected visibleRoutes(): string[] {
    return this.normalizeRoutes(this.routes);
  }

  protected workingVisibleRoutes(): string[] {
    return this.workingRoutes;
  }

  protected hasRoute(): boolean {
    return this.visibleRoutes().length > 0;
  }

  protected routeEnabled(): boolean {
    return this.resolveConfigValue(this.config.enabled, this.hasRoute()) === true || this.routeEditorIsOpen();
  }

  protected async toggleRouteEnabled(event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.locked() || this.saving) {
      return;
    }
    if (!this.routeEnabled()) {
      this.openRoutePopup(event);
      return;
    }
    this.formFlowPopupStore.closeRouteInputEditor();
    await this.saveRouteValue(false, this.routes);
  }

  protected openRoutePopup(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.locked()) {
      return;
    }
    this.resetWorkingRoutes();
    this.error = '';
    this.formFlowPopupStore.openRouteInputEditor(this.buildEditorState());
    this.onModelTouched();
    this.cdr.markForCheck();
  }

  private closeRoutePopup(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.saving) {
      return;
    }
    this.formFlowPopupStore.closeRouteInputEditor();
    this.error = '';
    this.cdr.markForCheck();
  }

  private addStop(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.locked() || this.saving) {
      return;
    }
    this.workingRoutes = [...this.workingRoutes, ''];
    this.routeRowIds = [...this.routeRowIds, this.nextRouteRowId()];
    this.error = '';
    this.updateEditorState();
    this.cdr.markForCheck();
  }

  private removeStop(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.locked() || this.saving || index < 0 || index >= this.workingRoutes.length) {
      return;
    }
    this.workingRoutes = this.workingRoutes.filter((_stop, stopIndex) => stopIndex !== index);
    this.routeRowIds = this.routeRowIds.filter((_id, stopIndex) => stopIndex !== index);
    if (this.workingRoutes.length === 0) {
      this.workingRoutes = [''];
      this.routeRowIds = [this.nextRouteRowId()];
    }
    this.error = '';
    this.updateEditorState();
    this.cdr.markForCheck();
  }

  private updateStop(index: number, value: string): void {
    if (this.locked() || this.saving || index < 0 || index >= this.workingRoutes.length) {
      return;
    }
    const routes = [...this.workingRoutes];
    routes[index] = value;
    this.workingRoutes = routes;
    this.error = '';
    this.updateEditorState();
    this.cdr.markForCheck();
  }

  private dropStop(previousIndex: number, currentIndex: number): void {
    if (this.locked() || this.saving || previousIndex === currentIndex) {
      return;
    }
    const routes = [...this.workingRoutes];
    const rowIds = [...this.routeRowIds];
    const [route] = routes.splice(previousIndex, 1);
    const [rowId] = rowIds.splice(previousIndex, 1);
    routes.splice(currentIndex, 0, route);
    rowIds.splice(currentIndex, 0, rowId);
    this.workingRoutes = routes;
    this.routeRowIds = rowIds;
    this.error = '';
    this.updateEditorState();
    this.cdr.markForCheck();
  }

  protected canSaveRoute(): boolean {
    if (this.locked() || this.saving) {
      return false;
    }
    return !this.routesEqual(this.normalizeRoutes(this.workingRoutes), this.routes)
      || this.resolveConfigValue(this.config.enabled, this.hasRoute()) !== true;
  }

  private async saveRoute(event?: Event): Promise<void> {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.canSaveRoute()) {
      return;
    }
    const normalized = this.normalizeRoutes(this.workingRoutes);
    await this.saveRouteValue(true, normalized);
  }

  private async saveRouteValue(routeEnabled: boolean, normalized: string[]): Promise<void> {
    this.saving = true;
    this.error = '';
    this.updateEditorState();
    this.cdr.markForCheck();
    try {
      const result = await this.config.onSave?.({ routeEnabled, routes: normalized });
      const nextRoutes = this.normalizeRoutes(this.routeSaveResultRoutes(result, normalized));
      this.routes = nextRoutes;
      this.formFlowPopupStore.closeRouteInputEditor();
      this.emitRoutes();
    } catch {
      this.error = 'Unable to save route changes.';
      this.updateEditorState();
    } finally {
      this.saving = false;
      this.updateEditorState();
      this.cdr.markForCheck();
    }
  }

  protected openRouteMap(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openGoogleMapsDirections(this.routes);
  }

  protected openStopMap(stop: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.openGoogleMapsSearch(stop);
  }

  private resetWorkingRoutes(): void {
    const routes = this.routes.length > 0 ? [...this.routes] : [''];
    this.workingRoutes = routes;
    this.routeRowIds = routes.map(() => this.nextRouteRowId());
  }

  private emitRoutes(): void {
    const nextRoutes = [...this.routes];
    this.onModelChange(nextRoutes);
    this.onModelTouched();
  }

  private normalizeRoutes(routes: readonly string[] | null | undefined): string[] {
    return (routes ?? [])
      .map(stop => `${stop ?? ''}`.trim())
      .filter(stop => stop.length > 0);
  }

  private routesEqual(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((stop, index) => stop === right[index]);
  }

  private editable(): boolean {
    return this.resolveConfigValue(this.config.editable, true) !== false;
  }

  private nextRouteRowId(): string {
    this.rowIdSequence += 1;
    return `route-input-stop-${Date.now()}-${this.rowIdSequence}`;
  }

  private routeEditorIsOpen(): boolean {
    return this.formFlowPopupStore.routeInputEditorRef() !== null;
  }

  private buildEditorState(): {
    title: string;
    subtitle: string;
    zIndex: number;
    routes: string[];
    routeRowIds: string[];
    saving: boolean;
    error: string | null;
    canSave: boolean;
  } {
    return {
      title: this.resolveConfigValue(this.config.popupTitle, 'Route Setup'),
      subtitle: this.resolveConfigValue(this.config.popupSubtitle, 'Set the runtime route for this event asset.'),
      zIndex: this.routePopupZIndex(),
      routes: [...this.workingRoutes],
      routeRowIds: [...this.routeRowIds],
      saving: this.saving,
      error: this.error || null,
      canSave: this.canSaveRoute()
    };
  }

  private updateEditorState(): void {
    if (!this.routeEditorIsOpen()) {
      return;
    }
    this.formFlowPopupStore.updateRouteInputEditor(this.buildEditorState());
  }

  private routePopupZIndex(): number {
    const parentZIndex = Number(this.resolveConfigValue(this.config.parentZIndex, null));
    return Number.isFinite(parentZIndex) && parentZIndex > 0
      ? Math.trunc(parentZIndex) + 100
      : 12600;
  }

  protected routeEditorComponent(): Type<unknown> | null {
    return this.formFlowPopupStore.routeInputEditorComponent();
  }

  private handleRouteEditorActionRequest(request: FormFlowRouteInputEditorActionRequest): void {
    switch (request.kind) {
      case 'close':
        this.closeRoutePopup(request.event);
        return;
      case 'save':
        void this.saveRoute(request.event);
        return;
      case 'addStop':
        this.addStop(request.event);
        return;
      case 'removeStop':
        this.removeStop(request.index, request.event);
        return;
      case 'updateStop':
        this.updateStop(request.index, request.value);
        return;
      case 'dropStop':
        this.dropStop(request.previousIndex, request.currentIndex);
        return;
      case 'openStopMap':
        this.openStopMap(this.workingRoutes[request.index] ?? request.stop, request.event);
        return;
      case 'openRouteMap':
        this.openGoogleMapsDirections(this.workingRoutes);
        return;
    }
  }

  private routeSaveResultRoutes(result: void | RouteInputSaveValue, fallback: readonly string[]): readonly string[] {
    return result && typeof result === 'object' && Array.isArray(result.routes)
      ? result.routes
      : fallback;
  }

  private resolveConfigValue<TValue>(value: RouteInputConfigValue<TValue> | undefined, fallback: TValue): TValue {
    if (typeof value === 'function') {
      return (value as () => TValue)();
    }
    return value ?? fallback;
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
    const normalized = this.normalizeRoutes(stops);
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
