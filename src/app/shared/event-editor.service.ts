import { Injectable, signal, computed } from '@angular/core';
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
export class EventEditorService {
  // Signal to track the open/close state
  private _isOpen = signal(false);
  
  // Signal for the editor mode
  private _mode = signal<'create' | 'edit'>('create');
  
  // Signal for the source event (used for view/edit)
  private _sourceEvent = signal<any>(null);
  
  // Signal for read-only mode (used for view)
  private _readOnly = signal(false);
  
  // Public readonly signals
  readonly isOpen = this._isOpen.asReadonly();
  readonly mode = this._mode.asReadonly();
  readonly sourceEvent = this._sourceEvent.asReadonly();
  readonly readOnly = this._readOnly.asReadonly();
  
  // Computed value for easy template usage
  readonly isOpenBoolean = computed(() => this._isOpen());
  
  // Subjects for open/close events
  private _onOpen = new Subject<void>();
  private _onClose = new Subject<void>();
  
  // Observables for open/close events
  readonly onOpen$ = this._onOpen.asObservable();
  readonly onClose$ = this._onClose.asObservable();

  constructor() {}

  /**
   * Open the event editor
   * @param mode - 'create' or 'edit' mode
   * @param sourceEvent - optional event data to edit/view
   * @param readOnly - optional flag for view-only mode
   */
  open(mode: 'create' | 'edit' = 'create', sourceEvent?: any, readOnly?: boolean): void {
    this._mode.set(mode);
    this._sourceEvent.set(sourceEvent || null);
    this._readOnly.set(readOnly || false);
    this._isOpen.set(true);
    this._onOpen.next();
  }

  /**
   * Open the event in view mode (read-only)
   * @param sourceEvent - the event data to view
   */
  openView(sourceEvent: any): void {
    this.open('edit', sourceEvent, true);
  }

  /**
   * Open the event in edit mode
   * @param sourceEvent - the event data to edit
   */
  openEdit(sourceEvent: any): void {
    this.open('edit', sourceEvent, false);
  }

  /**
   * Open the editor in create mode
   */
  openCreate(): void {
    this.open('create');
  }

  /**
   * Close the event editor
   */
  close(): void {
    this._isOpen.set(false);
    this._sourceEvent.set(null);
    this._readOnly.set(false);
    this._onClose.next();
  }

  /**
   * Toggle the event editor open/close
   * @param mode - mode to use when opening (if currently closed)
   * @param sourceEvent - optional event data to edit/view
   * @param readOnly - optional flag for view-only mode
   */
  toggle(mode: 'create' | 'edit' = 'create', sourceEvent?: any, readOnly?: boolean): void {
    if (this._isOpen()) {
      this.close();
    } else {
      this.open(mode, sourceEvent, readOnly);
    }
  }

  /**
   * Check if editor is currently open
   */
  get isCurrentlyOpen(): boolean {
    return this._isOpen();
  }

  /**
   * Get current mode
   */
  get currentMode(): 'create' | 'edit' {
    return this._mode();
  }

  /**
   * Get current source event
   */
  get currentSourceEvent(): any {
    return this._sourceEvent();
  }

  /**
   * Check if in read-only mode
   */
  get isReadOnly(): boolean {
    return this._readOnly();
  }
}
