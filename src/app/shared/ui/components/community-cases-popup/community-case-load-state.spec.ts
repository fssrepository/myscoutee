import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ExplanationGuideService, SmartListComponent, UI_TRANSLATIONS } from '@fssrepository/myscoutee-components';
import { CommunityCasesPopupComponent } from './community-cases-popup.component';
import { CommunityCasesStore } from '../../context/stores/community/community-cases.store';
import { I18nService } from '../../../core/base/services/localization/i18n.service';

describe('Case task board initial failure surface', () => {
  const store = {
    session: signal({ userId: 'actor', list: false, tasks: false }), board: signal(null),
    quotations: signal(null), editor: signal(null), error: signal('case.load.failed'),
    changed: signal(null), taskChanged: signal(null), close: vi.fn(),
    taskCounters: signal({active: 0, paused: 0, trash: 0, total: 0})
  };
  beforeEach(() => {
    store.error.set('case.load.failed');
    TestBed.configureTestingModule({
      imports: [CommunityCasesPopupComponent, SmartListComponent],
      providers: [
        { provide: CommunityCasesStore, useValue: store },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: ExplanationGuideService, useValue: { popupOpen: () => false } },
        { provide: UI_TRANSLATIONS, useValue: { revision: signal(0), translate: (key: string) => key } }
      ]
    });
  });
  afterEach(() => TestBed.resetTestingModule());

  it('shows the read error in the shared body card, without a form error or an underlying Cases list', () => {
    const fixture = TestBed.createComponent(CommunityCasesPopupComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const card = element.querySelector('app-smart-list-empty-state');
    expect(card?.getAttribute('role')).toBe('alert');
    expect(card?.textContent).toContain('case.load.failed');
    expect(element.querySelector('app-smart-list')).toBeNull();
    expect(element.querySelector('.ui-popup__error')).toBeNull();
    expect(element.textContent).not.toContain('case.save.failed');
    fixture.destroy();
  });

  it('routes scheduled-list read errors to SmartList instead of the popup form alert', () => {
    store.error.set('case.tasks.load.failed');
    const fixture = TestBed.createComponent(CommunityCasesPopupComponent);
    expect(fixture.componentInstance['taskLoadError']()).toBe('case.tasks.load.failed');
    expect(fixture.componentInstance['tasksModel']().errorMessage).toBeNull();
    store.error.set('case.save.failed');
    expect(fixture.componentInstance['taskLoadError']()).toBeNull();
    expect(fixture.componentInstance['tasksModel']().errorMessage).toBe('case.save.failed');
    fixture.destroy();
  });

  it('preserves the ordinary SmartList empty card and start placement', () => {
    const fixture = TestBed.createComponent(SmartListComponent);
    fixture.componentRef.setInput('config', { emptyLabel: 'No tasks in this column.', emptyPlacement: 'start' });
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.smart-list__empty');
    expect(card?.textContent).toContain('No tasks in this column.');
    expect(card?.classList.contains('smart-list__empty--start')).toBe(true);
    expect(card?.classList.contains('smart-list__empty--error')).toBe(false);
    fixture.destroy();
  });
});
