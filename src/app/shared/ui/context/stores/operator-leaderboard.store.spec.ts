import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import {
  SessionService,
  type AppSession
} from '../../../core/base/services/session.service';
import { OperatorLeaderboardStore } from './operator-leaderboard.store';

describe('OperatorLeaderboardStore deployment drilldown', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads the selected group page without querying or invalidating the leaderboard', async () => {
    const session = signal<AppSession | null>({
      kind: 'demo',
      userId: 'operator-demo-dev'
    });
    const deploymentPage = {
      items: [{
        deploymentId: 'dep_owner',
        groupId: 'opg_test',
        claimState: 'approved' as const,
        membershipState: 'owner' as const,
        verifiedWeight: 42,
        sharePercent: 4.2
      }],
      total: 1,
      nextCursor: null
    };
    const leaderboardPage = vi.fn();
    const leaderboardDeploymentPage = vi.fn()
      .mockResolvedValue(deploymentPage);
    TestBed.configureTestingModule({
      providers: [
        OperatorLeaderboardStore,
        {
          provide: OperatorRegistryService,
          useValue: {
            leaderboardPage,
            leaderboardDeploymentPage
          }
        },
        {
          provide: SessionService,
          useValue: {
            session: session.asReadonly(),
            currentSession: () => session()
          }
        }
      ]
    });
    const store = TestBed.inject(OperatorLeaderboardStore);
    const abortController = new AbortController();
    const query = {
      page: 1,
      pageSize: 8,
      cursor: 'registry-cursor',
      filters: { groupId: ' opg_test ' }
    };

    const result = await store.queryDeploymentPage(
      query,
      abortController.signal
    );

    expect(result).toBe(deploymentPage);
    expect(leaderboardDeploymentPage).toHaveBeenCalledWith(
      'opg_test',
      query,
      abortController.signal
    );
    expect(leaderboardPage).not.toHaveBeenCalled();
    expect(store.revision()).toBe(0);
  });
});
