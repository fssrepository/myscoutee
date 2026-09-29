import { Injectable, computed, inject, signal } from '@angular/core';

import type { HelpCenterRevisionDto } from '../../contracts';
import { HelpCenterService } from './help-center.service';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class ExplanationGuideService {
  private static readonly STORAGE_KEY = APP_STORAGE_KEYS.explanationGuideEnabled;
  private readonly helpCenter = inject(HelpCenterService);
  private readonly enabledRef = signal(this.readEnabledState());
  private readonly currentContextRef = signal<string | null>(null);
  private readonly popupOpenRef = signal(false);
  private readonly launcherDismissedRef = signal(false);
  private readonly loadingRef = signal(false);
  private readonly visibleRevisionRef = signal<HelpCenterRevisionDto | null>(null);
  private readonly contextStack: string[] = [];
  private loadSerial = 0;

  readonly enabled = this.enabledRef.asReadonly();
  readonly currentContextKey = this.currentContextRef.asReadonly();
  readonly popupOpen = this.popupOpenRef.asReadonly();
  readonly loading = this.loadingRef.asReadonly();
  readonly visibleRevision = this.visibleRevisionRef.asReadonly();
  readonly hasVisiblePopup = computed(() => this.popupOpenRef());
  readonly hasVisibleRevision = computed(() => Boolean(this.visibleRevisionRef()));
  readonly launcherVisible = computed(() => this.enabledRef() && !this.launcherDismissedRef() && this.hasVisibleRevision());

  registerContext(contextKey: string): () => void {
    const normalized = this.normalizeContextKey(contextKey);
    if (!normalized) {
      return () => undefined;
    }
    this.contextStack.push(normalized);
    this.setCurrentContext(normalized);
    let registered = true;
    return () => {
      if (!registered) {
        return;
      }
      registered = false;
      const index = this.contextStack.lastIndexOf(normalized);
      if (index >= 0) {
        this.contextStack.splice(index, 1);
      }
      this.setCurrentContext(this.contextStack[this.contextStack.length - 1] ?? null);
    };
  }

  setEnabled(enabled: boolean): void {
    if (this.enabledRef() === enabled) {
      return;
    }
    this.enabledRef.set(enabled);
    this.writeEnabledState(enabled);
    this.refreshVisibleForCurrent();
  }

  toggleEnabled(): void {
    this.setEnabled(!this.enabledRef());
  }

  openCurrent(): void {
    if (this.launcherVisible()) {
      this.popupOpenRef.set(true);
    }
  }

  closePopup(): void {
    this.popupOpenRef.set(false);
  }

  dismissLauncher(): void {
    this.launcherDismissedRef.set(true);
    this.closePopup();
  }

  private setCurrentContext(contextKey: string | null): void {
    if (this.currentContextRef() === contextKey) {
      return;
    }
    this.currentContextRef.set(contextKey);
    this.refreshVisibleForCurrent();
  }

  private refreshVisibleForCurrent(): void {
    ++this.loadSerial;
    this.closePopup();
    this.launcherDismissedRef.set(false);
    this.visibleRevisionRef.set(null);
    this.loadingRef.set(false);
    const contextKey = this.currentContextRef();
    if (!this.enabledRef() || !contextKey) {
      return;
    }
    void this.loadForContext(contextKey);
  }

  private async loadForContext(contextKey: string): Promise<void> {
    const serial = this.loadSerial;
    this.loadingRef.set(true);
    try {
      const state = await this.helpCenter.loadExplanationState(contextKey);
      if (serial !== this.loadSerial || !this.enabledRef() || this.currentContextRef() !== contextKey) {
        return;
      }
      this.visibleRevisionRef.set(state.activeRevision ?? null);
      this.loadingRef.set(false);
    } catch {
      if (serial === this.loadSerial) {
        this.loadingRef.set(false);
      }
    }
  }

  private normalizeContextKey(contextKey: string | null | undefined): string {
    return `${contextKey ?? ''}`.trim();
  }

  private readEnabledState(): boolean {
    if (typeof localStorage === 'undefined') {
      return true;
    }
    try {
      const stored = localStorage.getItem(ExplanationGuideService.STORAGE_KEY);
      return stored === null ? true : stored !== 'false';
    } catch {
      return true;
    }
  }

  private writeEnabledState(enabled: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(ExplanationGuideService.STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
      // Ignore unavailable storage; the guide still works for the current session.
    }
  }
}
