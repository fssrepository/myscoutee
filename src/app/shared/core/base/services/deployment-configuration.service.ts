import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';

import {
  DEFAULT_DEPLOYMENT_BRANDING,
  DEFAULT_DEPLOYMENT_CONFIGURATION,
  DEFAULT_DEPLOYMENT_PRIVACY_CONTACT,
  DEFAULT_DEPLOYMENT_SOCIAL_LINKS,
  DEPLOYMENT_THEME_PRESETS,
  type DeploymentBrandingDto,
  type DeploymentConfigurationDto,
  type DeploymentPrivacyContactDto,
  type DeploymentConfigurationServiceContract,
  type DeploymentSocialLinkDto,
  type DeploymentThemePreset
} from '../../contracts/deployment-configuration.interface';
import { OperatorConfigurationMapper } from '../mappers/operator-configuration.mapper';
import { HttpDeploymentConfigurationService } from '../../http/services/deployment-configuration.service';
import { LocalDeploymentConfigurationService } from '../../local/source/services/deployment-configuration.service';
import { BaseRouteModeService } from './base-route-mode.service';

const DEPLOYMENT_CONFIGURATION_ROUTE = '/deployment/configuration';

@Injectable({
  providedIn: 'root'
})
export class DeploymentConfigurationService
  extends BaseRouteModeService
  implements OnDestroy {
  private readonly documentRef = inject(DOCUMENT);
  private readonly localService = inject(LocalDeploymentConfigurationService);
  private readonly httpService = inject(HttpDeploymentConfigurationService);
  private readonly brandingRef = signal<DeploymentBrandingDto>(
    structuredClone(DEFAULT_DEPLOYMENT_BRANDING)
  );
  private readonly socialLinksRef = signal<readonly DeploymentSocialLinkDto[]>(
    structuredClone(DEFAULT_DEPLOYMENT_SOCIAL_LINKS)
  );
  private readonly privacyContactRef = signal<DeploymentPrivacyContactDto>(
    structuredClone(DEFAULT_DEPLOYMENT_PRIVACY_CONTACT)
  );
  private readonly paymentProviderIdRef = signal<string | null>(null);
  private readonly loadingRef = signal(false);
  private loadPromise: Promise<DeploymentBrandingDto> | null = null;
  private manifestObjectUrl: string | null = null;

  readonly branding = this.brandingRef.asReadonly();
  readonly socialLinks = this.socialLinksRef.asReadonly();
  readonly privacyContact = this.privacyContactRef.asReadonly();
  readonly paymentProviderId = this.paymentProviderIdRef.asReadonly();
  readonly loading = this.loadingRef.asReadonly();

  ngOnDestroy(): void {
    this.revokeManifestObjectUrl();
  }

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

  applySocialLinks(
    value: readonly DeploymentSocialLinkDto[]
  ): readonly DeploymentSocialLinkDto[] {
    const socialLinks = OperatorConfigurationMapper.socialLinks(value);
    this.socialLinksRef.set(socialLinks);
    return structuredClone(socialLinks);
  }

  applyPrivacyContact(
    value: DeploymentPrivacyContactDto
  ): DeploymentPrivacyContactDto {
    const privacyContact =
      OperatorConfigurationMapper.privacyContact(value);
    this.privacyContactRef.set(privacyContact);
    return structuredClone(privacyContact);
  }

  applyPaymentProviderId(value: string | null | undefined): string | null {
    const paymentProviderId = `${value ?? ''}`.trim().toLowerCase() || null;
    this.paymentProviderIdRef.set(paymentProviderId);
    return paymentProviderId;
  }

  applyPaymentProviderChangeResponse(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const response = value as Record<string, unknown>;
    if (response['code'] !== 'PAYMENT_PROVIDER_CHANGED'
      || !Object.prototype.hasOwnProperty.call(response, 'currentProvider')) {
      return false;
    }
    this.applyPaymentProviderId(
      typeof response['currentProvider'] === 'string'
        ? response['currentProvider']
        : null
    );
    return true;
  }

  private async load(): Promise<DeploymentBrandingDto> {
    if (!this.loadPromise) {
      this.loadingRef.set(true);
      this.loadPromise = this.configurationService()
        .loadBranding()
        .catch(() => structuredClone(DEFAULT_DEPLOYMENT_CONFIGURATION))
        .then(value => this.applyConfiguration(value))
        .finally(() => {
          this.loadingRef.set(false);
        });
    }
    return structuredClone(await this.loadPromise);
  }

  private applyConfiguration(
    value: DeploymentConfigurationDto
  ): DeploymentBrandingDto {
    this.applySocialLinks(value.socialLinks);
    this.applyPrivacyContact(value.privacyContact);
    this.applyPaymentProviderId(value.paymentProviderId);
    return this.applyBranding(value);
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
    const logoCharacterIndex = this.logoCharacterIndex(
      value?.logoCharacterIndex,
      productName
    );
    return {
      productName,
      homeLabel,
      logoUrl: this.safeLogoUrl(value?.logoUrl),
      logoCharacterIndex,
      themePreset: themePreset as DeploymentThemePreset,
      revision: Math.max(0, Math.trunc(Number(value?.revision) || 0))
    };
  }

  private logoCharacterIndex(
    value: number | null | undefined,
    productName: string
  ): number | null {
    if (value === null || value === undefined) {
      return DEFAULT_DEPLOYMENT_BRANDING.logoCharacterIndex;
    }
    const characterCount = Array.from(productName).length;
    if (!Number.isInteger(value) || value < -1 || value >= characterCount) {
      throw new Error('deployment.configuration.branding.logo.character.index.invalid');
    }
    return value;
  }

  private safeLogoUrl(value: string | null | undefined): string {
    const normalized = `${value ?? ''}`.trim();
    if (!normalized) {
      return '';
    }
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
    this.setMetaContent('meta[name="description"]', branding.homeLabel);
    this.setMetaContent('meta[property="og:title"]', branding.productName);
    this.setMetaContent('meta[property="og:site_name"]', branding.productName);
    this.setMetaContent('meta[property="og:description"]', branding.homeLabel);
    const canonicalUrl = this.deploymentRootUrl();
    this.setMetaContent('meta[property="og:url"]', canonicalUrl);
    this.setLinkHref('link[rel="canonical"]', canonicalUrl);
    const metadataLogoUrl = this.absoluteLogoUrl(branding.logoUrl);
    const logoMediaType = this.logoMediaType(branding.logoUrl);
    this.setMetaContent('meta[property="og:image"]', metadataLogoUrl);
    this.setMetaContent(
      'meta[property="og:image:secure_url"]',
      metadataLogoUrl.startsWith('https://') ? metadataLogoUrl : ''
    );
    this.setMetaContent(
      'meta[property="og:image:type"]',
      logoMediaType
    );
    this.setMetaContent(
      'meta[property="og:image:alt"]',
      metadataLogoUrl ? `${branding.productName} logo` : ''
    );
    this.setLinkHref('link[rel~="icon"]', branding.logoUrl);
    this.setLinkType('link[rel~="icon"]', logoMediaType);
    this.setLinkHref('link[rel="apple-touch-icon"]', branding.logoUrl);
    const deploymentThemeColor =
      this.documentRef.defaultView
        ?.getComputedStyle(documentElement)
        .getPropertyValue('--deployment-brand-primary')
        .trim()
      || '#7446f2';
    const themeColor = this.documentRef.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]'
    );
    if (themeColor) {
      themeColor.content = deploymentThemeColor;
    }
    this.applyWebManifestBranding(branding, deploymentThemeColor);
    this.publishServiceWorkerBranding(branding);
  }

  private applyWebManifestBranding(
    branding: DeploymentBrandingDto,
    themeColor: string
  ): void {
    const manifestLink = this.documentRef.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]'
    );
    const windowRef = this.documentRef.defaultView;
    if (
      !manifestLink
      || !windowRef
      || typeof windowRef.URL?.createObjectURL !== 'function'
      || typeof windowRef.Blob !== 'function'
    ) {
      return;
    }
    const logoUrl = this.absoluteLogoUrl(branding.logoUrl);
    const logoMediaType = logoUrl
      ? this.logoMediaType(branding.logoUrl) || 'image/png'
      : '';
    const manifest = {
      name: branding.productName,
      short_name: Array.from(branding.productName).slice(0, 24).join(''),
      description: branding.homeLabel,
      display: 'standalone',
      orientation: 'portrait',
      scope: './',
      start_url: './',
      background_color: '#f5f6fb',
      theme_color: themeColor,
      icons: logoUrl
        ? [
            {
              src: logoUrl,
              sizes: '192x192',
              type: logoMediaType,
              purpose: 'any maskable'
            },
            {
              src: logoUrl,
              sizes: '512x512',
              type: logoMediaType,
              purpose: 'any maskable'
            }
          ]
        : []
    };
    const nextObjectUrl = windowRef.URL.createObjectURL(
      new windowRef.Blob(
        [JSON.stringify(manifest)],
        { type: 'application/manifest+json' }
      )
    );
    this.revokeManifestObjectUrl();
    this.manifestObjectUrl = nextObjectUrl;
    manifestLink.href = nextObjectUrl;
  }

  private revokeManifestObjectUrl(): void {
    if (!this.manifestObjectUrl) {
      return;
    }
    const urlApi = this.documentRef.defaultView?.URL;
    if (typeof urlApi?.revokeObjectURL === 'function') {
      urlApi.revokeObjectURL(this.manifestObjectUrl);
    }
    this.manifestObjectUrl = null;
  }

  private publishServiceWorkerBranding(
    branding: DeploymentBrandingDto
  ): void {
    const serviceWorker =
      this.documentRef.defaultView?.navigator.serviceWorker;
    if (!serviceWorker) {
      return;
    }
    const message = {
      type: 'DEPLOYMENT_BRANDING',
      branding: {
        productName: branding.productName,
        homeLabel: branding.homeLabel,
        logoUrl: this.absoluteLogoUrl(branding.logoUrl)
      }
    };
    const controller = serviceWorker.controller;
    controller?.postMessage(message);
    void serviceWorker.ready
      .then(registration => {
        const worker =
          registration.active
          ?? registration.waiting
          ?? registration.installing;
        if (worker && worker !== controller) {
          worker.postMessage(message);
        }
      })
      .catch(() => undefined);
  }

  private setMetaContent(selector: string, content: string): void {
    const meta = this.documentRef.querySelector<HTMLMetaElement>(selector);
    if (meta) {
      meta.content = content;
    }
  }

  private setLinkHref(selector: string, href: string): void {
    const link = this.documentRef.querySelector<HTMLLinkElement>(selector);
    if (link) {
      if (href) {
        link.setAttribute('href', href);
      } else {
        link.removeAttribute('href');
      }
    }
  }

  private setLinkType(selector: string, type: string): void {
    const link = this.documentRef.querySelector<HTMLLinkElement>(selector);
    if (!link) {
      return;
    }
    if (type) {
      link.type = type;
    } else {
      link.removeAttribute('type');
    }
  }

  private absoluteLogoUrl(logoUrl: string): string {
    if (!logoUrl) {
      return '';
    }
    if (/^data:image\//i.test(logoUrl)) {
      return logoUrl;
    }
    try {
      return new URL(logoUrl, this.documentRef.baseURI).toString();
    } catch {
      return logoUrl;
    }
  }

  private deploymentRootUrl(): string {
    try {
      return new URL('/', this.documentRef.baseURI).toString();
    } catch {
      return this.documentRef.baseURI;
    }
  }

  private logoMediaType(logoUrl: string): string {
    const dataMediaType =
      /^data:(image\/(?:png|jpeg|webp|gif));base64,/i.exec(logoUrl)?.[1];
    if (dataMediaType) {
      return dataMediaType.toLowerCase();
    }
    const path = logoUrl.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
    if (path.endsWith('.png')) {
      return 'image/png';
    }
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (path.endsWith('.webp')) {
      return 'image/webp';
    }
    if (path.endsWith('.gif')) {
      return 'image/gif';
    }
    if (path.endsWith('.ico')) {
      return 'image/x-icon';
    }
    return '';
  }
}
