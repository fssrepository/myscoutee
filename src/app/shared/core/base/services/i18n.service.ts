import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, NgZone, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import {
  I18nBundleRepository,
  type I18nBundleScope,
  type StoredI18nBundle
} from '../repositories/i18n-bundle.repository';
import { SessionService } from './session.service';

interface I18nAssetBundle {
  lang?: string;
  version?: string;
  messages?: Record<string, string>;
}

interface I18nRemoteBundleResponse {
  lang?: string;
  version?: string;
  data?: Record<string, string> | null;
}

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private static readonly DEFAULT_LANGUAGE = 'en';
  private static readonly REVALIDATE_HEADERS = new HttpHeaders({
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  });
  private static readonly LOCAL_SEED_ASSETS: Record<string, string> = {
    en: 'assets/i18n/en.json',
    hu: 'assets/i18n/hu.json'
  };
  private static readonly TRANSLATABLE_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'] as const;
  private static readonly SKIP_ATTRIBUTE_SELECTOR = [
    '[data-i18n-ignore]',
    'mat-icon',
    '.mat-icon',
    '.material-icons',
    'script',
    'style',
    'code',
    'pre'
  ].join(',');
  private static readonly SKIP_TEXT_SELECTOR = [
    '[data-i18n-ignore]',
    'mat-icon',
    '.mat-icon',
    '.material-icons',
    'script',
    'style',
    'code',
    'pre',
    'textarea',
    '[contenteditable="true"]',
    '.admin-message',
    '.activities-card-title',
    '.activities-card-subtitle',
    '.activities-card-detail',
    '.admin-feedback-detail-field p',
    '.profile-view-experience-description',
    '.user-name',
    '.contact-title-wrap h3',
    '.profile-name-line'
  ].join(',');

  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly bundleRepository = inject(I18nBundleRepository);
  private readonly sessionService = inject(SessionService);
  private readonly currentLanguageSignal = signal(I18nService.DEFAULT_LANGUAGE);
  private readonly messagesSignal = signal<Record<string, string>>({});
  private readonly sourceMessagesSignal = signal<Record<string, string>>({});
  private readonly sourceKeyByTextSignal = signal<Record<string, string>>({});
  private readonly revisionSignal = signal(0);
  private readonly textNodeSources = new WeakMap<Text, string>();
  private readonly attributeSources = new WeakMap<Element, Map<string, string>>();
  private domObserver: MutationObserver | null = null;
  private initialized = false;
  private activeBundleScope = this.resolveBundleScope();
  private bundleLoadGeneration = 0;
  private scanQueued = false;
  private translatingDom = false;

  readonly currentLanguage = this.currentLanguageSignal.asReadonly();
  readonly isDefaultLanguage = computed(() => this.currentLanguageSignal() === I18nService.DEFAULT_LANGUAGE);
  readonly revision = this.revisionSignal.asReadonly();

  constructor() {
    effect(() => {
      this.sessionService.session();
      const nextScope = this.resolveBundleScope();
      if (!this.initialized || nextScope === this.activeBundleScope) {
        return;
      }
      this.startLanguageLoad(nextScope);
    });
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.installDomObserver();
    this.startLanguageLoad(this.resolveBundleScope());
  }

  translate(value: string | null | undefined, fallback?: string | null): string {
    const source = `${value ?? ''}`;
    if (!source) {
      return `${fallback ?? ''}`;
    }
    const translated = this.translateRaw(source);
    const fallbackText = `${fallback ?? ''}`.trim();
    if (fallbackText && translated === source && fallbackText !== source.trim()) {
      return this.translateRaw(fallbackText);
    }
    return translated;
  }

  translateParams(
    value: string | null | undefined,
    values: Record<string, string | number>,
    fallback?: string | null
  ): string {
    const translated = this.translate(value, fallback);
    return this.interpolate(
      translated,
      Object.fromEntries(Object.entries(values).map(([key, item]) => [key, `${item ?? ''}`]))
    );
  }

  private startLanguageLoad(scope: I18nBundleScope): void {
    this.activeBundleScope = scope;
    const generation = ++this.bundleLoadGeneration;
    this.currentLanguageSignal.set(I18nService.DEFAULT_LANGUAGE);
    this.messagesSignal.set({});
    this.sourceMessagesSignal.set({});
    this.sourceKeyByTextSignal.set({});
    this.updateDocumentLanguage(I18nService.DEFAULT_LANGUAGE);
    this.bumpRevision();
    this.scheduleDomScan();
    void this.loadPreferredLanguage(scope, generation);
  }

  private async loadPreferredLanguage(
    scope: I18nBundleScope,
    generation: number
  ): Promise<void> {
    await this.loadDefaultSourceBundle(scope, generation);
    if (!this.isCurrentBundleLoad(scope, generation)) {
      return;
    }

    const candidates = this.localizedBrowserCandidates();
    const stored = await this.bundleRepository.firstStoredBundle(scope, candidates);
    if (!this.isCurrentBundleLoad(scope, generation)) {
      return;
    }
    if (stored) {
      this.applyBundle(stored.lang, stored.version, stored.data);
    }

    const seed = this.usesHttpBundles()
      ? null
      : await this.firstLocalSeedBundle(
        candidates,
        stored?.lang ?? null,
        stored?.version ?? null
      );
    if (!this.isCurrentBundleLoad(scope, generation)) {
      return;
    }
    if (seed) {
      if (!this.usesHttpBundles()) {
        await this.bundleRepository.writeStoredBundle(scope, seed);
        if (!this.isCurrentBundleLoad(scope, generation)) {
          return;
        }
      }
      this.applyBundle(seed.lang, seed.version, seed.data);
    }
    await this.refreshFromServer(scope, generation, candidates);
  }

  private async loadDefaultSourceBundle(
    scope: I18nBundleScope,
    generation: number
  ): Promise<void> {
    const lang = I18nService.DEFAULT_LANGUAGE;
    const assetUrl = I18nService.LOCAL_SEED_ASSETS[lang];
    const seed = !this.usesHttpBundles() && assetUrl
      ? await this.loadLocalSeedBundle(assetUrl, true)
      : null;
    if (!this.isCurrentBundleLoad(scope, generation)) {
      return;
    }
    if (seed && seed.lang === lang && Object.keys(seed.data).length > 0) {
      this.applySourceBundle(seed.data);
    }

    const stored = await this.bundleRepository.readStoredBundle(scope, lang);
    if (!this.isCurrentBundleLoad(scope, generation)) {
      return;
    }
    const storedCanOverrideSeed = stored
      && Object.keys(stored.data).length > 0
      && (!seed || this.compareVersions(stored.version, seed.version) >= 0);
    if (storedCanOverrideSeed) {
      this.applySourceBundle(stored.data, true);
      return;
    }
    if (!this.usesHttpBundles() && seed) {
      await this.bundleRepository.writeStoredBundle(scope, seed);
    }
  }

  private async refreshFromServer(
    scope: I18nBundleScope,
    generation: number,
    candidates: readonly string[]
  ): Promise<void> {
    if (!this.usesHttpBundles()) {
      return;
    }
    const activeLang = this.currentLanguageSignal();
    const preferredLang = activeLang === I18nService.DEFAULT_LANGUAGE
      ? candidates[0] ?? null
      : activeLang;
    const requests = [
      this.refreshLanguageFromServer(
        scope,
        generation,
        I18nService.DEFAULT_LANGUAGE,
        false
      )
    ];
    if (preferredLang && preferredLang !== I18nService.DEFAULT_LANGUAGE) {
      requests.push(
        this.refreshLanguageFromServer(
          scope,
          generation,
          preferredLang,
          true
        )
      );
    }
    await Promise.all(requests);
  }

  private async refreshLanguageFromServer(
    scope: I18nBundleScope,
    generation: number,
    requestedLang: string,
    activateTranslation: boolean
  ): Promise<void> {
    const stored = await this.bundleRepository.readStoredBundle(scope, requestedLang);
    if (!this.isCurrentBundleLoad(scope, generation)) {
      return;
    }
    let params = new HttpParams().set('lang', requestedLang);
    if (stored?.version) {
      params = params.set('version', stored.version);
    }

    try {
      const response = await firstValueFrom(this.http.get<I18nRemoteBundleResponse>(
        `${environment.apiBaseUrl ?? '/api'}/i18n/bundle`,
        {
          headers: I18nService.REVALIDATE_HEADERS.set(
            'Accept-Language',
            this.acceptLanguageHeader()
          ),
          params
        }
      ));
      if (!this.isCurrentBundleLoad(scope, generation)) {
        return;
      }
      const lang = this.normalizeLanguage(response?.lang ?? requestedLang);
      if (!lang) {
        return;
      }
      const version = `${response?.version ?? stored?.version ?? ''}`.trim();
      const data = this.normalizeMessages(response?.data ?? null);
      if (stored?.lang === lang
        && stored.version
        && version
        && this.compareVersions(version, stored.version) < 0) {
        return;
      }
      if (data && Object.keys(data).length > 0) {
        const bundle = { lang, version: version || '0', data, storedAt: Date.now() };
        await this.bundleRepository.writeStoredBundle(scope, bundle);
        if (!this.isCurrentBundleLoad(scope, generation)) {
          return;
        }
        this.applyServerBundle(bundle, activateTranslation);
        return;
      }
      if (stored && stored.lang === lang && version && version === stored.version) {
        this.applyServerBundle(stored, activateTranslation);
      }
    } catch {
      // A previously cached backend bundle remains available. Local assets are
      // intentionally not a fallback when the backend is authoritative.
    }
  }

  private applyServerBundle(
    bundle: StoredI18nBundle,
    activateTranslation: boolean
  ): void {
    if (bundle.lang === I18nService.DEFAULT_LANGUAGE) {
      if (activateTranslation) {
        this.currentLanguageSignal.set(I18nService.DEFAULT_LANGUAGE);
        this.messagesSignal.set({});
        this.updateDocumentLanguage(I18nService.DEFAULT_LANGUAGE);
      }
      this.applySourceBundle(bundle.data, true);
      return;
    }
    if (activateTranslation) {
      this.applyBundle(bundle.lang, bundle.version, bundle.data);
    }
  }

  private usesHttpBundles(): boolean {
    return environment.activitiesDataSource === 'http';
  }

  private resolveBundleScope(): I18nBundleScope {
    if (!this.usesHttpBundles()) {
      return 'demo';
    }
    return this.sessionService.currentSession()?.kind === 'demo'
      ? 'demo'
      : 'real';
  }

  private isCurrentBundleLoad(
    scope: I18nBundleScope,
    generation: number
  ): boolean {
    return scope === this.activeBundleScope
      && generation === this.bundleLoadGeneration;
  }

  private async firstLocalSeedBundle(
    candidates: readonly string[],
    storedLang: string | null,
    storedVersion: string | null
  ): Promise<StoredI18nBundle | null> {
    for (const lang of candidates) {
      const assetUrl = I18nService.LOCAL_SEED_ASSETS[lang];
      if (!assetUrl) {
        continue;
      }
      const seed = await this.loadLocalSeedBundle(assetUrl);
      if (!seed || seed.lang !== lang || Object.keys(seed.data).length === 0) {
        continue;
      }
      if (storedLang === seed.lang
        && storedVersion
        && this.compareVersions(seed.version, storedVersion) <= 0) {
        return null;
      }
      return seed;
    }
    return null;
  }

  private async loadLocalSeedBundle(
    assetUrl: string | undefined,
    allowDefaultLanguage = false
  ): Promise<StoredI18nBundle | null> {
    if (!assetUrl) {
      return null;
    }
    try {
      const response = await firstValueFrom(this.http.get<I18nAssetBundle>(assetUrl, {
        headers: I18nService.REVALIDATE_HEADERS
      }));
      const lang = this.normalizeLanguage(response?.lang ?? '');
      const data = this.normalizeMessages(response?.messages ?? null);
      const version = `${response?.version ?? ''}`.trim();
      if (!lang || (!allowDefaultLanguage && lang === I18nService.DEFAULT_LANGUAGE) || !version || !data) {
        return null;
      }
      return {
        lang,
        version,
        data,
        storedAt: Date.now()
      };
    } catch {
      return null;
    }
  }

  private applyBundle(lang: string, version: string, data: Record<string, string>): void {
    const normalizedLang = this.normalizeLanguage(lang);
    if (!normalizedLang || normalizedLang === I18nService.DEFAULT_LANGUAGE) {
      if (normalizedLang === I18nService.DEFAULT_LANGUAGE && Object.keys(data).length > 0) {
        this.applySourceBundle(data, true);
      }
      this.currentLanguageSignal.set(I18nService.DEFAULT_LANGUAGE);
      this.messagesSignal.set({});
      this.updateDocumentLanguage(I18nService.DEFAULT_LANGUAGE);
      this.bumpRevision();
      this.scheduleDomScan();
      return;
    }
    this.currentLanguageSignal.set(normalizedLang);
    this.messagesSignal.set(data);
    this.updateDocumentLanguage(normalizedLang);
    this.bumpRevision();
    this.scheduleDomScan();
    void version;
  }

  private applySourceBundle(
    data: Record<string, string>,
    preserveTextAliases = false
  ): void {
    this.sourceMessagesSignal.set(data);
    const nextIndex = this.buildSourceKeyIndex(data);
    this.sourceKeyByTextSignal.set(preserveTextAliases
      ? { ...this.sourceKeyByTextSignal(), ...nextIndex }
      : nextIndex);
    this.bumpRevision();
    this.scheduleDomScan();
  }

  private buildSourceKeyIndex(data: Record<string, string>): Record<string, string> {
    const index: Record<string, string> = {};
    Object.entries(data).forEach(([key, source]) => {
      const normalizedKey = this.normalizeSourceKey(key);
      const normalizedSource = this.normalizeSourceKey(source);
      if (!normalizedKey || !normalizedSource) {
        return;
      }
      for (const candidate of this.sourceLookupCandidates(normalizedSource)) {
        if (candidate && !index[candidate]) {
          index[candidate] = normalizedKey;
        }
      }
    });
    return index;
  }

  private updateDocumentLanguage(lang: string): void {
    const documentElement = this.document?.documentElement;
    if (documentElement) {
      documentElement.lang = lang;
    }
  }

  private bumpRevision(): void {
    this.revisionSignal.update(value => value + 1);
  }

  private localizedBrowserCandidates(): string[] {
    const rawLanguages = this.browserLanguages();
    const candidates: string[] = [];
    for (const raw of rawLanguages) {
      const lang = this.normalizeLanguage(raw);
      if (!lang || lang === I18nService.DEFAULT_LANGUAGE || candidates.includes(lang)) {
        continue;
      }
      candidates.push(lang);
    }
    return candidates;
  }

  private browserLanguages(): string[] {
    if (typeof navigator === 'undefined') {
      return [];
    }
    const languages = Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
    return languages
      .map(value => `${value ?? ''}`.trim())
      .filter(value => value.length > 0);
  }

  private acceptLanguageHeader(): string {
    const browserLanguages = this.browserLanguages();
    return browserLanguages.length > 0 ? browserLanguages.join(',') : I18nService.DEFAULT_LANGUAGE;
  }

  private normalizeLanguage(value: string): string {
    return `${value ?? ''}`
      .trim()
      .toLowerCase()
      .split(',')[0]
      .split(';')[0]
      .split('-')[0]
      .replace(/[^a-z]/g, '');
  }

  private normalizeMessages(value: Record<string, string> | null): Record<string, string> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const normalized: Record<string, string> = {};
    Object.entries(value).forEach(([key, translation]) => {
      const normalizedKey = this.normalizeSourceKey(key);
      const normalizedTranslation = `${translation ?? ''}`.trim();
      if (normalizedKey && normalizedTranslation) {
        normalized[normalizedKey] = normalizedTranslation;
      }
    });
    return normalized;
  }

  private compareVersions(left: string, right: string): number {
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
  }

  private installDomObserver(): void {
    const body = this.document?.body;
    const view = this.document?.defaultView;
    if (!body || !view?.MutationObserver) {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.domObserver = new view.MutationObserver(() => {
        if (!this.translatingDom) {
          this.scheduleDomScan();
        }
      });
      this.domObserver.observe(body, {
        attributes: true,
        attributeFilter: [...I18nService.TRANSLATABLE_ATTRIBUTES],
        characterData: true,
        childList: true,
        subtree: true
      });
      this.scheduleDomScan();
    });
  }

  private scheduleDomScan(): void {
    const view = this.document?.defaultView;
    if (this.scanQueued || !view) {
      return;
    }
    this.scanQueued = true;
    view.requestAnimationFrame(() => {
      this.scanQueued = false;
      this.scanDom();
    });
  }

  private scanDom(): void {
    const body = this.document?.body;
    const view = this.document?.defaultView;
    if (!body || !view) {
      return;
    }
    this.translatingDom = true;
    try {
      this.translateElementAttributes(body);
      body.querySelectorAll<HTMLElement>('*').forEach(element => this.translateElementAttributes(element));
      const showText = typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_TEXT : 4;
      const walker = this.document.createTreeWalker(body, showText);
      let current = walker.nextNode();
      while (current) {
        if (current.nodeType === 3) {
          this.translateTextNode(current as Text);
        }
        current = walker.nextNode();
      }
    } finally {
      this.translatingDom = false;
    }
  }

  private translateElementAttributes(element: Element): void {
    if (this.shouldSkipAttributeElement(element)) {
      return;
    }
    for (const attributeName of I18nService.TRANSLATABLE_ATTRIBUTES) {
      const current = element.getAttribute(attributeName);
      if (!current || !this.hasLetters(current)) {
        continue;
      }
      const source = this.resolveAttributeSource(element, attributeName, current);
      const translated = this.translateRaw(source);
      if (translated !== current) {
        element.setAttribute(attributeName, translated);
      }
    }
  }

  private translateTextNode(node: Text): void {
    const parent = node.parentElement;
    if (!parent || this.shouldSkipTextElement(parent)) {
      return;
    }
    const current = node.data;
    if (!this.hasLetters(current)) {
      return;
    }
    const source = this.resolveTextSource(node, current);
    const translated = this.translateRaw(source);
    if (translated !== current) {
      node.data = translated;
    }
  }

  private resolveTextSource(node: Text, current: string): string {
    const previousSource = this.textNodeSources.get(node);
    if (!previousSource) {
      this.textNodeSources.set(node, current);
      return current;
    }
    const previousTranslation = this.translateRaw(previousSource);
    if (current !== previousSource && current !== previousTranslation) {
      this.textNodeSources.set(node, current);
      return current;
    }
    return previousSource;
  }

  private resolveAttributeSource(element: Element, attributeName: string, current: string): string {
    let sources = this.attributeSources.get(element);
    if (!sources) {
      sources = new Map<string, string>();
      this.attributeSources.set(element, sources);
    }
    const previousSource = sources.get(attributeName);
    if (!previousSource) {
      sources.set(attributeName, current);
      return current;
    }
    const previousTranslation = this.translateRaw(previousSource);
    if (current !== previousSource && current !== previousTranslation) {
      sources.set(attributeName, current);
      return current;
    }
    return previousSource;
  }

  private translateRaw(source: string): string {
    const normalizedKey = this.normalizeSourceKey(source);
    if (!normalizedKey) {
      return source;
    }
    const messages = this.messagesSignal();
    const sourceMessages = this.sourceMessagesSignal();
    const sourceKeyByText = this.sourceKeyByTextSignal();
    const dynamicTranslated = this.translateDynamicSource(normalizedKey, messages, sourceKeyByText)
      ?? this.translateDynamicSource(normalizedKey, sourceMessages, sourceKeyByText);
    if (dynamicTranslated) {
      return this.replaceCoreText(source, dynamicTranslated);
    }
    const translated = this.resolveCoreTranslation(normalizedKey, messages, sourceKeyByText)
      ?? this.resolveCoreTranslation(normalizedKey, sourceMessages, sourceKeyByText);
    if (!translated) {
      return source;
    }
    return this.replaceCoreText(source, translated);
  }

  private translateDynamicSource(
    normalizedSource: string,
    messages: Record<string, string>,
    sourceKeyByText: Record<string, string>
  ): string | null {
    const adminJobDetailTranslation = this.translateAdminJobDetailSource(normalizedSource, messages);
    if (adminJobDetailTranslation) {
      return adminJobDetailTranslation;
    }

    const helpEditorTranslation = this.translateHelpEditorSource(normalizedSource, messages);
    if (helpEditorTranslation) {
      return helpEditorTranslation;
    }

    const composite = this.translateCompositeSource(normalizedSource, messages, sourceKeyByText);
    if (composite) {
      return composite;
    }

    const paramsUpdatedMatch = normalizedSource.match(/^Updated\s+(.+?)\s+parameters\.$/i);
    if (paramsUpdatedMatch) {
      const translated = messages['admin.params.summary.updated'];
      if (translated) {
        return this.interpolate(translated, {
          section: this.resolveCoreTranslation(paramsUpdatedMatch[1] ?? '', messages, sourceKeyByText)
            ?? paramsUpdatedMatch[1]
            ?? ''
        });
      }
    }

    const paramsRevertedMatch = normalizedSource.match(/^Reverted\s+(.+?)\s+parameters\s+to\s+version\s+(\d+)\.$/i);
    if (paramsRevertedMatch) {
      const translated = messages['admin.params.summary.reverted'];
      if (translated) {
        return this.interpolate(translated, {
          section: this.resolveCoreTranslation(paramsRevertedMatch[1] ?? '', messages, sourceKeyByText)
            ?? paramsRevertedMatch[1]
            ?? '',
          version: paramsRevertedMatch[2] ?? ''
        });
      }
    }

    const dateTranslation = this.translateEnglishDateSource(normalizedSource);
    if (dateTranslation) {
      return dateTranslation;
    }

    const feedbackItemsMatch = normalizedSource.match(/^(\d+)\/(\d+) feedback items? pending\.$/i);
    if (feedbackItemsMatch) {
      const translated = messages['feedback.items.pending.count'];
      return translated
        ? this.interpolate(translated, {
          pending: feedbackItemsMatch[1] ?? '0',
          total: feedbackItemsMatch[2] ?? '0'
        })
        : null;
    }

    const minimumCharactersMatch = normalizedSource.match(/^Minimum (\d+) characters \((\d+) left\)\.$/i);
    if (minimumCharactersMatch) {
      const translated = messages['minimum.characters.left.count'];
      return translated
        ? this.interpolate(translated, {
          min: minimumCharactersMatch[1] ?? '0',
          left: minimumCharactersMatch[2] ?? '0'
        })
        : null;
    }

    const savedContactsMatch = normalizedSource.match(/^(\d+) saved contacts?$/i);
    if (savedContactsMatch) {
      const translated = messages['saved.contacts.count'];
      return translated
        ? this.interpolate(translated, { count: savedContactsMatch[1] ?? '0' })
        : null;
    }

    const methodsMatch = normalizedSource.match(/^(\d+) methods?$/i);
    if (methodsMatch) {
      const translated = messages['methods.count'];
      return translated
        ? this.interpolate(translated, { count: methodsMatch[1] ?? '0' })
        : null;
    }

    const membersMatch = normalizedSource.match(/^(\d+) members?$/i);
    if (membersMatch) {
      const translated = messages['members.count'];
      return translated
        ? this.interpolate(translated, { count: membersMatch[1] ?? '0' })
        : null;
    }

    const noItemsMatch = normalizedSource.match(/^No (.+) items in this filter\.$/i);
    if (noItemsMatch) {
      const translated = messages['no.filtered.items'];
      const item = noItemsMatch[1] ?? '';
      const itemLabel = this.resolveCoreTranslation(item, messages, sourceKeyByText) ?? item;
      return translated
        ? this.interpolate(translated, { item: itemLabel })
        : null;
    }

    const singleRateMatch = normalizedSource.match(/^Single (given|received) · (.+)$/i);
    if (singleRateMatch) {
      const direction = this.resolveCoreTranslation(`Single ${singleRateMatch[1]}`, messages, sourceKeyByText)
        ?? `Single ${singleRateMatch[1]}`;
      return `${direction} · ${singleRateMatch[2] ?? ''}`.trim();
    }

    const reportedTargetMatch = normalizedSource.match(/^(.+?) reported (.+)$/i);
    if (reportedTargetMatch) {
      const translated = messages['reporter.reported.target'];
      return translated
        ? this.interpolate(translated, {
          reporter: reportedTargetMatch[1] ?? '',
          target: reportedTargetMatch[2] ?? ''
        })
        : null;
    }

    const signalsMatch = normalizedSource.match(/^(\d+) signals?$/i);
    if (signalsMatch) {
      const translated = messages['signals.count'];
      return translated
        ? this.interpolate(translated, { count: signalsMatch[1] ?? '0' })
        : null;
    }

    const percentLabelMatch = normalizedSource.match(/^(.+?)\s+(\d+)%$/);
    if (percentLabelMatch) {
      const label = percentLabelMatch[1] ?? '';
      const translatedLabel = this.resolveCoreTranslation(label, messages, sourceKeyByText);
      return translatedLabel ? `${translatedLabel} ${percentLabelMatch[2] ?? '0'}%` : null;
    }

    return null;
  }

  private translateAdminJobDetailSource(
    normalizedSource: string,
    messages: Record<string, string>
  ): string | null {
    const translate = (key: string, values: Record<string, string> = {}): string | null => {
      const template = messages[key];
      return template ? this.interpolate(template, values) : null;
    };
    const exactKeys: Record<string, string> = {
      'Rule was not found.': 'admin.jobs.run.detail.rule.not.found',
      'Manual start requested.': 'admin.jobs.run.detail.manual.requested',
      'Manual matched room assignment started.': 'admin.jobs.run.detail.matched.started',
      'This rule is action driven and has no manual worker.': 'admin.jobs.run.detail.action.no.manual.worker',
      'Loading published events for matched rooms.': 'admin.jobs.run.detail.loading.published',
      'Scheduled process is running.': 'admin.jobs.run.detail.scheduled.running',
      'Starting scheduled process.': 'admin.jobs.run.detail.scheduled.starting',
      'Scheduled random grouping started.': 'admin.jobs.run.detail.scheduled.random.started',
      'Loaded eligible random events.': 'admin.jobs.run.detail.loaded.eligible',
      'Generated random event group plans.': 'admin.jobs.run.detail.generated.scheduled',
      'Scanning expired event counters.': 'admin.jobs.run.detail.counter.scanning',
      'No expired event counters or ticket records were due.': 'admin.jobs.run.detail.counter.none.due',
      'Scanning expired checkout basket drafts.': 'admin.jobs.run.detail.checkout.scanning',
      'No expired checkout basket items were due.': 'admin.jobs.run.detail.checkout.none.due'
    };
    const exactKey = exactKeys[normalizedSource];
    if (exactKey) {
      return translate(exactKey);
    }

    const runningForMatch = normalizedSource.match(/^(.+)\s+Running for\s+(\d+)s\.$/i);
    if (runningForMatch) {
      const detail = runningForMatch[1] ?? '';
      return translate('admin.jobs.run.detail.running.for', {
        detail: this.translateAdminJobDetailSource(detail, messages) ?? detail,
        seconds: runningForMatch[2] ?? '0'
      });
    }

    const loadedRecordsMatch = normalizedSource.match(/^Loaded\s+(\d+)\s+event record\(s\)\.$/i);
    if (loadedRecordsMatch) {
      return translate('admin.jobs.run.detail.loaded.records', { events: loadedRecordsMatch[1] ?? '0' });
    }

    const queriedEmptyMatch = normalizedSource.match(
      /^Queried\s+(\d+)\s+backend lookup\(s\); event has no eligible accepted members\.$/i
    );
    if (queriedEmptyMatch) {
      return translate('admin.jobs.run.detail.queried.no.eligible', { queries: queriedEmptyMatch[1] ?? '0' });
    }

    const queriedCandidatesMatch = normalizedSource.match(
      /^Queried\s+(\d+)\s+backend lookup\(s\); found\s+(\d+)\s+candidate user\(s\)\.$/i
    );
    if (queriedCandidatesMatch) {
      return translate('admin.jobs.run.detail.queried.candidates', {
        queries: queriedCandidatesMatch[1] ?? '0',
        users: queriedCandidatesMatch[2] ?? '0'
      });
    }

    const noGraphMatch = normalizedSource.match(
      /^No candidate user graph was available after\s+(\d+)\s+backend lookup\(s\)\.$/i
    );
    if (noGraphMatch) {
      return translate('admin.jobs.run.detail.no.candidate.graph', { queries: noGraphMatch[1] ?? '0' });
    }

    const builtGraphMatch = normalizedSource.match(
      /^Built candidate user graph after\s+(\d+)\s+backend lookup\(s\)\.$/i
    );
    if (builtGraphMatch) {
      return translate('admin.jobs.run.detail.built.candidate.graph', { queries: builtGraphMatch[1] ?? '0' });
    }

    const startingAssignmentMatch = normalizedSource.match(
      /^Starting random assignment for\s+(\d+)\s+sub-event\(s\)\.$/i
    );
    if (startingAssignmentMatch) {
      return translate('admin.jobs.run.detail.starting.assignment', {
        subEvents: startingAssignmentMatch[1] ?? '0'
      });
    }

    const processingSubEventMatch = normalizedSource.match(/^Processing sub-event\s+(\d+)\/(\d+)\.$/i);
    if (processingSubEventMatch) {
      return translate('admin.jobs.run.detail.processing.sub.event', {
        current: processingSubEventMatch[1] ?? '0',
        total: processingSubEventMatch[2] ?? '0'
      });
    }

    const skippedSubEventMatch = normalizedSource.match(
      /^Skipped sub-event\s+(\d+)\/(\d+); no target groups\.$/i
    );
    if (skippedSubEventMatch) {
      return translate('admin.jobs.run.detail.skipped.sub.event', {
        current: skippedSubEventMatch[1] ?? '0',
        total: skippedSubEventMatch[2] ?? '0'
      });
    }

    const processedSubEventMatch = normalizedSource.match(
      /^Processed sub-event\s+(\d+)\/(\d+),\s+(\d+)\s+candidate user\(s\),\s+(\d+)\s+backend lookup\(s\)\.$/i
    );
    if (processedSubEventMatch) {
      return translate('admin.jobs.run.detail.processed.sub.event', {
        current: processedSubEventMatch[1] ?? '0',
        total: processedSubEventMatch[2] ?? '0',
        users: processedSubEventMatch[3] ?? '0',
        queries: processedSubEventMatch[4] ?? '0'
      });
    }

    const processedEventsMatch = normalizedSource.match(
      /^Processed\s+(\d+)\/(\d+)\s+random event\(s\),\s+(\d+)\s+candidate user\(s\),\s+(\d+)\s+backend lookup\(s\)\.$/i
    );
    if (processedEventsMatch) {
      return translate('admin.jobs.run.detail.processed.events', {
        current: processedEventsMatch[1] ?? '0',
        total: processedEventsMatch[2] ?? '0',
        users: processedEventsMatch[3] ?? '0',
        queries: processedEventsMatch[4] ?? '0'
      });
    }

    const finalizingMatch = normalizedSource.match(
      /^Finalizing random event groups after\s+(\d+)\s+backend lookup\(s\)\.$/i
    );
    if (finalizingMatch) {
      return translate('admin.jobs.run.detail.finalizing', { queries: finalizingMatch[1] ?? '0' });
    }

    const generatedMatch = normalizedSource.match(
      /^Generated\s+(\d+)\s+random group plan\(s\) for\s+(\d+)\s+user\(s\)\.$/i
    );
    if (generatedMatch) {
      return translate('admin.jobs.run.detail.generated', {
        plans: generatedMatch[1] ?? '0',
        users: generatedMatch[2] ?? '0'
      });
    }

    const expiredCountersMatch = normalizedSource.match(
      /^Expired\s+(\d+)\s+event source\(s\), refreshed\s+(\d+)\/(\d+)\s+affected user counter document\(s\), marked\s+(\d+)\s+event record\(s\), and marked\s+(\d+)\s+ticket record\(s\)\.$/i
    );
    if (expiredCountersMatch) {
      return translate('admin.jobs.run.detail.counter.expired', {
        sources: expiredCountersMatch[1] ?? '0',
        updatedUsers: expiredCountersMatch[2] ?? '0',
        affectedUsers: expiredCountersMatch[3] ?? '0',
        eventRecords: expiredCountersMatch[4] ?? '0',
        ticketRecords: expiredCountersMatch[5] ?? '0'
      });
    }

    const checkoutMarkedMatch = normalizedSource.match(
      /^Marked\s+(\d+)\s+expired checkout basket item\(s\) as deleted\.$/i
    );
    if (checkoutMarkedMatch) {
      return translate('admin.jobs.run.detail.checkout.marked', { count: checkoutMarkedMatch[1] ?? '0' });
    }

    return null;
  }

  private translateHelpEditorSource(
    normalizedSource: string,
    messages: Record<string, string>
  ): string | null {
    const sectionsWithDateMatch = normalizedSource.match(/^(\d+) sections? · (.+)$/i);
    if (sectionsWithDateMatch) {
      const countText = this.translateCount(messages, 'sections.count', sectionsWithDateMatch[1] ?? '0');
      return countText ? `${countText} · ${sectionsWithDateMatch[2] ?? ''}` : null;
    }

    const sectionsMatch = normalizedSource.match(/^(\d+) sections?$/i);
    if (sectionsMatch) {
      return this.translateCount(messages, 'sections.count', sectionsMatch[1] ?? '0');
    }

    const activeMatch = normalizedSource.match(/^Active (help|privacy|terms|explanation) v(\d+)$/i);
    if (activeMatch) {
      return this.interpolateDocumentMessage(messages, `active.${this.documentKey(activeMatch[1])}.version`, {
        version: activeMatch[2] ?? '0'
      });
    }

    const noActiveMatch = normalizedSource.match(/^No active (help|privacy|terms|explanation) revision$/i);
    if (noActiveMatch) {
      return this.documentMessage(messages, `no.active.${this.documentKey(noActiveMatch[1])}.revision`);
    }

    const loadingMatch = normalizedSource.match(/^Loading (help|privacy|terms|explanation) revisions$/i);
    if (loadingMatch) {
      return this.documentMessage(messages, `loading.${this.documentKey(loadingMatch[1])}.revisions`);
    }

    const noRevisionsMatch = normalizedSource.match(/^No (help|privacy|terms|explanation) revisions$/i);
    if (noRevisionsMatch) {
      return this.documentMessage(messages, `no.${this.documentKey(noRevisionsMatch[1])}.revisions`);
    }

    const enablePopupMatch = normalizedSource.match(/^Create a revision to enable the (help|privacy|terms|explanation) popup\.$/i);
    if (enablePopupMatch) {
      return this.documentMessage(messages, `create.revision.to.enable.${this.documentKey(enablePopupMatch[1])}.popup`);
    }

    const revisionsLabelMatch = normalizedSource.match(/^(Help|Privacy|Terms|Explanation) revisions$/i);
    if (revisionsLabelMatch) {
      return this.documentMessage(messages, `${this.documentKey(revisionsLabelMatch[1])}.revisions`);
    }

    const popupHeaderMatch = normalizedSource.match(/^(Help|Privacy|Terms|Explanation) popup header$/i);
    if (popupHeaderMatch) {
      return this.documentMessage(messages, `${this.documentKey(popupHeaderMatch[1])}.popup.header`);
    }

    const descriptionMatch = normalizedSource.match(/^(Help|Privacy|Terms|Explanation) description$/i);
    if (descriptionMatch) {
      return this.documentMessage(messages, `${this.documentKey(descriptionMatch[1])}.description`);
    }

    const sectionTitleMatch = normalizedSource.match(/^(Help|Privacy|Terms|Explanation) section title$/i);
    if (sectionTitleMatch) {
      return this.documentMessage(messages, `${this.documentKey(sectionTitleMatch[1])}.section.title`);
    }

    const sectionActionMatch = normalizedSource.match(/^(Add|Remove|Toggle) (help|privacy|terms|explanation) section$/i);
    if (sectionActionMatch) {
      return this.documentMessage(
        messages,
        `${sectionActionMatch[1]?.toLocaleLowerCase('en-US')}.${this.documentKey(sectionActionMatch[2])}.section`
      );
    }

    const unableMatch = normalizedSource.match(/^Unable to (load|save|activate|delete) (help|privacy|terms|explanation) revision(s)?\.$/i);
    if (unableMatch) {
      return this.documentMessage(
        messages,
        `unable.to.${unableMatch[1]?.toLocaleLowerCase('en-US')}.${this.documentKey(unableMatch[2])}.revisions`
      );
    }

    return null;
  }

  private documentKey(value: string | undefined): 'help' | 'privacy' | 'terms' | 'explanation' {
    const normalized = `${value ?? ''}`.trim().toLocaleLowerCase('en-US');
    if (normalized === 'privacy' || normalized === 'terms' || normalized === 'explanation') {
      return normalized;
    }
    return 'help';
  }

  private documentMessage(messages: Record<string, string>, key: string): string | null {
    return messages[key] ?? null;
  }

  private interpolateDocumentMessage(
    messages: Record<string, string>,
    key: string,
    values: Record<string, string>
  ): string | null {
    const template = this.documentMessage(messages, key);
    return template ? this.interpolate(template, values) : null;
  }

  private translateCount(messages: Record<string, string>, key: string, count: string): string | null {
    const template = messages[key];
    return template ? this.interpolate(template, { count }) : null;
  }

  private translateEnglishDateSource(normalizedSource: string): string | null {
    if (this.currentLanguageSignal() === I18nService.DEFAULT_LANGUAGE) {
      return null;
    }
    const weekdayDateMatch = normalizedSource.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/i);
    if (weekdayDateMatch) {
      const date = this.englishDate(weekdayDateMatch[4], weekdayDateMatch[2], weekdayDateMatch[3]);
      return date
        ? this.formatDate(date, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
        : null;
    }
    const monthDateMatch = normalizedSource.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/i);
    if (monthDateMatch) {
      const date = this.englishDate(monthDateMatch[3], monthDateMatch[1], monthDateMatch[2]);
      return date
        ? this.formatDate(date, { year: 'numeric', month: 'short', day: 'numeric' })
        : null;
    }
    const dayMonthDateMatch = normalizedSource.match(/^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/i);
    if (dayMonthDateMatch) {
      const date = this.englishDate(dayMonthDateMatch[3], dayMonthDateMatch[2], dayMonthDateMatch[1]);
      return date
        ? this.formatDate(date, { year: 'numeric', month: 'short', day: 'numeric' })
        : null;
    }
    return null;
  }

  private englishDate(yearValue: string | undefined, monthValue: string | undefined, dayValue: string | undefined): Date | null {
    const year = Number(yearValue);
    const monthIndex = this.englishMonthIndex(monthValue ?? '');
    const day = Number(dayValue);
    if (!Number.isInteger(year) || !Number.isInteger(day) || monthIndex < 0 || day < 1 || day > 31) {
      return null;
    }
    return new Date(Date.UTC(year, monthIndex, day, 12));
  }

  private englishMonthIndex(value: string): number {
    return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      .indexOf(value.trim().slice(0, 3).toLocaleLowerCase('en-US'));
  }

  private formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
    try {
      return new Intl.DateTimeFormat(this.currentIntlLocale(), {
        ...options,
        timeZone: 'UTC'
      }).format(date);
    } catch {
      return '';
    }
  }

  private currentIntlLocale(): string {
    return this.currentLanguageSignal() === 'hu' ? 'hu-HU' : I18nService.DEFAULT_LANGUAGE;
  }

  private translateCompositeSource(
    normalizedSource: string,
    messages: Record<string, string>,
    sourceKeyByText: Record<string, string>
  ): string | null {
    if (normalizedSource.includes(' · ')) {
      const parts = normalizedSource.split(' · ');
      const translatedParts = parts.map(part => this.resolveCoreTranslation(part, messages, sourceKeyByText) ?? part);
      return translatedParts.some((part, index) => part !== parts[index])
        ? translatedParts.join(' · ')
        : null;
    }
    if (normalizedSource.includes(', ')) {
      const parts = normalizedSource.split(', ');
      const translatedParts = parts.map(part => this.resolveCoreTranslation(part, messages, sourceKeyByText) ?? part);
      return translatedParts.some((part, index) => part !== parts[index])
        ? translatedParts.join(', ')
        : null;
    }
    return null;
  }

  private resolveCoreTranslation(
    normalizedSource: string,
    messages: Record<string, string>,
    sourceKeyByText: Record<string, string>
  ): string | null {
    for (const candidate of this.sourceLookupCandidates(normalizedSource)) {
      const sourceBundleKey = sourceKeyByText[candidate];
      const translated = messages[candidate] ?? (sourceBundleKey ? messages[sourceBundleKey] : null);
      if (translated) {
        return translated;
      }
    }
    return null;
  }

  private sourceLookupCandidates(value: string): string[] {
    const normalized = this.normalizeSourceKey(value);
    const lower = normalized.toLocaleLowerCase('en-US');
    const upper = normalized.toLocaleUpperCase('en-US');
    return [normalized, lower, upper]
      .filter((candidate, index, values) => candidate && values.indexOf(candidate) === index);
  }

  private interpolate(template: string, values: Record<string, string>): string {
    return template.replace(
      /\{\{([a-zA-Z0-9_.-]+)\}\}|\{([a-zA-Z0-9_.-]+)\}/g,
      (match, doubleBraceKey: string | undefined, singleBraceKey: string | undefined) => {
        const key = doubleBraceKey ?? singleBraceKey ?? '';
        return values[key] ?? match;
      }
    );
  }

  private normalizeSourceKey(value: string): string {
    return `${value ?? ''}`.trim().replace(/\s+/g, ' ');
  }

  private replaceCoreText(source: string, translatedCore: string): string {
    const leading = source.match(/^\s*/)?.[0] ?? '';
    const trailing = source.match(/\s*$/)?.[0] ?? '';
    return `${leading}${translatedCore}${trailing}`;
  }

  private hasLetters(value: string): boolean {
    return Array.from(value).some(char => char.toLocaleLowerCase('en-US') !== char.toLocaleUpperCase('en-US'));
  }

  private shouldSkipAttributeElement(element: Element): boolean {
    return Boolean(element.closest(I18nService.SKIP_ATTRIBUTE_SELECTOR));
  }

  private shouldSkipTextElement(element: Element): boolean {
    return Boolean(element.closest(I18nService.SKIP_TEXT_SELECTOR));
  }
}
