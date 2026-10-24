import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { type UiBranding as DeploymentBrandingDto } from '@fssrepository/myscoutee-components';
import { DEFAULT_DEPLOYMENT_BRANDING, DEFAULT_DEPLOYMENT_PRIVACY_CONTACT, DEFAULT_DEPLOYMENT_SOCIAL_LINKS } from './shared/core/contracts';
import { DeploymentConfigurationService } from './shared/core/base/services/platform/deployment-configuration.service';

import { App } from './app';
import { routes } from './app.routes';
import { AppSetupStore } from './shared/ui/context/stores/app/app-setup.store';
import { PaymentAuthorizationService } from './shared/core/base/services/payments/payment-authorization.service';
import { PopupAdapterProxyService } from './shared/ui/context/popup-adapter-proxy.service';
import { POPUP_ADAPTER } from './shared/ui/context/popup-adapter-loaders';

@Component({ selector: 'test-setup-popup', template: 'setup' })
class SetupPopup {}
@Component({ selector: 'test-payment-popup', template: 'payment' })
class PaymentPopup {}

describe('App', () => {
  let branding: WritableSignal<DeploymentBrandingDto>;

  beforeEach(async () => {
    branding = signal(structuredClone(DEFAULT_DEPLOYMENT_BRANDING));
    await TestBed.configureTestingModule({
      imports: [App, SetupPopup, PaymentPopup],
      providers: [
        provideRouter(routes),
        {
          provide: DeploymentConfigurationService,
          useValue: {
            branding,
            firebaseMessagingConfigured: signal(false),
            socialLinks: signal(DEFAULT_DEPLOYMENT_SOCIAL_LINKS),
            privacyContact: signal(DEFAULT_DEPLOYMENT_PRIVACY_CONTACT),
            initialize: vi.fn().mockResolvedValue(DEFAULT_DEPLOYMENT_BRANDING)
          }
        }
      ]
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the entry page', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-entry-page')).not.toBeNull();
    expect(compiled.querySelector('.entry-brand')?.getAttribute('aria-label'))
      .toBe(DEFAULT_DEPLOYMENT_BRANDING.productName);
  });

  it('loads setup only when requested, shows its loading surface and retains the mounted instance', async () => {
    const open = signal(false);
    vi.spyOn(TestBed.inject(AppSetupStore), 'isOpen').mockImplementation(open);
    let finish!: (value: any) => void;
    const load = vi.spyOn(TestBed.inject(PopupAdapterProxyService), 'load')
      .mockImplementation(() => new Promise<any>(resolve => { finish = resolve; }));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(load).not.toHaveBeenCalled();
    open.set(true);
    fixture.detectChanges();
    expect(load).toHaveBeenCalledExactlyOnceWith(POPUP_ADAPTER.APP_SETUP);
    expect(fixture.nativeElement.querySelector('app-indicator')).not.toBeNull();
    // A request closed during download must not be reopened when code arrives.
    open.set(false);
    finish({ AppSetupPopupComponent: SetupPopup });
    await fixture.whenStable();
    fixture.detectChanges();
    const mounted = fixture.nativeElement.querySelector('test-setup-popup');
    expect(mounted).not.toBeNull();
    expect(open()).toBe(false);
    open.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('test-setup-popup')).toBe(mounted);
    expect(load).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('keeps payment code unloaded until a provider waiting surface exists', async () => {
    const surface = signal<{id: string; url: string} | null>(null);
    vi.spyOn(TestBed.inject(PaymentAuthorizationService), 'waitingSurface').mockImplementation(surface);
    const load = vi.spyOn(TestBed.inject(PopupAdapterProxyService), 'load')
      .mockResolvedValue({ PaymentAuthorizationPopupComponent: PaymentPopup } as any);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(load).not.toHaveBeenCalled();
    surface.set({ id: 'payment', url: 'https://provider.invalid/waiting' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(load).toHaveBeenCalledExactlyOnceWith(POPUP_ADAPTER.PAYMENT_AUTHORIZATION);
    const mounted = fixture.nativeElement.querySelector('test-payment-popup');
    expect(mounted).not.toBeNull();
    surface.set(null);
    fixture.detectChanges();
    surface.set({ id: 'next-payment', url: 'https://provider.invalid/next' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('test-payment-popup')).toBe(mounted);
    expect(load).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

});
