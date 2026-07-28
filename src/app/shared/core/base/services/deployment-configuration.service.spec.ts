import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { HttpDeploymentConfigurationService } from '../../http/services/deployment-configuration.service';
import { LocalDeploymentConfigurationService } from '../../local/source/services/deployment-configuration.service';
import { DeploymentConfigurationService } from './deployment-configuration.service';
import { SessionService } from './session.service';

describe('DeploymentConfigurationService', () => {
  const loadLocalBranding = vi.fn();

  beforeEach(() => {
    loadLocalBranding.mockReset();
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
    TestBed.resetTestingModule();
  });

  it('loads one central branding value and applies its theme to the document', async () => {
    loadLocalBranding.mockResolvedValue({
      productName: 'Community Hub',
      homeLabel: 'Meet locally',
      logoUrl: 'assets/logo/heart.png',
      logoCharacterIndex: null,
      themePreset: 'OCEAN',
      revision: 4
    });
    const service = TestBed.inject(DeploymentConfigurationService);

    const branding = await service.initialize();

    expect(branding).toEqual({
      productName: 'Community Hub',
      homeLabel: 'Meet locally',
      logoUrl: 'assets/logo/heart.png',
      logoCharacterIndex: null,
      themePreset: 'OCEAN',
      revision: 4
    });
    expect(service.branding()).toEqual(branding);
    expect(TestBed.inject(DOCUMENT).documentElement.dataset['deploymentTheme'])
      .toBe('ocean');
    expect(TestBed.inject(DOCUMENT).title).toBe('Community Hub');
    expect(loadLocalBranding).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid persisted logo character index instead of repairing it', async () => {
    loadLocalBranding.mockResolvedValue({
      productName: 'Hub',
      homeLabel: 'Meet locally',
      logoUrl: 'assets/logo/heart.png',
      logoCharacterIndex: 3,
      themePreset: 'OCEAN',
      revision: 4
    });
    const service = TestBed.inject(DeploymentConfigurationService);

    await expect(service.initialize()).rejects.toThrow(
      'deployment.configuration.branding.logo.character.index.invalid'
    );
  });
});
