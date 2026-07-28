import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import type { OperatorRegistryStatusDto } from '../../../shared/core/contracts/operator.interface';
import { OperatorMenuStore } from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';
import { OperatorRegistryPageComponent } from './operator-registry-page.component';

describe('OperatorRegistryPageComponent', () => {
  it('reactively enables inspection when the operator types a registry URL', async () => {
    const status = unconfiguredStatus();
    const statusSignal = signal<OperatorRegistryStatusDto | null>(status);
    const registryBaseUrl = signal('');
    const expectedRegistryScope = signal('');
    const busyAction = signal(null);
    const registryStore = {
      status: statusSignal.asReadonly(),
      inspection: signal(null).asReadonly(),
      busyAction: busyAction.asReadonly(),
      error: signal('').asReadonly(),
      notice: signal('').asReadonly(),
      registryBaseUrl: registryBaseUrl.asReadonly(),
      expectedRegistryScope: expectedRegistryScope.asReadonly(),
      canInspect: computed(() =>
        busyAction() === null
        && Boolean(registryBaseUrl().trim())
        && !(statusSignal()?.enabled && statusSignal()?.lifecycle === 'REGISTERED')
      ),
      setRegistryBaseUrl: (value: string) => registryBaseUrl.set(value),
      setExpectedRegistryScope: (value: string) => expectedRegistryScope.set(value),
      loadStatus: vi.fn().mockResolvedValue(status),
      clearFeedback: vi.fn(),
      clearInspection: vi.fn(),
      setError: vi.fn(),
      setNotice: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [OperatorRegistryPageComponent],
      providers: [
        { provide: OperatorRegistryStore, useValue: registryStore },
        {
          provide: OperatorMenuStore,
          useValue: {
            activePopup: signal(null).asReadonly(),
            open: vi.fn(),
            closePopup: vi.fn()
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({}))
          }
        },
        {
          provide: Router,
          useValue: {
            navigate: vi.fn().mockResolvedValue(true)
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(OperatorRegistryPageComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const componentView = component as unknown as {
      canInspect: Signal<boolean>;
    };

    expect(componentView.canInspect()).toBe(false);

    registryStore.setRegistryBaseUrl('https://registry.example.com');
    expect(componentView.canInspect()).toBe(true);

    registryStore.setRegistryBaseUrl('');
    expect(componentView.canInspect()).toBe(false);
  });
});

function unconfiguredStatus(): OperatorRegistryStatusDto {
  return {
    mode: 'DEMO',
    lifecycle: 'UNCONFIGURED',
    enabled: false,
    simulation: true,
    candidateDefaults: {
      baseUrl: '',
      registryScope: ''
    },
    draftInspection: null,
    selection: null,
    nodeIdentity: {
      state: 'MISSING',
      publicKeyFingerprint: null,
      initializedAt: null
    },
    enrollment: null,
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
