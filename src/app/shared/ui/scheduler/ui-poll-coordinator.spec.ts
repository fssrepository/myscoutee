import { TestBed } from '@angular/core/testing';

import { PopupPresenceStore } from '../context/stores/popup-presence.store';
import { UiPollCoordinator } from './ui-poll-coordinator';

describe('UiPollCoordinator', () => {
  let coordinator: UiPollCoordinator;
  let popupPresenceStore: PopupPresenceStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    coordinator = TestBed.inject(UiPollCoordinator);
    popupPresenceStore = TestBed.inject(PopupPresenceStore);
  });

  it('runs only one queued poll task at a time', async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });

    const first = coordinator.run('foreground', async () => {
      order.push('first:start');
      await firstGate;
      order.push('first:end');
    });
    const second = coordinator.run('foreground', () => {
      order.push('second');
    });

    await Promise.resolve();
    expect(order).toEqual(['first:start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first:start', 'first:end', 'second']);
  });

  it('gives an open popup ownership over background polling', async () => {
    const popupToken = popupPresenceStore.register();
    const backgroundTask = vi.fn();
    const foregroundTask = vi.fn();

    await coordinator.run('background', backgroundTask);
    await coordinator.run('foreground', foregroundTask);

    expect(backgroundTask).not.toHaveBeenCalled();
    expect(foregroundTask).toHaveBeenCalledOnce();
    popupPresenceStore.unregister(popupToken);
  });
});
