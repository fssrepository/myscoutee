import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ExplanationLauncherComponent } from './explanation-launcher.component';
import { ExplanationGuideService } from '../../../core/base/services/explanation-guide.service';
import { I18nService } from '../../../core/base/services/i18n.service';
import { PopupPresenceStore } from '../../context/stores/popup-presence.store';
import { RouteDelayService } from '../../../core/base/services/route-delay.service';
import { IndicatorComponent } from '../core/indicator';
import { By } from '@angular/platform-browser';

describe('Guide launcher loading indication', () => {
  it('renders the shared ring while content is pending, before the deferred popup, and removes it on close', async () => {
    const loading = signal(false);
    const open = signal(false);
    const visible = signal(false);
    TestBed.configureTestingModule({
      imports: [ExplanationLauncherComponent],
      providers: [
        { provide: ExplanationGuideService, useValue: {
          popupOpen: open, loading, launcherVisible: () => false,
          hasVisiblePopup: visible, currentContextKey: () => 'landing.home'
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
    open.set(true); loading.set(true);
    fixture.detectChanges();
    const overlay = fixture.nativeElement.querySelector('[role=status]');
    expect(overlay?.getAttribute('aria-busy')).toBe('true');
    expect(overlay?.querySelector('.app-indicator--load-ring')).not.toBeNull();
    expect(overlay?.querySelector('.app-indicator-host--tone-bright')).not.toBeNull();
    expect(overlay?.querySelector('.app-indicator--spinner-ring')).toBeNull();
    expect(fixture.debugElement.query(By.directive(IndicatorComponent)).componentInstance.durationMs).toBe(3000);
    expect(fixture.nativeElement.querySelector('app-explanation-popup')).toBeNull();
    // The data response precedes the tour's first positioned frame.
    loading.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.explanation-guide-loading')).toBe(overlay);
    visible.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.explanation-guide-loading')).toBeNull();
    open.set(false); loading.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=status]')).toBeNull();
    fixture.destroy();
    TestBed.resetTestingModule();
  });
});
