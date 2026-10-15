import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OperatorRegistryService } from '../../../../core/base/services/operator/operator-registry.service';
import {
  SessionService,
  type AppSession
} from '../../../../core/base/services/accounts/session.service';
import { OperatorLeaderboardStore } from './operator-leaderboard.store';

describe('OperatorLeaderboardStore deployment drilldown', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows read failures, clears them after recovery and ignores obsolete failures', async () => {
    const session = signal<AppSession | null>({ kind: 'demo', userId: 'operator-demo-dev' });
    const leaderboardPage = vi.fn().mockRejectedValue(new Error('operator.leaderboard.error.registration.required'));
    TestBed.configureTestingModule({ providers: [
      OperatorLeaderboardStore,
      { provide: OperatorRegistryService, useValue: { leaderboardPage } },
      { provide: SessionService, useValue: { session: session.asReadonly(), currentSession: () => session() } }
    ] });
    const store = TestBed.inject(OperatorLeaderboardStore);
    const query = { page: 0, pageSize: 8, filters: { revision: 0 } };
    await expect(store.queryPage(query)).rejects.toThrow('operator.leaderboard.error.registration.required');
    expect(store.error()).toBe('operator.leaderboard.error.registration.required');
    leaderboardPage.mockResolvedValue({ items: [], total: 0 });
    expect((await store.queryPage(query)).items).toEqual([]);
    expect(store.error()).toBeNull();

    let fail!: (reason: Error) => void;
    leaderboardPage.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject; }));
    const pending = store.queryPage(query);
    const rejection = expect(pending).rejects.toThrow('Obsolete');
    store.invalidate();
    fail(new Error('Obsolete'));
    await rejection;
    expect(store.error()).toBeNull();
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
        eligibilityStatus: 'ACTIVE' as const,
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
