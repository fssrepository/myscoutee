import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import { ActivityResourceBuilder } from '../../base/builders';
import type * as AppTypes from '../../../core/base/models';

@Injectable({
  providedIn: 'root'
})
export class HttpActivityResourcesRepository {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedStateByRecordId: Record<string, AppTypes.ActivitySubEventResourceState> = {};

  peekSubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): AppTypes.ActivitySubEventResourceState | null {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    return ActivityResourceBuilder.cloneState(
      this.cachedStateByRecordId[ActivityResourceBuilder.recordId(normalizedRef)]
    );
  }

  async querySubEventResourceState(
    ref: AppTypes.ActivitySubEventResourceStateRef
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    try {
      const response = await this.http
        .get<AppTypes.ActivitySubEventResourceState | null>(`${this.apiBaseUrl}/activities/events/subevent-resources`, {
          params: new HttpParams()
            .set('ownerId', normalizedRef.ownerId)
            .set('subEventId', normalizedRef.subEventId)
            .set('assetOwnerUserId', normalizedRef.assetOwnerUserId)
        })
        .toPromise();
      const normalizedState = ActivityResourceBuilder.normalizeState(response, normalizedRef);
      if (normalizedState) {
        this.cachedStateByRecordId[ActivityResourceBuilder.recordId(normalizedRef)] = normalizedState;
      }
      return ActivityResourceBuilder.cloneState(normalizedState);
    } catch {
      return this.peekSubEventResourceState(normalizedRef);
    }
  }

  async replaceSubEventResourceState(
    state: AppTypes.ActivitySubEventResourceState
  ): Promise<AppTypes.ActivitySubEventResourceState | null> {
    const normalizedState = ActivityResourceBuilder.normalizeState(state, state);
    if (!normalizedState) {
      return null;
    }
    this.cachedStateByRecordId[ActivityResourceBuilder.recordId(normalizedState)] = normalizedState;
    try {
      const response = await this.http
        .post<AppTypes.ActivitySubEventResourceState | null>(
          `${this.apiBaseUrl}/activities/events/subevent-resources/replace`,
          normalizedState
        )
        .toPromise();
      const savedState = ActivityResourceBuilder.normalizeState(response, normalizedState) ?? normalizedState;
      this.cachedStateByRecordId[ActivityResourceBuilder.recordId(savedState)] = savedState;
      return ActivityResourceBuilder.cloneState(savedState);
    } catch {
      return ActivityResourceBuilder.cloneState(normalizedState);
    }
  }

  protected normalizeRef(
    ref: AppTypes.ActivitySubEventResourceStateRef | null | undefined
  ): AppTypes.ActivitySubEventResourceStateRef | null {
    const ownerId = `${ref?.ownerId ?? ''}`.trim();
    const subEventId = `${ref?.subEventId ?? ''}`.trim();
    const assetOwnerUserId = `${ref?.assetOwnerUserId ?? ''}`.trim();
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return null;
    }
    return {
      ownerId,
      subEventId,
      assetOwnerUserId
    };
  }
}
