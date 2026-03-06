export type ProfileEditorScreen = 'main' | 'values' | 'interest' | 'experience' | 'imageEditor';

/**
 * Small deterministic state machine for screen-to-screen navigation in profile editor.
 * It keeps a back stack so nested screen transitions can safely return to the previous state.
 */
export class ProfileEditorStateMachine {
  private currentState: ProfileEditorScreen = 'main';
  private readonly history: ProfileEditorScreen[] = [];

  get current(): ProfileEditorScreen {
    return this.currentState;
  }

  reset(): void {
    this.currentState = 'main';
    this.history.length = 0;
  }

  goTo(next: ProfileEditorScreen): ProfileEditorScreen {
    if (next === this.currentState) {
      return this.currentState;
    }
    this.history.push(this.currentState);
    this.currentState = next;
    return this.currentState;
  }

  canGoBack(): boolean {
    return this.history.length > 0;
  }

  back(): ProfileEditorScreen {
    const previous = this.history.pop();
    this.currentState = previous ?? 'main';
    return this.currentState;
  }

  goMain(): ProfileEditorScreen {
    this.currentState = 'main';
    this.history.length = 0;
    return this.currentState;
  }
}
