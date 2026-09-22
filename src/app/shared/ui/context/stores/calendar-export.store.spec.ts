import '@angular/compiler';
import { DOCUMENT } from '@angular/common';
import { createEnvironmentInjector, runInInjectionContext, signal, type EnvironmentInjector } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsService } from '../../../core/base/services/events.service';
import { UserProfileStore } from './user-profile.store';
import { DialogStore } from './dialog.store';
import { CalendarExportStore } from './calendar-export.store';

vi.mock('../../../core/base/services/events.service', () => ({ EventsService: class {} }));
vi.mock('./user-profile.store', () => ({ UserProfileStore: class {} }));

describe('Calendar download request lifecycle', () => {
  let injector: EnvironmentInjector;
  let store: CalendarExportStore;
  const actor = signal('viewer');
  const exportCalendar = vi.fn();
  const openInfo = vi.fn();
  const click = vi.fn(), remove = vi.fn(), appendChild = vi.fn();
  const anchor = { href: '', download: '', click, remove };
  const content = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';

  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); actor.set('viewer');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:calendar');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    injector = createEnvironmentInjector([
      { provide: EventsService, useValue: { exportCalendar } },
      { provide: UserProfileStore, useValue: { activeUserId: actor } },
      { provide: DialogStore, useValue: { openInfo } },
      { provide: DOCUMENT, useValue: { body: { appendChild }, createElement: () => anchor } }
    ], null as unknown as EnvironmentInjector);
    store = runInInjectionContext(injector, () => new CalendarExportStore());
  });
  afterEach(() => { injector.destroy(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('waits for one request, downloads once and releases the object URL', async () => {
    let finish!: (text: string) => void;
    exportCalendar.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
    const pending = store.download();
    await store.download();
    expect(exportCalendar).toHaveBeenCalledTimes(1); expect(click).not.toHaveBeenCalled();
    expect(store.downloading()).toBe(true);
    finish(content); await pending;
    expect(click).toHaveBeenCalledTimes(1); expect(anchor.download).toBe('myscoutee-calendar.ics');
    expect(store.downloading()).toBe(false); expect(remove).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60_000); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:calendar');
  });
  it('does not download the prior account data after an account change', async () => {
    let finish!: (text: string) => void;
    exportCalendar.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
    const pending = store.download(); actor.set('other'); finish(content); await pending;
    expect(click).not.toHaveBeenCalled(); expect(store.downloading()).toBe(false);
  });
  it('rejects an HTML response and permits retry after a failed request', async () => {
    exportCalendar.mockResolvedValueOnce('<html>Login</html>').mockResolvedValueOnce(content);
    await store.download(); expect(click).not.toHaveBeenCalled(); expect(openInfo).toHaveBeenCalledOnce();
    await store.download(); expect(click).toHaveBeenCalledOnce(); expect(store.downloading()).toBe(false);
  });
  it('aborts a stalled HTTP request and clears the ring', async () => {
    exportCalendar.mockImplementationOnce((signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('timeout')));
    }));
    const pending = store.download(); vi.advanceTimersByTime(30_000); await pending;
    expect(openInfo).toHaveBeenCalledOnce(); expect(click).not.toHaveBeenCalled();
    expect(store.downloading()).toBe(false);
  });
});
