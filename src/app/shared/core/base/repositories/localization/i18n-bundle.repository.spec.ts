import { I18nBundleRepository, type StoredI18nBundle } from './i18n-bundle.repository';
import { APP_I18N_BUNDLES_STORE, scopedStorageKey } from '../../../common/storage-scope';

describe('I18nBundleRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  const bundle: StoredI18nBundle = {
    lang: 'en', version: 'current.1', data: { greeting: 'Hello' }, storedAt: 1
  };
  const localKey = scopedStorageKey('i18n.bundle.v2.real.en');

  function storedCatalogs(abortWrites = false): Map<string, StoredI18nBundle> {
    const records = new Map<string, StoredI18nBundle>();
    const db = {
      objectStoreNames: { contains: (name: string) => name === APP_I18N_BUNDLES_STORE },
      transaction: () => {
        const tx = {
          oncomplete: () => {}, onabort: () => {},
          objectStore: () => ({
            get: (key: string) => {
              const request = { result: structuredClone(records.get(key)), onsuccess: () => {} };
              queueMicrotask(() => request.onsuccess());
              return request;
            },
            put: (value: StoredI18nBundle, key: string) => {
              queueMicrotask(() => {
                if (abortWrites) tx.onabort();
                else { records.set(key, structuredClone(value)); tx.oncomplete(); }
              });
            }
          })
        };
        return tx;
      }
    };
    vi.stubGlobal('indexedDB', { open: () => {
      const request = { result: db, onsuccess: () => {} };
      queueMicrotask(() => request.onsuccess());
      return request;
    } });
    return records;
  }

  it('keeps full catalogs in IndexedDB without consuming localStorage quota needed by account sessions', async () => {
    storedCatalogs();
    await new I18nBundleRepository().writeStoredBundle('real', bundle);
    expect(localStorage.getItem(localKey)).toBeNull();
    // A new repository must still restore the persisted offline catalog.
    await expect(new I18nBundleRepository().readStoredBundle('real', 'en')).resolves.toEqual(bundle);
    expect(localStorage.getItem(localKey)).toBeNull();
  });

  it('removes an old duplicate only after reading the persisted catalog', async () => {
    const records = storedCatalogs();
    records.set('real:en', bundle);
    localStorage.setItem(localKey, JSON.stringify({ ...bundle, version: 'old' }));
    localStorage.setItem('unrelated', 'retained');
    await expect(new I18nBundleRepository().readStoredBundle('real', 'en')).resolves.toEqual(bundle);
    expect(localStorage.getItem(localKey)).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('retained');
  });

  it('moves a local-only catalog to IndexedDB before removing it', async () => {
    const records = storedCatalogs();
    localStorage.setItem(localKey, JSON.stringify(bundle));
    await expect(new I18nBundleRepository().readStoredBundle('real', 'en')).resolves.toEqual(bundle);
    expect(records.get('real:en')).toEqual(bundle);
    expect(localStorage.getItem(localKey)).toBeNull();
  });

  it('retains the local catalog when its IndexedDB migration aborts', async () => {
    storedCatalogs(true);
    localStorage.setItem(localKey, JSON.stringify(bundle));
    await expect(new I18nBundleRepository().readStoredBundle('real', 'en')).resolves.toEqual(bundle);
    expect(JSON.parse(localStorage.getItem(localKey)!)).toEqual(bundle);
  });

  it('uses the existing local cache when IndexedDB writes abort', async () => {
    storedCatalogs(true);
    await new I18nBundleRepository().writeStoredBundle('real', bundle);
    expect(JSON.parse(localStorage.getItem(localKey)!)).toEqual(bundle);
  });

  it('isolates real and demo HTTP bundles for the same language', async () => {
    const repository = new I18nBundleRepository();
    await repository.writeStoredBundle('real', {
      lang: 'en',
      version: 'real.1',
      data: { greeting: 'Real greeting' },
      storedAt: 1
    });
    await repository.writeStoredBundle('demo', {
      lang: 'en',
      version: 'demo.1',
      data: { greeting: 'Demo greeting' },
      storedAt: 2
    });

    await expect(repository.readStoredBundle('real', 'en'))
      .resolves.toEqual(expect.objectContaining({
        version: 'real.1',
        data: { greeting: 'Real greeting' }
      }));
    await expect(repository.readStoredBundle('demo', 'en'))
      .resolves.toEqual(expect.objectContaining({
        version: 'demo.1',
        data: { greeting: 'Demo greeting' }
      }));
  });

  it('does not read the former unscoped cache key', async () => {
    localStorage.setItem(
      'myscoutee.http.i18n.bundle.v1.en',
      JSON.stringify({
        lang: 'en',
        version: 'legacy.1',
        data: { greeting: 'Legacy greeting' },
        storedAt: 1
      })
    );

    await expect(new I18nBundleRepository().readStoredBundle('real', 'en'))
      .resolves.toBeNull();
  });
});
