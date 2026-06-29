import { Injectable, Type, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface EventEditorState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  sourceEvent?: any;
  readOnly?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EventEditorPopupStore {
  private readonly _isOpen = signal(false);
  private readonly _mode = signal<'create' | 'edit'>('create');
  private readonly _sourceEvent = signal<any>(null);
  private readonly _readOnly = signal(false);
  private readonly eventEditorPopupComponentRef = signal<Type<unknown> | null>(null);
  private readonly _onOpen = new Subject<void>();
  private readonly _onClose = new Subject<void>();

  readonly isOpen = this._isOpen.asReadonly();
  readonly mode = this._mode.asReadonly();
  readonly sourceEvent = this._sourceEvent.asReadonly();
  readonly readOnly = this._readOnly.asReadonly();
  readonly eventEditorPopupComponent = this.eventEditorPopupComponentRef.asReadonly();

  readonly isOpenBoolean = computed(() => this._isOpen());
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

  async ensureEventEditorPopupLoaded(): Promise<void> {
    if (this.eventEditorPopupComponentRef()) {
      return;
    }
    const module = await import('../../../../activity/components/event-editor-popup/event-editor-popup.component');
    this.eventEditorPopupComponentRef.set(module.EventEditorPopupComponent);
  }
}
