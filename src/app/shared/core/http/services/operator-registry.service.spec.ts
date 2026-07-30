import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { I18nService } from '../../base/services/i18n.service';
import { RouteDelayService } from '../../base/services/route-delay.service';
import { SessionService } from '../../base/services/session.service';
import type {
  OperatorRegistryInspectionDto,
  OperatorRegistryStatusDto
} from '../../contracts/operator.interface';
import { HttpOperatorRegistryService } from './operator-registry.service';

describe('HttpOperatorRegistryService', () => {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const withRequestTimeout = vi.fn();
  let currentSession: unknown;

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    withRequestTimeout
      .mockReset()
      .mockImplementation((_route: string, task: Promise<unknown>) => task);
    currentSession = {
      kind: 'demo',
      userId: ' operator-demo-dev '
    };
    TestBed.configureTestingModule({
      providers: [
        HttpOperatorRegistryService,
        { provide: HttpClient, useValue: { get, post, put } },
        {
          provide: SessionService,
          useValue: {
            currentSession: () => currentSession
          }
        },
        {
          provide: I18nService,
          useValue: {
            currentLanguage: () => 'en'
          }
        },
        { provide: RouteDelayService, useValue: { withRequestTimeout } }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('sends the current demo operator identity through Java and centralizes the 30 second timeout', async () => {
    const status = registryStatus();
    get.mockReturnValue(of(status));

    const result = await TestBed.inject(HttpOperatorRegistryService).loadStatus();

    expect(result).toEqual(status);
    expect(get).toHaveBeenCalledTimes(1);
    const [, options] = get.mock.calls[0] as [string, { headers?: HttpHeaders }];
    expect(options.headers?.get('X-Demo-User-Id')).toBe('operator-demo-dev');
    expect(withRequestTimeout).toHaveBeenCalledWith(
      '/operator/registry',
      expect.any(Promise),
      'operator.request.timeout'
    );
  });

  it('posts only the normalized inspection contract and does not send a demo identity for Firebase', async () => {
    currentSession = {
      kind: 'firebase',
      profile: {
        id: 'operator-real',
        name: 'Real Operator',
        email: 'operator@example.com',
        initials: 'RO'
      }
    };
    const inspection = registryInspection();
    post.mockReturnValue(of(inspection));

    const result = await TestBed.inject(HttpOperatorRegistryService).inspect({
      baseUrl: ' https://registry.example.com ',
      expectedScope: ' partner:europe '
    });

    expect(result).toEqual(inspection);
    expect(post).toHaveBeenCalledWith(
      '/api/operator/registry/inspect',
      {
        baseUrl: 'https://registry.example.com',
        expectedScope: 'partner:europe'
      },
      {}
    );
  });

  it('uses the exact explicit register contract and null-body retry/disconnect payloads', async () => {
    const status = registryStatus();
    const unclaimedRow = {
      rowId: 'dep_demo',
      view: 'unclaimed',
      groupId: '',
      label: 'dep_demo',
      avatarUrl: '',
      claimState: 'unclaimed',
      eligibilityStatus: 'inactive',
      deploymentCount: 1,
      weightNumerator: '0',
      weightDenominator: '1',
      shareNumerator: '0',
      shareDenominator: '1'
    };
    post.mockImplementation((url: string) =>
      url.endsWith('/register') || url.endsWith('/disconnect')
        ? of({
            status,
            leaderboardEntry: url.endsWith('/register')
              ? unclaimedRow
              : null,
            leaderboardUpserts: url.endsWith('/register')
              ? [unclaimedRow]
              : [],
            removedLeaderboardEntryIds: url.endsWith('/disconnect')
              ? ['dep_demo']
              : [],
            leaderboardTotalDelta: url.endsWith('/register') ? 1 : -1,
            created: url.endsWith('/register')
          })
        : of(status)
    );
    const service = TestBed.inject(HttpOperatorRegistryService);

    await service.confirm(' inspection_1 ');
    const registered = await service.register({
      registryBaseUrl: ' https://registry.example.com ',
      expectedRegistryScope: ' partner:europe '
    });
    await service.retry();
    const disconnected = await service.disconnect();

    expect(registered.leaderboardEntry).toEqual(expect.objectContaining({
      id: 'dep_demo',
      nodeId: 'dep_demo',
      group: 'UNCLAIMED'
    }));
    expect(registered.leaderboardUpserts).toEqual([
      expect.objectContaining({ id: 'dep_demo', group: 'UNCLAIMED' })
    ]);
    expect(registered.leaderboardTotalDelta).toBe(1);
    expect(disconnected.removedLeaderboardEntryIds).toEqual(['dep_demo']);
    expect(disconnected.leaderboardUpserts).toEqual([]);
    expect(disconnected.leaderboardTotalDelta).toBe(-1);

    expect(post.mock.calls.map((call: unknown[]) => [call[0], call[1]])).toEqual([
      ['/api/operator/registry/confirm', { inspectionToken: 'inspection_1' }],
      ['/api/operator/registry/register', {
        registryBaseUrl: 'https://registry.example.com',
        expectedRegistryScope: 'partner:europe'
      }],
      ['/api/operator/registry/retry', null],
      ['/api/operator/registry/disconnect', null]
    ]);
    for (const call of post.mock.calls as Array<[string, unknown, { headers?: HttpHeaders }]>) {
      expect(call[2].headers?.get('X-Demo-User-Id')).toBe('operator-demo-dev');
    }
  });

  it('synchronizes QMAU delivery, pages blocked reports, and requeues one exact report', async () => {
    const report = {
      id: '0123456789abcdef01234567',
      period: '2026-06',
      windowStart: '2026-05-03',
      windowEnd: '2026-06-01',
      revision: 1,
      rulesetVersion: 'qmau-v1',
      qualifiedMauCount: 248,
      actionCount: 731,
      status: 'BLOCKED' as const,
      attemptCount: 2,
      nextRetryAt: null,
      failureCode: 'RECEIPT_INVALID',
      failureMessage: 'The registry receipt was invalid.',
      batchId: null,
      acceptedAt: null,
      createdAt: '2026-07-01T00:01:00.000Z',
      updatedAt: '2026-07-01T00:03:00.000Z'
    };
    const synchronization = {
      state: 'BLOCKED' as const,
      code: 'MEASUREMENT_OUTBOX_BLOCKED',
      message: 'A QMAU report requires operator review.',
      materialized: 1,
      submitted: 1,
      accepted: 0,
      pending: 0,
      blocked: 1,
      synchronizedAt: '2026-07-01T00:04:00.000Z'
    };
    post.mockReturnValueOnce(of(synchronization));
    get.mockReturnValueOnce(of({
      items: [report],
      page: 0,
      size: 4,
      totalElements: 1,
      totalPages: 1
    }));
    post.mockReturnValueOnce(of({
      ...report,
      status: 'PENDING' as const,
      updatedAt: '2026-07-01T00:05:00.000Z'
    }));
    const service = TestBed.inject(HttpOperatorRegistryService);

    const syncResult = await service.synchronizeMeasurements();
    const page = await service.measurementReportPage({
      page: 0,
      pageSize: 4,
      filters: {
        status: 'BLOCKED',
        revision: 'client-cache-only'
      }
    });
    const requeued = await service.requeueMeasurementReport(report.id);

    expect(syncResult).toEqual(synchronization);
    expect(page).toEqual({ items: [report], total: 1 });
    expect(requeued.status).toBe('PENDING');
    expect(post.mock.calls[0]).toEqual([
      '/api/operator/measurements/synchronize',
      null,
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    ]);
    const reportCall = get.mock.calls[0] as [
      string,
      { params: { get(name: string): string | null } }
    ];
    expect(reportCall[0]).toBe('/api/operator/measurements/reports');
    expect(reportCall[1].params.get('status')).toBe('BLOCKED');
    expect(reportCall[1].params.get('page')).toBe('0');
    expect(reportCall[1].params.get('size')).toBe('4');
    expect(reportCall[1].params.get('revision')).toBeNull();
    expect(post.mock.calls[1]).toEqual([
      '/api/operator/measurements/reports/0123456789abcdef01234567/requeue',
      null,
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    ]);
  });

  it('wires claim, grouping-token, and group-link actions to the Java operator routes', async () => {
    const claimStatus = {
      claimed: true,
      claimedAt: '2026-07-28T18:00:00.000Z',
      claimantUserId: 'operator-demo-dev',
      claimantName: 'Demo Operator',
      claimantAvatarUrl: null,
      operatorGroupId: 'opg_demo',
      activeLinkId: null,
      sharePercent: 4.25,
      shareNumerator: '17',
      shareDenominator: '400',
      verificationCapability: 'AVAILABLE',
      verificationUnavailableReason: null,
      verificationStatus: 'PENDING_REVIEW',
      verificationSubmittedAt: '2026-07-28T18:00:00.000Z',
      legalName: 'Demo Operator s.r.o.',
      eligibilityStatus: 'inactive'
    };
    const claimedRow = {
      rowId: 'opg_demo',
      view: 'claimed',
      groupId: 'opg_demo',
      label: 'Demo Operator s.r.o.',
      avatarUrl: null,
      claimState: 'pending-review',
      eligibilityStatus: 'inactive',
      deploymentCount: 1,
      weightNumerator: '17',
      weightDenominator: '1',
      shareNumerator: '17',
      shareDenominator: '400'
    };
    const claimMutation = {
      status: claimStatus,
      submission: {
        legalName: 'Demo Operator s.r.o.',
        registrationNumber: '51 234 567',
        jurisdiction: 'Slovakia',
        registeredAddress: 'Main Street 1, Bratislava',
        website: 'https://operator.example.test/',
        verificationContactName: 'Demo Operator',
        verificationContactRole: 'Managing director',
        verificationContactEmail: 'operator@example.test',
        authorityAttested: true
      },
      leaderboardEntry: claimedRow,
      leaderboardUpserts: [claimedRow],
      removedLeaderboardEntryIds: ['dep_demo'],
      leaderboardTotalDelta: 0
    };
    get.mockReturnValue(of({
      status: claimStatus,
      submission: claimMutation.submission
    }));
    post.mockImplementation((url: string) =>
      url.endsWith('/claim') || url.endsWith('/claim/redeem')
        ? of(claimMutation)
        : of({
          clientToken: url.endsWith('/client-token') ? 'client_token_1' : null,
          receipt: {
            acceptedAt: '2026-07-28T18:00:00.000Z',
            claimState: 'pending-review',
            groupId: 'opg_demo',
            tokenExpiresAt: url.endsWith('/client-token')
              ? '2026-07-28T18:05:00.000Z'
              : null
          }
        })
    );
    const service = TestBed.inject(HttpOperatorRegistryService);

    const loaded = await service.loadClaimStatus();
    const claimed = await service.claimShare({
      legalName: ' Demo Operator s.r.o. ',
      registrationNumber: ' 51 234 567 ',
      jurisdiction: ' Slovakia ',
      registeredAddress: ' Main Street 1, Bratislava ',
      website: ' https://operator.example.test ',
      verificationContactName: ' Demo Operator ',
      verificationContactRole: ' Managing director ',
      verificationContactEmail: ' OPERATOR@EXAMPLE.TEST ',
      authorityAttested: true
    });
    const token = await service.issueGroupingToken();
    const grouped = await service.linkOperatorGroup({
      clientToken: ' token_from_other_claimed_deployment '
    });

    expect(loaded).toEqual({
      status: {
        ...claimStatus,
        eligibilityStatus: 'INACTIVE'
      },
      submission: claimMutation.submission
    });
    expect(claimed).toEqual({
      status: {
        ...claimStatus,
        eligibilityStatus: 'INACTIVE'
      },
      submission: claimMutation.submission,
      leaderboardEntry: expect.objectContaining({
        id: 'opg_demo',
        group: 'CLAIMED',
        operatorGroupId: 'opg_demo',
        claimed: true
      }),
      leaderboardUpserts: [
        expect.objectContaining({
          id: 'opg_demo',
          group: 'CLAIMED',
          operatorGroupId: 'opg_demo'
        })
      ],
      removedLeaderboardEntryIds: ['dep_demo'],
      leaderboardTotalDelta: 0
    });
    expect(grouped).toEqual({
      status: {
        ...claimStatus,
        eligibilityStatus: 'INACTIVE'
      },
      submission: claimMutation.submission,
      leaderboardEntry: expect.objectContaining({
        id: 'opg_demo',
        group: 'CLAIMED',
        operatorGroupId: 'opg_demo',
        claimed: true
      }),
      leaderboardUpserts: [
        expect.objectContaining({
          id: 'opg_demo',
          group: 'CLAIMED',
          operatorGroupId: 'opg_demo'
        })
      ],
      removedLeaderboardEntryIds: ['dep_demo'],
      leaderboardTotalDelta: 0
    });
    expect(token).toEqual({
      clientToken: 'client_token_1',
      expiresAt: '2026-07-28T18:05:00.000Z'
    });
    expect(post.mock.calls.map((call: unknown[]) => [call[0], call[1]])).toEqual([
      ['/api/operator/claim', {
        legalName: 'Demo Operator s.r.o.',
        registrationNumber: '51 234 567',
        jurisdiction: 'Slovakia',
        registeredAddress: 'Main Street 1, Bratislava',
        website: 'https://operator.example.test/',
        verificationContactName: 'Demo Operator',
        verificationContactRole: 'Managing director',
        verificationContactEmail: 'operator@example.test',
        authorityAttested: true
      }],
      ['/api/operator/claim/client-token', null],
      ['/api/operator/claim/redeem', {
        clientToken: 'token_from_other_claimed_deployment'
      }]
    ]);
    expect(get.mock.calls.filter(
      (call: unknown[]) => call[0] === '/api/operator/claim'
    )).toHaveLength(1);
  });

  it('does not post structured verification to a legacy claim endpoint', async () => {
    get.mockReturnValue(of({
      status: {
        claimed: false,
        claimedAt: null,
        claimantUserId: null,
        claimantName: null,
        claimantAvatarUrl: null,
        operatorGroupId: null,
        sharePercent: 0
      },
      submission: null
    }));
    const service = TestBed.inject(HttpOperatorRegistryService);

    const status = await service.loadClaimStatus();

    expect(status.status.verificationCapability).toBe('BACKEND_UNAVAILABLE');
    await expect(service.claimShare({
      legalName: 'Example Operator s.r.o.',
      registrationNumber: '51 234 567',
      jurisdiction: 'Slovakia',
      registeredAddress: 'Main Street 1, Bratislava',
      website: '',
      verificationContactName: 'Authorized Contact',
      verificationContactRole: 'Managing director',
      verificationContactEmail: 'operator@example.test',
      authorityAttested: true
    })).rejects.toThrow('operator.claim.verification.backend.unavailable');
    expect(post).not.toHaveBeenCalled();
  });

  it('maps the three Java leaderboard views into one grouped cursor stream', async () => {
    const snapshot = {
      snapshotId: 'lbs_0123456789abcdef0123456789abcdef',
      formulaVersion: 'six-complete-month-average-v1',
      rulesetVersion: 'qmau-v1',
      throughPeriod: '2026-07',
      throughLedgerIndex: 42,
      throughAuditIndex: 17,
      throughReviewIndex: 3,
      throughEligibilityIndex: 2,
      throughTransferEventIndex: 0,
      ledgerHeadHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      auditHeadHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      reviewHeadHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      eligibilityHeadHash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      transferEventHeadHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      founderUnitsNumerator: '100000',
      founderUnitsDenominator: '1',
      founderShareNumerator: '1',
      founderShareDenominator: '2',
      measuredWeightNumerator: '100000',
      measuredWeightDenominator: '1',
      claimedWeightNumerator: '0',
      claimedWeightDenominator: '1',
      createdAt: '2026-07-29T00:00:00.000Z',
      snapshotHash: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    };
    get.mockImplementation((_url: string, options: { params?: { get(name: string): string | null } }) => {
      const view = options.params?.get('view');
      if (view === 'founder') {
        return of({
          snapshot,
          view,
          items: [{
            rowId: 'founder',
            view,
            groupId: null,
            label: 'MyScoutee',
            avatarUrl: null,
            claimState: 'founder',
            eligibilityStatus: 'active',
            deploymentCount: 1,
            weightNumerator: '100000',
            weightDenominator: '1',
            shareNumerator: '1',
            shareDenominator: '2'
          }],
          nextCursor: null
        });
      }
      if (view === 'claimed') {
        return of({
          snapshot,
          view,
          items: [{
            rowId: 'claimed-group:campus',
            view,
            groupId: 'opg_campus',
            label: 'Campus Operator',
            avatarUrl: 'https://example.com/campus.webp',
            claimState: 'pending-review',
            eligibilityStatus: 'future-state',
            deploymentCount: 2,
            weightNumerator: '60000',
            weightDenominator: '1',
            shareNumerator: '1',
            shareDenominator: '4'
          }],
          nextCursor: null
        });
      }
      return of({
        snapshot,
        view: 'unclaimed',
        items: [{
          rowId: 'dep_unclaimed',
          view: 'unclaimed',
          groupId: null,
          label: 'Unclaimed deployment',
          avatarUrl: null,
          claimState: 'unclaimed',
          eligibilityStatus: 'inactive',
          deploymentCount: 1,
          weightNumerator: '40000',
          weightDenominator: '1',
          shareNumerator: '0',
          shareDenominator: '1'
        }],
        nextCursor: null
      });
    });
    const service = TestBed.inject(HttpOperatorRegistryService);

    const first = await service.leaderboardPage({
      page: 0,
      pageSize: 2,
      sort: 'share',
      direction: 'desc'
    });
    const second = await service.leaderboardPage({
      page: 1,
      pageSize: 2,
      cursor: first.nextCursor,
      sort: 'share',
      direction: 'desc'
    });

    expect(first.items.map(item => item.group)).toEqual(['FOUNDER', 'CLAIMED']);
    expect(first.items[1]).toEqual(expect.objectContaining({
      operatorGroupId: 'opg_campus',
      deploymentCount: 2,
      verifiedWeight: 60_000,
      sharePercent: 25,
      claimVerificationStatus: 'PENDING_REVIEW',
      eligibilityStatus: 'INACTIVE'
    }));
    expect(first.nextCursor).toMatch(/^operator-http:/);
    expect(second.items).toEqual([
      expect.objectContaining({
        id: 'dep_unclaimed',
        nodeId: 'dep_unclaimed',
        group: 'UNCLAIMED',
        verifiedWeight: 40_000,
        sharePercent: 0,
        eligibilityStatus: 'INACTIVE'
      })
    ]);
    expect(second.nextCursor).toBeNull();
    expect(second.total).toBe(3);
    expect(first.context?.snapshotBoundary).toEqual(expect.objectContaining({
      throughLedgerIndex: 42,
      throughAuditIndex: 17,
      throughReviewIndex: 3,
      throughEligibilityIndex: 2,
      reviewHeadHash: snapshot.reviewHeadHash,
      eligibilityHeadHash: snapshot.eligibilityHeadHash
    }));
    expect(second.context?.groupSummaries).toEqual([
      expect.objectContaining({
        group: 'FOUNDER',
        verifiedWeight: 100_000,
        sharePercent: 50
      }),
      expect.objectContaining({
        group: 'CLAIMED',
        verifiedWeight: 0,
        sharePercent: 0
      }),
      expect.objectContaining({
        group: 'UNCLAIMED',
        verifiedWeight: 100_000,
        sharePercent: 0
      })
    ]);
    const leaderboardCalls = get.mock.calls.filter(
      (call: unknown[]) => call[0] === '/api/operator/leaderboard'
    );
    expect(leaderboardCalls.map(
      (call: unknown[]) => (call[1] as { params: { get(name: string): string | null } })
        .params.get('view')
    )).toEqual(['founder', 'claimed', 'unclaimed']);
    expect((leaderboardCalls[2]?.[1] as {
      params: { get(name: string): string | null };
    }).params.get('throughPeriod')).toBe('2026-07');
  });

  it('rejects a leaderboard page when its signed snapshot boundary changes', async () => {
    const snapshot = {
      snapshotId: 'lbs_0123456789abcdef0123456789abcdef',
      formulaVersion: 'six-complete-month-average-v1',
      rulesetVersion: 'qmau-v1',
      throughPeriod: '2026-07',
      throughLedgerIndex: 42,
      throughAuditIndex: 17,
      throughReviewIndex: 3,
      throughEligibilityIndex: 2,
      throughTransferEventIndex: 0,
      ledgerHeadHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      auditHeadHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      reviewHeadHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      eligibilityHeadHash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      transferEventHeadHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      founderUnitsNumerator: '100000',
      founderUnitsDenominator: '1',
      founderShareNumerator: '1',
      founderShareDenominator: '2',
      measuredWeightNumerator: '100000',
      measuredWeightDenominator: '1',
      claimedWeightNumerator: '0',
      claimedWeightDenominator: '1',
      createdAt: '2026-07-29T00:00:00.000Z',
      snapshotHash: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    };
    get.mockImplementation((
      _url: string,
      options: { params?: { get(name: string): string | null } }
    ) => {
      const view = options.params?.get('view') ?? 'founder';
      return of({
        snapshot: view === 'claimed'
          ? {
              ...snapshot,
              throughEligibilityIndex: 3,
              eligibilityHeadHash:
                'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
            }
          : snapshot,
        view,
        items: view === 'founder'
          ? [{
              rowId: 'founder',
              view,
              groupId: null,
              label: 'MyScoutee',
              avatarUrl: null,
              claimState: 'founder',
              eligibilityStatus: 'active',
              deploymentCount: 1,
              weightNumerator: '100000',
              weightDenominator: '1',
              shareNumerator: '1',
              shareDenominator: '2'
            }]
          : [],
        nextCursor: null
      });
    });
    const service = TestBed.inject(HttpOperatorRegistryService);

    await expect(service.leaderboardPage({
      page: 0,
      pageSize: 2,
      sort: 'share',
      direction: 'desc'
    })).rejects.toThrow('operator.leaderboard.error.snapshot.changed');
  });

  it('resumes a legacy compound cursor at the zero ownership-transfer boundary', async () => {
    const zeroHash =
      'sha256:0000000000000000000000000000000000000000000000000000000000000000';
    const legacyCursor = `operator-http:${encodeURIComponent(JSON.stringify({
      viewIndex: 1,
      viewCursor: 'registry-v2-cursor',
      throughPeriod: '2026-07',
      throughLedgerIndex: 42,
      throughAuditIndex: 17,
      throughReviewIndex: 3,
      throughEligibilityIndex: 2,
      ledgerHeadHash:
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      auditHeadHash:
        'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      reviewHeadHash:
        'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      eligibilityHeadHash:
        'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      emitted: 1
    }))}`;
    const snapshot = {
      snapshotId: 'lbs_0123456789abcdef0123456789abcdef',
      formulaVersion: 'six-complete-month-average-v1',
      rulesetVersion: 'qmau-v1',
      throughPeriod: '2026-07',
      throughLedgerIndex: 42,
      throughAuditIndex: 17,
      throughReviewIndex: 3,
      throughEligibilityIndex: 2,
      throughTransferEventIndex: 0,
      ledgerHeadHash:
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      auditHeadHash:
        'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      reviewHeadHash:
        'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      eligibilityHeadHash:
        'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      transferEventHeadHash: zeroHash,
      founderUnitsNumerator: '100000',
      founderUnitsDenominator: '1',
      founderShareNumerator: '1',
      founderShareDenominator: '2',
      measuredWeightNumerator: '100000',
      measuredWeightDenominator: '1',
      claimedWeightNumerator: '60000',
      claimedWeightDenominator: '1',
      createdAt: '2026-07-29T00:00:00.000Z',
      snapshotHash:
        'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    };
    get.mockReturnValue(of({
      snapshot,
      view: 'claimed',
      items: [{
        rowId: 'claimed-group:campus',
        view: 'claimed',
        groupId: 'opg_campus',
        label: 'Campus Operator',
        avatarUrl: null,
        claimState: 'approved',
        eligibilityStatus: 'active',
        deploymentCount: 2,
        weightNumerator: '60000',
        weightDenominator: '1',
        shareNumerator: '1',
        shareDenominator: '4'
      }],
      nextCursor: null
    }));
    const service = TestBed.inject(HttpOperatorRegistryService);

    const result = await service.leaderboardPage({
      page: 1,
      pageSize: 1,
      cursor: legacyCursor,
      sort: 'share',
      direction: 'desc'
    });

    expect(result.items).toHaveLength(1);
    expect(result.context?.snapshotBoundary).toEqual(expect.objectContaining({
      throughTransferEventIndex: 0,
      transferEventHeadHash: zeroHash
    }));
    const [, options] = get.mock.calls[0] as [
      string,
      { params: { get(name: string): string | null } }
    ];
    expect(options.params.get('view')).toBe('claimed');
    expect(options.params.get('cursor')).toBe('registry-v2-cursor');
  });

  it('pages claimed-group deployments without reloading the leaderboard stream', async () => {
    const groupId = 'opg_0123456789abcdef0123456789abcdef';
    const snapshot = {
      snapshotId: 'lbs_0123456789abcdef0123456789abcdef',
      formulaVersion: 'six-complete-month-average-v1',
      rulesetVersion: 'qmau-v1',
      throughPeriod: '2026-07',
      throughLedgerIndex: 42,
      throughAuditIndex: 17,
      throughReviewIndex: 3,
      throughEligibilityIndex: 2,
      throughTransferEventIndex: 0,
      ledgerHeadHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      auditHeadHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      reviewHeadHash: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      eligibilityHeadHash: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      transferEventHeadHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      founderUnitsNumerator: '1',
      founderUnitsDenominator: '1',
      founderShareNumerator: '1',
      founderShareDenominator: '10',
      measuredWeightNumerator: '100',
      measuredWeightDenominator: '1',
      claimedWeightNumerator: '100',
      claimedWeightDenominator: '1',
      createdAt: '2026-07-29T00:00:00.000Z',
      snapshotHash: 'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    };
    get.mockImplementation((
      _url: string,
      options: { params: { get(name: string): string | null } }
    ) => options.params.get('cursor')
      ? of({
          snapshot,
          groupId,
          items: [{
            deploymentId: 'dep_east',
            groupId,
            claimState: 'rejected',
            eligibilityStatus: 'inactive',
            membershipState: 'linked',
            weightNumerator: '125',
            weightDenominator: '2',
            shareNumerator: '0',
            shareDenominator: '1'
          }],
          nextCursor: null
        })
      : of({
          snapshot,
          groupId,
          items: [{
            deploymentId: 'dep_owner',
            groupId,
            claimState: 'pending-review',
            eligibilityStatus: 'inactive',
            membershipState: 'owner',
            weightNumerator: '75',
            weightDenominator: '1',
            shareNumerator: '0',
            shareDenominator: '1'
          }],
          nextCursor: 'registry-cursor-2'
        })
    );
    const service = TestBed.inject(HttpOperatorRegistryService);

    const first = await service.leaderboardDeploymentPage(groupId, {
      page: 0,
      pageSize: 1
    });
    const second = await service.leaderboardDeploymentPage(groupId, {
      page: 1,
      pageSize: 1,
      cursor: first.nextCursor
    });

    expect(first).toEqual({
      items: [{
        deploymentId: 'dep_owner',
        groupId,
        claimState: 'pending-review',
        eligibilityStatus: 'INACTIVE',
        membershipState: 'owner',
        verifiedWeight: 75,
        sharePercent: 0
      }],
      total: 2,
      nextCursor: 'registry-cursor-2',
      context: expect.objectContaining({
        throughReviewIndex: 3,
        throughEligibilityIndex: 2,
        reviewHeadHash: snapshot.reviewHeadHash,
        eligibilityHeadHash: snapshot.eligibilityHeadHash
      })
    });
    expect(second).toEqual({
      items: [{
        deploymentId: 'dep_east',
        groupId,
        claimState: 'rejected',
        eligibilityStatus: 'INACTIVE',
        membershipState: 'linked',
        verifiedWeight: 62.5,
        sharePercent: 0
      }],
      total: 2,
      nextCursor: null,
      context: expect.objectContaining({
        throughReviewIndex: 3,
        throughEligibilityIndex: 2
      })
    });
    expect(get.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      `/api/operator/leaderboard/groups/${groupId}/deployments`,
      `/api/operator/leaderboard/groups/${groupId}/deployments`
    ]);
    const deploymentCalls = get.mock.calls as Array<[
      string,
      { params: { get(name: string): string | null } }
    ]>;
    expect(deploymentCalls[0]?.[1].params.get('limit')).toBe('1');
    expect(deploymentCalls[0]?.[1].params.get('cursor')).toBeNull();
    expect(deploymentCalls[1]?.[1].params.get('cursor'))
      .toBe('registry-cursor-2');
  });

  it('combines deployment community providers and signed announcements', async () => {
    get.mockImplementation((url: string) => {
      if (url === '/api/operator/community/providers') {
        return of([
          {
            id: ' discord ',
            name: ' Discord ',
            purpose: ' operator.community.provider.discord.purpose ',
            url: 'https://discord.com/',
            configured: false,
            available: true
          },
          {
            id: 'discourse',
            name: 'Discourse',
            purpose: 'operator.community.provider.discourse.purpose',
            url: 'https://www.discourse.org/',
            configured: false,
            available: true
          }
        ]);
      }
      if (url === '/api/operator/announcements') {
        return of(remoteAnnouncementPage());
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const community = await TestBed.inject(HttpOperatorRegistryService)
      .loadCommunityStatus();

    expect(community).toEqual(expect.objectContaining({
      availability: 'INVISIBLE',
      updatedAt: '2026-07-28T18:30:00.000Z',
      providers: [
        {
          id: 'discord',
          name: 'Discord',
          purpose: 'operator.community.provider.discord.purpose',
          url: 'https://discord.com/',
          configured: false,
          available: true
        },
        {
          id: 'discourse',
          name: 'Discourse',
          purpose: 'operator.community.provider.discourse.purpose',
          url: 'https://www.discourse.org/',
          configured: false,
          available: true
        }
      ]
    }));
    expect(community.announcements).toEqual([
      expect.objectContaining({
        id: 'ann_update_1',
        kind: 'UPDATE',
        severity: 'INFO',
        status: 'PUBLISHED',
        unread: true,
        title: 'MyScoutee 1.2.3 is available',
        body: 'Install the verified stable release.',
        links: [
          expect.objectContaining({
            label: 'operator.community.announcement.link.release.notes',
            verified: true
          })
        ],
        update: expect.objectContaining({
          version: '1.2.3',
          artifact: expect.objectContaining({
            downloadUrlVerified: true,
            sha256Digest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            packageSigningKeyId: 'pkey_86dfce4288ce436029e7236ac60b0604',
            signature: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
            signatureVerified: true,
            sizeBytes: 12_345
          })
        })
      })
    ]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledWith(
      '/api/operator/community/providers',
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    );
    const announcementCall = get.mock.calls.find(
      (call: unknown[]) => call[0] === '/api/operator/announcements'
    ) as [
      string,
      { params: { get(name: string): string | null } }
    ];
    const [url, options] = announcementCall;
    expect(url).toBe('/api/operator/announcements');
    expect(options.params.get('includeExpired')).toBe('false');
    expect(options.params.get('limit')).toBe('100');
    expect(withRequestTimeout.mock.calls.map(call => call[0])).toEqual([
      '/operator/community/providers',
      '/operator/announcements'
    ]);
  });

  it('loads currency-separated deployment revenue through the operator route', async () => {
    const revenue = {
      generatedAtIso: '2026-07-28T18:30:00.000Z',
      rulesetVersion: 'net-captured-revenue-v1',
      commissionRateBasisPoints: 500,
      currencies: [
        {
          currencyCode: 'EUR',
          fractionDigits: 2,
          payableEvents: 1,
          payableAssets: 2,
          projectedEventMinor: 1_000,
          projectedAssetMinor: 2_000,
          capturedPaymentMinor: 900,
          refundedPaymentMinor: 100,
          netPaymentMinor: 800,
          commissionBasisMinor: 800,
          estimatedCommissionMinor: 40,
          paymentCount: 2,
          payingUsers: 2,
          eventBuyers: 1,
          assetBorrowers: 1,
          assetCategories: [],
          timeline: []
        }
      ]
    };
    get.mockReturnValue(of(revenue));

    const result = await TestBed.inject(HttpOperatorRegistryService).loadRevenue();

    expect(result).toEqual(revenue);
    expect(get).toHaveBeenCalledWith(
      '/api/operator/revenue',
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    );
    expect(withRequestTimeout).toHaveBeenCalledWith(
      '/operator/revenue',
      expect.any(Promise),
      'operator.request.timeout'
    );
  });

  it('runs explicit revenue synchronization and returns the aggregate delivery state', async () => {
    const synchronization = {
      state: 'BLOCKED' as const,
      code: 'REVENUE_OUTBOX_BLOCKED',
      message: 'A revenue report requires operator review.',
      materialized: 1,
      submitted: 2,
      accepted: 1,
      pending: 0,
      blocked: 1,
      synchronizedAtIso: '2026-07-28T18:31:00.000Z'
    };
    post.mockReturnValue(of(synchronization));

    const result = await TestBed.inject(
      HttpOperatorRegistryService
    ).synchronizeRevenue();

    expect(result).toEqual(synchronization);
    expect(post).toHaveBeenCalledWith(
      '/api/operator/revenue/synchronize',
      null,
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    );
    expect(withRequestTimeout).toHaveBeenCalledWith(
      '/operator/revenue/synchronize',
      expect.any(Promise),
      'operator.request.timeout'
    );
  });

  it('loads only blocked revenue reports and requeues one exact report', async () => {
    const report = {
      id: '0123456789abcdef01234567',
      period: '2026-07-27',
      revision: 2,
      supersedesBatchId: null,
      rulesetVersion: 'net-captured-revenue-v1',
      commissionRateBasisPoints: 500,
      currencies: [],
      payloadHash: 'payload-hash',
      status: 'BLOCKED' as const,
      attemptCount: 1,
      nextRetryAt: null,
      failureCode: 'INVALID_REVENUE_RECEIPT',
      failureMessage: 'Registry receipt was invalid.',
      failureRetryable: false,
      failedAt: '2026-07-28T18:31:00.000Z',
      acceptedBatchId: null,
      acceptedAt: null,
      createdAt: '2026-07-28T18:30:00.000Z',
      updatedAt: '2026-07-28T18:31:00.000Z'
    };
    get.mockReturnValue(of({
      items: [report],
      page: 0,
      size: 5,
      totalElements: 1,
      totalPages: 1
    }));
    post.mockReturnValue(of({
      ...report,
      status: 'PENDING' as const,
      updatedAt: '2026-07-28T18:32:00.000Z'
    }));
    const service = TestBed.inject(HttpOperatorRegistryService);

    const page = await service.revenueReportPage({
      page: 0,
      pageSize: 5,
      filters: { status: 'BLOCKED', revision: 'ignored-by-http' }
    });
    const requeued = await service.requeueRevenueReport(report.id);

    expect(page).toEqual({ items: [report], total: 1 });
    expect(requeued.status).toBe('PENDING');
    const reportCall = get.mock.calls[0] as [
      string,
      { params: { get(name: string): string | null } }
    ];
    expect(reportCall[0]).toBe('/api/operator/revenue/reports');
    expect(reportCall[1].params.get('status')).toBe('BLOCKED');
    expect(reportCall[1].params.get('page')).toBe('0');
    expect(reportCall[1].params.get('size')).toBe('5');
    expect(reportCall[1].params.get('revision')).toBeNull();
    expect(post).toHaveBeenCalledWith(
      '/api/operator/revenue/reports/0123456789abcdef01234567/requeue',
      null,
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    );
  });

  it('pages validated currency-separated registry settlements with the compound cursor', async () => {
    const settlement = remoteSettlement();
    get
      .mockReturnValueOnce(of({
        items: [settlement],
        nextAfterPeriod: '2026-06',
        nextAfterSettlementId: settlement.settlementId,
        generatedAtIso: '2026-07-02T08:00:00.000Z'
      }))
      .mockReturnValueOnce(of({
        items: [],
        nextAfterPeriod: null,
        nextAfterSettlementId: null,
        generatedAtIso: '2026-07-02T08:00:00.000Z'
      }));
    const service = TestBed.inject(HttpOperatorRegistryService);

    const first = await service.settlementPage({
      page: 0,
      pageSize: 1,
      filters: {
        currencyCode: ' eur ',
        fromPeriod: '2026-01',
        throughPeriod: '2026-06',
        includeSuperseded: false
      }
    });
    await service.settlementPage({
      page: 1,
      pageSize: 1,
      cursor: first.nextCursor
    });

    expect(first.items).toEqual([expect.objectContaining({
      settlementId: settlement.settlementId,
      currencyCode: 'EUR',
      beneficiaryType: 'OPERATOR_GROUP',
      valuationIsNonBinding: true,
      indicativeNetworkValueMinor: 3_378_060
    })]);
    expect(first.context).toEqual({
      generatedAtIso: '2026-07-02T08:00:00.000Z'
    });
    expect(first.nextCursor).toMatch(/^operator-settlement:/);
    const firstCall = get.mock.calls[0] as [
      string,
      { params: { get(name: string): string | null } }
    ];
    expect(firstCall[0]).toBe('/api/operator/revenue/settlements');
    expect(firstCall[1].params.get('currencyCode')).toBe('EUR');
    expect(firstCall[1].params.get('fromPeriod')).toBe('2026-01');
    expect(firstCall[1].params.get('throughPeriod')).toBe('2026-06');
    expect(firstCall[1].params.get('includeSuperseded')).toBe('false');
    expect(firstCall[1].params.get('limit')).toBe('1');
    const secondCall = get.mock.calls[1] as [
      string,
      { params: { get(name: string): string | null } }
    ];
    expect(secondCall[1].params.get('afterPeriod')).toBe('2026-06');
    expect(secondCall[1].params.get('afterSettlementId')).toBe(
      settlement.settlementId
    );
  });

  it('rejects an unverified registry settlement response', async () => {
    get.mockReturnValue(of({
      items: [{
        ...remoteSettlement(),
        valuationIsNonBinding: false
      }],
      nextAfterPeriod: null,
      nextAfterSettlementId: null,
      generatedAtIso: '2026-07-02T08:00:00.000Z'
    }));

    await expect(
      TestBed.inject(HttpOperatorRegistryService).settlementPage({
        page: 0,
        pageSize: 6
      })
    ).rejects.toThrow('operator.revenue.settlement.response.invalid');
  });

  it('loads, saves, and tests the persisted operator configuration through Java', async () => {
    const configuration = operatorConfiguration();
    get.mockReturnValue(of(configuration));
    put.mockReturnValue(of({
      ...configuration,
      branding: {
        ...configuration.branding,
        productName: 'Community Hub',
        revision: 2
      }
    }));
    post.mockReturnValue(of({
      kind: 'FIREBASE_AUTHENTICATION',
      success: true,
      message: 'operator.configuration.test.success',
      testedAt: '2026-07-28T19:00:00.000Z',
      firebase: null
    }));
    const service = TestBed.inject(HttpOperatorRegistryService);
    const request = {
      adminEmails: ['operator@example.test'],
      privacyContact: {
        dataControllerName: 'Example Operator s.r.o.',
        privacyContactEmail: 'privacy@example.test'
      },
      socialLinks: [{
        provider: 'community',
        label: 'Community',
        url: 'https://community.example.test/',
        icon: 'forum',
        handle: '@community'
      }],
      branding: {
        productName: 'Community Hub',
        logoUrl: '/api/media/operator/logo.webp',
        logoCharacterIndex: null,
        themePreset: 'OCEAN' as const
      },
      payment: {
        providerId: 'stripe',
        publicBaseUrl: 'https://community.example.test',
        merchantAccount: '',
        credential: 'write-only-token'
      },
      firebase: {
        projectId: 'community-hub',
        apiKey: 'browser-api-key',
        authDomain: 'community-hub.firebaseapp.com',
        storageBucket: 'community-hub.firebasestorage.app',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:abc',
        measurementId: '',
        vapidKey: '',
        authenticationCredential: 'write-only-auth',
        messagingCredential: 'write-only-messaging'
      }
    };

    const loaded = await service.loadConfiguration();
    const saved = await service.saveConfiguration(request);
    const tested = await service.testConfiguration({
      kind: 'FIREBASE_AUTHENTICATION'
    });

    expect(saved.branding.productName).toBe('Community Hub');
    expect(loaded.payment.availableProviders).toEqual([
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
    ]);
    expect(tested.success).toBe(true);
    expect(get).toHaveBeenCalledWith(
      '/api/operator/configuration',
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    );
    expect(put).toHaveBeenCalledWith(
      '/api/operator/configuration',
      request,
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    );
    expect(post).toHaveBeenCalledWith(
      '/api/operator/configuration/tests',
      { kind: 'FIREBASE_AUTHENTICATION' },
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    );
  });

  it('sends trimmed write-only browser proof for the Firebase messaging test', async () => {
    post.mockReturnValue(of({
      kind: 'FIREBASE_MESSAGING',
      success: true,
      message: 'Firebase messaging test succeeded.',
      testedAt: '2026-07-28T19:05:00.000Z',
      firebase: null
    }));

    const result = await TestBed.inject(
      HttpOperatorRegistryService
    ).testConfiguration({
      kind: 'FIREBASE_MESSAGING',
      destinationToken: ' registration-token ',
      browserReadinessToken: ' browser-generated-token ',
      browserConfigurationRevision: 7,
      browserAppId: ' 1:123456789:web:operator '
    });

    expect(result.success).toBe(true);
    expect(post).toHaveBeenCalledWith(
      '/api/operator/configuration/tests',
      {
        kind: 'FIREBASE_MESSAGING',
        destinationToken: 'registration-token',
        browserReadinessToken: 'browser-generated-token',
        browserConfigurationRevision: 7,
        browserAppId: '1:123456789:web:operator'
      },
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    );
  });

  it('approves a verified update and streams Java status/events into update progress', async () => {
    const announcementPage = remoteAnnouncementPage();
    const checking = remoteUpdateJob('CHECKING', 5, '1.0.0');
    const downloading = remoteUpdateJob('DOWNLOADING', 35, '1.0.0');
    const completed = remoteUpdateJob('COMPLETED', 100, '1.2.3');
    post.mockReturnValue(of(checking));
    get.mockImplementation((url: string) => {
      if (url === '/api/operator/updates') {
        return of({
          enabled: true,
          currentVersion: '1.0.0',
          latestJob: null
        });
      }
      if (url === '/api/operator/announcements') {
        return of(announcementPage);
      }
      if (url === '/api/operator/updates/jobs/update_job_1') {
        return of(downloading);
      }
      if (url === '/api/operator/updates/jobs/update_job_1/events') {
        return of({
          items: [
            { sequence: 1, status: downloading },
            { sequence: 2, status: completed }
          ],
          nextAfter: 2,
          terminal: true
        });
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    const progress = vi.fn();
    const service = TestBed.inject(HttpOperatorRegistryService);

    const available = await service.loadDeploymentUpdate();
    const result = await service.applyDeploymentUpdate(progress);

    expect(available).toEqual(expect.objectContaining({
      currentVersion: '1.0.0',
      availableVersion: '1.2.3',
      updateAvailable: true,
      progress: expect.objectContaining({ phase: 'IDLE' })
    }));
    expect(post).toHaveBeenCalledWith(
      '/api/operator/updates',
      { announcementId: 'ann_update_1' },
      expect.objectContaining({ headers: expect.any(HttpHeaders) })
    );
    expect(result).toEqual(expect.objectContaining({
      currentVersion: '1.2.3',
      availableVersion: '1.2.3',
      updateAvailable: false,
      lastUpdatedAt: '2026-07-28T18:40:00.000Z',
      progress: expect.objectContaining({
        phase: 'COMPLETED',
        percent: 100,
        bytesDownloaded: 12_345,
        bytesTotal: 12_345
      })
    }));
    expect(progress.mock.calls.map(call => call[0].phase)).toEqual([
      'CHECKING',
      'DOWNLOADING',
      'DOWNLOADING',
      'COMPLETED'
    ]);
    const eventCall = get.mock.calls.find(
      (call: unknown[]) => call[0] === '/api/operator/updates/jobs/update_job_1/events'
    ) as [string, { params: { get(name: string): string | null } }];
    expect(eventCall[1].params.get('after')).toBe('0');
    expect(eventCall[1].params.get('limit')).toBe('100');
    expect(withRequestTimeout.mock.calls.map(call => call[0])).toEqual([
      '/operator/updates',
      '/operator/announcements',
      '/operator/updates',
      '/operator/updates/jobs/update_job_1',
      '/operator/updates/jobs/update_job_1/events'
    ]);
  });

  it('reconnects to the durable latest update job and maps recovery-required as terminal failure', async () => {
    const recoveryRequired = remoteUpdateJob(
      'RECOVERY_REQUIRED',
      72,
      '1.0.0'
    );
    get.mockImplementation((url: string) => {
      if (url === '/api/operator/updates') {
        return of({
          enabled: true,
          currentVersion: '1.0.0',
          latestJob: recoveryRequired
        });
      }
      if (url === '/api/operator/announcements') {
        return of(remoteAnnouncementPage());
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    const update = await TestBed.inject(HttpOperatorRegistryService)
      .loadDeploymentUpdate();

    expect(update.currentVersion).toBe('1.0.0');
    expect(update.progress).toEqual(expect.objectContaining({
      phase: 'FAILED',
      percent: 72,
      message: 'operator.update.error.recovery.required'
    }));
    expect(get.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      '/api/operator/updates',
      '/api/operator/announcements'
    ]);
  });
});

function registryStatus(): OperatorRegistryStatusDto {
  return {
    mode: 'DEMO',
    lifecycle: 'UNCONFIGURED',
    enabled: false,
    simulation: false,
    candidateDefaults: {
      baseUrl: 'https://registry.example.com',
      registryScope: 'partner:europe'
    },
    draftInspection: null,
    selection: null,
    nodeIdentity: {
      state: 'MISSING',
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

function registryInspection(): OperatorRegistryInspectionDto {
  return {
    inspectionToken: 'inspection_1',
    expiresAt: '2026-07-28T04:00:00.000Z',
    baseUrl: 'https://registry.example.com',
    simulation: false,
    registryIdentity: {
      identityEndpoint: 'https://registry.example.com/v1/registry/identity',
      protocolVersion: '1',
      registryScope: 'partner:europe'
    }
  };
}

function remoteSettlement() {
  return {
    settlementId: `stl_${'1'.padStart(32, '0')}`,
    period: '2026-06',
    currencyCode: 'EUR',
    fractionDigits: 2,
    revision: 1,
    supersedesSettlementId: null,
    beneficiaryType: 'OPERATOR_GROUP',
    beneficiaryId: `opg_${'1'.repeat(32)}`,
    shareNumerator: '277',
    shareDenominator: '5000',
    networkPoolMinor: 52_500,
    networkPoolAllocationMinor: 2_908,
    ttmCommissionBasisMinor: 1_050_000,
    ttmNetworkCommissionPoolMinor: 52_500,
    indicativeNetworkValueMinor: 3_378_060,
    indicativeValueAllocationMinor: 187_144,
    valuationRulesetVersion: 'three-month-acceleration-valuation-v1',
    baseValuationMultiplierBasisPoints: 30_000,
    recentThreeMonthAverageMinor: 96_000,
    priorThreeMonthAverageMinor: 81_000,
    earlierThreeMonthAverageMinor: 75_000,
    recentGrowthBasisPoints: 1_851,
    priorGrowthBasisPoints: 800,
    accelerationBasisPoints: 1_051,
    valuationAdjustmentBasisPoints: 724,
    effectiveValuationMultiplierBasisPoints: 32_172,
    valuationIsNonBinding: true,
    throughLedgerIndex: 42,
    throughAuditIndex: 22,
    throughReviewIndex: 8,
    throughEligibilityIndex: 6,
    sourceFingerprint: `sha256:${'a'.repeat(64)}`,
    settlementHash: `sha256:${'b'.repeat(64)}`,
    acceptedAtIso: '2026-07-02T08:00:00.000Z'
  };
}

function operatorConfiguration() {
  return {
    capability: 'AVAILABLE' as const,
    unavailableReason: null,
    adminEmails: [],
    privacyContact: {
      configured: false,
      dataControllerName: '',
      privacyContactEmail: ''
    },
    socialLinks: [],
    branding: {
      productName: 'MyScoutee',
      homeLabel: 'Your preferences come first',
      logoUrl: 'assets/logo/heart.webp',
      logoCharacterIndex: null,
      themePreset: 'AURORA' as const,
      revision: 1
    },
    payment: {
      availableProviders: [
        {
          id: 'stripe',
          label: 'Stripe',
          logoUrl: 'assets/payment-providers/stripe.svg',
          logoAlt: 'Stripe',
          palette: 'violet' as const
        },
        {
          id: 'barion',
          label: 'Barion',
          logoUrl: 'assets/payment-providers/barion.svg',
          logoAlt: 'Barion',
          palette: 'blue' as const
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

function remoteAnnouncementPage() {
  return {
    snapshot: {
      asOf: '2026-07-28T18:30:00.000Z',
      throughSequence: 1,
      createdAt: '2026-07-28T18:30:00.000Z'
    },
    items: [
      {
        sequence: 1,
        announcementId: 'ann_update_1',
        kind: 'UPDATE',
        severity: 'NOTICE',
        publishedAt: '2026-07-28T18:00:00.000Z',
        expiresAt: null,
        titleKey: null,
        bodyKey: null,
        localizations: [
          {
            locale: 'en',
            title: 'MyScoutee 1.2.3 is available',
            body: 'Install the verified stable release.'
          }
        ],
        links: [
          {
            relation: 'release-notes',
            url: 'https://downloads.example.test/releases/1.2.3'
          }
        ],
        updateManifest: {
          manifestVersion: '1',
          releaseVersion: '1.2.3',
          channel: 'stable',
          publishedAt: '2026-07-28T18:00:00.000Z',
          minimumCompatibleVersion: '1.0.0',
          maximumCompatibleVersion: '2.0.0',
          artifactUrl: 'https://downloads.example.test/myscoutee_1.2.3_amd64.deb',
          artifactSizeBytes: 12_345,
          artifactSha256: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          packageSigningKeyId: 'pkey_86dfce4288ce436029e7236ac60b0604',
          packageSignature: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
          releaseNotesUrl: 'https://downloads.example.test/releases/1.2.3',
          backupRequired: true,
          expectedDowntimeSeconds: 90,
          status: 'AVAILABLE',
          supersedesVersion: null,
          supersededByVersion: null,
          revocationReason: null,
          packageSigningKeyConfigured: true,
          packageSigningKeyMatches: true,
          packageSignatureVerified: true
        },
        updateManifestHash: 'sha256:manifest',
        announcementHash: 'sha256:announcement'
      }
    ],
    nextCursor: null
  };
}

function remoteUpdateJob(phase: string, percent: number, currentVersion: string) {
  return {
    schemaVersion: 1,
    jobId: 'update_job_1',
    phase,
    percent,
    message: null,
    updatedAt: phase === 'COMPLETED'
      ? '2026-07-28T18:40:00.000Z'
      : '2026-07-28T18:35:00.000Z',
    requestedAt: '2026-07-28T18:34:00.000Z',
    requestedBy: 'operator-real',
    manifestHash: 'sha256:manifest',
    currentVersion,
    targetVersion: '1.2.3',
    channel: 'stable',
    artifactSha256: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    backupPath: phase === 'COMPLETED' ? '/var/backups/myscoutee/update_job_1' : null
  };
}
