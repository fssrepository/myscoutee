import { Injectable, inject } from '@angular/core';

import type * as AppTypes from '../../../core/base/models';
import { HttpActivityResourcesRepository } from '../repositories/activity-resources.repository';

@Injectable({
  providedIn: 'root'
})
export class HttpActivityResourcesService {
  private readonly repository = inject(HttpActivityResourcesRepository);

  peekSubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): AppTypes.ActivitySubEventResourceState | null {
    return this.repository.peekSubEventResourceState(ref);
  }

  async querySubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    return this.repository.querySubEventResourceState(ref);
  }

  async replaceSubEventResourceState(
    state: AppTypes.ActivitySubEventResourceState
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    return this.repository.replaceSubEventResourceState(state);
  }
}
