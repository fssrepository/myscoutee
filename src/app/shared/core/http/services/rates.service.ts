import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type { RateMenuItem } from '../../../demo-data';

@Injectable({
  providedIn: 'root'
})
export class HttpRatesService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedRatesByUserId: Record<string, RateMenuItem[]> = {};

  peekRateItemsByUser(userId: string): RateMenuItem[] {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    return [...(this.cachedRatesByUserId[normalizedUserId] ?? [])];
  }

  async queryRateItemsByUser(userId: string): Promise<RateMenuItem[]> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return [];
    }
    try {
      const response = await this.http
        .get<RateMenuItem[] | null>(`${this.apiBaseUrl}/activities/rates`, {
          params: new HttpParams().set('userId', normalizedUserId)
        })
        .toPromise();
      const items = Array.isArray(response)
        ? response.map(item => ({ ...item }))
        : [];
      this.cachedRatesByUserId[normalizedUserId] = items;
      return [...items];
    } catch {
      return this.peekRateItemsByUser(normalizedUserId);
    }
  }
}
