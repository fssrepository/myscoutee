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
    post.mockReturnValue(of(status));
    const service = TestBed.inject(HttpOperatorRegistryService);

    await service.confirm(' inspection_1 ');
    await service.register({
      registryBaseUrl: ' https://registry.example.com ',
      expectedRegistryScope: ' partner:europe '
    });
    await service.retry();
    await service.disconnect();

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
      shareDenominator: '400'
    };
    get.mockReturnValue(of(claimStatus));
    post.mockImplementation((url: string) => of({
      clientToken: url.endsWith('/client-token') ? 'client_token_1' : null,
      receipt: {
        acceptedAt: '2026-07-28T18:00:00.000Z',
        claimState: 'claimed',
        groupId: 'opg_demo',
        tokenExpiresAt: url.endsWith('/client-token')
          ? '2026-07-28T18:05:00.000Z'
          : null
      }
    }));
    const service = TestBed.inject(HttpOperatorRegistryService);

    const loaded = await service.loadClaimStatus();
    const claimed = await service.claimShare({
      operatorName: ' Demo Operator ',
      operatorAvatarUrl: 'https://cdn.example.test/operator.webp'
    });
    const token = await service.issueGroupingToken();
    const grouped = await service.linkOperatorGroup({
      clientToken: ' token_from_other_claimed_deployment '
    });

    expect(loaded).toEqual(claimStatus);
    expect(claimed).toEqual(claimStatus);
    expect(grouped).toEqual(claimStatus);
    expect(token).toEqual({
      clientToken: 'client_token_1',
      expiresAt: '2026-07-28T18:05:00.000Z'
    });
    expect(post.mock.calls.map((call: unknown[]) => [call[0], call[1]])).toEqual([
      ['/api/operator/claim', {
        operatorName: 'Demo Operator',
        operatorAvatarUrl: 'https://cdn.example.test/operator.webp'
      }],
      ['/api/operator/claim/client-token', null],
      ['/api/operator/claim/redeem', {
        clientToken: 'token_from_other_claimed_deployment'
      }]
    ]);
    expect(get.mock.calls.filter(
      (call: unknown[]) => call[0] === '/api/operator/claim'
    )).toHaveLength(3);
  });

  it('maps the three Java leaderboard views into one grouped cursor stream', async () => {
    const snapshot = {
      throughPeriod: '2026-07',
      founderUnitsNumerator: '100000',
      founderUnitsDenominator: '1',
      founderShareNumerator: '1',
      founderShareDenominator: '2',
      measuredWeightNumerator: '100000',
      measuredWeightDenominator: '1',
      claimedWeightNumerator: '60000',
      claimedWeightDenominator: '1'
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
            claimState: 'claimed',
            deploymentCount: 2,
            weightNumerator: '60000',
            weightDenominator: '1',
            shareNumerator: '3',
            shareDenominator: '10'
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
      sharePercent: 30
    }));
    expect(first.nextCursor).toMatch(/^operator-http:/);
    expect(second.items).toEqual([
      expect.objectContaining({
        id: 'dep_unclaimed',
        nodeId: 'dep_unclaimed',
        group: 'UNCLAIMED',
        verifiedWeight: 40_000,
        sharePercent: 0
      })
    ]);
    expect(second.nextCursor).toBeNull();
    expect(second.total).toBe(3);
    expect(second.context?.groupSummaries).toEqual([
      expect.objectContaining({
        group: 'FOUNDER',
        verifiedWeight: 100_000,
        sharePercent: 50
      }),
      expect.objectContaining({
        group: 'CLAIMED',
        verifiedWeight: 60_000,
        sharePercent: 50
      }),
      expect.objectContaining({
        group: 'UNCLAIMED',
        verifiedWeight: 40_000,
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

  it('loads signed Java announcements into the common community model', async () => {
    get.mockReturnValue(of(remoteAnnouncementPage()));

    const community = await TestBed.inject(HttpOperatorRegistryService)
      .loadCommunityStatus();

    expect(community).toEqual(expect.objectContaining({
      availability: 'INVISIBLE',
      updatedAt: '2026-07-28T18:30:00.000Z',
      providers: []
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
            sizeBytes: 12_345
          })
        })
      })
    ]);
    expect(get).toHaveBeenCalledTimes(1);
    const [url, options] = get.mock.calls[0] as [
      string,
      { params: { get(name: string): string | null } }
    ];
    expect(url).toBe('/api/operator/announcements');
    expect(options.params.get('includeExpired')).toBe('false');
    expect(options.params.get('limit')).toBe('100');
    expect(withRequestTimeout).toHaveBeenCalledWith(
      '/operator/announcements',
      expect.any(Promise),
      'operator.request.timeout'
    );
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
      testedAt: '2026-07-28T19:00:00.000Z'
    }));
    const service = TestBed.inject(HttpOperatorRegistryService);
    const request = {
      branding: {
        productName: 'Community Hub',
        homeLabel: 'Meet locally',
        logoUrl: '/api/media/operator/logo.webp',
        themePreset: 'OCEAN' as const
      },
      payment: {
        providerId: 'stripe',
        credential: 'write-only-token'
      },
      firebase: {
        projectId: 'community-hub',
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
      { id: 'stripe', label: 'Stripe' },
      { id: 'barion', label: 'Barion' }
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

function operatorConfiguration() {
  return {
    capability: 'AVAILABLE' as const,
    unavailableReason: null,
    branding: {
      productName: 'MyScoutee',
      homeLabel: 'Your preferences come first',
      logoUrl: 'assets/logo/heart.webp',
      themePreset: 'AURORA' as const,
      revision: 1
    },
    payment: {
      availableProviders: [
        { id: 'stripe', label: 'Stripe' },
        { id: 'barion', label: 'Barion' }
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
          packageSigningKeyId: 'release_key_1',
          packageSignature: 'ed25519:signature',
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
