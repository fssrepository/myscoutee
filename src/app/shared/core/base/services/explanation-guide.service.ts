import { Injectable, computed, inject, signal } from '@angular/core';

import type { HelpCenterRevision } from '../models';
import { HelpCenterService } from './help-center.service';

@Injectable({
  providedIn: 'root'
})
export class ExplanationGuideService {
  private static readonly STORAGE_KEY = 'myscoutee.explanation-guide.enabled.v1';
  private readonly helpCenter = inject(HelpCenterService);
  private readonly enabledRef = signal(this.readEnabledState());
  private readonly currentContextRef = signal<string | null>(null);
  private readonly visibleRevisionRef = signal<HelpCenterRevision | null>(null);
  private readonly dismissedContexts = new Set<string>();
  private readonly contextStack: string[] = [];
  private loadSerial = 0;

  readonly enabled = this.enabledRef.asReadonly();
  readonly currentContextKey = this.currentContextRef.asReadonly();
  readonly visibleRevision = this.visibleRevisionRef.asReadonly();
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
      this.visibleRevisionRef.set(null);
      return;
    }
    this.dismissedContexts.clear();
    const contextKey = this.currentContextRef();
    if (contextKey) {
      void this.loadForContext(contextKey);
    }
  }

  toggleEnabled(): void {
    this.setEnabled(!this.enabledRef());
  }

  dismiss(): void {
    const contextKey = this.currentContextRef();
    if (contextKey) {
      this.dismissedContexts.add(contextKey);
    }
    this.visibleRevisionRef.set(null);
  }

  replayCurrent(): void {
    const contextKey = this.currentContextRef();
    if (!contextKey) {
      return;
    }
    this.dismissedContexts.delete(contextKey);
    this.setEnabled(true);
  }

  private refreshVisibleForCurrent(): void {
    const contextKey = this.currentContextRef();
    if (!this.enabledRef() || !contextKey || this.dismissedContexts.has(contextKey)) {
      this.visibleRevisionRef.set(null);
      return;
    }
    void this.loadForContext(contextKey);
  }

  private async loadForContext(contextKey: string): Promise<void> {
    const serial = ++this.loadSerial;
    try {
      const state = await this.helpCenter.loadExplanationState(contextKey);
      if (serial !== this.loadSerial || !this.enabledRef() || this.currentContextRef() !== contextKey || this.dismissedContexts.has(contextKey)) {
        return;
      }
      this.visibleRevisionRef.set(state.activeRevision ?? null);
    } catch {
      if (serial === this.loadSerial) {
        this.visibleRevisionRef.set(null);
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
    const stored = localStorage.getItem(ExplanationGuideService.STORAGE_KEY);
    return stored === null ? true : stored !== 'false';
  }

  private writeEnabledState(enabled: boolean): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(ExplanationGuideService.STORAGE_KEY, enabled ? 'true' : 'false');
  }
}
