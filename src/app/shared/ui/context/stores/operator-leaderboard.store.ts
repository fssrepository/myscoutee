import { Injectable, effect, inject, signal } from '@angular/core';

import { OperatorRegistryService } from '../../../core/base/services/operator-registry.service';
import {
  SessionService,
  type AppSession
} from '../../../core/base/services/session.service';
import type { ListQuery } from '../../../core/contracts/list.interface';
import type {
  OperatorLeaderboardGroupSummaryDto,
  OperatorLeaderboardPageDto
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
  private contextKey = this.sessionKey(this.sessionService.currentSession());
  private generation = 0;

  readonly revision = this.revisionRef.asReadonly();
  readonly summaries = this.summariesRef.asReadonly();

  constructor() {
    effect(() => {
      const nextContextKey = this.sessionKey(this.sessionService.session());
      if (nextContextKey === this.contextKey) {
        return;
      }
      this.contextKey = nextContextKey;
      this.generation += 1;
      this.summariesRef.set([]);
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

  invalidate(): void {
    this.generation += 1;
    this.summariesRef.set([]);
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
