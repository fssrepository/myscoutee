import { signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../../shared/core/base/services/i18n.service';
import type {
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorConfigurationSaveRequestDto,
  OperatorTlsConfigurationDto,
  OperatorTlsConfigurationUpdateDto,
  OperatorSettlementDto
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

describe('OperatorActionPopupComponent', () => {
  const configuration = signal<OperatorConfigurationDto>(operatorConfiguration());
  const community = signal<OperatorCommunityStatusDto | null>(null);
  const configurationDraft = signal<OperatorConfigurationSaveRequestDto>(
    operatorConfigurationDraft('stripe')
  );
  const tlsConfiguration = signal<OperatorTlsConfigurationDto>({
    capability: 'AVAILABLE',
    unavailableReason: null,
    enabled: false,
    mode: 'AUTOMATIC',
    domain: '',
    contactEmail: '',
    autoRenew: true,
    certificateConfigured: false,
    certificateIssuer: null,
    certificateExpiresAt: null,
    updatedAt: null
  });
  const tlsConfigurationDraft = signal<OperatorTlsConfigurationUpdateDto>({
    enabled: false,
    mode: 'AUTOMATIC',
    domain: '',
    contactEmail: '',
    autoRenew: true,
    certificate: '',
    privateKey: ''
  });
  const busyAction = signal<string | null>(null);
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
    community.set(null);
    configurationDraft.set(operatorConfigurationDraft('stripe'));
    activePopup.set('configuration');
    busyAction.set(null);
    tlsConfigurationDraft.set({
      enabled: false,
      mode: 'AUTOMATIC',
      domain: '',
      contactEmail: '',
      autoRenew: true,
      certificate: '',
      privateKey: ''
    });
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
            busyAction: busyAction.asReadonly(),
            configuration: configuration.asReadonly(),
            configurationDraft: configurationDraft.asReadonly(),
            tlsConfiguration: tlsConfiguration.asReadonly(),
            tlsConfigurationDraft: tlsConfigurationDraft.asReadonly(),
            tlsConfigurationReady: signal(true).asReadonly(),
            setTlsConfiguration: vi.fn(),
            configurationBrandingReady: signal(true).asReadonly(),
            configurationPaymentReady: signal(true).asReadonly(),
            configurationFirebaseDirty: signal(false).asReadonly(),
            configurationPrivacyContactReady: signal(true).asReadonly(),
            configurationPrivacyContactValidationKey: () => null,
            clearFeedback,
            clearConfigurationCredentialDrafts,
            loadConfiguration: vi.fn().mockResolvedValue(configuration()),
            setConfigurationPrivacyContact: vi.fn(),
            configurationAuthenticationTest: signal(null).asReadonly(),
            configurationMessagingTest: signal(null).asReadonly(),
            configurationAuthenticationFeedback: signal(null).asReadonly(),
            configurationMessagingFeedback: signal(null).asReadonly(),
            configurationMessagingDestinationToken: signal('').asReadonly(),
            setConfigurationMessagingDestinationToken: vi.fn(),
            error: signal('').asReadonly(),
            notice: signal('').asReadonly(),
            community: community.asReadonly(),
            loadCommunityStatus: vi.fn().mockResolvedValue(null)
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

  it('keeps TLS toggles as draft state and gives Save the standard delayed ring', () => {
    tlsConfigurationDraft.update(current => ({
      ...current,
      enabled: true,
      domain: 'app.example.test',
      contactEmail: 'operator@example.test'
    }));
    busyAction.set('save-tls');
    const actionFixture = TestBed.createComponent(OperatorActionPopupComponent);
    const componentView = actionFixture.componentInstance as unknown as {
      configurationTlsEnabledItems:
        Signal<readonly AppMenuItem<string>[]>;
      configurationTlsActionItems:
        Signal<readonly AppMenuItem<string>[]>;
    };

    expect(componentView.configurationTlsEnabledItems()[0]).toEqual(
      expect.objectContaining({ checked: true, active: true })
    );
    expect(
      componentView.configurationTlsActionItems()
        .find(item => item.id === 'operator-save-tls')
        ?.progress
    ).toEqual({ state: 'loading', durationMs: 3000 });
    busyAction.set(null);
    tlsConfigurationDraft.update(current => ({
      ...current,
      enabled: false
    }));
    expect(
      componentView.configurationTlsActionItems()
        .find(item => item.id === 'operator-save-tls')
        ?.disabled
    ).toBe(false);
    actionFixture.destroy();
  });

  it('keeps the privacy contact editor distinct and without an inner title', () => {
    const actionFixture = TestBed.createComponent(OperatorActionPopupComponent);
    const componentView = actionFixture.componentInstance as unknown as {
      configurationPrivacyContactFormModel: Signal<{
        header: boolean;
        steps: readonly [{ title: string; chrome: string }];
      }>;
      configurationPrivacyContactFormValue: Signal<{
        dataControllerName: string;
        privacyContactEmail: string;
      }>;
    };

    expect(componentView.configurationPrivacyContactFormModel())
      .toEqual(expect.objectContaining({
        header: false,
        steps: [
          expect.objectContaining({
            title: '',
            chrome: 'none'
          })
        ]
      }));
    expect(componentView.configurationPrivacyContactFormValue()).toEqual({
      dataControllerName: 'Example Operator s.r.o.',
      privacyContactEmail: 'privacy@example.test'
    });
    actionFixture.destroy();
  });

  it('does not gate Firebase activation on an empty storage bucket', () => {
    const base = operatorConfiguration();
    configuration.set({
      ...base,
      firebase: {
        ...base.firebase,
        readyToActivate: true
      }
    });
    configurationDraft.set({
      ...operatorConfigurationDraft('stripe'),
      firebase: {
        ...operatorConfigurationDraft('stripe').firebase,
        apiKey: 'browser-api-key',
        authDomain: 'community.firebaseapp.com',
        projectId: 'community',
        storageBucket: '',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:community',
        vapidKey: 'public-vapid-key'
      }
    });
    const actionFixture = TestBed.createComponent(OperatorActionPopupComponent);
    const componentView = actionFixture.componentInstance as unknown as {
      configurationFirebaseSaveActionItems:
        Signal<readonly AppMenuItem<string>[]>;
    };

    expect(
      componentView.configurationFirebaseSaveActionItems()
        .find(item => item.id === 'operator-activate-firebase')
        ?.disabled
    ).toBe(false);
    actionFixture.destroy();
  });

  it('allows the active saved Firebase revision to be tested again', () => {
    const base = operatorConfiguration();
    configuration.set({
      ...base,
      firebase: {
        ...base.firebase,
        active: true,
        authenticationCredentialConfigured: true,
        messagingCredentialConfigured: true
      }
    });
    const actionFixture = TestBed.createComponent(
      OperatorActionPopupComponent
    );
    const componentView = actionFixture.componentInstance as unknown as {
      configurationFirebaseTestActionItems:
        Signal<readonly AppMenuItem<string>[]>;
    };

    expect(
      componentView.configurationFirebaseTestActionItems()
        .find(item => item.id === 'operator-test-authentication')
        ?.disabled
    ).toBe(false);
    expect(
      componentView.configurationFirebaseTestActionItems()
        .find(item => item.id === 'operator-test-messaging')
        ?.disabled
    ).toBe(false);
    actionFixture.destroy();
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

  it('renders the complete signed package contract and explicit verification state', () => {
    activePopup.set('community');
    community.set(operatorCommunityStatus());
    const fixture = TestBed.createComponent(OperatorActionPopupComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(
      [...host.querySelectorAll<HTMLElement>(
        '.operator-action-popup__release code'
      )].map(element => element.textContent?.trim())
    ).toEqual(expect.arrayContaining([
      'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'pkey_86dfce4288ce436029e7236ac60b0604',
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='
    ]));
    const verifiedState = host.querySelector<HTMLElement>(
      '.operator-action-popup__signature-state'
    );
    expect(verifiedState?.dataset['verified']).toBe('true');
    expect(verifiedState?.textContent).toContain(
      'operator.community.announcement.artifact.signature.verified'
    );

    community.update(current => {
      const announcement = current!.announcements[0]!;
      const update = announcement.update!;
      return {
        ...current!,
        announcements: [{
          ...announcement,
          update: {
            ...update,
            artifact: {
              ...update.artifact,
              downloadUrlVerified: false,
              signatureVerified: false
            }
          }
        }]
      };
    });
    fixture.detectChanges();

    const unverifiedState = host.querySelector<HTMLElement>(
      '.operator-action-popup__signature-state'
    );
    expect(unverifiedState?.dataset['verified']).toBe('false');
    expect(unverifiedState?.textContent).toContain(
      'operator.community.announcement.artifact.signature.unverified'
    );
    fixture.destroy();
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
    fixture.destroy();
  });

  it('configures cursor settlement paging and formats an exact large rational share', () => {
    const fixture = TestBed.createComponent(OperatorActionPopupComponent);
    const componentView = fixture.componentInstance as unknown as {
      settlementConfig: {
        pageSize?: number;
        cacheable?: {
          identity: (settlement: OperatorSettlementDto) => string;
        };
      };
      formatSettlementShare: (
        settlement: OperatorSettlementDto
      ) => string;
    };
    const settlement = {
      settlementId: `stl_${'1'.repeat(32)}`,
      shareNumerator: '3074457345618258602',
      shareDenominator: '9223372036854775807'
    } as OperatorSettlementDto;

    expect(componentView.settlementConfig.pageSize).toBe(6);
    expect(
      componentView.settlementConfig.cacheable?.identity(settlement)
    ).toBe(settlement.settlementId);
    expect(componentView.formatSettlementShare(settlement)).toBe('33.33%');
    fixture.destroy();
  });

  it('shows Barion merchant routing and preserves an existing credential on update', () => {
    const base = operatorConfiguration();
    configuration.set({
      ...base,
      payment: {
        ...base.payment,
        providerId: 'barion',
        publicBaseUrl: 'https://community.example.test',
        merchantAccount: 'merchant@example.test',
        credentialConfigured: true,
        credentialMask: '••••live'
      }
    });
    configurationDraft.set(operatorConfigurationDraft('barion'));
    const fixture = TestBed.createComponent(OperatorActionPopupComponent);
    const componentView = fixture.componentInstance as unknown as {
      configurationPaymentIsBarion: () => boolean;
      configurationPaymentActionItems:
        Signal<readonly AppMenuItem<string>[]>;
    };

    expect(componentView.configurationPaymentIsBarion()).toBe(true);
    expect(componentView.configurationPaymentActionItems()[0]).toEqual(
      expect.objectContaining({
        id: 'operator-update-payment',
        disabled: false
      })
    );
    fixture.destroy();
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
      eligibilityStatus: 'ACTIVE' as const,
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
        claimState: 'pending-review' | 'approved' | 'rejected';
        eligibilityStatus: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
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
      eligibilityStatus: 'INACTIVE' as const,
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
        badges: expect.arrayContaining([
          expect.objectContaining({
            label: 'operator.leaderboard.deployments.claim.pending-review'
          }),
          expect.objectContaining({
            label: '0.0%'
          })
        ])
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
    expect(componentView.leaderboardDeploymentRow({
      ...deployment,
      claimState: 'approved',
      eligibilityStatus: 'SUSPENDED'
    })).toEqual(expect.objectContaining({
      surfaceTone: 'danger',
      badges: expect.arrayContaining([
        expect.objectContaining({
          label: 'operator.claim.eligibility.suspended',
          icon: 'pause_circle',
          tone: 'danger'
        }),
        expect.objectContaining({
          label: '0.0%'
        })
      ])
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

function operatorCommunityStatus(): OperatorCommunityStatusDto {
  return {
    availability: 'AVAILABLE',
    updatedAt: '2026-07-30T09:00:00.000Z',
    providers: [],
    announcements: [{
      id: 'ann_release_1_2_3',
      kind: 'UPDATE',
      severity: 'SUCCESS',
      status: 'PUBLISHED',
      unread: true,
      title: 'MyScoutee 1.2.3',
      body: 'Signed GitHub Release package.',
      publishedAt: '2026-07-30T09:00:00.000Z',
      expiresAt: null,
      links: [],
      update: {
        version: '1.2.3',
        purpose: 'Signed release',
        releaseNotes: [],
        artifact: {
          downloadUrl:
            'https://github.com/fssrepository/myscoutee/releases/download/v1.2.3/myscoutee_1.2.3_amd64.deb',
          downloadUrlVerified: true,
          sha256Digest:
            'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          packageSigningKeyId:
            'pkey_86dfce4288ce436029e7236ac60b0604',
          signature:
            'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
          signatureVerified: true,
          sizeBytes: 18_874_368,
          compatibility: 'v1.0.0 – v2.0.0'
        }
      }
    }]
  };
}

function operatorConfiguration(): OperatorConfigurationDto {
  return {
    capability: 'AVAILABLE',
    unavailableReason: null,
    adminEmails: [],
    privacyContact: {
      configured: true,
      dataControllerName: 'Example Operator s.r.o.',
      privacyContactEmail: 'privacy@example.test'
    },
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
      publicBaseUrl: null,
      merchantAccount: null,
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
    privacyContact: {
      dataControllerName: 'Example Operator s.r.o.',
      privacyContactEmail: 'privacy@example.test'
    },
    socialLinks: [],
    branding: {
      productName: 'MyScoutee',
      logoUrl: 'assets/logo/heart.webp',
      logoCharacterIndex: null,
      themePreset: 'AURORA'
    },
    payment: {
      providerId,
      publicBaseUrl: providerId
        ? 'https://community.example.test'
        : '',
      merchantAccount: providerId === 'barion'
        ? 'merchant@example.test'
        : '',
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
