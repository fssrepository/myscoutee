import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  DEFAULT_DEPLOYMENT_BRANDING,
  DEFAULT_DEPLOYMENT_PRIVACY_CONTACT,
  DEFAULT_DEPLOYMENT_SOCIAL_LINKS,
  type DeploymentBrandingDto
} from './shared/core/contracts';
import { DeploymentConfigurationService } from './shared/core/base/services/deployment-configuration.service';
import { I18nService } from './shared/core/base/services/i18n.service';
import type { PromptModel } from './shared/ui/components/core/prompt';
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

  it('uses the active deployment brand in the install prompt', () => {
    const fixture = TestBed.createComponent(App);
    const i18nService = TestBed.inject(I18nService);
    vi.spyOn(i18nService, 'translateParams')
      .mockImplementation((key, values) => `${key}:${values['productName']}`);
    branding.set({
      ...DEFAULT_DEPLOYMENT_BRANDING,
      productName: 'Community Hub',
      logoUrl: '/api/assets/community-logo.webp',
      revision: 2
    });

    const model = (fixture.componentInstance as unknown as {
      installPromptModel: () => PromptModel;
    }).installPromptModel();

    expect(model.icon).toEqual({
      kind: 'image',
      src: '/api/assets/community-logo.webp',
      alt: ''
    });
    expect(model.title)
      .toBe('add.myscoutee.to.your.home.screen:Community Hub');
    expect(model.description)
      .toBe('install.prompt.description:Community Hub');
    expect(model.ariaLabel).toBe(model.title);
  });
});
