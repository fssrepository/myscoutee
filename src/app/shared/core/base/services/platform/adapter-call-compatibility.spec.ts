import { cachedAdapterType, LOCAL_ADAPTER } from '../../adapter-loaders';
import { AdminParamsService } from '../affinity/admin-params.service';
import { AdminMonitoringService } from '../administration/admin-monitoring.service';
import { ContentModerationService } from '../content/content-moderation.service';

// Preserve the existing local/HTTP call signatures while implementation classes
// move behind the common references. No constructor, seed or transport runs.
function fixture(owner: { prototype: object }, mode: 'local' | 'http', key: typeof LOCAL_ADAPTER[keyof typeof LOCAL_ADAPTER]) {
  const local = Object.create(cachedAdapterType(key)!.prototype);
  const http = Object.create(null);
  const service = Object.assign(Object.create(owner.prototype), {
    localService: local, httpService: http, local, http,
    resolveRouteService: (_route: string, localSource: unknown, httpSource: unknown) =>
      mode === 'local' ? localSource : httpSource,
    normalizeParamsState: (value: unknown) => value,
    normalizeParamsHistory: (value: unknown) => value,
    normalizeMonitoringState: vi.fn(value => value)
  });
  return { service, local, http };
}

describe('Central adapter reference call compatibility', () => {
  it.each(['local', 'http'] as const)('preserves %s parameter loading and save argument order', async mode => {
    const { service, local, http } = fixture(AdminParamsService, mode, LOCAL_ADAPTER.ADMIN_PARAMS);
    for (const adapter of [local, http]) {
      adapter.loadParamsState = vi.fn().mockResolvedValue({});
      adapter.saveParamsSection = vi.fn().mockResolvedValue({});
    }
    const options = { skipDemoDelay: true };
    await service.loadParamsState('admin', options);
    await service.saveParamsSection('section', [], 'summary', 'admin', options);
    if (mode === 'local') {
      expect(local.loadParamsState).toHaveBeenCalledExactlyOnceWith(options, 'admin');
      expect(local.saveParamsSection).toHaveBeenCalledExactlyOnceWith('section', [], 'summary', 'admin', options);
      expect(http.loadParamsState).not.toHaveBeenCalled();
      expect(http.saveParamsSection).not.toHaveBeenCalled();
    } else {
      expect(http.loadParamsState).toHaveBeenCalledExactlyOnceWith('admin');
      expect(http.saveParamsSection).toHaveBeenCalledExactlyOnceWith('section', [], 'summary', 'admin');
      expect(local.loadParamsState).not.toHaveBeenCalled();
      expect(local.saveParamsSection).not.toHaveBeenCalled();
    }
  });

  it.each(['local', 'http'] as const)('preserves %s parameter history argument order', async mode => {
    const { service, local, http } = fixture(AdminParamsService, mode, LOCAL_ADAPTER.ADMIN_PARAMS);
    local.loadParamsHistory = vi.fn().mockResolvedValue({});
    http.loadParamsHistory = vi.fn().mockResolvedValue({});
    const options = { skipDemoDelay: true };
    await service.loadParamsHistory('section', 'admin', options);
    expect(mode === 'local' ? local.loadParamsHistory : http.loadParamsHistory)
      .toHaveBeenCalledExactlyOnceWith(...(mode === 'local' ? ['section', options, 'admin'] : ['section', 'admin']));
    expect(mode === 'local' ? http.loadParamsHistory : local.loadParamsHistory).not.toHaveBeenCalled();
  });

  it.each(['local', 'http'] as const)('preserves %s monitoring arguments and source', async mode => {
    const { service, local, http } = fixture(AdminMonitoringService, mode, LOCAL_ADAPTER.ADMIN_MONITORING);
    local.loadMonitoringState = vi.fn().mockResolvedValue({});
    http.loadMonitoringState = vi.fn().mockResolvedValue({});
    await service.loadMonitoringState('admin', 'filter');
    expect(mode === 'local' ? local.loadMonitoringState : http.loadMonitoringState)
      .toHaveBeenCalledExactlyOnceWith(...(mode === 'local' ? ['filter', 'admin'] : ['admin', 'filter']));
    expect(mode === 'local' ? http.loadMonitoringState : local.loadMonitoringState).not.toHaveBeenCalled();
    expect(service.normalizeMonitoringState).toHaveBeenCalledExactlyOnceWith({}, mode === 'local' ? 'demo' : 'http');
  });

  it.each(['local', 'http'] as const)('preserves %s moderation decision arguments', async mode => {
    const { service, local, http } = fixture(ContentModerationService, mode, LOCAL_ADAPTER.CONTENT_MODERATION);
    local.decide = vi.fn().mockResolvedValue({});
    http.decide = vi.fn().mockResolvedValue({});
    const request = { decision: 'approve' }, admin = { id: 'admin' };
    await service.decide('item', request, admin, 'group');
    expect(mode === 'local' ? local.decide : http.decide)
      .toHaveBeenCalledExactlyOnceWith(...(mode === 'local' ? ['item', request, admin, 'group'] : ['item', request, 'group']));
    expect(mode === 'local' ? http.decide : local.decide).not.toHaveBeenCalled();
  });
});
