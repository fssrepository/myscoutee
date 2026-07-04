import { Injectable, Type, signal } from '@angular/core';

export interface FormFlowRouteInputEditorState {
  ownerId: string;
  title: string;
  subtitle: string;
  zIndex: number;
  routes: string[];
  routeRowIds: string[];
  saving: boolean;
  error: string | null;
  canSave: boolean;
  readOnly: boolean;
}

interface FormFlowRouteInputEditorActionBase {
  ownerId: string;
  requestId: number;
  event?: Event;
}

export type FormFlowRouteInputEditorActionRequest =
  | (FormFlowRouteInputEditorActionBase & { kind: 'close' | 'save' })
  | (FormFlowRouteInputEditorActionBase & {
    kind: 'draft';
    routes: string[];
    routeRowIds: string[];
  });

type FormFlowRouteInputEditorActionPayload =
  | (Omit<FormFlowRouteInputEditorActionBase, 'requestId'> & { kind: 'close' | 'save' })
  | (Omit<FormFlowRouteInputEditorActionBase, 'requestId'> & {
    kind: 'draft';
    routes: string[];
    routeRowIds: string[];
  });

@Injectable({
  providedIn: 'root'
})
export class FormFlowPopupStore {
  readonly routeInputEditorRef = signal<FormFlowRouteInputEditorState | null>(null);

  private readonly routeInputEditorComponentRef = signal<Type<unknown> | null>(null);
  private readonly routeInputEditorActionRequestRef = signal<FormFlowRouteInputEditorActionRequest | null>(null);
  private routeInputEditorActionSequence = 0;

  readonly routeInputEditorComponent = this.routeInputEditorComponentRef.asReadonly();
  readonly routeInputEditorActionRequest = this.routeInputEditorActionRequestRef.asReadonly();

  openRouteInputEditor(editor: FormFlowRouteInputEditorState): void {
    this.routeInputEditorRef.set(this.cloneRouteInputEditor(editor));
  }

  updateRouteInputEditor(editor: FormFlowRouteInputEditorState): void {
    const current = this.routeInputEditorRef();
    if (current && current.ownerId !== editor.ownerId) {
      return;
    }
    this.routeInputEditorRef.set(this.cloneRouteInputEditor(editor));
  }

  closeRouteInputEditor(ownerId?: string): void {
    const current = this.routeInputEditorRef();
    if (ownerId && current?.ownerId !== ownerId) {
      return;
    }
    this.routeInputEditorRef.set(null);
  }

  requestRouteInputEditorClose(ownerId: string, event?: Event): void {
    this.requestRouteInputEditorAction({ ownerId, kind: 'close', event });
  }

  requestRouteInputEditorSave(ownerId: string, event?: Event): void {
    this.requestRouteInputEditorAction({ ownerId, kind: 'save', event });
  }

  requestRouteInputEditorDraft(
    ownerId: string,
    routes: readonly string[],
    routeRowIds: readonly string[],
    event?: Event
  ): void {
    this.requestRouteInputEditorAction({
      ownerId,
      kind: 'draft',
      routes: [...routes],
      routeRowIds: [...routeRowIds],
      event
    });
  }

  async ensureRouteInputEditorLoaded(): Promise<void> {
    if (this.routeInputEditorComponentRef()) {
      return;
    }
    const module = await import('../inputs/route-input/route-input-popup/route-input-popup.component');
    this.routeInputEditorComponentRef.set(module.RouteInputPopupComponent);
  }

  private requestRouteInputEditorAction(request: FormFlowRouteInputEditorActionPayload): void {
    this.routeInputEditorActionSequence += 1;
    this.routeInputEditorActionRequestRef.set({
      ...request,
      requestId: this.routeInputEditorActionSequence
    });
  }

  private cloneRouteInputEditor(editor: FormFlowRouteInputEditorState): FormFlowRouteInputEditorState {
    return {
      ...editor,
      routes: [...editor.routes],
      routeRowIds: [...editor.routeRowIds]
    };
  }
}
