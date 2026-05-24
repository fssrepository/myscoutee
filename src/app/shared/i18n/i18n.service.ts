import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';

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

interface StoredI18nBundle {
  lang: string;
  version: string;
  data: Record<string, string>;
  storedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private static readonly DEFAULT_LANGUAGE = 'en';
  private static readonly STORAGE_PREFIX = 'myscoutee.i18n.bundle.v1';
  private static readonly INDEXED_DB_NAME = 'myscoutee-i18n-db';
  private static readonly INDEXED_DB_VERSION = 1;
  private static readonly INDEXED_DB_STORE = 'bundles';
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
    '.navigator-contact-title-wrap h3',
    '.profile-name-line'
  ].join(',');

  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly currentLanguageSignal = signal(I18nService.DEFAULT_LANGUAGE);
  private readonly messagesSignal = signal<Record<string, string>>({});
  private readonly sourceMessagesSignal = signal<Record<string, string>>({});
  private readonly sourceKeyByTextSignal = signal<Record<string, string>>({});
  private readonly revisionSignal = signal(0);
  private readonly textNodeSources = new WeakMap<Text, string>();
  private readonly attributeSources = new WeakMap<Element, Map<string, string>>();
  private domObserver: MutationObserver | null = null;
  private indexedDbOpenPromise: Promise<IDBDatabase | null> | null = null;
  private initialized = false;
  private scanQueued = false;
  private translatingDom = false;

  readonly currentLanguage = this.currentLanguageSignal.asReadonly();
  readonly isDefaultLanguage = computed(() => this.currentLanguageSignal() === I18nService.DEFAULT_LANGUAGE);
  readonly revision = this.revisionSignal.asReadonly();

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.installDomObserver();
    void this.loadPreferredLanguage();
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

  private async loadPreferredLanguage(): Promise<void> {
    await this.loadDefaultSourceBundle();

    const candidates = this.localizedBrowserCandidates();
    const localStorageMirror = this.firstLocalStorageBundle(candidates);
    if (localStorageMirror) {
      this.applyBundle(localStorageMirror.lang, localStorageMirror.version, localStorageMirror.data);
    }

    const indexedDbStored = await this.firstIndexedDbBundle(candidates);
    if (indexedDbStored) {
      this.writeLocalStorageBundle(indexedDbStored);
      this.applyBundle(indexedDbStored.lang, indexedDbStored.version, indexedDbStored.data);
    }

    const activeStored = indexedDbStored ?? localStorageMirror;
    const seed = await this.firstLocalSeedBundle(
      candidates,
      activeStored?.lang ?? null,
      activeStored?.version ?? null
    );
    if (seed) {
      await this.writeIndexedDbBundle(seed);
      this.writeLocalStorageBundle(seed);
      this.applyBundle(seed.lang, seed.version, seed.data);
    }

    await this.refreshFromServer(candidates);
  }

  private async loadDefaultSourceBundle(): Promise<void> {
    const lang = I18nService.DEFAULT_LANGUAGE;
    const localStorageMirror = this.readLocalStorageBundle(lang);
    if (localStorageMirror && Object.keys(localStorageMirror.data).length > 0) {
      this.applySourceBundle(localStorageMirror.data);
    }

    const indexedDbStored = await this.readIndexedDbBundle(lang);
    if (indexedDbStored && Object.keys(indexedDbStored.data).length > 0) {
      this.writeLocalStorageBundle(indexedDbStored);
      this.applySourceBundle(indexedDbStored.data);
    }

    const activeStored = indexedDbStored ?? localStorageMirror;
    const assetUrl = I18nService.LOCAL_SEED_ASSETS[lang];
    if (!assetUrl) {
      return;
    }
    const seed = await this.loadLocalSeedBundle(assetUrl, true);
    if (!seed || seed.lang !== lang || Object.keys(seed.data).length === 0) {
      return;
    }
    if (activeStored?.version
      && Object.keys(activeStored.data).length > 0
      && this.compareVersions(seed.version, activeStored.version) <= 0) {
      return;
    }
    await this.writeIndexedDbBundle(seed);
    this.writeLocalStorageBundle(seed);
    this.applySourceBundle(seed.data);
  }

  private async refreshFromServer(candidates: readonly string[]): Promise<void> {
    if (environment.remoteI18nEnabled === false) {
      return;
    }
    if (candidates.length === 0) {
      return;
    }
    const activeLang = this.currentLanguageSignal();
    const explicitLang = activeLang === I18nService.DEFAULT_LANGUAGE ? candidates[0] : activeLang;
    const stored = await this.readStoredBundle(explicitLang);
    let params = new HttpParams().set('lang', explicitLang);
    if (stored?.version) {
      params = params.set('version', stored.version);
    }

    try {
      const response = await firstValueFrom(this.http.get<I18nRemoteBundleResponse>(
        `${environment.apiBaseUrl ?? '/api'}/i18n/bundle`,
        {
          headers: new HttpHeaders({ 'Accept-Language': this.acceptLanguageHeader() }),
          params
        }
      ));
      const lang = this.normalizeLanguage(response?.lang ?? explicitLang);
      if (!lang || lang === I18nService.DEFAULT_LANGUAGE) {
        return;
      }
      const version = `${response?.version ?? stored?.version ?? ''}`.trim();
      const data = this.normalizeMessages(response?.data ?? null);
      if (stored?.version && version && this.compareVersions(version, stored.version) < 0) {
        return;
      }
      if (data && Object.keys(data).length > 0) {
        const bundle = { lang, version: version || '0', data, storedAt: Date.now() };
        await this.writeIndexedDbBundle(bundle);
        this.writeLocalStorageBundle(bundle);
        this.applyBundle(bundle.lang, bundle.version, bundle.data);
        return;
      }
      if (stored && stored.lang === lang && version && version === stored.version) {
        this.applyBundle(stored.lang, stored.version, stored.data);
      }
    } catch {
      // The static English UI and any stored/local seed bundle remain available.
    }
  }

  private firstLocalStorageBundle(candidates: readonly string[]): StoredI18nBundle | null {
    for (const lang of candidates) {
      const stored = this.readLocalStorageBundle(lang);
      if (stored && Object.keys(stored.data).length > 0) {
        return stored;
      }
    }
    return null;
  }

  private async firstIndexedDbBundle(candidates: readonly string[]): Promise<StoredI18nBundle | null> {
    for (const lang of candidates) {
      const stored = await this.readIndexedDbBundle(lang);
      if (stored && Object.keys(stored.data).length > 0) {
        return stored;
      }
    }
    return null;
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
      if (storedLang === seed.lang && storedVersion === seed.version) {
        return null;
      }
      return seed;
    }
    return null;
  }

  private async loadLocalSeedBundle(assetUrl: string, allowDefaultLanguage = false): Promise<StoredI18nBundle | null> {
    try {
      const response = await firstValueFrom(this.http.get<I18nAssetBundle>(assetUrl));
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
      this.currentLanguageSignal.set(I18nService.DEFAULT_LANGUAGE);
      this.messagesSignal.set({});
      this.updateDocumentLanguage(I18nService.DEFAULT_LANGUAGE);
      this.bumpRevision();
      return;
    }
    this.currentLanguageSignal.set(normalizedLang);
    this.messagesSignal.set(data);
    this.updateDocumentLanguage(normalizedLang);
    this.bumpRevision();
    this.scheduleDomScan();
    void version;
  }

  private applySourceBundle(data: Record<string, string>): void {
    this.sourceMessagesSignal.set(data);
    this.sourceKeyByTextSignal.set(this.buildSourceKeyIndex(data));
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

  private async readStoredBundle(lang: string): Promise<StoredI18nBundle | null> {
    return await this.readIndexedDbBundle(lang) ?? this.readLocalStorageBundle(lang);
  }

  private readLocalStorageBundle(lang: string): StoredI18nBundle | null {
    if (!this.canUseLocalStorage()) {
      return null;
    }
    try {
      const raw = localStorage.getItem(this.storageKey(lang));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<StoredI18nBundle> | null;
      const normalizedLang = this.normalizeLanguage(parsed?.lang ?? lang);
      const data = this.normalizeMessages(parsed?.data ?? null);
      const version = `${parsed?.version ?? ''}`.trim();
      if (!normalizedLang || !version || !data) {
        return null;
      }
      return {
        lang: normalizedLang,
        version,
        data,
        storedAt: Number.isFinite(parsed?.storedAt) ? Number(parsed?.storedAt) : 0
      };
    } catch {
      return null;
    }
  }

  private writeLocalStorageBundle(bundle: StoredI18nBundle): void {
    if (!this.canUseLocalStorage()) {
      return;
    }
    try {
      localStorage.setItem(this.storageKey(bundle.lang), JSON.stringify(bundle));
    } catch {
      // Private-mode/quota failures should never block rendering.
    }
  }

  private async readIndexedDbBundle(lang: string): Promise<StoredI18nBundle | null> {
    const db = await this.openIndexedDb();
    if (!db) {
      return null;
    }
    return await new Promise<StoredI18nBundle | null>(resolve => {
      const tx = db.transaction(I18nService.INDEXED_DB_STORE, 'readonly');
      const request = tx.objectStore(I18nService.INDEXED_DB_STORE).get(this.normalizeLanguage(lang));
      request.onsuccess = () => {
        resolve(this.normalizeStoredBundle(request.result, lang));
      };
      request.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  }

  private async writeIndexedDbBundle(bundle: StoredI18nBundle): Promise<void> {
    const db = await this.openIndexedDb();
    if (!db) {
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(I18nService.INDEXED_DB_STORE, 'readwrite');
      tx.objectStore(I18nService.INDEXED_DB_STORE).put(bundle, bundle.lang);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  private async openIndexedDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return null;
    }
    if (!this.indexedDbOpenPromise) {
      this.indexedDbOpenPromise = new Promise<IDBDatabase | null>(resolve => {
        const request = indexedDB.open(I18nService.INDEXED_DB_NAME, I18nService.INDEXED_DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(I18nService.INDEXED_DB_STORE)) {
            db.createObjectStore(I18nService.INDEXED_DB_STORE);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      });
    }
    return await this.indexedDbOpenPromise;
  }

  private normalizeStoredBundle(value: unknown, fallbackLang: string): StoredI18nBundle | null {
    const parsed = value as Partial<StoredI18nBundle> | null;
    const normalizedLang = this.normalizeLanguage(parsed?.lang ?? fallbackLang);
    const data = this.normalizeMessages(parsed?.data ?? null);
    const version = `${parsed?.version ?? ''}`.trim();
    if (!normalizedLang || !version || !data) {
      return null;
    }
    return {
      lang: normalizedLang,
      version,
      data,
      storedAt: Number.isFinite(parsed?.storedAt) ? Number(parsed?.storedAt) : 0
    };
  }

  private storageKey(lang: string): string {
    return `${I18nService.STORAGE_PREFIX}.${this.normalizeLanguage(lang) || I18nService.DEFAULT_LANGUAGE}`;
  }

  private canUseLocalStorage(): boolean {
    try {
      return typeof localStorage !== 'undefined';
    } catch {
      return false;
    }
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
    const dynamicTranslated = this.translateDynamicSource(normalizedKey, messages, sourceKeyByText);
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

    const activeMatch = normalizedSource.match(/^Active (help|privacy|explanation) v(\d+)$/i);
    if (activeMatch) {
      return this.interpolateDocumentMessage(messages, `active.${this.documentKey(activeMatch[1])}.version`, {
        version: activeMatch[2] ?? '0'
      });
    }

    const noActiveMatch = normalizedSource.match(/^No active (help|privacy|explanation) revision$/i);
    if (noActiveMatch) {
      return this.documentMessage(messages, `no.active.${this.documentKey(noActiveMatch[1])}.revision`);
    }

    const loadingMatch = normalizedSource.match(/^Loading (help|privacy|explanation) revisions$/i);
    if (loadingMatch) {
      return this.documentMessage(messages, `loading.${this.documentKey(loadingMatch[1])}.revisions`);
    }

    const noRevisionsMatch = normalizedSource.match(/^No (help|privacy|explanation) revisions$/i);
    if (noRevisionsMatch) {
      return this.documentMessage(messages, `no.${this.documentKey(noRevisionsMatch[1])}.revisions`);
    }

    const enablePopupMatch = normalizedSource.match(/^Create a revision to enable the (help|privacy|explanation) popup\.$/i);
    if (enablePopupMatch) {
      return this.documentMessage(messages, `create.revision.to.enable.${this.documentKey(enablePopupMatch[1])}.popup`);
    }

    const revisionsLabelMatch = normalizedSource.match(/^(Help|Privacy|Explanation) revisions$/i);
    if (revisionsLabelMatch) {
      return this.documentMessage(messages, `${this.documentKey(revisionsLabelMatch[1])}.revisions`);
    }

    const popupHeaderMatch = normalizedSource.match(/^(Help|Privacy|Explanation) popup header$/i);
    if (popupHeaderMatch) {
      return this.documentMessage(messages, `${this.documentKey(popupHeaderMatch[1])}.popup.header`);
    }

    const descriptionMatch = normalizedSource.match(/^(Help|Privacy|Explanation) description$/i);
    if (descriptionMatch) {
      return this.documentMessage(messages, `${this.documentKey(descriptionMatch[1])}.description`);
    }

    const sectionTitleMatch = normalizedSource.match(/^(Help|Privacy|Explanation) section title$/i);
    if (sectionTitleMatch) {
      return this.documentMessage(messages, `${this.documentKey(sectionTitleMatch[1])}.section.title`);
    }

    const sectionActionMatch = normalizedSource.match(/^(Add|Remove|Toggle) (help|privacy|explanation) section$/i);
    if (sectionActionMatch) {
      return this.documentMessage(
        messages,
        `${sectionActionMatch[1]?.toLocaleLowerCase('en-US')}.${this.documentKey(sectionActionMatch[2])}.section`
      );
    }

    const unableMatch = normalizedSource.match(/^Unable to (load|save|activate|delete) (help|privacy|explanation) revision(s)?\.$/i);
    if (unableMatch) {
      return this.documentMessage(
        messages,
        `unable.to.${unableMatch[1]?.toLocaleLowerCase('en-US')}.${this.documentKey(unableMatch[2])}.revisions`
      );
    }

    return null;
  }

  private documentKey(value: string | undefined): 'help' | 'privacy' | 'explanation' {
    const normalized = `${value ?? ''}`.trim().toLocaleLowerCase('en-US');
    if (normalized === 'privacy' || normalized === 'explanation') {
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
    return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, key: string) => values[key] ?? match);
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
    return /\p{L}/u.test(value);
  }

  private shouldSkipAttributeElement(element: Element): boolean {
    return Boolean(element.closest(I18nService.SKIP_ATTRIBUTE_SELECTOR));
  }

  private shouldSkipTextElement(element: Element): boolean {
    return Boolean(element.closest(I18nService.SKIP_TEXT_SELECTOR));
  }
}
