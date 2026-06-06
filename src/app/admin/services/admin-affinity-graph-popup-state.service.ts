import { Injectable, computed, inject, signal } from '@angular/core';

import {
  AdminAffinityGraphService,
  type AdminAffinityGraphRangeParams,
  type AdminAffinityGraphTileParams
} from '../../shared/core';
import type {
  AdminAffinityGraphDto,
  AdminAffinityGraphForestsDto,
  AdminAffinityGraphMetaDto,
  AdminAffinityGraphNeighborhoodDto,
  AdminAffinityGraphTileDto
} from '../../shared/core/base/interfaces/admin-affinity-graph.interface';
import { RouteDelayService } from '../../shared/core/base/services/route-delay.service';

const ADMIN_AFFINITY_GRAPH_ROUTE = '/admin/affinity-graph';

@Injectable({
  providedIn: 'root'
})
export class AdminAffinityGraphPopupStateService {
  private readonly graphData = inject(AdminAffinityGraphService);
  private readonly routeDelay = inject(RouteDelayService);
  private readonly loadingActiveRef = signal(false);
  private readonly loadingProgressRef = signal(0);
  private readonly loadingOverdueRef = signal(false);
  private loadingCounter = 0;
  private loadingStartedAtMs = 0;
  private loadingProgressTimer: ReturnType<typeof setInterval> | null = null;
  private loadingCompleteTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loadingState = computed(() => ({
    active: this.loadingActiveRef() || this.loadingProgressRef() > 0,
    progress: this.loadingProgressRef(),
    overdue: this.loadingOverdueRef()
  }));

  async loadInitialGraph(adminUserId?: string | null): Promise<AdminAffinityGraphDto> {
    return this.withLoadingProgress(() => this.graphData.loadInitialGraph(adminUserId));
  }

  async loadMeta(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams): Promise<AdminAffinityGraphMetaDto> {
    return this.withLoadingProgress(() => this.graphData.loadMeta(adminUserId, range));
  }

  async loadForests(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams): Promise<AdminAffinityGraphForestsDto> {
    return this.withLoadingProgress(() => this.graphData.loadForests(adminUserId, range));
  }

  async loadTile(adminUserId?: string | null, tile?: AdminAffinityGraphTileParams): Promise<AdminAffinityGraphTileDto> {
    return this.withLoadingProgress(() => this.graphData.loadTile(adminUserId, tile));
  }

  async loadNeighborhood(
    userId: string,
    depth?: number | null,
    adminUserId?: string | null,
    range?: AdminAffinityGraphRangeParams
  ): Promise<AdminAffinityGraphNeighborhoodDto> {
    return this.withLoadingProgress(() => this.graphData.loadNeighborhood(userId, depth, adminUserId, range));
  }

  async rebuildLayout(adminUserId?: string | null): Promise<AdminAffinityGraphMetaDto> {
    return this.withLoadingProgress(() => this.graphData.rebuildLayout(adminUserId));
  }

  private async withLoadingProgress<T>(work: () => Promise<T>): Promise<T> {
    this.beginLoadingProgress();
    try {
      return await work();
    } finally {
      this.endLoadingProgress();
    }
  }

  private beginLoadingProgress(): void {
    this.loadingCounter += 1;
    if (this.loadingCounter > 1) {
      return;
    }
    if (this.loadingCompleteTimer) {
      clearTimeout(this.loadingCompleteTimer);
      this.loadingCompleteTimer = null;
    }
    this.loadingActiveRef.set(true);
    this.loadingProgressRef.set(0.02);
    this.loadingOverdueRef.set(false);
    this.loadingStartedAtMs = this.nowMs();
    this.updateLoadingProgress();
    this.loadingProgressTimer = setInterval(() => this.updateLoadingProgress(), 80);
  }

  private updateLoadingProgress(): void {
    if (!this.loadingStartedAtMs) {
      this.loadingProgressRef.set(0);
      this.loadingOverdueRef.set(false);
      return;
    }
    const elapsedMs = Math.max(0, this.nowMs() - this.loadingStartedAtMs);
    const progressWindowMs = this.routeDelay.resolveRequestTimeoutMs(ADMIN_AFFINITY_GRAPH_ROUTE);
    const nextProgress = Math.min(1, elapsedMs / progressWindowMs);
    this.loadingProgressRef.set(Math.max(this.loadingProgressRef(), nextProgress));
    this.loadingOverdueRef.set(elapsedMs >= progressWindowMs && this.loadingCounter > 0);
  }

  private endLoadingProgress(): void {
    if (this.loadingCounter === 0) {
      return;
    }
    this.loadingCounter = Math.max(0, this.loadingCounter - 1);
    if (this.loadingCounter !== 0) {
      return;
    }
    this.clearLoadingProgressTimer();
    this.loadingActiveRef.set(false);
    this.loadingProgressRef.set(1);
    this.loadingOverdueRef.set(false);
    if (this.loadingCompleteTimer) {
      clearTimeout(this.loadingCompleteTimer);
    }
    this.loadingCompleteTimer = setTimeout(() => {
      if (this.loadingCounter !== 0) {
        return;
      }
      this.loadingStartedAtMs = 0;
      this.loadingProgressRef.set(0);
      this.loadingOverdueRef.set(false);
      this.loadingCompleteTimer = null;
    }, 120);
  }

  private clearLoadingProgressTimer(): void {
    if (!this.loadingProgressTimer) {
      return;
    }
    clearInterval(this.loadingProgressTimer);
    this.loadingProgressTimer = null;
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}
