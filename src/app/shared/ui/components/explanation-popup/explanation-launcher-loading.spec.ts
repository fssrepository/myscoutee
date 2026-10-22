import { AppSetupStore } from '../../context/stores/app/app-setup.store';
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { ExplanationLauncherComponent } from './explanation-launcher.component';
import { ExplanationGuideService, PopupPresenceStore, IndicatorComponent } from '@fssrepository/myscoutee-components';
import { I18nService } from '../../../core/base/services/localization/i18n.service';

import { RouteDelayService } from '../../../core/base/services/platform/route-delay.service';

import { By } from '@angular/platform-browser';
import { PopupAdapterProxyService } from '../../context/popup-adapter-proxy.service';
import { POPUP_ADAPTER } from '../../context/popup-adapter-loaders';

@Component({ selector: 'test-guide', template: 'guide' })
class TestGuide {}
@Component({ selector: 'test-document', template: 'document' })
class TestDocument {}

describe('Guide launcher loading indication', () => {
  it('keeps the shade while loading the selected surface and reuses the component on reopening', async () => {
    const loading = signal(false);
    const open = signal(false);
    const visible = signal(false);
    const mode = signal('tour');
    let finish!: (module: unknown) => void;
    const load = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    TestBed.configureTestingModule({
      imports: [ExplanationLauncherComponent],
      providers: [
        { provide: AppSetupStore, useValue: { launcherVisible: () => false, guideRequested: () => false } },
        { provide: PopupAdapterProxyService, useValue: { load } },
        { provide: ExplanationGuideService, useValue: {
          popupOpen: open, loading, launcherVisible: () => false,
          hasVisiblePopup: visible, popupMode: mode, currentContextKey: () => 'landing.home'
        } },
        { provide: PopupPresenceStore, useValue: { topLayer: () => 0 } },
        { provide: RouteDelayService, useValue: { resolveDelayMs: () => 1500, resolveRequestTimeoutMs: () => 3000 } },
        { provide: I18nService, useValue: { translate: (key: string) => key, revision: signal(0) } }
      ]
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(ExplanationLauncherComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]')).toBeNull();
    expect(load).not.toHaveBeenCalled();
    open.set(true); loading.set(true);
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('[role=status]');
    expect(overlay?.getAttribute('aria-busy')).toBe('true');
    expect(overlay?.querySelector('.app-indicator--load-ring')).not.toBeNull();
    expect(overlay?.querySelector('.app-indicator-host--tone-bright')).not.toBeNull();
    expect(overlay?.querySelector('.app-indicator--spinner-ring')).toBeNull();
    expect(fixture.debugElement.query(By.directive(IndicatorComponent)).componentInstance.durationMs).toBe(3000);
    expect(fixture.nativeElement.querySelector('app-explanation-popup')).toBeNull();
    expect(load).not.toHaveBeenCalled();
    // Keep the same shade through lazy rendering and initial positioning.
    loading.set(false);
    fixture.detectChanges();
    expect(load).toHaveBeenCalledExactlyOnceWith(POPUP_ADAPTER.EXPLANATION_GUIDE);
    expect(fixture.nativeElement.querySelector('.explanation-guide-loading')).toBe(overlay);
    expect(overlay?.querySelector('app-indicator')).toBeNull();
    finish({ ExplanationGuideOverlayComponent: TestGuide });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('test-guide')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('test-document')).toBeNull();
    visible.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.explanation-guide-loading')).toBeNull();
    // Closing before the guide is ready must also release the shade.
    visible.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.explanation-guide-loading')).not.toBeNull();
    open.set(false); loading.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]')).toBeNull();
    expect(fixture.nativeElement.querySelector('test-guide')).toBeNull();
    open.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('test-guide')).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    mode.set('document');
    fixture.detectChanges();
    expect(load).toHaveBeenLastCalledWith(POPUP_ADAPTER.EXPLANATION_DOCUMENT);
    expect(fixture.nativeElement.querySelector('test-guide')).toBeNull();
    finish({ ExplanationPopupComponent: TestDocument });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('test-document')).not.toBeNull();
    fixture.destroy();
    TestBed.resetTestingModule();
  });
});
