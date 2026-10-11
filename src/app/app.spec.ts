import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { type UiBranding as DeploymentBrandingDto } from '@fssrepository/myscoutee-components';
import { DEFAULT_DEPLOYMENT_BRANDING, DEFAULT_DEPLOYMENT_PRIVACY_CONTACT, DEFAULT_DEPLOYMENT_SOCIAL_LINKS } from './shared/core/contracts';
import { DeploymentConfigurationService } from './shared/core/base/services/deployment-configuration.service';

import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  let branding: WritableSignal<DeploymentBrandingDto>;

  beforeEach(async () => {
    branding = signal(structuredClone(DEFAULT_DEPLOYMENT_BRANDING));
    await TestBed.configureTestingModule({
      imports: [App],
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

});
