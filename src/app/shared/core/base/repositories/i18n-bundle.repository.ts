import { Injectable } from '@angular/core';

import {
  APP_I18N_BUNDLES_STORE,
  APP_SCOPED_INDEXED_DB_NAME,
  APP_SCOPED_INDEXED_DB_VERSION,
  createAppScopedObjectStores,
  scopedStorageKey
} from '../../common/storage-scope';

export interface StoredI18nBundle {
  lang: string;
  version: string;
  data: Record<string, string>;
  storedAt: number;
}

export type I18nBundleScope = 'real' | 'demo';

@Injectable({
  providedIn: 'root'
})
export class I18nBundleRepository {
  private static readonly DEFAULT_LANGUAGE = 'en';
  private indexedDbOpenPromise: Promise<IDBDatabase | null> | null = null;

  async firstStoredBundle(
    scope: I18nBundleScope,
    candidates: readonly string[]
  ): Promise<StoredI18nBundle | null> {
    for (const lang of candidates) {
      const stored = await this.readStoredBundle(scope, lang);
      if (stored && Object.keys(stored.data).length > 0) {
        return stored;
      }
    }
    return null;
  }

  async readStoredBundle(
    scope: I18nBundleScope,
    lang: string
  ): Promise<StoredI18nBundle | null> {
    const stored = await this.readIndexedDbBundle(scope, lang);
    if (stored) {
      this.writeLocalStorageBundle(scope, stored);
      return stored;
    }
    return this.readLocalStorageBundle(scope, lang);
  }

  async writeStoredBundle(
    scope: I18nBundleScope,
    bundle: StoredI18nBundle
  ): Promise<void> {
    await this.writeIndexedDbBundle(scope, bundle);
    this.writeLocalStorageBundle(scope, bundle);
  }

  private readLocalStorageBundle(
    scope: I18nBundleScope,
    lang: string
  ): StoredI18nBundle | null {
    if (!this.canUseLocalStorage()) {
      return null;
    }
    try {
      const raw = localStorage.getItem(this.storageKey(scope, lang));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<StoredI18nBundle> | null;
      return this.normalizeStoredBundle(parsed, lang);
    } catch {
      return null;
    }
  }

  private writeLocalStorageBundle(
    scope: I18nBundleScope,
    bundle: StoredI18nBundle
  ): void {
    if (!this.canUseLocalStorage()) {
      return;
    }
    try {
      localStorage.setItem(
        this.storageKey(scope, bundle.lang),
        JSON.stringify(bundle)
      );
    } catch {
      // Private-mode/quota failures should never block rendering.
    }
  }

  private async readIndexedDbBundle(
    scope: I18nBundleScope,
    lang: string
  ): Promise<StoredI18nBundle | null> {
    const db = await this.openIndexedDb();
    if (!db || !db.objectStoreNames.contains(APP_I18N_BUNDLES_STORE)) {
      return null;
    }
    return await new Promise<StoredI18nBundle | null>(resolve => {
      const tx = db.transaction(APP_I18N_BUNDLES_STORE, 'readonly');
      const request = tx.objectStore(APP_I18N_BUNDLES_STORE)
        .get(this.bundleKey(scope, lang));
      request.onsuccess = () => {
        resolve(this.normalizeStoredBundle(request.result, lang));
      };
      request.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  }

  private async writeIndexedDbBundle(
    scope: I18nBundleScope,
    bundle: StoredI18nBundle
  ): Promise<void> {
    const db = await this.openIndexedDb();
    if (!db || !db.objectStoreNames.contains(APP_I18N_BUNDLES_STORE)) {
      return;
    }
    await new Promise<void>(resolve => {
      const tx = db.transaction(APP_I18N_BUNDLES_STORE, 'readwrite');
      tx.objectStore(APP_I18N_BUNDLES_STORE)
        .put(bundle, this.bundleKey(scope, bundle.lang));
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
        const request = indexedDB.open(APP_SCOPED_INDEXED_DB_NAME, APP_SCOPED_INDEXED_DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          createAppScopedObjectStores(db);
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

  private storageKey(scope: I18nBundleScope, lang: string): string {
    const normalizedLang = this.normalizeLanguage(lang) || I18nBundleRepository.DEFAULT_LANGUAGE;
    return scopedStorageKey(`i18n.bundle.v2.${scope}.${normalizedLang}`);
  }

  private bundleKey(scope: I18nBundleScope, lang: string): string {
    const normalizedLang = this.normalizeLanguage(lang)
      || I18nBundleRepository.DEFAULT_LANGUAGE;
    return `${scope}:${normalizedLang}`;
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

  private normalizeSourceKey(value: string): string {
    return `${value ?? ''}`.trim().replace(/\s+/g, ' ');
  }
}
