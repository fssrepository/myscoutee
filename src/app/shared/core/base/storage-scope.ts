import { environment } from '../../../../environments/environment';

export type AppStorageScope = 'demo' | 'http';

export const APP_STORAGE_SCOPE: AppStorageScope = environment.activitiesDataSource === 'http'
  ? 'http'
  : 'demo';

export const APP_SCOPED_INDEXED_DB_NAME = APP_STORAGE_SCOPE === 'demo'
  ? 'myscoutee_demo_db'
  : 'myscoutee_http_db';

export const APP_SCOPED_INDEXED_DB_VERSION = 1;
export const APP_TABLES_STORE = 'tables';
export const APP_I18N_BUNDLES_STORE = 'i18nBundles';

export function appScopedIndexedDbName(scope: AppStorageScope): string {
  return scope === 'demo'
    ? 'myscoutee_demo_db'
    : 'myscoutee_http_db';
}

export function scopedStorageKey(key: string, scope: AppStorageScope = APP_STORAGE_SCOPE): string {
  return `myscoutee.${scope}.${key.trim()}`;
}

export function createAppScopedObjectStores(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(APP_TABLES_STORE)) {
    db.createObjectStore(APP_TABLES_STORE);
  }
  if (!db.objectStoreNames.contains(APP_I18N_BUNDLES_STORE)) {
    db.createObjectStore(APP_I18N_BUNDLES_STORE);
  }
}
