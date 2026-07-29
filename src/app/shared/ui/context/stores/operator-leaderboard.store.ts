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
  OperatorLeaderboardMutationDto,
  OperatorLeaderboardPageDto
} from '../../../core/contracts/operator.interface';

export interface OperatorLeaderboardFilters {
  revision: number;
}

export interface OperatorLeaderboardCacheMutation {
  sequence: number;
  leaderboardUpserts: readonly OperatorLeaderboardEntryDto[];
  removedEntryIds: readonly string[];
  leaderboardTotalDelta: number;
}

@Injectable({
  providedIn: 'root'
})
export class OperatorLeaderboardStore {
  private readonly service = inject(OperatorRegistryService);
  private readonly sessionService = inject(SessionService);
  private readonly revisionRef = signal(0);
  private readonly summariesRef = signal<readonly OperatorLeaderboardGroupSummaryDto[]>([]);
  private readonly latestCacheMutationRef =
    signal<OperatorLeaderboardCacheMutation | null>(null);
  private readonly cacheUpserts = new Map<string, OperatorLeaderboardEntryDto>();
  private readonly cacheTombstones = new Set<string>();
  private contextKey = this.sessionKey(this.sessionService.currentSession());
  private generation = 0;
  private mutationSequence = 0;

  readonly revision = this.revisionRef.asReadonly();
  readonly summaries = this.summariesRef.asReadonly();
  readonly latestCacheMutation = this.latestCacheMutationRef.asReadonly();

  constructor() {
    effect(() => {
      const nextContextKey = this.sessionKey(this.sessionService.session());
      if (nextContextKey === this.contextKey) {
        return;
      }
      this.contextKey = nextContextKey;
      this.generation += 1;
      this.summariesRef.set([]);
      this.resetCacheOverlay();
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
    return this.applyCacheOverlay(page, !query.cursor);
  }

  applyMutation(
    result: OperatorLeaderboardMutationDto
  ): OperatorLeaderboardCacheMutation | null {
    const removedEntryIds = [...new Set(
      result.removedLeaderboardEntryIds
        .map(id => id.trim())
        .filter(Boolean)
    )];
    for (const id of removedEntryIds) {
      this.cacheUpserts.delete(id);
      this.cacheTombstones.add(id);
    }

    const upsertsById = new Map<string, OperatorLeaderboardEntryDto>();
    for (const sourceEntry of result.leaderboardUpserts) {
      const id = sourceEntry.id.trim();
      if (!id) {
        continue;
      }
      const entry = {
        ...structuredClone(sourceEntry),
        id
      };
      upsertsById.set(id, entry);
      this.cacheTombstones.delete(id);
      this.cacheUpserts.set(id, entry);
    }
    const leaderboardUpserts = [...upsertsById.values()];
    const totalDeltaValue = Number(result.leaderboardTotalDelta);
    const leaderboardTotalDelta = Number.isFinite(totalDeltaValue)
      ? Math.trunc(totalDeltaValue)
      : 0;
    if (
      leaderboardUpserts.length === 0
      && removedEntryIds.length === 0
      && leaderboardTotalDelta === 0
    ) {
      return null;
    }

    const mutation: OperatorLeaderboardCacheMutation = {
      sequence: ++this.mutationSequence,
      leaderboardUpserts,
      removedEntryIds,
      leaderboardTotalDelta
    };
    this.latestCacheMutationRef.set(mutation);
    return mutation;
  }

  consumeCacheMutation(sequence: number): void {
    if (this.latestCacheMutationRef()?.sequence === sequence) {
      this.latestCacheMutationRef.set(null);
    }
  }

  invalidate(): void {
    this.generation += 1;
    this.summariesRef.set([]);
    this.resetCacheOverlay();
    this.revisionRef.update(value => value + 1);
  }

  private applyCacheOverlay(
    page: OperatorLeaderboardPageDto,
    initialPage: boolean
  ): OperatorLeaderboardPageDto {
    const items: OperatorLeaderboardEntryDto[] = [];
    const seen = new Set<string>();
    for (const sourceEntry of page.items) {
      const id = sourceEntry.id.trim();
      if (!id || this.cacheTombstones.has(id) || seen.has(id)) {
        continue;
      }
      const overlay = this.cacheUpserts.get(id);
      if (overlay) {
        if (!initialPage) {
          continue;
        }
        items.push(structuredClone(overlay));
      } else {
        items.push(sourceEntry);
      }
      seen.add(id);
    }
    if (initialPage) {
      for (const [id, entry] of this.cacheUpserts) {
        if (!seen.has(id) && !this.cacheTombstones.has(id)) {
          items.push(structuredClone(entry));
          seen.add(id);
        }
      }
    }
    return {
      ...page,
      items,
      total: Math.max(items.length, page.total)
    };
  }

  private resetCacheOverlay(): void {
    this.cacheUpserts.clear();
    this.cacheTombstones.clear();
    this.latestCacheMutationRef.set(null);
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
