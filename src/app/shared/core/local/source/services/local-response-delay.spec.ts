import { LocalPhotoFeedService } from './photo-feed.service';
import { LocalAssetsService } from './assets.service';
import { LocalAssetTicketsService } from './asset-tickets.service';
import { LocalEventsService } from './events.service';
import { LocalRatesService } from './rates.service';
import { LocalActivityResourcesService } from './activity-resources.service';
import { LocalCampaignsService } from './campaigns.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('Local service response timing across owners', () => {
  const readers = [
    { name: 'assets', prototype: LocalAssetsService.prototype, field: 'assetsRepository', read: 'queryOwnedAssetsByUser', method: 'queryOwnedAssetsByUser', args: ['member'] },
    { name: 'tickets', prototype: LocalAssetTicketsService.prototype, field: 'assetTicketsRepository', read: 'queryTicketPage', method: 'queryTicketPage', args: [{}] },
    { name: 'events', prototype: LocalEventsService.prototype, field: 'eventsRepository', read: 'queryItemsByUser', method: 'queryItemsByUser', args: ['member'] },
    { name: 'rates', prototype: LocalRatesService.prototype, field: 'ratesRepository', read: 'queryRateItemsByUserId', method: 'queryRateItemsByUser', args: ['member'] }
  ];
  for (const reader of readers) {
    it(`${reader.name} starts the read immediately and waits for both work and emulation`, async () => {
      const delay = deferred<void>(), work = deferred<any>();
      const read = vi.fn(() => work.promise);
      const service = Object.assign(Object.create(reader.prototype), {
        [reader.field]: { [reader.read]: read }, waitForRouteDelay: vi.fn(() => delay.promise)
      });
      let complete = false;
      const pending = service[reader.method](...reader.args).then((value: any) => { complete = true; return value; });
      expect(read).toHaveBeenCalledOnce();
      delay.resolve();
      await Promise.resolve();
      expect(complete).toBe(false);
      work.resolve([]);
      expect(await pending).toEqual([]);
      expect(service.waitForRouteDelay).toHaveBeenCalledOnce();
    });
  }

  it('feed hydration, seen acknowledgement and page projection finish during one held delay', async () => {
    const delay = deferred<void>();
    const repository = {
      whenReady: vi.fn().mockResolvedValue(undefined), user: () => ({locationCoordinates: {latitude: 51.5, longitude: -0.1}}),
      markSeen: vi.fn().mockResolvedValue(undefined), seenIds: vi.fn().mockResolvedValue(['seen']),
      page: vi.fn().mockReturnValue({items: ['post']})
    };
    const service = Object.assign(Object.create(LocalPhotoFeedService.prototype), {
      repository, waitForRouteDelay: vi.fn(() => delay.promise)
    });
    let complete = false;
    const pending = service.page('member', {pageSize: 10, filters: {status: 'public'}}, undefined,
      ['12345678-1234-1234-1234-123456789abc']).then((value: any) => { complete = true; return value; });
    await vi.waitFor(() => expect(repository.page).toHaveBeenCalledOnce());
    expect(repository.markSeen).toHaveBeenCalledOnce();
    expect(complete).toBe(false);
    delay.resolve();
    expect(await pending).toEqual({items: ['post']});
    expect(service.waitForRouteDelay).toHaveBeenCalledOnce();
  });

  it('an already cancelled feed request cannot mark items as seen', async () => {
    const abort = new AbortController(); abort.abort();
    const repository = {whenReady: vi.fn(), markSeen: vi.fn()};
    const service = Object.assign(Object.create(LocalPhotoFeedService.prototype), {repository, waitForRouteDelay: vi.fn()});
    await expect(service.page('member', {pageSize: 10}, abort.signal)).rejects.toMatchObject({name: 'AbortError'});
    expect(repository.whenReady).not.toHaveBeenCalled();
    expect(repository.markSeen).not.toHaveBeenCalled();
  });

  it('a cancelled response is not published after the work has completed', async () => {
    const abort = new AbortController(), delay = deferred<void>();
    const service = Object.assign(Object.create(LocalAssetTicketsService.prototype), {
      assetTicketsRepository: {syncTickets: vi.fn().mockResolvedValue({upserts: []})}, waitForRouteDelay: () => delay.promise
    });
    const pending = service.syncTickets({}, abort.signal);
    abort.abort(); delay.resolve();
    await expect(pending).rejects.toMatchObject({name: 'AbortError'});
  });

  it('campaign aggregation reuses the authorized owner projection without another delay', async () => {
    const delay = deferred<void>();
    const actor = {id: 'member'}, record = {id: 'campaign'}, rating = {score: 7};
    const service = Object.assign(Object.create(LocalCampaignsService.prototype), {
      actor: vi.fn().mockResolvedValue(actor), visible: vi.fn().mockReturnValue(record), dto: vi.fn().mockReturnValue(record),
      campaigns: {ratingEvidenceByCampaign: () => new Map([['campaign', rating]])}, waitForRouteDelay: vi.fn(() => delay.promise)
    });
    expect(await service.readDetail('member', 'campaign')).toBe(record);
    expect(service.waitForRouteDelay).not.toHaveBeenCalled();
    const pending = service.detail('member', 'campaign');
    await vi.waitFor(() => expect(service.dto).toHaveBeenCalledTimes(2));
    delay.resolve(); expect(await pending).toBe(record);
    expect(service.waitForRouteDelay).toHaveBeenCalledOnce();
    expect(service.dto).toHaveBeenCalledWith(actor, record, rating);
  });

  it('event cancellation reuses the complete leave operation without its own second delay', async () => {
    const body = vi.fn().mockResolvedValue(null), delay = deferred<void>();
    const service = Object.assign(Object.create(LocalEventsService.prototype), {
      leaveWithinRequest: body, waitForRouteDelay: vi.fn(() => delay.promise)
    });
    const pending = service.leaveEvent('member', 'event', {removeMembershipOnly: true});
    expect(body).toHaveBeenCalledWith('member', 'event', {removeMembershipOnly: true});
    delay.resolve(); expect(await pending).toBeNull();
    expect(service.waitForRouteDelay).toHaveBeenCalledOnce();
  });

  it('resource writes reject already cancelled commands before changing repository state', async () => {
    const abort = new AbortController(); abort.abort();
    const repository = {replaceSubEventResourceRecord: vi.fn()};
    const service = Object.assign(Object.create(LocalActivityResourcesService.prototype), {repository});
    await expect(service.writeSubEventResourceState({}, abort.signal)).rejects.toMatchObject({name: 'AbortError'});
    expect(repository.replaceSubEventResourceRecord).not.toHaveBeenCalled();
  });
});
