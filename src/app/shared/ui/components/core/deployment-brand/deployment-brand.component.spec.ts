import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DeploymentConfigurationService } from '../../../../core/base/services/deployment-configuration.service';
import type { DeploymentBrandingDto } from '../../../../core/contracts/deployment-configuration.interface';
import { DeploymentBrandComponent } from './deployment-brand.component';

describe('DeploymentBrandComponent', () => {
  const branding = signal<DeploymentBrandingDto>(brand(null));

  beforeEach(() => {
    branding.set(brand(null));
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

  it('keeps the logo adjacent to the complete name when the index is null', () => {
    const fixture = TestBed.createComponent(DeploymentBrandComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.deployment-brand')?.textContent?.trim())
      .toBe('MyScoutee');
    expect(host.querySelector('.deployment-brand--inline-logo')).toBeNull();
    expect(host.querySelectorAll('img')).toHaveLength(1);
  });

  it('replaces index zero while retaining the full accessible name', () => {
    branding.set(brand(0));
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
