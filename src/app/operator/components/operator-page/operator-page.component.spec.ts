import { signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../../shared/core/base/services/i18n.service';
import { DeploymentConfigurationService } from '../../../shared/core/base/services/deployment-configuration.service';
import type { ListQuery } from '../../../shared/core/contracts/list.interface';
import type {
  OperatorLeaderboardEntryDto,
  OperatorRegistryStatusDto
} from '../../../shared/core/contracts/operator.interface';
import { AppRuntimeStore } from '../../../shared/ui/context/stores/app-runtime.store';
import {
  OperatorLeaderboardStore,
  type OperatorLeaderboardFilters
} from '../../../shared/ui/context/stores/operator-leaderboard.store';
import {
  OperatorMenuStore,
  type OperatorMenuKind
} from '../../../shared/ui/context/stores/operator-menu.store';
import { OperatorRegistryStore } from '../../../shared/ui/context/stores/operator-registry.store';
import { OperatorWorkspaceStore } from '../../../shared/ui/context/stores/operator-workspace.store';
import { OperatorPageComponent } from './operator-page.component';
import type { AppMenuItem } from '../../../shared/ui/components/core/menu';

describe('OperatorPageComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('keeps the leaderboard mounted while registration refreshes and the popup closes', () => {
    const registryStatus = signal<OperatorRegistryStatusDto | null>(
      registeredStatus()
    );
    const registryBusyAction = signal<string | null>(null);
    const activePopup = signal<OperatorMenuKind | null>('registration');
    const leaderboardRevision = signal(0);
    const leaderboardCacheUpsert = signal<OperatorLeaderboardEntryDto | null>(null);
    const workspaceBusyAction = signal<string | null>(null);
    const invalidateLeaderboard = vi.fn();

    TestBed.configureTestingModule({
      imports: [OperatorPageComponent],
      providers: [
        {
          provide: DeploymentConfigurationService,
          useValue: {
            branding: signal({
              productName: 'MyScoutee',
              homeLabel: 'Community',
              logoUrl: 'assets/logo/heart.webp',
              logoCharacterIndex: null,
              themePreset: 'AURORA',
              revision: 1
            }).asReadonly()
          }
        },
        {
          provide: OperatorRegistryStore,
          useValue: {
            status: registryStatus.asReadonly(),
            busyAction: registryBusyAction.asReadonly(),
            error: signal('').asReadonly(),
            loadStatus: vi.fn()
          }
        },
        {
          provide: OperatorMenuStore,
          useValue: {
            activePopup: activePopup.asReadonly(),
            open: (kind: OperatorMenuKind) => activePopup.set(kind),
            closePopup: () => activePopup.set(null)
          }
        },
        {
          provide: OperatorWorkspaceStore,
          useValue: {
            busyAction: workspaceBusyAction.asReadonly(),
            deploymentUpdate: signal(null).asReadonly(),
            claimStatus: signal(null).asReadonly(),
            loadDeploymentUpdate: vi.fn()
          }
        },
        {
          provide: OperatorLeaderboardStore,
          useValue: {
            revision: leaderboardRevision.asReadonly(),
            latestCacheUpsert: leaderboardCacheUpsert.asReadonly(),
            invalidate: invalidateLeaderboard,
            queryPage: vi.fn()
          }
        },
        {
          provide: AppRuntimeStore,
          useValue: {
            selectLoadingState: () => signal({ status: 'success' }).asReadonly()
          }
        },
        {
          provide: I18nService,
          useValue: {
            currentLanguage: () => 'en',
            translate: (value: string) => value
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(OperatorPageComponent);
    const componentView = fixture.componentInstance as unknown as {
      loading: Signal<boolean>;
      leaderboardQuery: Signal<Partial<ListQuery<OperatorLeaderboardFilters>>>;
      actionItems: Signal<readonly AppMenuItem<string>[]>;
      leaderboardSmartList: {
        reinsertVisibleItem: (
          item: OperatorLeaderboardEntryDto,
          options: { totalDelta: number; loadedRange: string }
        ) => boolean;
      };
    };
    const initialQuery = componentView.leaderboardQuery();

    registryBusyAction.set('load');
    expect(componentView.loading()).toBe(false);
    expect(componentView.actionItems().find(item => item.id === 'registration')?.progress)
      .toBeUndefined();

    activePopup.set(null);
    expect(componentView.loading()).toBe(false);
    expect(componentView.leaderboardQuery()).toBe(initialQuery);
    expect(invalidateLeaderboard).not.toHaveBeenCalled();
    expect(componentView.actionItems().map(item => item.id)).toEqual([
      'updates',
      'registration',
      'claim',
      'configuration',
      'revenue'
    ]);
    expect(componentView.actionItems().at(-1)).toEqual(expect.objectContaining({
      label: 'operator.action.revenue',
      palette: 'green',
      layout: 'big'
    }));
    workspaceBusyAction.set('claim-share');
    expect(componentView.actionItems().find(item => item.id === 'claim')?.progress)
      .toBeUndefined();
    registryBusyAction.set('register');
    expect(componentView.actionItems().find(item => item.id === 'registration')?.progress)
      .toBeUndefined();

    const registeredDeployment: OperatorLeaderboardEntryDto = {
      id: 'dep_registered',
      nodeId: 'dep_registered',
      label: 'dep_registered',
      group: 'UNCLAIMED',
      verifiedWeight: 0,
      sharePercent: 0,
      claimed: false,
      deploymentCount: 1
    };
    const reinsertVisibleItem = vi.fn().mockReturnValue(true);
    componentView.leaderboardSmartList = { reinsertVisibleItem };
    leaderboardCacheUpsert.set(registeredDeployment);
    TestBed.tick();

    expect(reinsertVisibleItem).toHaveBeenCalledWith(registeredDeployment, {
      totalDelta: 1,
      loadedRange: 'any'
    });
    expect(componentView.leaderboardQuery()).toBe(initialQuery);
    expect(invalidateLeaderboard).not.toHaveBeenCalled();

    fixture.destroy();
  });
});

function registeredStatus(): OperatorRegistryStatusDto {
  return {
    mode: 'DEMO',
    lifecycle: 'REGISTERED',
    enabled: true,
    simulation: true,
    candidateDefaults: null,
    registryOptions: [],
    draftInspection: null,
    selection: null,
    nodeIdentity: {
      state: 'SIMULATED',
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
