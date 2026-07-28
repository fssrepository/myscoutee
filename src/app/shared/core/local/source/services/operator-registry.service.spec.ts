import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { RouteDelayService } from '../../../base/services/route-delay.service';
import { LocalMemoryDb } from '../../../common/app.db';
import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';
import { LocalOperatorRegistryRepository } from '../repositories/operator-registry.repository';
import { LocalOperatorRegistryService } from './operator-registry.service';

describe('LocalOperatorRegistryService', () => {
  let memoryDb: LocalMemoryDb;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    memoryDb = TestBed.inject(LocalMemoryDb);
    await memoryDb.resetStorage();
    vi.spyOn(
      TestBed.inject(RouteDelayService),
      'waitForRouteDelay'
    ).mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('hydrates the standalone registry key once across load, inspect, and confirm', async () => {
    const diskReadSpy = vi.spyOn(memoryDb, 'readIndexedDbTableEntry');
    const diskWriteSpy = vi.spyOn(memoryDb, 'writeIndexedDbTableEntry');
    const repository = TestBed.inject(LocalOperatorRegistryRepository);
    const service = TestBed.inject(LocalOperatorRegistryService);

    await Promise.all([
      repository.whenReady(),
      repository.whenReady()
    ]);
    const initial = await service.loadStatus();
    const inspection = await service.inspect({
      baseUrl: 'https://sample-registry.myscoutee.invalid',
      expectedScope: 'demo:sample'
    });
    const registered = await service.confirm(inspection.inspectionToken);
    const cached = await repository.read();

    expect(initial.lifecycle).toBe('UNCONFIGURED');
    expect(initial.nodeIdentity.state).toBe('MISSING');
    expect(inspection.simulation).toBe(true);
    expect(registered.lifecycle).toBe('REGISTERED');
    expect(registered.nodeIdentity.state).toBe('SIMULATED');
    expect(cached?.status.enrollment?.deploymentCode).toBe(
      registered.enrollment?.deploymentCode
    );

    expect(diskReadSpy).toHaveBeenCalledTimes(1);
    expect(diskReadSpy).toHaveBeenCalledWith(APP_INDEXED_DB_KEYS.operatorRegistry);
    expect(diskWriteSpy).toHaveBeenCalledTimes(3);
    expect(diskWriteSpy.mock.calls.every(
      ([key]: [string, unknown]) => key === APP_INDEXED_DB_KEYS.operatorRegistry
    )).toBe(true);
  });
});
