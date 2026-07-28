import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { OperatorRegistryStatusDto } from '../../../shared/core/contracts/operator.interface';
import { OperatorMenuStore } from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';
import type { LinkInputConfig } from '../../../shared/ui/components/core/form/inputs/link-input';
import type { AppMenuItem } from '../../../shared/ui/components/core/menu';
import type { PopupModel } from '../../../shared/ui/components/core/popup';
import { OperatorRegistryPopupComponent } from './operator-registry-popup.component';

describe('OperatorRegistryPopupComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('uses a compact popup and disables only the current registry selector option', async () => {
    const status = registeredStatus();
    const statusSignal = signal<OperatorRegistryStatusDto | null>(status);
    const registryBaseUrl = signal(status.selection?.baseUrl ?? '');
    const expectedRegistryScope = signal(status.selection?.registryScope ?? '');
    const busyAction = signal<string | null>(null);
    const registryStore = {
      status: statusSignal.asReadonly(),
      busyAction: busyAction.asReadonly(),
      error: signal('').asReadonly(),
      notice: signal('').asReadonly(),
      registryBaseUrl: registryBaseUrl.asReadonly(),
      expectedRegistryScope: expectedRegistryScope.asReadonly(),
      registryOptions: computed(() => statusSignal()?.registryOptions ?? []),
      canRegister: computed(() =>
        busyAction() === null
        && registryBaseUrl() !== statusSignal()?.selection?.baseUrl
      ),
      setRegistryBaseUrl: (value: string) => registryBaseUrl.set(value),
      setExpectedRegistryScope: (value: string) => expectedRegistryScope.set(value),
      loadStatus: vi.fn().mockResolvedValue(status),
      register: vi.fn(),
      disconnect: vi.fn(),
      clearFeedback: vi.fn(),
      setError: vi.fn(),
      setNotice: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [OperatorRegistryPopupComponent],
      providers: [
        { provide: OperatorRegistryStore, useValue: registryStore },
        {
          provide: OperatorMenuStore,
          useValue: {
            activePopup: signal<'registration' | null>('registration').asReadonly(),
            closePopup: vi.fn()
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(OperatorRegistryPopupComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const componentView = fixture.componentInstance as unknown as {
      popupModel: () => PopupModel;
      registryUrlConfig: Signal<LinkInputConfig>;
      registryActionItems: Signal<readonly AppMenuItem<string>[]>;
    };

    expect(componentView.popupModel().size).toBe('small');
    expect(componentView.popupModel().height).toBe('auto');
    expect(componentView.popupModel().bodyLayout).toBe('overflow');
    expect(componentView.registryUrlConfig().panelMode).toBe('auto');
    expect(componentView.registryUrlConfig().availableUrls).toEqual([
      expect.objectContaining({
        url: 'https://registry.example.com',
        disabled: true
      }),
      expect.objectContaining({
        url: 'https://registry-two.example.com',
        disabled: false
      })
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('Sample data');
    expect(fixture.nativeElement.textContent).not.toContain('fingerprint');
    expect(fixture.nativeElement.querySelector('[name="expectedRegistryScope"]')).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLInputElement>('input[type="url"]')
        ?.readOnly
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelectorAll('.link-input__actions .app-menu__button-row-item')
    ).toHaveLength(4);
    expect(componentView.registryActionItems().map(item => item.id)).toEqual([
      'disconnect',
      'register'
    ]);
    expect(componentView.registryActionItems()[0]).toMatchObject({
      palette: 'danger',
      disabled: false,
      progress: null
    });

    busyAction.set('disconnect');
    expect(componentView.registryActionItems()[0]?.progress).toMatchObject({
      state: 'loading',
      shape: 'button'
    });
  });
});

function registeredStatus(): OperatorRegistryStatusDto {
  return {
    mode: 'DEMO',
    lifecycle: 'REGISTERED',
    enabled: true,
    simulation: true,
    candidateDefaults: {
      baseUrl: 'https://registry.example.com',
      registryScope: 'demo:registry'
    },
    registryOptions: [
      {
        id: 'registry-primary',
        label: 'Primary registry',
        baseUrl: 'https://registry.example.com',
        registryScope: 'demo:registry',
        selected: true
      },
      {
        id: 'registry-secondary',
        label: 'Secondary registry',
        baseUrl: 'https://registry-two.example.com',
        registryScope: 'demo:secondary',
        selected: false
      }
    ],
    draftInspection: null,
    selection: {
      baseUrl: 'https://registry.example.com',
      registryScope: 'demo:registry',
      confirmedAt: '2026-07-28T10:00:00.000Z'
    },
    nodeIdentity: {
      state: 'SIMULATED',
      initializedAt: '2026-07-28T10:00:00.000Z'
    },
    enrollment: {
      deploymentCode: 'dep_demo',
      installationTestBatchId: 'batch_demo',
      installationTestAcceptedAt: '2026-07-28T10:00:00.000Z',
      installationTestLedgerIndex: 1,
      completedAt: '2026-07-28T10:00:00.000Z'
    },
    audit: {
      createdAt: null,
      updatedAt: null,
      lastAttemptAt: null,
      lastSuccessAt: null,
      disabledAt: null,
      updatedBy: null
    },
    lastError: null
  };
}
