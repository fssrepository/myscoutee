import { LocalContentModerationService } from './content-moderation.service';

describe('Local moderation aggregate request', () => {
  it('reads the complete owner detail while one outer delay is pending', async () => {
    let releaseDelay!: () => void;
    const detail = { id: 'group-a', role: 'Admin', membershipStatus: 'accepted' };
    const service = Object.assign(Object.create(LocalContentModerationService.prototype), {
      waitForRouteDelay: vi.fn(() => new Promise<void>(resolve => { releaseDelay = resolve; })),
      repository: { whenReady: vi.fn(), state: () => ({ pendingMessages: [] }) },
      users: { queryUserById: () => ({ id: 'admin' }) },
      groupRecords: { find: () => ({ id: 'group-a', ownerUserId: 'admin' }) },
      groups: { readDetail: vi.fn().mockResolvedValue(detail), detail: vi.fn() }
    });
    let published = false;
    const request = service.detail('admin', 'group:group-a').then((value: unknown) => { published = true; return value; });
    await vi.waitFor(() => expect(service.groups.readDetail).toHaveBeenCalledWith('admin', 'group-a'));
    expect(published).toBe(false);
    expect(service.waitForRouteDelay).toHaveBeenCalledExactlyOnceWith('/admin/content-moderation');
    expect(service.groups.detail).not.toHaveBeenCalled();
    releaseDelay();
    expect(await request).toEqual(detail);
  });
});
