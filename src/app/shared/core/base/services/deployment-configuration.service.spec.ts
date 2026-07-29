import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { HttpDeploymentConfigurationService } from '../../http/services/deployment-configuration.service';
import { LocalDeploymentConfigurationService } from '../../local/source/services/deployment-configuration.service';
import { DeploymentConfigurationService } from './deployment-configuration.service';
import { SessionService } from './session.service';

describe('DeploymentConfigurationService', () => {
  const loadLocalBranding = vi.fn();
  const metadataFixtures: Element[] = [];
  let initialDocumentTitle = '';
  let initialDeploymentTheme: string | undefined;

  beforeEach(() => {
    loadLocalBranding.mockReset();
    const documentRef = document;
    initialDocumentTitle = documentRef.title;
    initialDeploymentTheme =
      documentRef.documentElement.dataset['deploymentTheme'];
    addHeadFixture('meta', { name: 'description' });
    addHeadFixture('meta', { property: 'og:title' });
    addHeadFixture('meta', { property: 'og:site_name' });
    addHeadFixture('meta', { property: 'og:description' });
    addHeadFixture('meta', { property: 'og:url' });
    addHeadFixture('meta', { property: 'og:image' });
    addHeadFixture('meta', { property: 'og:image:secure_url' });
    addHeadFixture('meta', { property: 'og:image:type' });
    addHeadFixture('meta', { property: 'og:image:alt' });
    addHeadFixture('link', { rel: 'icon' });
    addHeadFixture('link', { rel: 'apple-touch-icon' });
    addHeadFixture('link', { rel: 'canonical' });
    TestBed.configureTestingModule({
      providers: [
        DeploymentConfigurationService,
        {
          provide: LocalDeploymentConfigurationService,
          useValue: { loadBranding: loadLocalBranding }
        },
        {
          provide: HttpDeploymentConfigurationService,
          useValue: { loadBranding: vi.fn() }
        },
        {
          provide: SessionService,
          useValue: {
            currentSession: () => ({
              kind: 'demo',
              userId: 'operator-demo-dev'
            })
          }
        }
      ]
    });
  });

  afterEach(() => {
    metadataFixtures.splice(0).forEach(element => element.remove());
    document.title = initialDocumentTitle;
    if (initialDeploymentTheme === undefined) {
      delete document.documentElement.dataset['deploymentTheme'];
    } else {
      document.documentElement.dataset['deploymentTheme'] =
        initialDeploymentTheme;
    }
    TestBed.resetTestingModule();
  });

  it('loads one central branding value and applies runtime document branding', async () => {
    loadLocalBranding.mockResolvedValue({
      productName: 'Community Hub',
      homeLabel: 'Meet locally',
      logoUrl: 'https://cdn.example.test/community-hub.webp',
      logoCharacterIndex: null,
      themePreset: 'OCEAN',
      socialLinks: [{
        provider: 'community',
        label: 'Community',
        url: 'https://community.example.test/',
        icon: null,
        handle: '@community'
      }],
      revision: 4
    });
    const service = TestBed.inject(DeploymentConfigurationService);

    const branding = await service.initialize();

    expect(branding).toEqual({
      productName: 'Community Hub',
      homeLabel: 'Meet locally',
      logoUrl: 'https://cdn.example.test/community-hub.webp',
      logoCharacterIndex: null,
      themePreset: 'OCEAN',
      revision: 4
    });
    expect(service.branding()).toEqual(branding);
    expect(service.socialLinks()).toEqual([{
      provider: 'community',
      label: 'Community',
      url: 'https://community.example.test/',
      icon: null,
      handle: '@community'
    }]);
    expect(TestBed.inject(DOCUMENT).documentElement.dataset['deploymentTheme'])
      .toBe('ocean');
    expect(TestBed.inject(DOCUMENT).title).toBe('Community Hub');
    expect(metaContent('meta[name="description"]')).toBe('Meet locally');
    expect(metaContent('meta[property="og:title"]')).toBe('Community Hub');
    expect(metaContent('meta[property="og:site_name"]')).toBe('Community Hub');
    expect(metaContent('meta[property="og:description"]')).toBe('Meet locally');
    expect(metaContent('meta[property="og:url"]'))
      .toBe(new URL('/', document.baseURI).toString());
    expect(metaContent('meta[property="og:image"]'))
      .toBe('https://cdn.example.test/community-hub.webp');
    expect(metaContent('meta[property="og:image:secure_url"]'))
      .toBe('https://cdn.example.test/community-hub.webp');
    expect(metaContent('meta[property="og:image:type"]')).toBe('image/webp');
    expect(metaContent('meta[property="og:image:alt"]'))
      .toBe('Community Hub logo');
    expect(linkHref('link[rel~="icon"]'))
      .toBe('https://cdn.example.test/community-hub.webp');
    expect(document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.type)
      .toBe('image/webp');
    expect(linkHref('link[rel="apple-touch-icon"]'))
      .toBe('https://cdn.example.test/community-hub.webp');
    expect(linkHref('link[rel="canonical"]'))
      .toBe(new URL('/', document.baseURI).toString());
    expect(loadLocalBranding).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid persisted logo character index instead of repairing it', async () => {
    loadLocalBranding.mockResolvedValue({
      productName: 'Hub',
      homeLabel: 'Meet locally',
      logoUrl: 'assets/logo/heart.png',
      logoCharacterIndex: 3,
      themePreset: 'OCEAN',
      socialLinks: [],
      revision: 4
    });
    const service = TestBed.inject(DeploymentConfigurationService);

    await expect(service.initialize()).rejects.toThrow(
      'deployment.configuration.branding.logo.character.index.invalid'
    );
  });

  function addHeadFixture(
    tagName: 'meta' | 'link',
    attributes: Record<string, string>
  ): void {
    const element = document.createElement(tagName);
    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, value);
    });
    document.head.prepend(element);
    metadataFixtures.push(element);
  }

  function metaContent(selector: string): string | null {
    return document.querySelector<HTMLMetaElement>(selector)
      ?.getAttribute('content') ?? null;
  }

  function linkHref(selector: string): string | null {
    return document.querySelector<HTMLLinkElement>(selector)
      ?.getAttribute('href') ?? null;
  }
});
