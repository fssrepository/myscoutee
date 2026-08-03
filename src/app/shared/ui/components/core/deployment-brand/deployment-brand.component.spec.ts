import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DeploymentConfigurationService } from '../../../../core/base/services/deployment-configuration.service';
import type { DeploymentBrandingDto } from '../../../../core/contracts/deployment-configuration.interface';
import { DeploymentBrandComponent } from './deployment-brand.component';

describe('DeploymentBrandComponent', () => {
  const branding = signal<DeploymentBrandingDto>(brand(0));

  beforeEach(() => {
    branding.set(brand(0));
    TestBed.configureTestingModule({
      imports: [DeploymentBrandComponent],
      providers: [{
        provide: DeploymentConfigurationService,
        useValue: { branding: branding.asReadonly() }
      }]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('replaces index zero by default while retaining the full accessible name', () => {
    const fixture = TestBed.createComponent(DeploymentBrandComponent);
    fixture.detectChanges();
    const rendered = fixture.nativeElement.querySelector(
      '.deployment-brand'
    ) as HTMLElement;

    expect(rendered.textContent?.trim()).toBe('yScoutee');
    expect(rendered.getAttribute('aria-label')).toBe('MyScoutee');
    expect(rendered.classList.contains('deployment-brand--inline-logo')).toBe(true);
  });

  it('treats a legacy null index as the default first-character replacement', () => {
    branding.set(brand(null));
    const fixture = TestBed.createComponent(DeploymentBrandComponent);
    fixture.detectChanges();
    const rendered = fixture.nativeElement.querySelector(
      '.deployment-brand'
    ) as HTMLElement;

    expect(rendered.textContent?.trim()).toBe('yScoutee');
    expect(rendered.getAttribute('aria-label')).toBe('MyScoutee');
    expect(rendered.classList.contains('deployment-brand--inline-logo')).toBe(true);
  });

  it('uses Unicode code-point positions for a middle replacement', () => {
    branding.set({
      ...brand(1),
      productName: 'A😀BC'
    });
    const fixture = TestBed.createComponent(DeploymentBrandComponent);
    fixture.detectChanges();
    const rendered = fixture.nativeElement.querySelector(
      '.deployment-brand'
    ) as HTMLElement;

    expect(rendered.textContent?.trim()).toBe('ABC');
    expect(rendered.getAttribute('aria-label')).toBe('A😀BC');
  });

  it('renders the full name without a wordmark logo at index minus one', () => {
    branding.set(brand(-1));
    const fixture = TestBed.createComponent(DeploymentBrandComponent);
    fixture.detectChanges();
    const rendered = fixture.nativeElement.querySelector(
      '.deployment-brand'
    ) as HTMLElement;

    expect(rendered.textContent?.trim()).toBe('MyScoutee');
    expect(rendered.querySelector('img')).toBeNull();
    expect(rendered.classList.contains('deployment-brand--inline-logo')).toBe(false);
  });

  it('renders the full name when no logo is configured', () => {
    branding.set({
      ...brand(0),
      logoUrl: ''
    });
    const fixture = TestBed.createComponent(DeploymentBrandComponent);
    fixture.detectChanges();
    const rendered = fixture.nativeElement.querySelector(
      '.deployment-brand'
    ) as HTMLElement;

    expect(rendered.textContent?.trim()).toBe('MyScoutee');
    expect(rendered.querySelector('img')).toBeNull();
  });
});

function brand(logoCharacterIndex: number | null): DeploymentBrandingDto {
  return {
    productName: 'MyScoutee',
    homeLabel: 'Community',
    logoUrl: 'assets/logo/heart.webp',
    logoCharacterIndex,
    themePreset: 'AURORA',
    revision: 1
  };
}
