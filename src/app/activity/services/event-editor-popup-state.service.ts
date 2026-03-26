import { computed, Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface EventEditorState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  sourceEvent?: any;
  readOnly?: boolean;
}

export type EventEditorSubEventResourceType = 'Members' | 'Car' | 'Accommodation' | 'Supplies';

export interface EventEditorSubEventResourcePopupRequest {
  type: EventEditorSubEventResourceType;
  subEvent: any;
  ownerId?: string | null;
  parentTitle?: string;
  group?: {
    id?: string | null;
    groupLabel?: string;
    pending?: number;
    capacityMin?: number;
    capacityMax?: number;
  } | null;
}

@Injectable({
  providedIn: 'root'
})
export class EventEditorPopupStateService {
  private _isOpen = signal(false);
  private _mode = signal<'create' | 'edit'>('create');
  private _sourceEvent = signal<any>(null);
  private _readOnly = signal(false);
  private _subEventResourcePopupRequest = signal<EventEditorSubEventResourcePopupRequest | null>(null);
  private _openSubEventsRequestNonce = signal(0);

  readonly isOpen = this._isOpen.asReadonly();
  readonly mode = this._mode.asReadonly();
  readonly sourceEvent = this._sourceEvent.asReadonly();
  readonly readOnly = this._readOnly.asReadonly();
  readonly subEventResourcePopupRequest = this._subEventResourcePopupRequest.asReadonly();
  readonly openSubEventsRequestNonce = this._openSubEventsRequestNonce.asReadonly();

  readonly isOpenBoolean = computed(() => this._isOpen());

  private _onOpen = new Subject<void>();
  private _onClose = new Subject<void>();

  readonly onOpen$ = this._onOpen.asObservable();
  readonly onClose$ = this._onClose.asObservable();

  open(mode: 'create' | 'edit' = 'create', sourceEvent?: any, readOnly?: boolean): void {
    this._mode.set(mode);
    this._sourceEvent.set(sourceEvent ?? null);
    this._readOnly.set(Boolean(readOnly));
    this._isOpen.set(true);
    this._onOpen.next();
  }

  openView(sourceEvent: any): void {
    this.open('edit', sourceEvent, true);
  }

  openEdit(sourceEvent: any): void {
    this.open('edit', sourceEvent, false);
  }

  openCreate(): void {
    this.open('create');
  }

  close(): void {
    this._isOpen.set(false);
    this._sourceEvent.set(null);
    this._readOnly.set(false);
    this._subEventResourcePopupRequest.set(null);
    this._onClose.next();
  }

  toggle(mode: 'create' | 'edit' = 'create', sourceEvent?: any, readOnly?: boolean): void {
    if (this._isOpen()) {
      this.close();
      return;
    }
    this.open(mode, sourceEvent, readOnly);
  }

  get isCurrentlyOpen(): boolean {
    return this._isOpen();
  }

  get currentMode(): 'create' | 'edit' {
    return this._mode();
  }

  get currentSourceEvent(): any {
    return this._sourceEvent();
  }

  get isReadOnly(): boolean {
    return this._readOnly();
  }

  requestSubEventResourcePopup(request: EventEditorSubEventResourcePopupRequest): void {
    this._subEventResourcePopupRequest.set(request);
  }

  clearSubEventResourcePopupRequest(): void {
    this._subEventResourcePopupRequest.set(null);
  }

  requestOpenSubEventsPopup(): void {
    this._openSubEventsRequestNonce.update(value => value + 1);
  }
}
