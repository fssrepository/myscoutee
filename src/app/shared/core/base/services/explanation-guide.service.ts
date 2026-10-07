import { Inject, Injectable, InjectionToken, computed, effect, inject, signal } from '@angular/core';

import type { HelpCenterGuideFieldDto, HelpCenterRevisionDto, HelpCenterStateDto } from '../../contracts';
import { HelpCenterService } from './help-center.service';
import { APP_STORAGE_KEYS } from '../../common/storage-scope';
import { I18nService } from './i18n.service';
import { APP_STATIC_DATA } from '../../../app-static-data';

export interface ExplanationGuideOptions {
  storageKey?: string;
  dismissalScope?: 'context' | 'visit';
  loadState: (contextKey: string, language: string) => Promise<HelpCenterStateDto>;
}
export const EXPLANATION_GUIDE_OPTIONS = new InjectionToken<ExplanationGuideOptions>('Explanation guide options', {
  providedIn: 'root', factory: () => {
    const help = inject(HelpCenterService);
    return { storageKey: APP_STORAGE_KEYS.explanationGuideEnabled,
      loadState: (context, language) => help.loadExplanationState(context, language) };
  }
});

@Injectable({
  providedIn: 'root'
})
export class ExplanationGuideService {
  private readonly i18n = inject(I18nService);
  private readonly enabledRef = signal(true);
  private readonly currentContextRef = signal<string | null>(null);
  private readonly popupOpenRef = signal(false);
  private readonly tourVisibleRef = signal(false);
  private readonly popupModeRef = signal<'document' | 'tour'>('tour');
  private readonly stepIndexRef = signal(0);
  private readonly launcherDismissedRef = signal(false);
  private readonly loadingRef = signal(false);
  private readonly loadErrorRef = signal(false);
  private readonly noGuideRef = signal(false);
  private readonly visibleRevisionRef = signal<HelpCenterRevisionDto | null>(null);
  private readonly visibleGuideFieldsRef = signal<HelpCenterGuideFieldDto[]>([]);
  private readonly loadedContextRef = signal<string | null>(null);
  private readonly loadedLanguageRef = signal<string | null>(null);
  private readonly resolvedContextRef = signal<string | null>(null);
  private readonly contextStack: Array<{ contextKey: string | null }> = [];
  private loadSerial = 0;
  private introductionOffered = false;
  private releaseIntroduction: (() => void) | null = null;

  readonly enabled = this.enabledRef.asReadonly();
  readonly currentContextKey = this.currentContextRef.asReadonly();
  readonly popupOpen = this.popupOpenRef.asReadonly();
  readonly popupMode = this.popupModeRef.asReadonly();
  readonly stepIndex = this.stepIndexRef.asReadonly();
  readonly loading = this.loadingRef.asReadonly();
  readonly loadError = this.loadErrorRef.asReadonly();
  readonly noGuide = this.noGuideRef.asReadonly();
  readonly visibleRevision = this.visibleRevisionRef.asReadonly();
  readonly visibleGuideFields = this.visibleGuideFieldsRef.asReadonly();
  readonly hasVisiblePopup = computed(() => this.popupOpenRef() && !this.loadingRef()
    && (this.noGuideRef() || this.loadErrorRef() || (this.popupModeRef() === 'document'
      ? Boolean(this.visibleRevisionRef()) : this.tourVisibleRef())));
  readonly hasVisibleRevision = computed(() => Boolean(this.visibleRevisionRef()));
  readonly launcherVisible = computed(() => {
    const contextKey = this.currentContextRef();
    return this.enabledRef()
      && !this.launcherDismissedRef()
      && Boolean(contextKey && this.isExplainableContext(contextKey))
      && (this.resolvedContextRef() !== contextKey || this.hasVisibleRevision() || this.noGuideRef());
  });

  constructor(@Inject(EXPLANATION_GUIDE_OPTIONS) private readonly options: ExplanationGuideOptions) {
    this.enabledRef.set(this.readEnabledState());
    effect(() => {
      const contextKey = this.currentContextRef();
      const language = this.i18n.currentLanguage();
      const shouldRefresh = this.popupOpenRef()
        && this.resolvedContextRef() === contextKey
        && this.loadedLanguageRef() !== language
        && !this.loadingRef()
        && !this.loadErrorRef();
      if (contextKey && shouldRefresh) {
        this.visibleRevisionRef.set(null);
        this.visibleGuideFieldsRef.set([]);
        this.loadedContextRef.set(null);
        this.popupModeRef.set('tour');
        void this.loadForContext(contextKey, language);
      }
    });
  }

  // A null modal context temporarily hides the underlying surface's guide.
  registerContext(contextKey: string | null): () => void {
    if (this.releaseIntroduction) this.closePopup();
    const normalized = this.normalizeContextKey(contextKey);
    if (!normalized && contextKey !== null) {
      return () => undefined;
    }
    const registration = {
      contextKey: this.isExplainableContext(normalized) ? normalized : null
    };
    this.contextStack.push(registration);
    this.setCurrentContext(registration.contextKey);
    let registered = true;
    return () => {
      if (!registered) {
        return;
      }
      registered = false;
      const index = this.contextStack.lastIndexOf(registration);
      if (index >= 0) {
        this.contextStack.splice(index, 1);
      }
      this.setCurrentContext(this.contextStack[this.contextStack.length - 1]?.contextKey ?? null);
    };
  }

  setEnabled(enabled: boolean): void {
    if (enabled) this.launcherDismissedRef.set(false);
    if (this.enabledRef() === enabled) {
      return;
    }
    this.enabledRef.set(enabled);
    if (!enabled) {
      this.closePopup();
    }
    this.writeEnabledState(enabled);
  }

  toggleEnabled(): void {
    this.setEnabled(!this.enabledRef());
  }

  openCurrent(): void {
    if (this.releaseIntroduction) this.closePopup();
    if (this.popupOpenRef()) {
      this.closePopup();
      return;
    }
    if (!this.launcherVisible()) {
      return;
    }

    const contextKey = this.currentContextRef();
    if (!contextKey || !this.isExplainableContext(contextKey)) {
      return;
    }

    const language = this.i18n.currentLanguage();
    this.noGuideRef.set(false);
    const hasCurrentLanguageRevision = this.loadedContextRef() === contextKey
      && this.loadedLanguageRef() === language
      && Boolean(this.visibleRevisionRef());
    this.stepIndexRef.set(0);
    this.popupModeRef.set(hasCurrentLanguageRevision && this.visibleRevisionRef()?.presentation === 'document' ? 'document' : 'tour');
    this.popupOpenRef.set(true);

    if (hasCurrentLanguageRevision) {
      return;
    }
    if (this.resolvedContextRef() === contextKey && this.loadedLanguageRef() === language && !this.visibleRevisionRef()) {
      this.showNoGuide();
      return;
    }
    void this.loadForContext(contextKey, language);
  }

  nextStep(): void {
    if (this.popupModeRef() !== 'tour' || !this.popupOpenRef()) return;
    this.stepIndexRef.update(step => step + 1);
  }

  // Opening requests a guide; the existing target resolver confirms visibility.
  setTourVisible(visible: boolean): void {
    this.tourVisibleRef.set(visible);
  }

  showNoGuide(): void {
    this.noGuideRef.set(true);
    this.popupModeRef.set('tour');
  }

  setStepIndex(step: number): void {
    if (this.popupModeRef() === 'tour' && this.popupOpenRef() && Number.isInteger(step) && step >= 0) {
      this.stepIndexRef.set(step);
    }
  }

  closePopup(): void {
    if (this.loadingRef()) {
      ++this.loadSerial;
      this.loadingRef.set(false);
    }
    this.popupOpenRef.set(false);
    this.tourVisibleRef.set(false);
    if (this.releaseIntroduction) {
      const release = this.releaseIntroduction;
      this.releaseIntroduction = null;
      if (this.loadedContextRef() === 'landing.guide') {
        try { localStorage.setItem(APP_STORAGE_KEYS.explanationGuideIntroductionSeen, 'true'); } catch { /* Session-only when storage is unavailable. */ }
      }
      release();
    }
  }

  canOfferLauncherIntroduction(): boolean {
    return !this.introductionOffered && !this.popupOpenRef() && this.launcherVisible();
  }

  offerLauncherIntroduction(): void {
    if (!this.canOfferLauncherIntroduction()) return;
    this.introductionOffered = true;
    try {
      if (localStorage.getItem(APP_STORAGE_KEYS.explanationGuideIntroductionSeen) === 'true'
        || localStorage.getItem(APP_STORAGE_KEYS.entryConsent)) return;
    } catch { /* The introduction can still be shown once in this session. */ }
    const release = this.registerContext('landing.guide');
    this.openCurrent();
    this.releaseIntroduction = release;
  }

  beginVisit(): void {
    this.launcherDismissedRef.set(false);
  }

  dismissLauncher(): void {
    this.launcherDismissedRef.set(true);
    this.closePopup();
  }

  private setCurrentContext(contextKey: string | null): void {
    if (this.currentContextRef() === contextKey) {
      return;
    }
    const guideWasOpen = this.popupOpenRef();
    this.currentContextRef.set(contextKey);
    ++this.loadSerial;
    this.loadingRef.set(false);
    this.loadErrorRef.set(false);
    this.noGuideRef.set(false);
    this.visibleRevisionRef.set(null);
    this.visibleGuideFieldsRef.set([]);
    this.loadedContextRef.set(null);
    this.loadedLanguageRef.set(null);
    this.resolvedContextRef.set(null);
    if (this.options.dismissalScope !== 'visit') this.launcherDismissedRef.set(false);

    if (!contextKey) {
      this.popupOpenRef.set(false);
      return;
    }
    if (guideWasOpen && this.enabledRef()) {
      this.popupModeRef.set('tour');
      void this.loadForContext(contextKey, this.i18n.currentLanguage());
    }
  }

  private async loadForContext(contextKey: string, language: string): Promise<void> {
    const serial = ++this.loadSerial;
    this.loadingRef.set(true);
    this.loadErrorRef.set(false);
    this.noGuideRef.set(false);
    try {
      const state = await this.options.loadState(contextKey, language);
      if (serial !== this.loadSerial || !this.enabledRef() || this.currentContextRef() !== contextKey) {
        return;
      }
      if (this.i18n.currentLanguage() !== language) {
        this.loadingRef.set(false);
        void this.loadForContext(contextKey, this.i18n.currentLanguage());
        return;
      }
      const revision = state.activeRevision ?? null;
      const fields = [...state.guideFields].sort((left, right) => left.order - right.order);
      const usableRevision = revision && fields.length ? revision : null;
      this.visibleRevisionRef.set(usableRevision);
      this.visibleGuideFieldsRef.set(usableRevision ? fields : []);
      this.loadedContextRef.set(usableRevision ? contextKey : null);
      this.loadedLanguageRef.set(language);
      this.resolvedContextRef.set(contextKey);
      this.loadingRef.set(false);
      if (!usableRevision) {
        this.showNoGuide();
      } else {
        this.popupModeRef.set(usableRevision.presentation === 'document' ? 'document' : 'tour');
        this.stepIndexRef.set(0);
      }
    } catch {
      if (serial === this.loadSerial) {
        this.loadingRef.set(false);
        this.loadErrorRef.set(true);
        this.popupModeRef.set('tour');
      }
    }
  }

  private normalizeContextKey(contextKey: string | null | undefined): string {
    return `${contextKey ?? ''}`.trim();
  }

  private isExplainableContext(contextKey: string): boolean {
    return APP_STATIC_DATA.explainableSurfaces.some(surface => surface.enabled && surface.key === contextKey);
  }

  private readEnabledState(): boolean {
    if (!this.options.storageKey || typeof localStorage === 'undefined') {
      return true;
    }
    try {
      const stored = localStorage.getItem(this.options.storageKey);
      return stored === null ? true : stored !== 'false';
    } catch {
      return true;
    }
  }

  private writeEnabledState(enabled: boolean): void {
    if (!this.options.storageKey || typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(this.options.storageKey, enabled ? 'true' : 'false');
    } catch {
      // Ignore unavailable storage; the guide still works for the current session.
    }
  }
}
