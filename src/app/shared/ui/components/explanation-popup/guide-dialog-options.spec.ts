import { TestBed } from '@angular/core/testing';
import { myScouteeTourDialogOptions } from './guide-dialog-options';
import { signal } from '@angular/core';
import { AppSetupStore } from '../../context/stores/app/app-setup.store';

describe('Application guide dialog bindings', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('retains launcher introduction ownership above a consent popup and normal popup ownership afterward', () => {
    TestBed.configureTestingModule({ providers: [{ provide: AppSetupStore, useValue: { guideRequested: signal(false) } }] });
    const options = TestBed.runInInjectionContext(myScouteeTourDialogOptions);
    const launcher = document.createElement('app-explanation-launcher');
    const introduction = document.createElement('div');
    introduction.dataset['guideSurface'] = 'landing.guide';
    launcher.append(introduction);
    const popup = document.createElement('section');
    popup.className = 'ui-popup';
    popup.style.zIndex = '100';
    const consent = document.createElement('div');
    consent.dataset['guideSurface'] = 'landing.consent';
    popup.append(consent);
    document.body.append(launcher, popup);
    try {
      expect(options.resolveSurface?.('landing.guide', () => true)).toBe(introduction);
      expect(options.resolveSurface?.('landing.consent', () => true)).toBe(popup);
      expect(options.resolveSurface?.('some.application.popup', () => true)).toBe(popup);
    } finally {
      launcher.remove(); popup.remove();
    }
  });

  it('consumes a setup request only after the shared dialog selects its external launcher', () => {
    const guideRequested = signal(true);
    TestBed.configureTestingModule({ providers: [{ provide: AppSetupStore, useValue: { guideRequested } }] });
    const options = TestBed.runInInjectionContext(myScouteeTourDialogOptions);
    expect(options.requestedStepId?.()).toBe('setup-launcher');
    expect(guideRequested()).toBe(true);
    options.onRequestedStepSelected?.('setup-launcher');
    expect(guideRequested()).toBe(false);
    expect(options.requestedStepId?.()).toBeNull();
    expect(options.trailingStepIds).toEqual(['close', 'setup-launcher']);
  });

});
