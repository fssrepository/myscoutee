import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { ActivityResourceBuilder } from '../../base/builders';
import type * as AppDTOs from '../../base/dto';
@Injectable({
  providedIn: 'root'
})
export class HttpActivityResourcesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedStateByRecordId: Record<string, AppDTOs.ActivitySubEventResourceStateDTO> = {};

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

  async replaceSubEventResourceState(
    state: AppDTOs.ActivitySubEventResourceStateDTO,
    signal?: AbortSignal
  ): Promise<AppDTOs.ActivitySubEventResourceStateDTO | null> {
    const normalizedState = ActivityResourceBuilder.normalizeState(state, state);
    if (!normalizedState) {
      return null;
    }
    this.cachedStateByRecordId[ActivityResourceBuilder.recordId(normalizedState)] = normalizedState;
    try {
      const response = await this.requestWithAbort(
        this.http
          .post<AppDTOs.ActivitySubEventResourceStateDTO | null>(
            `${this.apiBaseUrl}/activities/events/subevent-resources/replace`,
            normalizedState
          ),
        signal
      );
      const savedState = ActivityResourceBuilder.normalizeState(response, normalizedState) ?? normalizedState;
      this.cachedStateByRecordId[ActivityResourceBuilder.recordId(savedState)] = savedState;
      return ActivityResourceBuilder.cloneState(savedState);
    } catch {
      if (signal?.aborted) {
        throw this.createAbortError();
      }
      return ActivityResourceBuilder.cloneState(normalizedState);
    }
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
