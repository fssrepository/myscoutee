import { Injectable, computed, inject, signal } from '@angular/core';

import type { HelpCenterRevisionDto } from '../../contracts';
import { HelpCenterService } from './help-center.service';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';

@Injectable({
  providedIn: 'root'
})
export class ExplanationGuideService {
  private static readonly STORAGE_KEY = APP_STORAGE_KEYS.explanationGuideEnabled;
  private static readonly DISMISSED_CONTEXTS_STORAGE_KEY = APP_STORAGE_KEYS.explanationGuideDismissedContexts;
  private readonly helpCenter = inject(HelpCenterService);
  private readonly enabledRef = signal(this.readEnabledState());
  private readonly currentContextRef = signal<string | null>(null);
  private readonly popupOpenRef = signal(false);
  private readonly loadingRef = signal(false);
  private readonly visibleRevisionRef = signal<HelpCenterRevisionDto | null>(null);
  private readonly dismissedContexts = new Set<string>(this.readDismissedContexts());
  private readonly contextStack: string[] = [];
  private loadSerial = 0;

  readonly enabled = this.enabledRef.asReadonly();
  readonly currentContextKey = this.currentContextRef.asReadonly();
  readonly popupOpen = this.popupOpenRef.asReadonly();
  readonly loading = this.loadingRef.asReadonly();
  readonly visibleRevision = this.visibleRevisionRef.asReadonly();
  readonly hasVisiblePopup = computed(() => this.popupOpenRef());
  readonly hasVisibleRevision = computed(() => Boolean(this.visibleRevisionRef()));

  registerContext(contextKey: string): () => void {
    const normalized = this.normalizeContextKey(contextKey);
    if (!normalized) {
      return () => undefined;
    }
    this.contextStack.push(normalized);
    this.currentContextRef.set(normalized);
    this.refreshVisibleForCurrent();
    return () => {
      const index = this.contextStack.lastIndexOf(normalized);
      if (index >= 0) {
        this.contextStack.splice(index, 1);
      }
      this.currentContextRef.set(this.contextStack[this.contextStack.length - 1] ?? null);
      this.refreshVisibleForCurrent();
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabledRef.set(enabled);
    this.writeEnabledState(enabled);
    if (!enabled) {
      this.closePopup();
      return;
    }
    const contextKey = this.currentContextRef();
    if (contextKey) {
      this.refreshVisibleForCurrent();
    }
  }

  toggleEnabled(): void {
    this.setEnabled(!this.enabledRef());
  }

  dismiss(): void {
    const contextKey = this.currentContextRef();
    if (contextKey) {
      this.rememberDismissedContext(contextKey);
    }
    this.closePopup();
  }

  replayCurrent(): void {
    const contextKey = this.currentContextRef();
    if (!contextKey) {
      return;
    }
    this.dismissedContexts.delete(contextKey);
    this.writeDismissedContexts();
    this.setEnabled(true);
  }

  private refreshVisibleForCurrent(): void {
    const contextKey = this.currentContextRef();
    if (!this.enabledRef() || !contextKey || this.isDismissedContext(contextKey)) {
      this.closePopup();
      return;
    }
    this.popupOpenRef.set(true);
    this.visibleRevisionRef.set(null);
    void this.loadForContext(contextKey);
  }

  private async loadForContext(contextKey: string): Promise<void> {
    const serial = ++this.loadSerial;
    this.loadingRef.set(true);
    try {
      const state = await this.helpCenter.loadExplanationState(contextKey);
      if (serial !== this.loadSerial || !this.enabledRef() || this.currentContextRef() !== contextKey || this.isDismissedContext(contextKey)) {
        return;
      }
      const revision = state.activeRevision ?? null;
      if (!revision) {
        this.closePopup();
        return;
      }
      this.visibleRevisionRef.set(revision);
      this.loadingRef.set(false);
    } catch {
      if (serial === this.loadSerial) {
        this.closePopup();
      }
    }
  }

  private closePopup(): void {
    this.loadingRef.set(false);
    this.visibleRevisionRef.set(null);
    this.popupOpenRef.set(false);
  }

  private normalizeContextKey(contextKey: string | null | undefined): string {
    return `${contextKey ?? ''}`.trim();
  }

  private isDismissedContext(contextKey: string): boolean {
    return this.dismissedContexts.has(this.normalizeContextKey(contextKey));
  }

  private rememberDismissedContext(contextKey: string): void {
    const normalized = this.normalizeContextKey(contextKey);
    if (!normalized) {
      return;
    }
    this.dismissedContexts.add(normalized);
    this.writeDismissedContexts();
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

  private readDismissedContexts(): string[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    try {
      const stored = localStorage.getItem(ExplanationGuideService.DISMISSED_CONTEXTS_STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map(value => this.normalizeContextKey(`${value ?? ''}`))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private writeDismissedContexts(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(
        ExplanationGuideService.DISMISSED_CONTEXTS_STORAGE_KEY,
        JSON.stringify([...this.dismissedContexts].sort())
      );
    } catch {
      // Ignore unavailable storage; the in-memory dismissal still prevents repeats.
    }
  }
}
