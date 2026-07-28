import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

import {
  DEFAULT_DEPLOYMENT_BRANDING,
  DEPLOYMENT_THEME_PRESETS,
  type DeploymentBrandingDto,
  type DeploymentConfigurationServiceContract,
  type DeploymentThemePreset
} from '../../contracts/deployment-configuration.interface';
import { HttpDeploymentConfigurationService } from '../../http/services/deployment-configuration.service';
import { LocalDeploymentConfigurationService } from '../../local/source/services/deployment-configuration.service';
import { BaseRouteModeService } from './base-route-mode.service';

const DEPLOYMENT_CONFIGURATION_ROUTE = '/deployment/configuration';

@Injectable({
  providedIn: 'root'
})
export class DeploymentConfigurationService extends BaseRouteModeService {
  private readonly documentRef = inject(DOCUMENT);
  private readonly localService = inject(LocalDeploymentConfigurationService);
  private readonly httpService = inject(HttpDeploymentConfigurationService);
  private readonly brandingRef = signal<DeploymentBrandingDto>(
    structuredClone(DEFAULT_DEPLOYMENT_BRANDING)
  );
  private readonly loadingRef = signal(false);
  private loadPromise: Promise<DeploymentBrandingDto> | null = null;

  readonly branding = this.brandingRef.asReadonly();
  readonly loading = this.loadingRef.asReadonly();

  initialize(): Promise<DeploymentBrandingDto> {
    return this.load();
  }

  async reload(): Promise<DeploymentBrandingDto> {
    this.loadPromise = null;
    return this.load();
  }

  applyBranding(value: DeploymentBrandingDto): DeploymentBrandingDto {
    const branding = this.normalize(value);
    this.brandingRef.set(branding);
    this.applyDocumentBranding(branding);
    return structuredClone(branding);
  }

  private async load(): Promise<DeploymentBrandingDto> {
    if (!this.loadPromise) {
      this.loadingRef.set(true);
      this.loadPromise = this.configurationService()
        .loadBranding()
        .then(value => this.applyBranding(value))
        .catch(() => this.applyBranding(DEFAULT_DEPLOYMENT_BRANDING))
        .finally(() => {
          this.loadingRef.set(false);
        });
    }
    return structuredClone(await this.loadPromise);
  }

  private configurationService(): DeploymentConfigurationServiceContract {
    return this.resolveRouteService(
      DEPLOYMENT_CONFIGURATION_ROUTE,
      this.localService,
      this.httpService
    );
  }

  private normalize(value: DeploymentBrandingDto): DeploymentBrandingDto {
    const productName = `${value?.productName ?? ''}`.trim().slice(0, 80)
      || DEFAULT_DEPLOYMENT_BRANDING.productName;
    const homeLabel = `${value?.homeLabel ?? ''}`.trim().slice(0, 120)
      || productName;
    const themePreset = DEPLOYMENT_THEME_PRESETS.includes(value?.themePreset)
      ? value.themePreset
      : DEFAULT_DEPLOYMENT_BRANDING.themePreset;
    return {
      productName,
      homeLabel,
      logoUrl: this.safeLogoUrl(value?.logoUrl),
      themePreset: themePreset as DeploymentThemePreset,
      revision: Math.max(0, Math.trunc(Number(value?.revision) || 0))
    };
  }

  private safeLogoUrl(value: string | null | undefined): string {
    const normalized = `${value ?? ''}`.trim();
    if (
      normalized.startsWith('assets/')
      || normalized.startsWith('/')
      || /^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(normalized)
    ) {
      return normalized;
    }
    try {
      const url = new URL(normalized);
      return url.protocol === 'https:' && !url.username && !url.password
        ? url.toString()
        : DEFAULT_DEPLOYMENT_BRANDING.logoUrl;
    } catch {
      return DEFAULT_DEPLOYMENT_BRANDING.logoUrl;
    }
  }

  private applyDocumentBranding(branding: DeploymentBrandingDto): void {
    const documentElement = this.documentRef.documentElement;
    documentElement.dataset['deploymentTheme'] = branding.themePreset.toLowerCase();
    this.documentRef.title = branding.productName;
    const themeColor = this.documentRef.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.content =
        this.documentRef.defaultView
          ?.getComputedStyle(documentElement)
          .getPropertyValue('--deployment-brand-primary')
          .trim()
        || '#7446f2';
    }
  }
}
