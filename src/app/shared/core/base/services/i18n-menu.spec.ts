import { TestBed } from '@angular/core/testing';

import { I18nService } from '../..';
import { AppMenuComponent, type AppMenuDragEvent } from '@fssrepository/myscoutee-components';

describe('MyScoutee menu translation scanning', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({matches: window.innerWidth <= Number(query.match(/max-width: (\d+)px/)?.[1] ?? 0), media: query, addEventListener() {}, removeEventListener() {}}));
    TestBed.configureTestingModule({imports: [AppMenuComponent]});
  });
  afterEach(() => {TestBed.resetTestingModule(); vi.unstubAllGlobals();});
  it.each([360, 1100])('keeps the Hungarian children label after the DOM translation scan at width %s', width => {
    vi.stubGlobal('innerWidth', width);
    const messages: Record<string, string> = { 'profile.children.has': 'Van', van: 'Furgon' };
    const i18n = Object.assign(Object.create(I18nService.prototype), {
      document,
      messagesSignal: () => messages,
      currentLanguageSignal: () => 'hu',
      sourceMessagesSignal: () => ({}),
      sourceKeyByTextSignal: () => ({}),
      textNodeSources: new WeakMap(), attributeSources: new WeakMap(),
      revision: () => 0,
      translate: (value: string) => messages[value] ?? value,
      translateParams: (value: string) => value
    });
    TestBed.overrideProvider(I18nService, {useValue: i18n});
    const fixture = TestBed.createComponent(AppMenuComponent);
    fixture.componentRef.setInput('kind', 'select');
    fixture.componentRef.setInput('panelMode', 'sheet');
    fixture.componentRef.setInput('items', [{id: 'yes', value: 'Yes', label: 'profile.children.has', kind: 'radio'}]);
    fixture.componentInstance.open = true;
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const label = fixture.nativeElement.querySelector('.app-menu__item-label') as HTMLElement;
    expect(label.textContent?.trim()).toBe('Van');
    i18n.scanDom();
    expect(label.textContent?.trim()).toBe('Van');
    expect(i18n.translateRaw('van')).toBe('Furgon');
  });

});
