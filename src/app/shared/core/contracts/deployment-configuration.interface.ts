export interface DeploymentSocialLinkDto {
  provider: string;
  label: string;
  url: string;
  icon: string | null;
  handle: string | null;
}

export interface DeploymentPrivacyContactDto {
  configured: boolean;
  dataControllerName: string;
  privacyContactEmail: string;
}

import type { UiBranding as DeploymentBrandingDto } from '@fssrepository/myscoutee-components';

export const DEFAULT_DEPLOYMENT_BRANDING: Readonly<DeploymentBrandingDto> = {
  productName: 'MyScoutee',
  homeLabel: 'Your preferences come first',
  logoUrl: 'assets/logo/heart.webp',
  logoCharacterIndex: 0,
  revision: 0
};

export const DEFAULT_DEPLOYMENT_SOCIAL_LINKS:
Readonly<readonly DeploymentSocialLinkDto[]> = [];

export const DEFAULT_DEPLOYMENT_PRIVACY_CONTACT:
Readonly<DeploymentPrivacyContactDto> = {
  configured: false,
  dataControllerName: '',
  privacyContactEmail: ''
};

export interface DeploymentConfigurationDto extends DeploymentBrandingDto {
  paymentProviderId: string | null;
  firebaseMessagingConfigured: boolean;
  socialLinks: readonly DeploymentSocialLinkDto[];
  privacyContact: DeploymentPrivacyContactDto;
}

export const DEFAULT_DEPLOYMENT_CONFIGURATION:
Readonly<DeploymentConfigurationDto> = {
  ...DEFAULT_DEPLOYMENT_BRANDING,
  paymentProviderId: null,
  firebaseMessagingConfigured: false,
  socialLinks: DEFAULT_DEPLOYMENT_SOCIAL_LINKS,
  privacyContact: DEFAULT_DEPLOYMENT_PRIVACY_CONTACT
};

export const DEPLOYMENT_LOGO_PRESETS = [
  {
    id: 'heart-webp',
    label: 'operator.configuration.branding.logo.heart.webp',
    url: 'assets/logo/heart.webp'
  },
  {
    id: 'heart-png',
    label: 'operator.configuration.branding.logo.heart.png',
    url: 'assets/logo/heart.png'
  }
] as const;

export interface DeploymentConfigurationServiceContract {
  loadBranding(): Promise<DeploymentConfigurationDto>;
}
