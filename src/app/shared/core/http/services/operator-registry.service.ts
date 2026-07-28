import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  OperatorGroupLinkRequestDto,
  OperatorGroupingTokenDto,
  OperatorClaimRequestDto,
  OperatorClaimStatusDto,
  OperatorCommunityAnnouncementDto,
  OperatorCommunityAnnouncementKind,
  OperatorCommunityAnnouncementSeverity,
  OperatorCommunityAnnouncementStatus,
  OperatorCommunityAvailability,
  OperatorCommunityStatusDto,
  OperatorConfigurationDto,
  OperatorConfigurationSaveRequestDto,
  OperatorConfigurationTestRequestDto,
  OperatorConfigurationTestResultDto,
  OperatorDeploymentUpdateDto,
  OperatorDeploymentUpdatePhase,
  OperatorDeploymentUpdateProgressDto,
  OperatorDeploymentUpdateProgressHandler,
  OperatorLeaderboardEntryDto,
  OperatorLeaderboardGroup,
  OperatorLeaderboardGroupSummaryDto,
  OperatorLeaderboardPageDto,
  OperatorRevenueDto,
  OperatorRegistryRegisterRequestDto,
  OperatorRegistryConfirmRequestDto,
  OperatorRegistryInspectRequestDto,
  OperatorRegistryInspectionDto,
  OperatorRegistryServiceContract,
  OperatorRegistryStatusDto
} from '../../contracts/operator.interface';
import type { ListQuery } from '../../contracts/list.interface';
import { I18nService } from '../../base/services/i18n.service';
import { SessionService } from '../../base/services/session.service';
import { RouteDelayService } from '../../base/services/route-delay.service';

const OPERATOR_REGISTRY_ROUTE = '/operator/registry';
const OPERATOR_NETWORK_ROUTE = '/operator';
const OPERATOR_ANNOUNCEMENTS_ROUTE = '/operator/announcements';
const OPERATOR_UPDATES_ROUTE = '/operator/updates';
const OPERATOR_CONFIGURATION_ROUTE = '/operator/configuration';
const OPERATOR_REVENUE_ROUTE = '/operator/revenue';
const DEMO_OPERATOR_USER_HEADER = 'X-Demo-User-Id';
const LEADERBOARD_VIEWS = ['founder', 'claimed', 'unclaimed'] as const;
const UPDATE_POLL_INTERVAL_MS = 750;
const UPDATE_POLL_LIMIT = 800;
const UPDATE_TERMINAL_PHASES = new Set([
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'RECOVERY_REQUIRED'
]);

type RemoteLeaderboardView = typeof LEADERBOARD_VIEWS[number];

interface RemoteOperatorActionReceipt {
  acceptedAt: string | null;
  claimState: string | null;
  groupId: string | null;
  tokenExpiresAt: string | null;
}

interface RemoteOperatorActionResult {
  clientToken: string | null;
  receipt: RemoteOperatorActionReceipt;
}

type RemoteOperatorClaimStatus = Partial<OperatorClaimStatusDto>;

interface RemoteOperatorLeaderboardSnapshot {
  throughPeriod: string;
  founderUnitsNumerator: string;
  founderUnitsDenominator: string;
  founderShareNumerator: string;
  founderShareDenominator: string;
  measuredWeightNumerator: string;
  measuredWeightDenominator: string;
  claimedWeightNumerator: string;
  claimedWeightDenominator: string;
}

interface RemoteOperatorLeaderboardRow {
  rowId: string;
  view: RemoteLeaderboardView;
  groupId: string | null;
  label: string;
  avatarUrl: string | null;
  claimState: string;
  deploymentCount: number;
  weightNumerator: string;
  weightDenominator: string;
  shareNumerator: string;
  shareDenominator: string;
}

interface RemoteOperatorLeaderboardPage {
  snapshot: RemoteOperatorLeaderboardSnapshot;
  view: RemoteLeaderboardView;
  items: RemoteOperatorLeaderboardRow[];
  nextCursor: string | null;
}

interface OperatorLeaderboardCursorState {
  viewIndex: number;
  viewCursor: string | null;
  throughPeriod: string | null;
  emitted: number;
}

interface RemoteOperatorAnnouncementLocalization {
  locale: string;
  title: string;
  body: string;
}

interface RemoteOperatorAnnouncementLink {
  relation: string;
  url: string;
}

interface RemoteOperatorUpdateManifest {
  manifestVersion: string;
  releaseVersion: string;
  channel: string;
  publishedAt: string;
  minimumCompatibleVersion: string;
  maximumCompatibleVersion: string;
  artifactUrl: string;
  artifactSizeBytes: number;
  artifactSha256: string;
  packageSigningKeyId: string;
  packageSignature: string;
  releaseNotesUrl: string;
  backupRequired: boolean;
  expectedDowntimeSeconds: number;
  status: string;
  supersedesVersion: string | null;
  supersededByVersion: string | null;
  revocationReason: string | null;
  packageSigningKeyConfigured: boolean;
  packageSigningKeyMatches: boolean;
  packageSignatureVerified: boolean;
}

interface RemoteOperatorAnnouncement {
  sequence: number;
  announcementId: string;
  kind: string;
  severity: string;
  publishedAt: string;
  expiresAt: string | null;
  titleKey: string | null;
  bodyKey: string | null;
  localizations: RemoteOperatorAnnouncementLocalization[];
  links: RemoteOperatorAnnouncementLink[];
  updateManifest: RemoteOperatorUpdateManifest | null;
  updateManifestHash: string | null;
  announcementHash: string;
}

interface RemoteOperatorAnnouncementPage {
  snapshot: {
    asOf: string;
    throughSequence: number;
    createdAt: string;
  };
  items: RemoteOperatorAnnouncement[];
  nextCursor: string | null;
}

interface RemoteOperatorUpdateJob {
  schemaVersion: number;
  jobId: string;
  phase: string;
  percent: number;
  message: string | null;
  updatedAt: string;
  requestedAt: string;
  requestedBy: string;
  manifestHash: string;
  currentVersion: string;
  targetVersion: string;
  channel: string;
  artifactSha256: string;
  backupPath: string | null;
}

interface RemoteOperatorUpdateEventPage {
  items: Array<{
    sequence: number;
    status: RemoteOperatorUpdateJob;
  }>;
  nextAfter: number;
  terminal: boolean;
}

interface RemoteOperatorUpdatesStatus {
  enabled: boolean;
  currentVersion: string;
  latestJob: RemoteOperatorUpdateJob | null;
}

@Injectable({
  providedIn: 'root'
})
export class HttpOperatorRegistryService implements OperatorRegistryServiceContract {
  readonly source = 'http' as const;
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly sessionService = inject(SessionService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly apiBaseUrl = (environment.apiBaseUrl ?? '/api').replace(/\/+$/, '');
  private readonly endpoint = `${this.apiBaseUrl}${OPERATOR_REGISTRY_ROUTE}`;
  private readonly operatorEndpoint = `${this.apiBaseUrl}${OPERATOR_NETWORK_ROUTE}`;
  private latestUpdateAnnouncement: RemoteOperatorAnnouncement | null = null;
  private latestAnnouncementsCheckedAt: string | null = null;
  private activeUpdateJob: RemoteOperatorUpdateJob | null = null;
  private currentDeploymentVersion = '—';
  private claimVerificationAvailable: boolean | null = null;

  async loadStatus(): Promise<OperatorRegistryStatusDto> {
    return await this.requireResponse(
      OPERATOR_REGISTRY_ROUTE,
      this.http.get<OperatorRegistryStatusDto>(this.endpoint, this.requestOptions()).toPromise()
    );
  }

  async inspect(request: OperatorRegistryInspectRequestDto): Promise<OperatorRegistryInspectionDto> {
    const payload: OperatorRegistryInspectRequestDto = {
      baseUrl: request.baseUrl.trim(),
      ...(request.expectedScope?.trim() ? { expectedScope: request.expectedScope.trim() } : {})
    };
    return await this.requireResponse(
      `${OPERATOR_REGISTRY_ROUTE}/inspect`,
      this.http.post<OperatorRegistryInspectionDto>(
        `${this.endpoint}/inspect`,
        payload,
        this.requestOptions()
      ).toPromise()
    );
  }

  async confirm(inspectionToken: string): Promise<OperatorRegistryStatusDto> {
    const payload: OperatorRegistryConfirmRequestDto = {
      inspectionToken: inspectionToken.trim()
    };
    return await this.requireResponse(
      `${OPERATOR_REGISTRY_ROUTE}/confirm`,
      this.http.post<OperatorRegistryStatusDto>(
        `${this.endpoint}/confirm`,
        payload,
        this.requestOptions()
      ).toPromise()
    );
  }

  async register(request: OperatorRegistryRegisterRequestDto): Promise<OperatorRegistryStatusDto> {
    const payload: OperatorRegistryRegisterRequestDto = {
      registryBaseUrl: request.registryBaseUrl.trim(),
      ...(request.expectedRegistryScope?.trim()
        ? { expectedRegistryScope: request.expectedRegistryScope.trim() }
        : {})
    };
    return await this.requireResponse(
      `${OPERATOR_REGISTRY_ROUTE}/register`,
      this.http.post<OperatorRegistryStatusDto>(
        `${this.endpoint}/register`,
        payload,
        this.requestOptions()
      ).toPromise()
    );
  }

  async retry(): Promise<OperatorRegistryStatusDto> {
    return await this.requireResponse(
      `${OPERATOR_REGISTRY_ROUTE}/retry`,
      this.http.post<OperatorRegistryStatusDto>(
        `${this.endpoint}/retry`,
        null,
        this.requestOptions()
      ).toPromise()
    );
  }

  async disconnect(): Promise<OperatorRegistryStatusDto> {
    return await this.requireResponse(
      `${OPERATOR_REGISTRY_ROUTE}/disconnect`,
      this.http.post<OperatorRegistryStatusDto>(
        `${this.endpoint}/disconnect`,
        null,
        this.requestOptions()
      ).toPromise()
    );
  }

  async leaderboardPage(
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<OperatorLeaderboardPageDto> {
    this.throwIfAborted(signal);
    const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(query.pageSize) || 20)));
    const state = this.decodeLeaderboardCursor(query.cursor);
    const items: OperatorLeaderboardEntryDto[] = [];
    let viewIndex = state.viewIndex;
    let viewCursor = state.viewCursor;
    let throughPeriod = state.throughPeriod;
    let snapshot: RemoteOperatorLeaderboardSnapshot | null = null;
    let requestCount = 0;

    while (items.length < pageSize && viewIndex < LEADERBOARD_VIEWS.length) {
      requestCount += 1;
      if (requestCount > 100) {
        throw new Error('operator.leaderboard.error.pagination');
      }
      this.throwIfAborted(signal);
      const view = LEADERBOARD_VIEWS[viewIndex]!;
      let params = new HttpParams()
        .set('view', view)
        .set('limit', pageSize - items.length);
      if (throughPeriod) {
        params = params.set('throughPeriod', throughPeriod);
      }
      if (viewCursor) {
        params = params.set('cursor', viewCursor);
      }
      const remote = await this.requireResponse(
        `${OPERATOR_NETWORK_ROUTE}/leaderboard`,
        this.http.get<RemoteOperatorLeaderboardPage>(
          `${this.operatorEndpoint}/leaderboard`,
          this.requestOptions(params)
        ).toPromise()
      );
      this.throwIfAborted(signal);
      if (remote.view !== view) {
        throw new Error('operator.leaderboard.error.response');
      }
      snapshot ??= remote.snapshot;
      throughPeriod ??= remote.snapshot.throughPeriod;
      items.push(...remote.items.map(row => this.toLeaderboardEntry(row)));

      if (remote.nextCursor) {
        if (remote.nextCursor === viewCursor && remote.items.length === 0) {
          throw new Error('operator.leaderboard.error.pagination');
        }
        viewCursor = remote.nextCursor;
      } else {
        viewIndex += 1;
        viewCursor = null;
      }
    }

    const emitted = state.emitted + items.length;
    const nextCursor = viewIndex < LEADERBOARD_VIEWS.length
      ? this.encodeLeaderboardCursor({
          viewIndex,
          viewCursor,
          throughPeriod,
          emitted
        })
      : null;
    return {
      items,
      total: emitted + (nextCursor ? 1 : 0),
      nextCursor,
      context: {
        groupSummaries: this.toLeaderboardSummaries(snapshot, items)
      }
    };
  }

  async loadClaimStatus(): Promise<OperatorClaimStatusDto> {
    const remote = await this.requireResponse(
      `${OPERATOR_NETWORK_ROUTE}/claim`,
      this.http.get<RemoteOperatorClaimStatus>(
        `${this.operatorEndpoint}/claim`,
        this.requestOptions()
      ).toPromise()
    );
    const status = this.toClaimStatus(remote);
    this.claimVerificationAvailable =
      status.verificationCapability === 'AVAILABLE';
    return status;
  }

  async claimShare(request: OperatorClaimRequestDto): Promise<OperatorClaimStatusDto> {
    if (this.claimVerificationAvailable === null) {
      await this.loadClaimStatus();
    }
    if (!this.claimVerificationAvailable) {
      throw new Error('operator.claim.verification.backend.unavailable');
    }
    const payload = this.requireClaimVerificationRequest(request);
    const remote = await this.requireResponse(
      `${OPERATOR_NETWORK_ROUTE}/claim`,
      this.http.post<RemoteOperatorClaimStatus>(
        `${this.operatorEndpoint}/claim`,
        payload,
        this.requestOptions()
      ).toPromise()
    );
    const status = this.toClaimStatus(remote);
    this.claimVerificationAvailable =
      status.verificationCapability === 'AVAILABLE';
    return status;
  }

  async issueGroupingToken(): Promise<OperatorGroupingTokenDto> {
    const result = await this.requireResponse(
      `${OPERATOR_NETWORK_ROUTE}/claim/client-token`,
      this.http.post<RemoteOperatorActionResult>(
        `${this.operatorEndpoint}/claim/client-token`,
        null,
        this.requestOptions()
      ).toPromise()
    );
    const clientToken = result.clientToken?.trim() ?? '';
    const expiresAt = result.receipt?.tokenExpiresAt?.trim() ?? '';
    if (!clientToken || !expiresAt) {
      throw new Error('operator.group.error.token.response');
    }
    return {
      clientToken,
      expiresAt
    };
  }

  async linkOperatorGroup(
    request: OperatorGroupLinkRequestDto
  ): Promise<OperatorClaimStatusDto> {
    await this.requireResponse(
      `${OPERATOR_NETWORK_ROUTE}/claim/redeem`,
      this.http.post<RemoteOperatorActionResult>(
        `${this.operatorEndpoint}/claim/redeem`,
        {
          clientToken: request.clientToken.trim()
        },
        this.requestOptions()
      ).toPromise()
    );
    return this.loadClaimStatus();
  }

  async loadDeploymentUpdate(): Promise<OperatorDeploymentUpdateDto> {
    const status = await this.requireResponse(
      OPERATOR_UPDATES_ROUTE,
      this.http.get<RemoteOperatorUpdatesStatus>(
        `${this.operatorEndpoint}/updates`,
        this.requestOptions()
      ).toPromise()
    );
    this.currentDeploymentVersion = status.currentVersion?.trim() || '—';
    this.activeUpdateJob = status.latestJob ?? null;
    const announcements = await this.loadAnnouncements({
      kind: 'UPDATE',
      includeExpired: false,
      limit: 100
    });
    this.latestAnnouncementsCheckedAt =
      announcements.snapshot.asOf?.trim()
      || announcements.snapshot.createdAt?.trim()
      || new Date().toISOString();
    this.latestUpdateAnnouncement = [...announcements.items]
      .filter(item => this.announcementKind(item.kind) === 'UPDATE' && item.updateManifest)
      .sort((left, right) => Number(right.sequence) - Number(left.sequence))[0] ?? null;

    return this.toDeploymentUpdate(
      this.latestUpdateAnnouncement,
      this.activeUpdateJob
    );
  }

  async applyDeploymentUpdate(
    onProgress?: OperatorDeploymentUpdateProgressHandler
  ): Promise<OperatorDeploymentUpdateDto> {
    if (!this.latestUpdateAnnouncement) {
      await this.loadDeploymentUpdate();
    }
    const announcement = this.latestUpdateAnnouncement;
    if (!announcement?.updateManifest || !this.installableUpdate(announcement.updateManifest)) {
      throw new Error('operator.update.error.unavailable');
    }

    let job = await this.requireResponse(
      OPERATOR_UPDATES_ROUTE,
      this.http.post<RemoteOperatorUpdateJob>(
        `${this.operatorEndpoint}/updates`,
        { announcementId: announcement.announcementId.trim() },
        this.requestOptions()
      ).toPromise()
    );
    this.activeUpdateJob = job;
    this.currentDeploymentVersion = job.currentVersion?.trim()
      || this.currentDeploymentVersion;
    onProgress?.(this.toUpdateProgress(job, announcement.updateManifest));

    job = await this.loadUpdateJob(job.jobId);
    this.activeUpdateJob = job;
    onProgress?.(this.toUpdateProgress(job, announcement.updateManifest));
    if (this.updateJobTerminal(job.phase)) {
      return this.toDeploymentUpdate(announcement, job);
    }

    let after = 0;
    for (let poll = 0; poll < UPDATE_POLL_LIMIT; poll += 1) {
      const page = await this.loadUpdateEvents(job.jobId, after);
      for (const event of page.items) {
        if (event.sequence <= after) {
          continue;
        }
        after = event.sequence;
        job = event.status;
        this.activeUpdateJob = job;
        onProgress?.(this.toUpdateProgress(job, announcement.updateManifest));
      }
      after = Math.max(after, Math.max(0, Math.trunc(Number(page.nextAfter) || 0)));
      if (page.terminal || this.updateJobTerminal(job.phase)) {
        return this.toDeploymentUpdate(announcement, job);
      }
      await this.waitForUpdatePoll();
    }
    throw new Error('operator.request.timeout');
  }

  async loadConfiguration(): Promise<OperatorConfigurationDto> {
    return await this.requireResponse(
      OPERATOR_CONFIGURATION_ROUTE,
      this.http.get<OperatorConfigurationDto>(
        `${this.apiBaseUrl}${OPERATOR_CONFIGURATION_ROUTE}`,
        this.requestOptions()
      ).toPromise()
    );
  }

  async saveConfiguration(
    request: OperatorConfigurationSaveRequestDto
  ): Promise<OperatorConfigurationDto> {
    return await this.requireResponse(
      OPERATOR_CONFIGURATION_ROUTE,
      this.http.put<OperatorConfigurationDto>(
        `${this.apiBaseUrl}${OPERATOR_CONFIGURATION_ROUTE}`,
        request,
        this.requestOptions()
      ).toPromise()
    );
  }

  async testConfiguration(
    request: OperatorConfigurationTestRequestDto
  ): Promise<OperatorConfigurationTestResultDto> {
    return await this.requireResponse(
      `${OPERATOR_CONFIGURATION_ROUTE}/tests`,
      this.http.post<OperatorConfigurationTestResultDto>(
        `${this.apiBaseUrl}${OPERATOR_CONFIGURATION_ROUTE}/tests`,
        request,
        this.requestOptions()
      ).toPromise()
    );
  }

  async loadRevenue(): Promise<OperatorRevenueDto> {
    return await this.requireResponse(
      OPERATOR_REVENUE_ROUTE,
      this.http.get<OperatorRevenueDto>(
        `${this.apiBaseUrl}${OPERATOR_REVENUE_ROUTE}`,
        this.requestOptions()
      ).toPromise()
    );
  }

  async loadCommunityStatus(): Promise<OperatorCommunityStatusDto> {
    const page = await this.loadAnnouncements({
      includeExpired: false,
      limit: 100
    });
    return {
      availability: 'INVISIBLE',
      updatedAt:
        page.snapshot.asOf?.trim()
        || page.snapshot.createdAt?.trim()
        || null,
      providers: [],
      announcements: [...page.items]
        .sort((left, right) => Number(right.sequence) - Number(left.sequence))
        .map(item => this.toCommunityAnnouncement(item))
    };
  }

  async setCommunityAvailability(
    _availability: OperatorCommunityAvailability
  ): Promise<OperatorCommunityStatusDto> {
    return this.unsupported('community availability');
  }

  private async loadAnnouncements(filters: {
    kind?: string;
    severity?: string;
    channel?: string;
    includeExpired?: boolean;
    limit: number;
    cursor?: string | null;
  }): Promise<RemoteOperatorAnnouncementPage> {
    let params = new HttpParams()
      .set('includeExpired', filters.includeExpired === true)
      .set('limit', Math.max(1, Math.min(100, Math.trunc(filters.limit) || 100)));
    if (filters.kind?.trim()) {
      params = params.set('kind', filters.kind.trim());
    }
    if (filters.severity?.trim()) {
      params = params.set('severity', filters.severity.trim());
    }
    if (filters.channel?.trim()) {
      params = params.set('channel', filters.channel.trim());
    }
    if (filters.cursor?.trim()) {
      params = params.set('cursor', filters.cursor.trim());
    }
    return await this.requireResponse(
      OPERATOR_ANNOUNCEMENTS_ROUTE,
      this.http.get<RemoteOperatorAnnouncementPage>(
        `${this.operatorEndpoint}/announcements`,
        this.requestOptions(params)
      ).toPromise()
    );
  }

  private async loadUpdateJob(jobId: string): Promise<RemoteOperatorUpdateJob> {
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId) {
      throw new Error('operator.update.error.response');
    }
    return await this.requireResponse(
      `${OPERATOR_UPDATES_ROUTE}/jobs/${normalizedJobId}`,
      this.http.get<RemoteOperatorUpdateJob>(
        `${this.operatorEndpoint}/updates/jobs/${encodeURIComponent(normalizedJobId)}`,
        this.requestOptions()
      ).toPromise()
    );
  }

  private async loadUpdateEvents(
    jobId: string,
    after: number
  ): Promise<RemoteOperatorUpdateEventPage> {
    const normalizedJobId = jobId.trim();
    if (!normalizedJobId) {
      throw new Error('operator.update.error.response');
    }
    const params = new HttpParams()
      .set('after', Math.max(0, Math.trunc(Number(after) || 0)))
      .set('limit', 100);
    return await this.requireResponse(
      `${OPERATOR_UPDATES_ROUTE}/jobs/${normalizedJobId}/events`,
      this.http.get<RemoteOperatorUpdateEventPage>(
        `${this.operatorEndpoint}/updates/jobs/${encodeURIComponent(normalizedJobId)}/events`,
        this.requestOptions(params)
      ).toPromise()
    );
  }

  private toDeploymentUpdate(
    announcement: RemoteOperatorAnnouncement | null,
    job: RemoteOperatorUpdateJob | null
  ): OperatorDeploymentUpdateDto {
    const manifest = announcement?.updateManifest ?? null;
    const targetVersion =
      job?.targetVersion?.trim()
      || manifest?.releaseVersion?.trim()
      || '—';
    const currentVersion =
      job?.currentVersion?.trim()
      || this.currentDeploymentVersion
      || '—';
    const completed = job?.phase?.trim().toUpperCase() === 'COMPLETED';
    return {
      currentVersion,
      availableVersion: targetVersion,
      updateAvailable: Boolean(
        manifest
        && this.installableUpdate(manifest)
        && !completed
        && currentVersion !== targetVersion
      ),
      lastCheckedAt:
        this.latestAnnouncementsCheckedAt
        || job?.updatedAt?.trim()
        || null,
      lastUpdatedAt: completed ? job?.updatedAt?.trim() || null : null,
      progress: job
        ? this.toUpdateProgress(job, manifest)
        : {
            phase: 'IDLE',
            bytesDownloaded: 0,
            bytesTotal: Math.max(0, Number(manifest?.artifactSizeBytes) || 0),
            percent: 0,
            message: null,
            updatedAt: this.latestAnnouncementsCheckedAt
          }
    };
  }

  private toUpdateProgress(
    job: RemoteOperatorUpdateJob,
    manifest: RemoteOperatorUpdateManifest | null
  ): OperatorDeploymentUpdateProgressDto {
    const phase = this.updatePhase(job.phase);
    const percent = Math.max(0, Math.min(100, Math.trunc(Number(job.percent) || 0)));
    const bytesTotal = Math.max(0, Number(manifest?.artifactSizeBytes) || 0);
    let bytesDownloaded = 0;
    if (job.phase?.trim().toUpperCase() === 'DOWNLOADING') {
      const downloadPercent = Math.max(0, Math.min(1, (percent - 10) / 50));
      bytesDownloaded = Math.round(bytesTotal * downloadPercent);
    } else if (phase === 'VERIFYING' || phase === 'INSTALLING' || phase === 'COMPLETED') {
      bytesDownloaded = bytesTotal;
    }
    return {
      phase,
      bytesDownloaded,
      bytesTotal,
      percent,
      message: job.phase?.trim().toUpperCase() === 'RECOVERY_REQUIRED'
        ? 'operator.update.error.recovery.required'
        : phase === 'FAILED'
          ? 'operator.update.error.failed'
          : null,
      updatedAt: job.updatedAt?.trim() || null
    };
  }

  private updatePhase(value: string): OperatorDeploymentUpdatePhase {
    switch (value?.trim().toUpperCase()) {
      case 'CHECKING':
        return 'CHECKING';
      case 'DOWNLOADING':
        return 'DOWNLOADING';
      case 'STAGING':
      case 'VERIFYING':
        return 'VERIFYING';
      case 'AWAITING_HOST':
      case 'BACKING_UP':
      case 'INSTALLING':
      case 'RESTARTING':
        return 'INSTALLING';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'FAILED':
      case 'REJECTED':
      case 'RECOVERY_REQUIRED':
        return 'FAILED';
      default:
        return 'CHECKING';
    }
  }

  private updateJobTerminal(value: string): boolean {
    return UPDATE_TERMINAL_PHASES.has(value?.trim().toUpperCase());
  }

  private installableUpdate(manifest: RemoteOperatorUpdateManifest): boolean {
    return manifest.status?.trim().toUpperCase() === 'AVAILABLE'
      && manifest.packageSigningKeyConfigured === true
      && manifest.packageSigningKeyMatches === true
      && manifest.packageSignatureVerified === true;
  }

  private toCommunityAnnouncement(
    announcement: RemoteOperatorAnnouncement
  ): OperatorCommunityAnnouncementDto {
    const localization = this.announcementLocalization(announcement);
    const title = announcement.titleKey?.trim() || localization?.title?.trim()
      || announcement.announcementId;
    const body = announcement.bodyKey?.trim() || localization?.body?.trim() || '';
    const manifest = announcement.updateManifest;
    return {
      id: announcement.announcementId,
      kind: this.announcementKind(announcement.kind),
      severity: this.announcementSeverity(announcement.severity),
      status: this.announcementStatus(announcement),
      unread: true,
      title,
      body,
      publishedAt: announcement.publishedAt,
      expiresAt: announcement.expiresAt?.trim() || null,
      links: (announcement.links ?? []).map((link, index) => ({
        id: `${announcement.announcementId}:${link.relation || index}`,
        label: this.announcementLinkLabel(link.relation),
        url: link.url,
        verified: true
      })),
      update: manifest
        ? {
            version: manifest.releaseVersion,
            purpose: 'operator.community.announcement.update.verified.purpose',
            releaseNotes: [],
            artifact: {
              downloadUrl: manifest.artifactUrl,
              downloadUrlVerified: this.installableUpdate(manifest),
              sha256Digest: manifest.artifactSha256,
              signature: manifest.packageSignature,
              sizeBytes: Math.max(0, Number(manifest.artifactSizeBytes) || 0),
              compatibility: `v${manifest.minimumCompatibleVersion} – v${manifest.maximumCompatibleVersion}`
            }
          }
        : null
    };
  }

  private announcementLocalization(
    announcement: RemoteOperatorAnnouncement
  ): RemoteOperatorAnnouncementLocalization | null {
    const localizations = announcement.localizations ?? [];
    const language = this.i18n.currentLanguage().trim().toLowerCase();
    return localizations.find(item => item.locale?.trim().toLowerCase() === language)
      ?? localizations.find(
        item => item.locale?.trim().toLowerCase().split('-')[0] === language.split('-')[0]
      )
      ?? localizations.find(item => item.locale?.trim().toLowerCase() === 'en')
      ?? localizations[0]
      ?? null;
  }

  private announcementKind(value: string): OperatorCommunityAnnouncementKind {
    switch (value?.trim().toUpperCase()) {
      case 'UPDATE':
        return 'UPDATE';
      case 'MAINTENANCE':
        return 'MAINTENANCE';
      case 'SECURITY':
        return 'SECURITY';
      default:
        return 'GENERAL';
    }
  }

  private announcementSeverity(value: string): OperatorCommunityAnnouncementSeverity {
    switch (value?.trim().toUpperCase()) {
      case 'SUCCESS':
        return 'SUCCESS';
      case 'WARNING':
      case 'WARN':
        return 'WARNING';
      case 'CRITICAL':
      case 'ERROR':
        return 'CRITICAL';
      default:
        return 'INFO';
    }
  }

  private announcementStatus(
    announcement: RemoteOperatorAnnouncement
  ): OperatorCommunityAnnouncementStatus {
    const manifestStatus = announcement.updateManifest?.status?.trim().toUpperCase();
    if (manifestStatus === 'REVOKED' || manifestStatus === 'WITHDRAWN') {
      return 'WITHDRAWN';
    }
    if (
      manifestStatus === 'SUPERSEDED'
      || (
        announcement.expiresAt
        && Number.isFinite(Date.parse(announcement.expiresAt))
        && Date.parse(announcement.expiresAt) <= Date.now()
      )
    ) {
      return 'ARCHIVED';
    }
    return 'PUBLISHED';
  }

  private announcementLinkLabel(relation: string): string {
    const normalized = relation?.trim().toLowerCase();
    if (normalized === 'release-notes' || normalized === 'release_notes') {
      return 'operator.community.announcement.link.release.notes';
    }
    if (normalized === 'project') {
      return 'operator.community.announcement.link.project';
    }
    return normalized
      ? normalized.replace(/[-_]+/g, ' ').replace(/\b\w/g, value => value.toUpperCase())
      : 'operator.community.announcement.link.open';
  }

  private waitForUpdatePoll(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, UPDATE_POLL_INTERVAL_MS));
  }

  private safeHttpsUrl(value: string | null | undefined): string | null {
    try {
      const url = new URL(`${value ?? ''}`.trim());
      return url.protocol === 'https:' && !url.username && !url.password
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  private toClaimStatus(remote: RemoteOperatorClaimStatus): OperatorClaimStatusDto {
    const claimed = remote.claimed === true;
    const hasVerificationCapability =
      remote.verificationCapability === 'AVAILABLE'
      || remote.verificationCapability === 'BACKEND_UNAVAILABLE';
    const verificationStatus = remote.verificationStatus === 'PENDING_REVIEW'
      || remote.verificationStatus === 'APPROVED'
      || remote.verificationStatus === 'VERIFIED'
      || remote.verificationStatus === 'REJECTED'
      || remote.verificationStatus === 'WITHDRAWN'
      || remote.verificationStatus === 'NOT_SUBMITTED'
      ? remote.verificationStatus
      : claimed
        ? 'VERIFIED'
        : 'NOT_SUBMITTED';
    return {
      claimed,
      claimedAt: remote.claimedAt?.trim() || null,
      claimantUserId: remote.claimantUserId?.trim() || null,
      claimantName: remote.claimantName?.trim() || null,
      claimantAvatarUrl: this.safeHttpsUrl(remote.claimantAvatarUrl),
      operatorGroupId: remote.operatorGroupId?.trim() || null,
      activeLinkId: remote.activeLinkId?.trim() || null,
      sharePercent: Math.max(0, Number(remote.sharePercent) || 0),
      shareNumerator: remote.shareNumerator?.trim() || null,
      shareDenominator: remote.shareDenominator?.trim() || null,
      verificationCapability: hasVerificationCapability
        ? remote.verificationCapability!
        : 'BACKEND_UNAVAILABLE',
      verificationUnavailableReason: hasVerificationCapability
        ? remote.verificationUnavailableReason?.trim() || null
        : 'operator.claim.verification.backend.unavailable',
      verificationStatus,
      verificationSubmittedAt: remote.verificationSubmittedAt?.trim() || null,
      legalName: remote.legalName?.trim() || remote.claimantName?.trim() || null
    };
  }

  private requireClaimVerificationRequest(
    request: OperatorClaimRequestDto
  ): OperatorClaimRequestDto {
    const payload: OperatorClaimRequestDto = {
      legalName: `${request.legalName ?? ''}`.trim(),
      registrationNumber: `${request.registrationNumber ?? ''}`.trim(),
      jurisdiction: `${request.jurisdiction ?? ''}`.trim(),
      registeredAddress: `${request.registeredAddress ?? ''}`.trim(),
      website: this.publicWebsite(request.website),
      verificationContactName: `${request.verificationContactName ?? ''}`.trim(),
      verificationContactRole: `${request.verificationContactRole ?? ''}`.trim(),
      verificationContactEmail:
        `${request.verificationContactEmail ?? ''}`.trim().toLowerCase(),
      authorityAttested: request.authorityAttested === true
    };
    if (
      !payload.legalName
      || !payload.registrationNumber
      || !payload.jurisdiction
      || !payload.registeredAddress
      || !payload.verificationContactName
      || !payload.verificationContactRole
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.verificationContactEmail)
      || !payload.authorityAttested
    ) {
      throw new Error('operator.claim.verification.error.required');
    }
    return payload;
  }

  private publicWebsite(value: string | null | undefined): string | null {
    const source = `${value ?? ''}`.trim();
    if (!source) {
      return null;
    }
    try {
      const url = new URL(source);
      if (
        url.protocol === 'https:'
        && !url.username
        && !url.password
      ) {
        return url.toString();
      }
    } catch {
      // Fall through to the validation error.
    }
    throw new Error('operator.claim.verification.error.website');
  }

  private requestOptions(params?: HttpParams): { headers?: HttpHeaders; params?: HttpParams } {
    const session = this.sessionService.currentSession();
    const options: { headers?: HttpHeaders; params?: HttpParams } = {};
    if (session?.kind === 'demo') {
      options.headers = new HttpHeaders({
        [DEMO_OPERATOR_USER_HEADER]: session.userId.trim()
      });
    }
    if (params) {
      options.params = params;
    }
    return options;
  }

  private async requireResponse<T>(route: string, task: Promise<T | undefined>): Promise<T> {
    const response = await this.routeDelay.withRequestTimeout(
      route,
      task,
      'operator.request.timeout'
    );
    if (!response) {
      throw new Error('operator.registration.error.response.unavailable');
    }
    return response;
  }

  private unsupported<T>(_capability: string): Promise<T> {
    return Promise.reject(
      new Error('operator.remote.capability.unavailable')
    );
  }

  private toLeaderboardEntry(
    row: RemoteOperatorLeaderboardRow
  ): OperatorLeaderboardEntryDto {
    const group: OperatorLeaderboardGroup = row.view === 'founder'
      ? 'FOUNDER'
      : row.view === 'claimed'
        ? 'CLAIMED'
        : 'UNCLAIMED';
    return {
      id: row.rowId,
      nodeId: group === 'UNCLAIMED' ? row.rowId : null,
      label: row.label,
      group,
      verifiedWeight: this.rational(row.weightNumerator, row.weightDenominator),
      sharePercent: this.rational(row.shareNumerator, row.shareDenominator) * 100,
      claimed: group !== 'UNCLAIMED',
      claimantUserId: null,
      claimantName: group === 'CLAIMED' ? row.label : null,
      claimantAvatarUrl: row.avatarUrl?.trim() || null,
      operatorGroupId: row.groupId?.trim() || null,
      deploymentCount: Math.max(0, Math.trunc(Number(row.deploymentCount) || 0))
    };
  }

  private toLeaderboardSummaries(
    snapshot: RemoteOperatorLeaderboardSnapshot | null,
    items: readonly OperatorLeaderboardEntryDto[]
  ): OperatorLeaderboardGroupSummaryDto[] {
    if (!snapshot) {
      return (['FOUNDER', 'CLAIMED', 'UNCLAIMED'] as const).map(group => ({
        group,
        itemCount: 0,
        verifiedWeight: 0,
        sharePercent: 0
      }));
    }
    const founderWeight = this.rational(
      snapshot.founderUnitsNumerator,
      snapshot.founderUnitsDenominator
    );
    const measuredWeight = this.rational(
      snapshot.measuredWeightNumerator,
      snapshot.measuredWeightDenominator
    );
    const claimedWeight = this.rational(
      snapshot.claimedWeightNumerator,
      snapshot.claimedWeightDenominator
    );
    const founderShare = this.rational(
      snapshot.founderShareNumerator,
      snapshot.founderShareDenominator
    ) * 100;
    const values: Record<
      OperatorLeaderboardGroup,
      { verifiedWeight: number; sharePercent: number }
    > = {
      FOUNDER: {
        verifiedWeight: founderWeight,
        sharePercent: founderShare
      },
      CLAIMED: {
        verifiedWeight: claimedWeight,
        sharePercent: claimedWeight > 0 ? Math.max(0, 100 - founderShare) : 0
      },
      UNCLAIMED: {
        verifiedWeight: Math.max(0, measuredWeight - claimedWeight),
        sharePercent: 0
      }
    };
    return (['FOUNDER', 'CLAIMED', 'UNCLAIMED'] as const).map(group => ({
      group,
      itemCount: items.filter(item => item.group === group).length,
      ...values[group]
    }));
  }

  private rational(numerator: string, denominator: string): number {
    const top = Number(numerator);
    const bottom = Number(denominator);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) {
      return 0;
    }
    return top / bottom;
  }

  private encodeLeaderboardCursor(state: OperatorLeaderboardCursorState): string {
    return `operator-http:${encodeURIComponent(JSON.stringify(state))}`;
  }

  private decodeLeaderboardCursor(
    cursor: string | null | undefined
  ): OperatorLeaderboardCursorState {
    const value = `${cursor ?? ''}`.trim();
    if (!value) {
      return {
        viewIndex: 0,
        viewCursor: null,
        throughPeriod: null,
        emitted: 0
      };
    }
    if (!value.startsWith('operator-http:')) {
      throw new Error('operator.leaderboard.error.cursor.invalid');
    }
    try {
      const parsed = JSON.parse(
        decodeURIComponent(value.slice('operator-http:'.length))
      ) as Partial<OperatorLeaderboardCursorState>;
      const viewIndex = Math.trunc(Number(parsed.viewIndex));
      const emitted = Math.max(0, Math.trunc(Number(parsed.emitted) || 0));
      if (
        !Number.isFinite(viewIndex)
        || viewIndex < 0
        || viewIndex >= LEADERBOARD_VIEWS.length
      ) {
        throw new Error();
      }
      return {
        viewIndex,
        viewCursor: typeof parsed.viewCursor === 'string'
          ? parsed.viewCursor
          : null,
        throughPeriod: typeof parsed.throughPeriod === 'string'
          ? parsed.throughPeriod
          : null,
        emitted
      };
    } catch {
      throw new Error('operator.leaderboard.error.cursor.invalid');
    }
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (!signal?.aborted) {
      return;
    }
    const error = new Error('operator.request.aborted');
    error.name = 'AbortError';
    throw error;
  }
}
