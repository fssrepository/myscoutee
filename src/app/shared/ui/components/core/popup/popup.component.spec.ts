import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PopupComponent } from './popup.component';
import { PopupPresenceStore } from '../../../context/stores/popup-presence.store';
import { I18nService } from '../../../../core/base/services/i18n.service';

@Component({ imports: [PopupComponent], template: `
  <app-popup [active]="open()" [model]="{title: 'Profile'}"><input value="cached"></app-popup>
` })
class RetainedPopup { open = signal(true); }

@Component({ imports: [PopupComponent], template: `
  <app-popup [model]="{title: 'Parent'}"><input value="draft"></app-popup>
  @if (childOpen()) {
    <app-popup [model]="{title: 'Child'}" (close)="childOpen.set(false)">Details</app-popup>
  }
` })
class StackedPopups { childOpen = signal(false); }

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

describe('stacked popup backdrop', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('keeps the parent and its draft visible beneath the child, then closes only the child', () => {
    TestBed.configureTestingModule({ imports: [StackedPopups], providers: [
      { provide: I18nService, useValue: { revision: () => 0, translate: (text: string) => text } }
    ] });
    const fixture = TestBed.createComponent(StackedPopups);
    const presence = TestBed.inject(PopupPresenceStore);
    fixture.detectChanges();
    const parent = fixture.nativeElement.querySelector('.ui-popup') as HTMLElement;
    const input = parent.querySelector('input')!;
    input.value = 'unsaved edit';
    const parentLayer = presence.topLayer();

    fixture.componentInstance.childOpen.set(true);
    fixture.detectChanges();
    const popups = fixture.nativeElement.querySelectorAll('.ui-popup') as NodeListOf<HTMLElement>;
    expect(popups).toHaveLength(2);
    expect(popups[0]).toBe(parent);
    expect(getComputedStyle(parent).display).not.toBe('none');
    expect(getComputedStyle(parent).visibility).toBe('visible');
    expect(Number(popups[1].style.zIndex)).toBeGreaterThan(parentLayer);
    const backdrop = popups[1].querySelector('.ui-popup__backdrop') as HTMLElement;
    expect(getComputedStyle(backdrop).backgroundColor).toBe('rgba(233, 237, 245, 0.56)');
    backdrop.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.ui-popup')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('input')).toBe(input);
    expect(input.value).toBe('unsaved edit');
    expect(presence.topLayer()).toBe(parentLayer);
    fixture.destroy();
  });
});
