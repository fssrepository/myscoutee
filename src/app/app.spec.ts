import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DEFAULT_DEPLOYMENT_BRANDING } from './shared/core/contracts';
import { DeploymentConfigurationService } from './shared/core/base/services/deployment-configuration.service';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: DeploymentConfigurationService,
          useValue: {
            branding: signal(DEFAULT_DEPLOYMENT_BRANDING),
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
    expect(compiled.querySelector('.entry-brand-text')?.textContent)
      .toContain(DEFAULT_DEPLOYMENT_BRANDING.productName);
  });
});
