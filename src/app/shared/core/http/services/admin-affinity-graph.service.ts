import { Injectable, inject } from '@angular/core';

import type {
  AdminAffinityGraphForestsDto,
  AdminAffinityGraphMetaDto,
  AdminAffinityGraphNeighborhoodDto,
  AdminAffinityGraphTileDto
} from '../../base/interfaces/admin-affinity-graph.interface';
import {
  HttpAdminAffinityGraphRepository,
  type AdminAffinityGraphRangeParams,
  type AdminAffinityGraphTileParams
} from '../repositories/admin-affinity-graph.repository';

export type { AdminAffinityGraphRangeParams, AdminAffinityGraphTileParams };

@Injectable({
  providedIn: 'root'
})
export class HttpAdminAffinityGraphService {
  private readonly repository = inject(HttpAdminAffinityGraphRepository);

  async loadMeta(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams): Promise<AdminAffinityGraphMetaDto> {
    return await this.repository.loadMeta(adminUserId, range);
  }

  async loadForests(adminUserId?: string | null, range?: AdminAffinityGraphRangeParams): Promise<AdminAffinityGraphForestsDto> {
    return await this.repository.loadForests(adminUserId, range);
  }

  async loadTile(adminUserId?: string | null, tile?: AdminAffinityGraphTileParams): Promise<AdminAffinityGraphTileDto> {
    return await this.repository.loadTile(adminUserId, tile);
  }

  async loadNeighborhood(
    userId: string,
    depth?: number | null,
    adminUserId?: string | null,
    range?: AdminAffinityGraphRangeParams
  ): Promise<AdminAffinityGraphNeighborhoodDto> {
    return await this.repository.loadNeighborhood(userId, depth, adminUserId, range);
  }

  async rebuildLayout(adminUserId?: string | null): Promise<AdminAffinityGraphMetaDto> {
    return await this.repository.rebuildLayout(adminUserId);
  }
}
