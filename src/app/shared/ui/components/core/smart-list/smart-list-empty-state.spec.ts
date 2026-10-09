import { CommonModule } from '@angular/common';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ExplanationGuideService } from '../../../../core/base/services/explanation-guide.service';
import { I18nService } from '../../../../core/base/services/i18n.service';
import { I18nPipe } from '../../../pipes/i18n.pipe';
import { SmartListComponent } from './smart-list.component';
import { IndicatorComponent } from '../indicator';
import type { PageResult, SmartListConfig } from './smart-list.types';

describe('SmartList existing empty states', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SmartListComponent],
      providers: [
        { provide: ExplanationGuideService, useValue: { popupOpen: () => false } },
        { provide: I18nService, useValue: { revision: signal(0), translate: (key: string) => key } }
      ]
    }).overrideComponent(SmartListComponent, {
      set: { imports: [CommonModule, I18nPipe, IndicatorComponent], schemas: [NO_ERRORS_SCHEMA] }
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  function render(config: SmartListConfig<unknown>, initialLoading = false) {
    const fixture = TestBed.createComponent(SmartListComponent);
    Object.assign(fixture.componentInstance, { config, initialLoading, loading: initialLoading, currentViewMode: 'list' });
    fixture.detectChanges();
    return fixture;
  }

  it.each(['vertical', 'horizontal'] as const)('retains configured empty content in a three-column %s list', orientation => {
    const fixture = render({ listLayout: 'card-grid', desktopColumns: 3, orientation,
      emptyLabel: 'No notifications', emptyDescription: 'Your notifications will appear here.' });
    expect(fixture.nativeElement.querySelector('.smart-list--desktop-columns-3')).not.toBeNull();
    const empty = fixture.nativeElement.querySelector('.smart-list__empty');
    expect(empty?.textContent).toContain('No notifications');
    expect(empty?.textContent).toContain('Your notifications will appear here.');
    fixture.destroy();
  });

  it('keeps the default empty message inside an empty carousel', () => {
    const fixture = render({ listLayout: 'card-grid', orientation: 'horizontal', compactHorizontal: true, desktopColumns: 1 });
    const list = fixture.nativeElement.querySelector('.smart-list--horizontal');
    expect(list).not.toBeNull();
    expect(list.querySelector('.smart-list__empty')?.textContent).toContain('No items');
    fixture.destroy();
  });

  it('keeps the carousel mounted while its initial load is pending', () => {
    const fixture = render({ listLayout: 'card-grid', orientation: 'horizontal', compactHorizontal: true, desktopColumns: 1 }, true);
    const list = fixture.nativeElement.querySelector('.smart-list--horizontal');
    expect(list).not.toBeNull();
    expect(list.querySelector('.smart-list__empty')).toBeNull();
    fixture.destroy();
  });

  it('preserves the bar for lists using the existing default indicator', () => {
    const fixture = render({ headerProgress: { enabled: true } }, true);
    expect(fixture.nativeElement.querySelector('.app-indicator--bar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.app-indicator--load-ring')).toBeNull();
    fixture.destroy();
  });

  it.each([true, false])('keeps loading visible independently of showEmptyState=%s', async showEmptyState => {
    const result = new Subject<PageResult<unknown>>();
    const fixture = TestBed.createComponent(SmartListComponent);
    const loadPage = vi.fn(() => result.asObservable());
    fixture.componentRef.setInput('config', {
      listLayout: 'card-grid', orientation: 'horizontal', compactHorizontal: true,
      initialPageCount: 1, headerProgress: { enabled: true }, showEmptyState
    });
    fixture.componentRef.setInput('loadPage', loadPage);
    fixture.detectChanges();
    expect(loadPage).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.smart-list--horizontal')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.app-indicator--bar.is-state-loading')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.smart-list__empty')).toBeNull();

    result.next({ items: [], total: 0, nextCursor: null });
    await vi.waitFor(() => expect(fixture.componentInstance['initialLoading']).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.smart-list--horizontal')).not.toBeNull();
    const empty = fixture.nativeElement.querySelector('.smart-list__empty');
    if (showEmptyState) {
      expect(empty?.textContent).toContain('No items');
    } else {
      expect(empty).toBeNull();
    }
    fixture.destroy();
  });

  it('removes the carousel load ring when card data arrives, without leaving a progress bar', async () => {
    const result = new Subject<PageResult<unknown>>();
    const fixture = TestBed.createComponent(SmartListComponent);
    fixture.componentRef.setInput('config', {
      listLayout: 'card-grid', orientation: 'horizontal', compactHorizontal: true,
      showEmptyState: false, initialPageCount: 1,
      headerProgress: { enabled: true, kind: 'load-ring', tone: 'bright' }
    });
    fixture.componentRef.setInput('loadPage', () => result.asObservable());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.smart-list--horizontal')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.smart-list__header-progress-shell--centered .app-indicator--load-ring')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.app-indicator-host--tone-bright')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.app-indicator__load-ring-progress.is-timed')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-indicator').style.getPropertyValue('--app-indicator-duration')).toBe('3000ms');
    expect(fixture.nativeElement.querySelector('.app-indicator--bar')).toBeNull();

    result.next({ items: [{ id: 'slide' }], total: 1, nextCursor: null });
    await vi.waitFor(() => expect(fixture.componentInstance['initialLoading']).toBe(false));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.smart-list--horizontal')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.smart-list__header-progress-shell')).toBeNull();
    expect(fixture.nativeElement.querySelector('.smart-list__empty')).toBeNull();
    fixture.destroy();
  });
});
