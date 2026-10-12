import { LocalGameService } from './game.service';

describe('Local game response timing', () => {
  it('hydrates and reads the repository during the emulated response delay', async () => {
    let releaseDelay!: () => void;
    const repository = {
      whenReady: vi.fn().mockResolvedValue(undefined),
      queryUserById: vi.fn().mockReturnValue(null)
    };
    const service = Object.assign(Object.create(LocalGameService.prototype), {
      usersRepository: repository,
      waitForRouteDelay: vi.fn(() => new Promise<void>(resolve => { releaseDelay = resolve; }))
    });
    let completed = false;
    const pending = service.queryUserGameCardsByFilter({ userId: 'account' })
      .then((response: any) => { completed = true; return response; });
    await vi.waitFor(() => expect(repository.queryUserById).toHaveBeenCalledWith('account'));
    expect(completed).toBe(false);
    releaseDelay();
    expect((await pending).cards.cardUserIds).toEqual([]);
    expect(repository.whenReady).toHaveBeenCalledOnce();
  });

  it('does not publish the result before slower repository hydration finishes', async () => {
    let releaseRead!: () => void;
    const repository = {
      whenReady: () => new Promise<void>(resolve => { releaseRead = resolve; }),
      queryUserById: vi.fn().mockReturnValue(null)
    };
    const service = Object.assign(Object.create(LocalGameService.prototype), {
      usersRepository: repository, waitForRouteDelay: vi.fn().mockResolvedValue(undefined)
    });
    let completed = false;
    const pending = service.queryUserGameCardsByFilter({ userId: 'account' }).then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(repository.queryUserById).not.toHaveBeenCalled();
    releaseRead();
    await pending;
    expect(completed).toBe(true);
  });
});
