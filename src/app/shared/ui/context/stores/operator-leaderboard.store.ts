import { Injectable, effect, inject, signal } from '@angular/core';

import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import {
  SessionService,
  type AppSession
} from '../../../core/base/services/session.service';
import type { ListQuery } from '../../../core/contracts/list.interface';
import type {
  OperatorLeaderboardEntryDto,
  OperatorLeaderboardGroupSummaryDto,
  OperatorLeaderboardPageDto,
  OperatorRegistryStatusDto
} from '../../../core/contracts/operator.interface';

export interface OperatorLeaderboardFilters {
  revision: number;
}

@Injectable({
  providedIn: 'root'
})
export class OperatorLeaderboardStore {
  private readonly service = inject(OperatorRegistryService);
  private readonly sessionService = inject(SessionService);
  private readonly revisionRef = signal(0);
  private readonly summariesRef = signal<readonly OperatorLeaderboardGroupSummaryDto[]>([]);
  private readonly latestCacheUpsertRef = signal<OperatorLeaderboardEntryDto | null>(null);
  private contextKey = this.sessionKey(this.sessionService.currentSession());
  private generation = 0;

  readonly revision = this.revisionRef.asReadonly();
  readonly summaries = this.summariesRef.asReadonly();
  readonly latestCacheUpsert = this.latestCacheUpsertRef.asReadonly();

  constructor() {
    effect(() => {
      const nextContextKey = this.sessionKey(this.sessionService.session());
      if (nextContextKey === this.contextKey) {
        return;
      }
      this.contextKey = nextContextKey;
      this.generation += 1;
      this.summariesRef.set([]);
      this.latestCacheUpsertRef.set(null);
      this.revisionRef.update(value => value + 1);
    });
  }

  async queryPage(
    query: ListQuery<OperatorLeaderboardFilters>,
    signal?: AbortSignal
  ): Promise<OperatorLeaderboardPageDto> {
    const generation = this.generation;
    const page = await this.service.leaderboardPage(query, signal);
    if (generation === this.generation && !signal?.aborted) {
      this.summariesRef.set(page.context?.groupSummaries ?? []);
    }
    return page;
  }

  upsertRegisteredDeployment(
    status: OperatorRegistryStatusDto
  ): OperatorLeaderboardEntryDto | null {
    const deploymentCode = status.enrollment?.deploymentCode?.trim() ?? '';
    if (
      !status.enabled
      || status.lifecycle !== 'REGISTERED'
      || !deploymentCode
    ) {
      return null;
    }
    const entry: OperatorLeaderboardEntryDto = {
      id: deploymentCode,
      nodeId: deploymentCode,
      label: deploymentCode,
      group: 'UNCLAIMED',
      verifiedWeight: 0,
      sharePercent: 0,
      claimed: false,
      claimantUserId: null,
      claimantName: null,
      claimantAvatarUrl: null,
      operatorGroupId: null,
      deploymentCount: 1
    };
    this.latestCacheUpsertRef.set(entry);
    return entry;
  }

  invalidate(): void {
    this.generation += 1;
    this.summariesRef.set([]);
    this.latestCacheUpsertRef.set(null);
    this.revisionRef.update(value => value + 1);
  }

  private sessionKey(session: AppSession | null): string {
    if (session?.kind === 'demo') {
      return `demo:${session.userId.trim()}`;
    }
    if (session?.kind === 'firebase') {
      return `firebase:${session.profile.id.trim()}`;
    }
    return 'none';
  }
}
