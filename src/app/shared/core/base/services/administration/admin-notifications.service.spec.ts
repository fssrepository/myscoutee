import { AdminNotificationsService } from './admin-notifications.service';
import { LocalAdminNotificationsService } from '../../../local/source/services/administration/admin-notifications.service';

describe('Admin notification adapter call compatibility', () => {
  function fixture(mode: 'local' | 'http') {
    const local = Object.assign(Object.create(LocalAdminNotificationsService.prototype), {
      loadNotificationCenter: vi.fn().mockResolvedValue({ id: 'local' }),
      saveNotificationCenter: vi.fn().mockResolvedValue({ id: 'local' })
    });
    const http = {
      loadNotificationCenter: vi.fn().mockResolvedValue({ id: 'http' }),
      saveNotificationCenter: vi.fn().mockResolvedValue({ id: 'http' })
    };
    const service = Object.assign(Object.create(AdminNotificationsService.prototype), {
      localService: local, httpService: http,
      resolveRouteService: (_route: string, localSource: unknown, httpSource: unknown) =>
        mode === 'local' ? localSource : httpSource,
      normalizeNotificationCenter: (value: unknown) => value
    });
    return { service, local, http };
  }

  it.each(['local', 'http'] as const)('retains the %s load argument order', async mode => {
    const { service, local, http } = fixture(mode);
    const options = { skipDemoDelay: true, filter: 'all' };
    expect(await service.loadNotificationCenter('admin', options)).toEqual({ id: mode });
    if (mode === 'local') {
      expect(local.loadNotificationCenter).toHaveBeenCalledExactlyOnceWith(options, 'admin');
      expect(http.loadNotificationCenter).not.toHaveBeenCalled();
    } else {
      expect(http.loadNotificationCenter).toHaveBeenCalledExactlyOnceWith('admin', 'all');
      expect(local.loadNotificationCenter).not.toHaveBeenCalled();
    }
  });

  it.each(['local', 'http'] as const)('retains the %s save argument order', async mode => {
    const { service, local, http } = fixture(mode);
    const options = { skipDemoDelay: true, filter: 'all' };
    expect(await service.saveNotificationCenter([], 'admin', options)).toEqual({ id: mode });
    if (mode === 'local') {
      expect(local.saveNotificationCenter).toHaveBeenCalledExactlyOnceWith([], 'admin', options);
      expect(http.saveNotificationCenter).not.toHaveBeenCalled();
    } else {
      expect(http.saveNotificationCenter).toHaveBeenCalledExactlyOnceWith([], 'admin', 'all');
      expect(local.saveNotificationCenter).not.toHaveBeenCalled();
    }
  });
});
