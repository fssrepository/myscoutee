import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { ActivityResourceBuilder } from '../../base/builders';
import type * as AppDTOs from '../../contracts';
@Injectable({
  providedIn: 'root'
})
export class HttpActivityResourcesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedStateByRecordId: Record<string, AppDTOs.ActivitySubEventResourceStateDTO> = {};
  private readonly cachedScopeById: Record<string, AppDTOs.ActivitySubEventResourceScopeDTO> = {};

  peekSubEventResourceState(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    return ActivityResourceBuilder.cloneState(
      this.cachedStateByRecordId[ActivityResourceBuilder.recordId(normalizedRef)]
    );
  }

  async querySubEventResourceState(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): Promise<AppDTOs.ActivitySubEventResourceStateDTO | null> {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    try {
      const response = await this.http
        .get<AppDTOs.ActivitySubEventResourceStateDTO | null>(`${this.apiBaseUrl}/activities/events/subevent-resources`, {
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

  async querySubEventResourceScope(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): Promise<AppDTOs.ActivitySubEventResourceScopeDTO | null> {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    const response = await this.http
      .get<AppDTOs.ActivitySubEventResourceScopeDTO>(
        `${this.apiBaseUrl}/activities/events/subevent-resources/scope`,
        {
          params: new HttpParams()
            .set('ownerId', normalizedRef.ownerId)
            .set('subEventId', normalizedRef.subEventId)
            .set('viewerUserId', normalizedRef.assetOwnerUserId)
        }
      )
      .toPromise();
    const scope = ActivityResourceBuilder.normalizeScope(response, normalizedRef);
    for (const state of [scope.viewerState, ...scope.visibleStates]) {
      this.cachedStateByRecordId[ActivityResourceBuilder.recordId(state)] = state;
    }
    this.cachedScopeById[ActivityResourceBuilder.scopeId(normalizedRef)] = scope;
    return ActivityResourceBuilder.normalizeScope(scope, normalizedRef);
  }

  peekSubEventResourceScope(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO
  ): AppDTOs.ActivitySubEventResourceScopeDTO | null {
    const normalizedRef = this.normalizeRef(ref);
    if (!normalizedRef) {
      return null;
    }
    const cached = this.cachedScopeById[ActivityResourceBuilder.scopeId(normalizedRef)];
    return cached ? ActivityResourceBuilder.normalizeScope(cached, normalizedRef) : null;
  }

  async markResourceTypeRead(
    request: AppDTOs.ActivitySubEventResourceReadRequestDTO
  ): Promise<AppDTOs.ActivitySubEventResourceReadReceiptDTO | null> {
    const response = await this.http
      .post<AppDTOs.ActivitySubEventResourceReadReceiptDTO | null>(
        `${this.apiBaseUrl}/activities/events/subevent-resources/read`,
        {
          ownerId: request.ownerId.trim(),
          subEventId: request.subEventId.trim(),
          resourceType: request.resourceType,
          userId: request.userId.trim()
        }
      )
      .toPromise();
    return response ?? null;
  }

  async querySupplyContributionPage(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO,
    assetId: string,
    page: number,
    pageSize: number
  ): Promise<AppDTOs.SubEventSupplyContributionPageDTO> {
    const normalizedRef = this.normalizeRef(ref);
    const normalizedAssetId = assetId.trim();
    const normalizedPage = Math.max(0, Math.trunc(page) || 0);
    const normalizedPageSize = Math.max(1, Math.trunc(pageSize) || 1);
    if (!normalizedRef || !normalizedAssetId) {
      return { items: [], total: 0, page: normalizedPage, pageSize: normalizedPageSize };
    }
    const response = await this.http
      .get<AppDTOs.SubEventSupplyContributionPageDTO>(
        `${this.apiBaseUrl}/activities/events/subevent-resources/contributions`,
        {
          params: new HttpParams()
            .set('ownerId', normalizedRef.ownerId)
            .set('subEventId', normalizedRef.subEventId)
            .set('assetOwnerUserId', normalizedRef.assetOwnerUserId)
            .set('assetId', normalizedAssetId)
            .set('page', normalizedPage)
            .set('pageSize', normalizedPageSize)
        }
      )
      .toPromise();
    return response ?? { items: [], total: 0, page: normalizedPage, pageSize: normalizedPageSize };
  }

  async replaceSubEventResourceState(
    state: AppDTOs.ActivitySubEventResourceStateDTO,
    signal?: AbortSignal,
    _actorUserId?: string | null
  ): Promise<AppDTOs.ActivitySubEventResourceStateDTO | null> {
    const normalizedState = ActivityResourceBuilder.normalizeState(state, state);
    if (!normalizedState) {
      return null;
    }
    const response = await this.requestWithAbort(
      this.http
        .post<AppDTOs.ActivitySubEventResourceStateDTO | null>(
          `${this.apiBaseUrl}/activities/events/subevent-resources/replace`,
          normalizedState
        ),
      signal
    );
    const savedState = ActivityResourceBuilder.normalizeState(response, null);
    if (!savedState) {
      throw new Error('Activity resource assignment was not persisted.');
    }
    const savedRecordId = ActivityResourceBuilder.recordId(savedState);
    const resourceIsActive = ActivityResourceBuilder.hasResourceData(savedState);
    if (resourceIsActive) {
      this.cachedStateByRecordId[savedRecordId] = savedState;
    } else {
      delete this.cachedStateByRecordId[savedRecordId];
    }
    for (const [scopeId, cachedScope] of Object.entries(this.cachedScopeById)) {
      if (
        cachedScope.viewerState.ownerId !== savedState.ownerId
        || cachedScope.viewerState.subEventId !== savedState.subEventId
      ) {
        continue;
      }
      const viewerState = cachedScope.viewerState.assetOwnerUserId === savedState.assetOwnerUserId
        ? (resourceIsActive ? savedState : ActivityResourceBuilder.createEmptyState(savedState))
        : cachedScope.viewerState;
      this.cachedScopeById[scopeId] = ActivityResourceBuilder.normalizeScope({
        viewerState,
        visibleStates: [
          ...cachedScope.visibleStates.filter(state => (
            ActivityResourceBuilder.recordId(state) !== savedRecordId
          )),
          ...(resourceIsActive ? [savedState] : [])
        ]
      }, viewerState);
    }
    return ActivityResourceBuilder.cloneState(savedState);
  }

  private createAbortError(): Error {
    const error = new Error('Activity resources request aborted.');
    error.name = 'AbortError';
    return error;
  }

  private requestWithAbort<T>(request$: Observable<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.createAbortError());
        return;
      }

      const subscription = request$.subscribe({
        next: value => {
          cleanup();
          resolve(value);
        },
        error: error => {
          cleanup();
          reject(error);
        }
      });

      const onAbort = () => {
        subscription.unsubscribe();
        cleanup();
        reject(this.createAbortError());
      };

      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
      };

      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private normalizeRef(
    ref: AppDTOs.ActivitySubEventResourceStateRefDTO | null | undefined
  ): AppDTOs.ActivitySubEventResourceStateRefDTO | null {
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
