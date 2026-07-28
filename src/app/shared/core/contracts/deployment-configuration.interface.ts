export const DEPLOYMENT_THEME_PRESETS = [
  'AURORA',
  'OCEAN',
  'FOREST',
  'SUNSET',
  'VIOLET',
  'ROSE',
  'AMBER',
  'SLATE',
  'AQUARIUS',
  'MONOCHROME'
] as const;

export type DeploymentThemePreset = typeof DEPLOYMENT_THEME_PRESETS[number];

export interface DeploymentBrandingDto {
  productName: string;
  homeLabel: string;
  logoUrl: string;
  themePreset: DeploymentThemePreset;
  revision: number;
}

export const DEFAULT_DEPLOYMENT_BRANDING: Readonly<DeploymentBrandingDto> = {
  productName: 'MyScoutee',
  homeLabel: 'Your preferences come first',
  logoUrl: 'assets/logo/heart.webp',
  themePreset: 'AURORA',
  revision: 0
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
  loadBranding(): Promise<DeploymentBrandingDto>;
}
