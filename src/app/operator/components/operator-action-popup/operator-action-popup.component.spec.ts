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
import { OperatorMenuStore } from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorWorkspaceStore } from '../../../shared/ui/context/stores/operator-workspace.store';
import { OperatorActionPopupComponent } from './operator-action-popup.component';

describe('OperatorActionPopupComponent payment provider menu', () => {
  const configuration = signal<OperatorConfigurationDto>(operatorConfiguration());
  const configurationDraft = signal<OperatorConfigurationSaveRequestDto>(
    operatorConfigurationDraft('stripe')
  );

  beforeEach(() => {
    configuration.set(operatorConfiguration());
    configurationDraft.set(operatorConfigurationDraft('stripe'));
    TestBed.configureTestingModule({
      imports: [
        AppMenuComponent,
        OperatorActionPopupComponent
      ],
      providers: [
        {
          provide: OperatorMenuStore,
          useValue: {
            activePopup: signal('configuration').asReadonly(),
            closePopup: vi.fn()
          }
        },
        {
          provide: OperatorWorkspaceStore,
          useValue: {
            busyAction: signal(null).asReadonly(),
            configuration: configuration.asReadonly(),
            configurationDraft: configurationDraft.asReadonly(),
            clearFeedback: vi.fn(),
            loadConfiguration: vi.fn().mockResolvedValue(configuration()),
            configurationAuthenticationFeedback: signal(null).asReadonly(),
            configurationMessagingFeedback: signal(null).asReadonly()
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
});

function operatorConfiguration(): OperatorConfigurationDto {
  return {
    capability: 'AVAILABLE',
    unavailableReason: null,
    branding: {
      productName: 'MyScoutee',
      homeLabel: 'Community',
      logoUrl: 'assets/logo/heart.webp',
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
      messagingCredentialConfigured: false
    },
    updatedAt: '2026-07-28T18:00:00.000Z'
  };
}

function operatorConfigurationDraft(
  providerId: string | null
): OperatorConfigurationSaveRequestDto {
  return {
    branding: {
      productName: 'MyScoutee',
      homeLabel: 'Community',
      logoUrl: 'assets/logo/heart.webp',
      themePreset: 'AURORA'
    },
    payment: {
      providerId,
      credential: ''
    },
    firebase: {
      projectId: 'myscoutee',
      authenticationCredential: '',
      messagingCredential: ''
    }
  };
}
