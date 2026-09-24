import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../core/base/services/i18n.service';
import { AppMenuComponent } from '../core/menu/menu.component';
import { navigatorContentMenuModel, navigatorTableMenuModel } from './side-menu-presenters';

describe('navigator content actions', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [AppMenuComponent],
    providers: [{ provide: I18nService, useValue: {
      revision: () => 0, translate: (key: string) => key
    } }]
  }));
  afterEach(() => TestBed.resetTestingModule());
  it.each(['feed', 'followed'] as const)('keeps %s clickable when its counter is zero and after a poll clears it', id => {
    const fixture = TestBed.createComponent(AppMenuComponent);
    fixture.componentRef.setInput('kind', 'inline');
    const selected = vi.fn();
    fixture.componentInstance.itemSelect.subscribe(selected);
    for (const count of [0, 3, 0]) {
      fixture.componentRef.setInput('model', navigatorContentMenuModel(id, count));
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button.disabled).toBe(false);
      expect(button.textContent).toContain(id === 'feed' ? 'feed.title' : 'event.following');
      const badge = button.querySelector('.app-menu__counter');
      if (count) expect(badge?.textContent?.trim()).toBe('3');
      else expect(badge).toBeNull();
      button.click();
      expect(selected).toHaveBeenLastCalledWith(expect.objectContaining({ id }));
    }
  });
  it('renders the waiting/assigned table action and clears only its attention badge', () => {
    const fixture = TestBed.createComponent(AppMenuComponent);
    fixture.componentRef.setInput('kind', 'inline');
    const selected = vi.fn();
    fixture.componentInstance.itemSelect.subscribe(selected);
    for (const [label, attention] of [['Tables', false], ['Table 4', true], ['Table 4', false]] as const) {
      fixture.componentRef.setInput('model', navigatorTableMenuModel(label, attention));
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button.disabled).toBe(false);
      expect(button.textContent).toContain(label);
      expect(button.querySelector('mat-icon')?.textContent).toContain('table_restaurant');
      expect(button.querySelector('.app-menu__counter') !== null).toBe(attention);
      button.click();
      expect(selected).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'table' }));
    }
  });

});
