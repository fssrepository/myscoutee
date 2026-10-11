import { I18nBundleRepository } from './i18n-bundle.repository';

describe('I18nBundleRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
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
