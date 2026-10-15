import type { CommunityCase } from '../../../core/contracts/community/community-case.interface';
import { TestBed } from '@angular/core/testing';
import { CalendarCardComponent, CalendarCardConverter, type SmartListCalendarConfig } from '@fssrepository/myscoutee-components';
import { CommunityCaseConverter } from '../../converters/community/community-case.converter';
import { ActivityEventInfoCardConverter } from '../../converters/event/activity-event-info-card.converter';

describe('Calendar card selection and configured surface', () => {
  const item = {id: 'case-task', title: 'Meter replacement'};
  const start = new Date(2026, 9, 14, 10), end = new Date(2026, 9, 14, 11);
  afterEach(() => TestBed.resetTestingModule());

  it.each(['week', 'month'] as const)('%s preserves inert cells and selectable badges with the configured status colors', mode => {
    const selected = vi.fn();
    const day = {key: '2026-10-14', date: start, dayNumber: 14, inCurrentMonth: true, isToday: false, items: [item]};
    const page = {key: day.key, label: 'October', anchor: start, days: [day], weeks: [
      {start, end, days: [day], spans: [{key: item.id, item, startCol: 0, endCol: 0, lane: 0}]}
    ]};
    const resolveColor = vi.fn(() => 'selected');
    const config: SmartListCalendarConfig<typeof item> = {
      resolveDateRange: () => ({start, end}), badgeLabel: row => row.title,
      badgeToneClass: () => 'calendar-badge-tone-1',
      badgeColors: {palette: {selected: {badgeTone: 'stage-scheduled'}}, resolveKey: resolveColor}
    };
    TestBed.configureTestingModule({imports: [CalendarCardComponent]});
    const fixture = TestBed.createComponent(CalendarCardComponent);
    const model = CalendarCardConverter.convert({viewMode: mode, pages: [page], calendar: config,
      query: {page: 0, pageSize: 20}, variant: 'default', touching: false, onItemSelect: selected});
    fixture.componentRef.setInput('model', model);
    fixture.detectChanges();
    const colorCalls = resolveColor.mock.calls.length;
    for (let i = 0; i < 20; i++) fixture.detectChanges();
    expect(resolveColor).toHaveBeenCalledTimes(colorCalls);
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLElement>(mode === 'week' ? '.smart-list__week-hour-slot' : '.smart-list__month-cell')!.click();
    expect(selected).not.toHaveBeenCalled();
    const badge = root.querySelector<HTMLButtonElement>('.smart-list__calendar-badge')!;
    expect(badge.classList.contains('calendar-badge-color-stage-scheduled')).toBe(true);
    expect(badge.style.getPropertyValue('--ui-info-card-accent-hue')).toBe('');
    badge.click();
    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected.mock.calls[0][0]).toBe(item);

    fixture.componentRef.setInput('model', {...model, config: {...config, badgeColors: {palette: {selected: {surfaceTone: 'subevent-light', accentHue: 175}}, resolveKey: () => 'selected'}}});
    fixture.detectChanges();
    expect(badge.classList.contains('calendar-badge-color-stage-scheduled')).toBe(false);
    expect(badge.classList.contains('ui-info-card--tone-subevent-light')).toBe(true);
    expect(badge.style.getPropertyValue('--ui-info-card-accent-hue')).toBe('175');

    fixture.componentRef.setInput('model', {...model, config: {...config, badgeColors: {...config.badgeColors!, resolveKey: () => 'missing'}}});
    fixture.detectChanges();
    expect(badge.classList.contains('calendar-badge-tone-1')).toBe(true);
    expect(badge.classList.contains('ui-info-card--tone-subevent-light')).toBe(false);
    expect(badge.style.getPropertyValue('--ui-info-card-accent-hue')).toBe('');
    fixture.componentRef.setInput('model', {...model, config: {...config, badgeColors: undefined}});
    fixture.detectChanges();
    expect(badge.classList.contains('calendar-badge-tone-1')).toBe(true);
  });
  it('renders five month badges beside a dense counter, clips crossing spans, and passes the selected day', () => {
    const selected = vi.fn();
    const rows = Array.from({length: 5}, (_, i) => ({id: `s${i}`, title: `Sparse ${i}`}));
    const summary = {id: 'summary', title: 'Dense'};
    const days = [0, 1, 2].map(offset => ({key: `2026-10-${14 + offset}`, date: new Date(2026, 9, 14 + offset),
      dayNumber: 14 + offset, inCurrentMonth: true, isToday: false, items: offset === 1 ? [summary] : rows}));
    const spans = rows.map((row, i) => ({key: row.id, item: row, startCol: 0, endCol: 2, lane: i}));
    const page = {key: 'month', label: 'October', anchor: start, weeks: [{start, end, days, spans}]};
    const config: SmartListCalendarConfig<typeof item> = {resolveDateRange: () => ({start, end}),
      density: {monthMaxBadges: 5}, dayCounter: day => day.key === days[1].key ? {label: '300', colorKey: 'dense'} : null,
      badgeColors: {palette: {dense: {badgeTone: 'stage-review'}}, resolveKey: () => null}};
    const fixture = TestBed.createComponent(CalendarCardComponent);
    fixture.componentRef.setInput('model', CalendarCardConverter.convert({viewMode: 'month', pages: [page], calendar: config,
      query: {page: 0, pageSize: 20}, variant: 'default', touching: false, onItemSelect: selected}));
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('.smart-list__calendar-badge')).toHaveLength(10);
    const counters = root.querySelectorAll<HTMLButtonElement>('.smart-list__month-counter');
    expect(counters).toHaveLength(1);
    expect(counters[0].textContent?.trim()).toBe('300');
    expect(counters[0].classList.contains('calendar-badge-color-stage-review')).toBe(true);
    counters[0].click();
    expect(selected.mock.calls[0][2].calendarDateIso).toBe('2026-10-15');
  });

  it('replaces only the dense weekly hour and preserves the sparse timed portion', () => {
    const dayStart = new Date(2026, 9, 14);
    const long = {id: 'long', title: 'Long'};
    const summary = {id: 'summary', title: 'Two slots'};
    const day = {key: '2026-10-14', date: dayStart, dayNumber: 14, inCurrentMonth: true, isToday: false, items: [long, summary]};
    const config: SmartListCalendarConfig<typeof item> = {
      resolveDateRange: row => ({start: new Date(2026, 9, 14, row.id === 'long' ? 9 : 10), end: new Date(2026, 9, 14, 11)}),
      density: {weekMaxBadgesPerHour: 1}, hourCounter: (_day, hour) => hour === 10 ? {label: '2', colorKey: 'dense'} : null,
      badgeColors: {palette: {dense: {surfaceTone: 'subevent-light', accentHue: 150}}, resolveKey: () => null}
    };
    const selected = vi.fn();
    const fixture = TestBed.createComponent(CalendarCardComponent);
    const page = {key: 'week', label: 'Week', anchor: dayStart, days: [day]};
    fixture.componentRef.setInput('model', CalendarCardConverter.convert({viewMode: 'week', pages: [page], calendar: config,
      query: {page: 0, pageSize: 20}, variant: 'default', touching: false, onItemSelect: selected}));
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const badges = root.querySelectorAll<HTMLElement>('.smart-list__week-timed-badge');
    expect(badges).toHaveLength(1);
    expect(Number.parseFloat(badges[0].style.height)).toBeCloseTo(100 / 24);
    const counter = root.querySelector<HTMLButtonElement>('.smart-list__week-hour-counter')!;
    expect(counter.textContent?.trim()).toBe('2');
    expect(counter.style.getPropertyValue('--ui-info-card-accent-hue')).toBe('150');
    counter.click();
    expect(selected.mock.calls[0][2].calendarDateIso).toBe(day.key);
    root.querySelector<HTMLElement>('.smart-list__week-hour-slot')!.click();
    expect(selected).toHaveBeenCalledTimes(1);
  });

  it('projects one case badge per dated task, excluding deleted, undated and out-of-range tasks', () => {
    const task = {id: 'first', title: 'First', status: 'todo', startAtIso: '2026-10-14T10:00:00Z', endAtIso: '2026-10-14T11:00:00Z'};
    const c = {id: 'case', title: 'Meter replacement', caseType: 'meter-replacement', status: 'open', boardTasks: [
      task, {...task, id: 'second', endAtIso: null}, {...task, id: 'deleted', status: 'deleted'},
      {...task, id: 'undated', startAtIso: null}, {...task, id: 'outside', startAtIso: '2026-09-14T10:00:00Z', endAtIso: '2026-09-14T11:00:00Z'},
      {...task, id: 'overlap', startAtIso: '2026-10-13T23:00:00Z', endAtIso: '2026-10-14T01:00:00Z'}
    ]} as CommunityCase;
    const cards = CommunityCaseConverter.calendarCards(c, {page: 0, pageSize: 20, rangeStart: '2026-10-14', rangeEnd: '2026-10-14'});
    expect(cards.map(card => card.id)).toEqual(['case:first', 'case:second', 'case:overlap']);
    expect(cards.every(card => card.eagerDetail === c)).toBe(true);
    expect(c.boardTasks).toHaveLength(6);
  });
  it('keeps business precedence in the caller palette and resolver', () => {
    const resolve = CommunityCaseConverter.calendarColorKey.bind(CommunityCaseConverter);
    expect(resolve('open', 'meter-replacement')).toBe('status:open');
    expect(resolve(undefined, 'meter-replacement')).toBe('category:meter-replacement');
    expect(resolve(undefined, undefined)).toBeNull();
    expect(CommunityCaseConverter.calendarColors['status:open']).toEqual({badgeTone: 'stage-scheduled'});
    const card = CommunityCaseConverter.card({id: 'case', title: 'Meter replacement', caseType: 'meter-replacement', status: 'open', boardTasks: []} as unknown as CommunityCase);
    expect(card.accentHue).toBe(175);
    expect(card.surfaceTone).toBe('subevent-light');
    expect(card.mediaEnd?.tone).toBe('stage-scheduled');
    expect(CommunityCaseConverter.calendarColors['category:meter-replacement'].accentHue).toBe(175);
    expect(ActivityEventInfoCardConverter.calendarColors['published']).toEqual({surfaceTone: 'published'});
    expect(ActivityEventInfoCardConverter.calendarColors['default']).toBeUndefined();
  });

});
