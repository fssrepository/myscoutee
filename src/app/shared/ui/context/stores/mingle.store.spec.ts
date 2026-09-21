import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EventsService } from '../../../core/base/services/events.service';
import { I18nService } from '../../../core/base/services/i18n.service';
import type { MingleStateDTO } from '../../../core/contracts/event.interface';
import { UiPollCoordinator } from '../../scheduler/ui-poll-coordinator';
import { ActivityStore } from './activity.store';
import { NotificationCenterStore } from './notification-center.store';
import { MemberMenuStore } from './member-menu.store';
import { MingleStore } from './mingle.store';

const state = (waiting = false): MingleStateDTO => ({
  eventId: 'event-1', eventTitle: 'Mingle', status: 'ROUND', roundNumber: 1, plannedRounds: 3,
  phaseStartedAtIso: new Date().toISOString(), phaseEndsAtIso: new Date(Date.now() + 120_000).toISOString(),
  remainingSeconds: 120, tableNumber: waiting ? null : 1,
  tables: waiting ? [] : [{ tableNumber: 1, subEventId: 'mingle-round-1', memberOwnerId: 'table-1', participants: [] }],
  canManage: false, waitingForTable: waiting, revision: 1
});

describe('MingleStore live table flow', () => {
  let store: MingleStore;
  let query: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let unread = signal(0);

  beforeEach(() => {
    vi.useFakeTimers();
    unread = signal(0);
    query = vi.fn().mockResolvedValue(null);
    navigate = vi.fn();
    TestBed.configureTestingModule({ providers: [
      MingleStore,
      { provide: EventsService, useValue: { queryMingleState: query } },
      { provide: I18nService, useValue: { translateParams: (key: string) => key } },
      { provide: MemberMenuStore, useValue: { requestActivitiesNavigation: navigate } },
      { provide: NotificationCenterStore, useValue: { unreadCount: unread } },
      { provide: ActivityStore, useValue: { activityEventRuntimeSync: signal(null) } },
      { provide: UiPollCoordinator, useValue: { run: (_priority: unknown, task: (context: object) => unknown) => task({}) } }
    ] });
    store = TestBed.inject(MingleStore);
    TestBed.tick();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('does not poll every five seconds without a live event; discovers one from the existing notification signal', async () => {
    store.activate('viewer');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(query).toHaveBeenCalledTimes(1);
    query.mockResolvedValue(state());
    unread.set(1);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.visible()).toBe(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('ticks the badge locally and freezes it while paused without requesting data on reads', async () => {
    query.mockResolvedValue(state());
    store.activate('viewer');
    await vi.advanceTimersByTimeAsync(0);
    await store.openCurrentTable();
    expect(store.countdown()).toBe('2:00');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(store.countdown()).toBe('1:59');
    const calls = query.mock.calls.length;
    for (let index = 0; index < 20; index++) store.countdown();
    expect(query).toHaveBeenCalledTimes(calls);
    query.mockResolvedValue({ ...state(), status: 'PAUSED', remainingSeconds: 83 });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(store.countdown()).toBe('1:23');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(store.countdown()).toBe('1:23');
  });

  it('opens waiting status without pretending the viewer belongs to a table', async () => {
    query.mockResolvedValue(state(true));
    store.activate('viewer');
    await vi.advanceTimersByTimeAsync(0);
    expect(store.visible()).toBe(true);
    expect(await store.openCurrentTable()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({
      mingleLive: true, ownerId: 'event-1', ownerType: 'event', canManage: false, viewOnly: true
    }));
    expect(store.attention()).toBe(false);
  });

  it('keeps the current assignment after a failed refresh and clears it immediately on account switch', async () => {
    query.mockResolvedValueOnce(state()).mockRejectedValue(new Error('offline'));
    store.activate('viewer');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(store.state()?.tableNumber).toBe(1);
    store.activate('another-user');
    expect(store.state()).toBeNull();
  });
});
