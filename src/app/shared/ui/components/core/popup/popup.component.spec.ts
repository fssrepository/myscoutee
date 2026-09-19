import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PopupComponent } from './popup.component';
import { PopupPresenceStore } from '../../../context/stores/popup-presence.store';
import { I18nService } from '../../../../core/base/services/i18n.service';

@Component({ imports: [PopupComponent], template: `
  <app-popup [active]="open()" [model]="{title: 'Profile'}"><input value="cached"></app-popup>
` })
class RetainedPopup { open = signal(true); }

describe('retained popup visibility', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('keeps content while releasing the modal layer and hidden-popup selector on close', () => {
    TestBed.configureTestingModule({ imports: [RetainedPopup], providers: [
      { provide: I18nService, useValue: { revision: () => 0, translate: (text: string) => text } }
    ] });
    const fixture = TestBed.createComponent(RetainedPopup);
    const presence = TestBed.inject(PopupPresenceStore);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(presence.visible()).toBe(true);
    fixture.componentInstance.open.set(false); fixture.detectChanges();
    expect(presence.visible()).toBe(false);
    expect(fixture.nativeElement.querySelector('.ui-popup')).toBeNull();
    expect(fixture.nativeElement.querySelector('input')).toBe(input);
    expect(input.closest('[style]').style.display).toBe('none');
    fixture.componentInstance.open.set(true); fixture.detectChanges();
    expect(presence.visible()).toBe(true);
    expect(fixture.nativeElement.querySelector('.ui-popup input')).toBe(input);
    fixture.destroy(); expect(presence.visible()).toBe(false);
  });
});
