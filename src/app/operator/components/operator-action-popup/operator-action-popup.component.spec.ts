import { signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../../shared/core/base/services/i18n.service';
import type {
  OperatorConfigurationDto,
  OperatorConfigurationSaveRequestDto
} from '../../../shared/core/contracts/operator.interface';
import {
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuTrigger
} from '../../../shared/ui/components/core/menu';
import { OperatorLeaderboardStore } from '../../../shared/ui/context/stores/operator-leaderboard.store';
import { OperatorMenuStore } from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';
import { OperatorWorkspaceStore } from '../../../shared/ui/context/stores/operator-workspace.store';
import { OperatorActionPopupComponent } from './operator-action-popup.component';

describe('OperatorActionPopupComponent payment provider menu', () => {
  const configuration = signal<OperatorConfigurationDto>(operatorConfiguration());
  const configurationDraft = signal<OperatorConfigurationSaveRequestDto>(
    operatorConfigurationDraft('stripe')
  );
  const activePopup =
    signal<'configuration' | 'community' | null>('configuration');
  const closePopup = vi.fn();
  const clearFeedback = vi.fn();
  const clearConfigurationCredentialDrafts = vi.fn();

  beforeEach(() => {
    closePopup.mockReset();
    closePopup.mockImplementation(() => activePopup.set(null));
    clearFeedback.mockReset();
    clearConfigurationCredentialDrafts.mockReset();
    configuration.set(operatorConfiguration());
    configurationDraft.set(operatorConfigurationDraft('stripe'));
    activePopup.set('configuration');
    TestBed.configureTestingModule({
      imports: [
        AppMenuComponent,
        OperatorActionPopupComponent
      ],
      providers: [
        {
          provide: OperatorMenuStore,
          useValue: {
            activePopup: activePopup.asReadonly(),
            closePopup
          }
        },
        {
          provide: OperatorLeaderboardStore,
          useValue: {
            queryDeploymentPage: vi.fn()
          }
        },
        {
          provide: OperatorWorkspaceStore,
          useValue: {
            busyAction: signal(null).asReadonly(),
            configuration: configuration.asReadonly(),
            configurationDraft: configurationDraft.asReadonly(),
            configurationBrandingReady: signal(true).asReadonly(),
            clearFeedback,
            clearConfigurationCredentialDrafts,
            loadConfiguration: vi.fn().mockResolvedValue(configuration()),
            configurationAuthenticationFeedback: signal(null).asReadonly(),
            configurationMessagingFeedback: signal(null).asReadonly(),
            configurationMessagingDestinationToken: signal('').asReadonly(),
            setConfigurationMessagingDestinationToken: vi.fn()
          }
        },
        {
          provide: OperatorRegistryStore,
          useValue: {
            status: signal({
              enabled: true,
              lifecycle: 'REGISTERED'
            }).asReadonly()
          }
        },
        {
          provide: I18nService,
          useValue: {
            revision: () => 0,
            currentLanguage: () => 'en',
            translate: (value: string | null | undefined) => value ?? ''
          }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('passes seeded logos and palettes to both the selected trigger and dropdown rows', () => {
    const actionFixture = TestBed.createComponent(OperatorActionPopupComponent);
    const componentView = actionFixture.componentInstance as unknown as {
      configurationPaymentProviderItems: Signal<readonly AppMenuItem<string>[]>;
      configurationPaymentProviderTrigger: () => AppMenuTrigger;
    };
    const trigger = componentView.configurationPaymentProviderTrigger();
    const items = componentView.configurationPaymentProviderItems();
    actionFixture.destroy();

    expect(trigger).toEqual(expect.objectContaining({
      label: 'Stripe',
      imageUrl: 'assets/payment-providers/stripe.svg',
      imageAlt: 'Stripe',
      palette: 'violet'
    }));
    expect(items.map(item => item.id)).toEqual([
      'operator-payment-provider-none',
      'operator-payment-provider-stripe',
      'operator-payment-provider-barion'
    ]);
    expect(items[1]).toEqual(expect.objectContaining({
      icon: undefined,
      imageUrl: 'assets/payment-providers/stripe.svg',
      imageAlt: 'Stripe',
      palette: 'violet'
    }));
    expect(items[2]).toEqual(expect.objectContaining({
      icon: undefined,
      imageUrl: 'assets/payment-providers/barion.svg',
      imageAlt: 'Barion',
      palette: 'blue'
    }));

    const menuFixture = TestBed.createComponent(AppMenuComponent);
    const menu = menuFixture.componentInstance;
    menu.kind = 'select';
    menu.trigger = trigger;
    menu.items = [...items];
    menu.open = true;
    menuFixture.detectChanges();

    const host = menuFixture.nativeElement as HTMLElement;
    expect(
      host.querySelector<HTMLImageElement>('.app-menu__trigger-image img')
        ?.getAttribute('src')
    ).toBe('assets/payment-providers/stripe.svg');
    expect(
      host.querySelector('.app-menu__trigger')
        ?.classList.contains('app-menu__palette--violet')
    ).toBe(true);
    const rowImages = [...host.querySelectorAll<HTMLImageElement>(
      '.app-menu__item-image img'
    )];
    expect(rowImages.map(image => image.getAttribute('src'))).toEqual([
      'assets/payment-providers/stripe.svg',
      'assets/payment-providers/barion.svg'
    ]);
    expect(rowImages.map(image => image.alt)).toEqual(['Stripe', 'Barion']);
    expect(
      rowImages[0]?.closest('.app-menu__item')
        ?.classList.contains('app-menu__palette--violet')
    ).toBe(true);
    expect(
      rowImages[1]?.closest('.app-menu__item')
        ?.classList.contains('app-menu__palette--blue')
    ).toBe(true);
  });

  it('scrubs write-only Firebase drafts when the configuration popup closes', () => {
    const fixture = TestBed.createComponent(OperatorActionPopupComponent);
    const componentView = fixture.componentInstance as unknown as {
      close: () => void;
    };
    clearFeedback.mockClear();
    clearConfigurationCredentialDrafts.mockClear();
    closePopup.mockClear();

    componentView.close();
    TestBed.flushEffects();

    expect(clearConfigurationCredentialDrafts).toHaveBeenCalledOnce();
    expect(clearFeedback).toHaveBeenCalledOnce();
    expect(closePopup).toHaveBeenCalledOnce();
    fixture.destroy();
  });

  it('scrubs write-only Firebase drafts when the popup switches kind', () => {
    const fixture = TestBed.createComponent(OperatorActionPopupComponent);
    clearConfigurationCredentialDrafts.mockClear();

    activePopup.set('community');
    TestBed.flushEffects();

    expect(clearConfigurationCredentialDrafts).toHaveBeenCalledOnce();
    fixture.destroy();
  });

  it('scrubs write-only Firebase drafts when the configuration popup is destroyed', () => {
    const fixture = TestBed.createComponent(OperatorActionPopupComponent);
    clearConfigurationCredentialDrafts.mockClear();

    fixture.destroy();

    expect(clearConfigurationCredentialDrafts).toHaveBeenCalledOnce();
  });

  it('does not scrub Firebase drafts when a different popup is destroyed', () => {
    activePopup.set('community');
    const fixture = TestBed.createComponent(OperatorActionPopupComponent);
    clearConfigurationCredentialDrafts.mockClear();

    fixture.destroy();

    expect(clearConfigurationCredentialDrafts).not.toHaveBeenCalled();
  });

  it('uses the generic payment icon only when a provider has no logo', () => {
    configuration.set({
      ...operatorConfiguration(),
      payment: {
        ...operatorConfiguration().payment,
        availableProviders: [
          ...operatorConfiguration().payment.availableProviders,
          {
            id: 'manual',
            label: 'Manual provider',
            logoUrl: null,
            logoAlt: null,
            palette: 'slate'
          }
        ]
      }
    });
    configurationDraft.set(operatorConfigurationDraft('manual'));
    const fixture = TestBed.createComponent(OperatorActionPopupComponent);
    const componentView = fixture.componentInstance as unknown as {
      configurationPaymentProviderItems: Signal<readonly AppMenuItem<string>[]>;
      configurationPaymentProviderTrigger: () => AppMenuTrigger;
    };

    const manual = componentView.configurationPaymentProviderItems().at(-1);
    expect(manual).toEqual(expect.objectContaining({
      icon: 'payments',
      imageUrl: null,
      palette: 'slate'
    }));
    expect(componentView.configurationPaymentProviderTrigger()).toEqual(
      expect.objectContaining({
        icon: 'payments',
        imageUrl: null,
        palette: 'slate'
      })
    );
  });

  it('hosts the selected claimed-group deployments in a cursor SmartList', () => {
    const activePopup = signal('deployments' as const);
    const selectedLeaderboardEntry = signal({
      id: 'claimed-group:opg_test',
      nodeId: null,
      label: 'Campus Operator',
      group: 'CLAIMED' as const,
      verifiedWeight: 65_000,
      sharePercent: 30,
      claimed: true,
      operatorGroupId: 'opg_test',
      deploymentCount: 2
    });
    TestBed.overrideProvider(OperatorMenuStore, {
      useValue: {
        activePopup: activePopup.asReadonly(),
        selectedLeaderboardEntry:
          selectedLeaderboardEntry.asReadonly(),
        closePopup: vi.fn()
      }
    });
    const fixture = TestBed.createComponent(OperatorActionPopupComponent);
    const componentView = fixture.componentInstance as unknown as {
      leaderboardDeploymentQuery: Signal<{
        filters?: { groupId?: string };
      }>;
      leaderboardDeploymentConfig: {
        pageSize?: number;
        cacheable?: {
          identity: (deployment: { deploymentId: string }) => string;
        };
      };
      leaderboardDeploymentRow: (deployment: {
        deploymentId: string;
        groupId: string;
        claimState: 'pending-review' | 'rejected';
        membershipState: 'owner';
        verifiedWeight: number;
        sharePercent: number;
      }) => {
        title: string;
        subtitle?: string | null;
        surfaceTone?: string | null;
        badges?: readonly { label: string }[];
      };
      popupModel: () => {
        title?: string | null;
        headerLabel?: string | null;
        subtitle?: string | null;
        translateTitle?: boolean;
        bodyLayout?: string;
        size?: string;
      };
    };
    const deployment = {
      deploymentId: 'dep_owner',
      groupId: 'opg_test',
      claimState: 'pending-review' as const,
      membershipState: 'owner' as const,
      verifiedWeight: 42,
      sharePercent: 0
    };

    expect(componentView.leaderboardDeploymentQuery().filters?.groupId)
      .toBe('opg_test');
    expect(componentView.leaderboardDeploymentConfig.pageSize).toBe(8);
    expect(
      componentView.leaderboardDeploymentConfig.cacheable
        ?.identity(deployment)
    ).toBe('dep_owner');
    expect(componentView.leaderboardDeploymentRow(deployment))
      .toEqual(expect.objectContaining({
        title: 'dep_owner',
        subtitle: 'operator.leaderboard.deployments.membership.owner',
        surfaceTone: 'warning',
        badges: [
          expect.objectContaining({
            label: 'operator.leaderboard.deployments.claim.pending-review'
          })
        ]
      }));
    expect(componentView.leaderboardDeploymentRow({
      ...deployment,
      claimState: 'rejected'
    })).toEqual(expect.objectContaining({
      surfaceTone: 'danger',
      badges: [
        expect.objectContaining({
          label: 'operator.leaderboard.deployments.claim.rejected',
          icon: 'block',
          tone: 'danger'
        })
      ]
    }));
    expect(componentView.popupModel()).toEqual(expect.objectContaining({
      headerLabel: 'operator.leaderboard.deployments.title',
      title: 'Campus Operator',
      subtitle: 'operator.leaderboard.deployments.subtitle',
      translateTitle: false,
      bodyLayout: 'fill',
      size: 'wide'
    }));

    fixture.destroy();
  });
});

function operatorConfiguration(): OperatorConfigurationDto {
  return {
    capability: 'AVAILABLE',
    unavailableReason: null,
    adminEmails: [],
    socialLinks: [],
    branding: {
      productName: 'MyScoutee',
      homeLabel: 'Community',
      logoUrl: 'assets/logo/heart.webp',
      logoCharacterIndex: null,
      themePreset: 'AURORA',
      revision: 1
    },
    payment: {
      availableProviders: [
        {
          id: 'stripe',
          label: 'Stripe',
          logoUrl: 'assets/payment-providers/stripe.svg',
          logoAlt: 'Stripe',
          palette: 'violet'
        },
        {
          id: 'barion',
          label: 'Barion',
          logoUrl: 'assets/payment-providers/barion.svg',
          logoAlt: 'Barion',
          palette: 'blue'
        }
      ],
      providerId: null,
      credentialConfigured: false,
      credentialMask: null
    },
    firebase: {
      projectId: 'myscoutee',
      authenticationCredentialConfigured: false,
      messagingCredentialConfigured: false,
      publicConfiguration: {
        revision: 0,
        apiKey: '',
        authDomain: '',
        projectId: 'myscoutee',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        measurementId: null,
        vapidKey: null
      },
      active: false,
      readyToActivate: false,
      authenticationTestedAt: null,
      messagingTestedAt: null,
      activatedAt: null
    },
    updatedAt: '2026-07-28T18:00:00.000Z'
  };
}

function operatorConfigurationDraft(
  providerId: string | null
): OperatorConfigurationSaveRequestDto {
  return {
    adminEmails: [],
    socialLinks: [],
    branding: {
      productName: 'MyScoutee',
      logoUrl: 'assets/logo/heart.webp',
      logoCharacterIndex: null,
      themePreset: 'AURORA'
    },
    payment: {
      providerId,
      credential: ''
    },
    firebase: {
      projectId: 'myscoutee',
      apiKey: '',
      authDomain: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
      measurementId: '',
      vapidKey: '',
      authenticationCredential: '',
      messagingCredential: ''
    }
  };
}
