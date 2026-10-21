import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { EventSubeventsPopupStore } from './event-subevents-popup.store';

describe('Subevents calendar selection state', () => {
  it('opens immediately and keeps date-input identity stable across repeated selection', () => {
    const store = TestBed.runInInjectionContext(() => new EventSubeventsPopupStore());
    store.openEventSubeventsListPopup({eventId: 'event', title: 'Event'});
    expect(store.eventSubeventsListPopup()?.eventId).toBe('event');
    store.selectCalendarRange('2027-02-09');
    const selection = store.calendarSelection();
    expect(selection).toEqual({view: 'day', dateRange: {startAt: '2027-02-09', endAt: '2027-02-09', precision: 'date'}});
    for (let i = 0; i < 100; i++) {
      store.selectCalendarRange('2027-02-09');
      expect(store.calendarSelection()).toBe(selection);
      expect(store.calendarSelection().dateRange).toBe(selection.dateRange);
    }
  });
  it('clears the day filter on view change, close and opening another event', () => {
    const store = TestBed.runInInjectionContext(() => new EventSubeventsPopupStore());
    store.openEventSubeventsListPopup({eventId: 'first'});
    store.selectCalendarRange('2027-02-09');
    store.selectListView('week');
    expect(store.calendarSelection()).toEqual({view: 'week', dateRange: null});
    store.selectCalendarRange('2027-02-10', '2027-02-11');
    store.openEventSubeventsListPopup({eventId: 'second'});
    expect(store.calendarSelection()).toEqual({view: 'day', dateRange: null});
    store.selectCalendarRange('2027-02-12');
    store.closeEventSubeventsListPopup();
    expect(store.eventSubeventsListPopup()).toBeNull();
    expect(store.calendarSelection().dateRange).toBeNull();
  });
});
