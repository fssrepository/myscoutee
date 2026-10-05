import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LocalMemoryDb } from '../../../common/app.db';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { SeedOperatorRegistryBuilder } from '../../seed/builders/operator-registry-seed.builder';
import publicConfiguration from '../../seed/data/deployment-configuration.json';
import { LocalOperatorRegistryRepository } from '../repositories/operator-registry.repository';
import { LocalDeploymentConfigurationService } from './deployment-configuration.service';

describe('Public local deployment configuration', () => {
  let db: LocalMemoryDb;
  let repository: LocalOperatorRegistryRepository;
  let service: LocalDeploymentConfigurationService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [
      { provide: RouteDelayService, useValue: { waitForRouteDelay: async () => undefined } }
    ] });
    db = TestBed.inject(LocalMemoryDb);
    await db.resetStorage();
    repository = TestBed.inject(LocalOperatorRegistryRepository);
    service = TestBed.inject(LocalDeploymentConfigurationService);
  });
  afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); });

  it('loads the public catalog on a fresh landing without creating any demo state', async () => {
    const before = structuredClone(db.read());
    const write = vi.spyOn(db, 'writeIndexedDbTableEntry');
    const response = await service.loadBranding();
    expect(response).toEqual(publicConfiguration);
    expect(response.socialLinks.map(link => link.provider)).toEqual(['instagram', 'youtube', 'facebook']);
    expect(await repository.read()).toBeNull();
    expect(db.read()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
  });

  it('uses the same public values after operator bootstrap and preserves saved overrides', async () => {
    const initial = await service.loadBranding();
    const record = SeedOperatorRegistryBuilder.buildInitialRecord();
    await repository.write(record);
    expect(await service.loadBranding()).toEqual(initial);

    record.configuration.branding.productName = 'Saved name';
    record.configuration.socialLinks = [];
    record.configuration.payment.providerId = null;
    await repository.write(record);
    const write = vi.spyOn(db, 'writeIndexedDbTableEntry');
    const response = await service.loadBranding();
    expect(response.productName).toBe('Saved name');
    expect(response.socialLinks).toEqual([]);
    expect(response.paymentProviderId).toBeNull();
    expect(write).not.toHaveBeenCalled();
    expect(await repository.read()).toEqual(record);
  });

  it('returns detached public data without exposing private operator state', async () => {
    const response = await service.loadBranding();
    response.socialLinks[0].label = 'Changed by caller';
    expect((await service.loadBranding()).socialLinks[0].label).toBe('Instagram');
    expect(Object.keys(response).sort()).toEqual(Object.keys(publicConfiguration).sort());
  });
});
