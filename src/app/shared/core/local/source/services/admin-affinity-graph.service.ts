import { Injectable, inject } from '@angular/core';

import type { AdminAffinityGraphDto } from '../../../contracts/admin.interface';
import { RouteDelayService } from '../../../base/services/route-delay.service';
import { LocalAdminAffinityGraphRepository } from '../repositories/admin-affinity-graph.repository';

const ADMIN_AFFINITY_GRAPH_ROUTE = '/admin/affinity-graph';

@Injectable({
  providedIn: 'root'
})
export class LocalAdminAffinityGraphService {
  private readonly repository = inject(LocalAdminAffinityGraphRepository);
  private readonly routeDelay = inject(RouteDelayService);

  async readGraphSnapshot(options?: { waitForRouteDelay?: boolean; signal?: AbortSignal }): Promise<AdminAffinityGraphDto | null> {
    if (options?.waitForRouteDelay !== true) {
      this.throwIfAborted(options?.signal);
      return await this.repository.readGraphSnapshot();
    }
    const delay = this.routeDelay.waitForRouteDelay(ADMIN_AFFINITY_GRAPH_ROUTE, options.signal);
    try {
      const [snapshot] = await Promise.all([
        this.repository.readGraphSnapshot(),
        delay
      ]);
      this.throwIfAborted(options.signal);
      return snapshot;
    } catch (error) {
      await delay.catch(() => undefined);
      throw error;
    }
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      const error = new Error('Request aborted.');
      error.name = 'AbortError';
      throw error;
    }
  }

}
