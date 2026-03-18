import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type {
  ActivityMemberOwnerRef,
  ActivityMembersSummary,
  ActivitiesEventSyncPayload
} from '../../../core/base/models';
import type * as AppTypes from '../../../core/base/models';
import { AppMemoryDb } from '../../base/db';

@Injectable({
  providedIn: 'root'
})
export class HttpActivityMembersRepository {
  protected readonly memoryDb = inject(AppMemoryDb);
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedMembersByOwnerKey: Record<string, AppTypes.ActivityMemberEntry[]> = {};
  private readonly cachedSummariesByOwnerKey: Record<string, ActivityMembersSummary> = {};

  peekMembersByOwner(owner: ActivityMemberOwnerRef): AppTypes.ActivityMemberEntry[] {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return [];
    }
    return this.cloneEntries(this.cachedMembersByOwnerKey[this.ownerKey(normalizedOwner)] ?? []);
  }

  peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummary | null {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return null;
    }
    const summary = this.cachedSummariesByOwnerKey[this.ownerKey(normalizedOwner)];
    return summary ? this.cloneSummary(summary) : null;
  }

  async queryMembersByOwner(owner: ActivityMemberOwnerRef): Promise<AppTypes.ActivityMemberEntry[]> {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return [];
    }
    try {
      const response = await this.http
        .get<AppTypes.ActivityMemberEntry[] | null>(`${this.apiBaseUrl}/activities/events/members`, {
          params: new HttpParams()
            .set('ownerType', normalizedOwner.ownerType)
            .set('ownerId', normalizedOwner.ownerId)
        })
        .toPromise();
      const members = this.cloneEntries(Array.isArray(response) ? response : []);
      this.cacheMembers(normalizedOwner, members, this.cachedSummariesByOwnerKey[this.ownerKey(normalizedOwner)]?.capacityTotal ?? null);
      return this.cloneEntries(members);
    } catch {
      return this.peekMembersByOwner(normalizedOwner);
    }
  }

  async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummary[]> {
    const normalizedOwners = this.normalizeOwners(owners);
    if (normalizedOwners.length === 0) {
      return [];
    }
    try {
      const response = await this.http
        .post<ActivityMembersSummary[] | null>(`${this.apiBaseUrl}/activities/events/members/summaries`, {
          owners: normalizedOwners
        })
        .toPromise();
      const summaries = (Array.isArray(response) ? response : [])
        .map(summary => this.normalizeSummary(summary))
        .filter((summary): summary is ActivityMembersSummary => Boolean(summary));
      this.cacheSummaries(summaries);
      return summaries.map(summary => this.cloneSummary(summary));
    } catch {
      return normalizedOwners
        .map(owner => this.peekSummaryByOwner(owner))
        .filter((summary): summary is ActivityMembersSummary => Boolean(summary));
    }
  }

  async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null
  ): Promise<void> {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    this.cacheMembers(normalizedOwner, members, capacityTotal);
    await this.postVoid('/activities/events/members/replace', {
      owner: normalizedOwner,
      members: this.cloneEntries(members),
      capacityTotal: this.normalizeCount(capacityTotal)
    });
  }

  async syncEventMembersFromEventSnapshot(payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    await this.postVoid('/activities/events/members/sync', payload);
  }

  protected ownerKey(owner: ActivityMemberOwnerRef): string {
    return `${owner.ownerType}:${owner.ownerId}`;
  }

  protected normalizeOwnerRef(owner: ActivityMemberOwnerRef | null | undefined): ActivityMemberOwnerRef | null {
    const ownerType = owner?.ownerType;
    const ownerId = owner?.ownerId?.trim() ?? '';
    if ((ownerType !== 'event' && ownerType !== 'subEvent' && ownerType !== 'group') || !ownerId) {
      return null;
    }
    return {
      ownerType,
      ownerId
    };
  }

  protected normalizeOwners(owners: readonly ActivityMemberOwnerRef[]): ActivityMemberOwnerRef[] {
    const next: ActivityMemberOwnerRef[] = [];
    const seen = new Set<string>();
    for (const owner of owners) {
      const normalizedOwner = this.normalizeOwnerRef(owner);
      if (!normalizedOwner) {
        continue;
      }
      const key = this.ownerKey(normalizedOwner);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      next.push(normalizedOwner);
    }
    return next;
  }

  protected cacheMembers(
    owner: ActivityMemberOwnerRef,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null
  ): void {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    const ownerKey = this.ownerKey(normalizedOwner);
    const clonedMembers = this.cloneEntries(members);
    this.cachedMembersByOwnerKey[ownerKey] = clonedMembers;
    this.cachedSummariesByOwnerKey[ownerKey] = this.buildSummary(
      normalizedOwner,
      clonedMembers,
      capacityTotal ?? this.cachedSummariesByOwnerKey[ownerKey]?.capacityTotal ?? null
    );
  }

  protected cacheSummaries(summaries: readonly ActivityMembersSummary[]): void {
    for (const summary of summaries) {
      const normalizedSummary = this.normalizeSummary(summary);
      if (!normalizedSummary) {
        continue;
      }
      this.cachedSummariesByOwnerKey[this.ownerKey(normalizedSummary)] = normalizedSummary;
    }
  }

  protected buildSummary(
    owner: ActivityMemberOwnerRef,
    members: readonly AppTypes.ActivityMemberEntry[],
    capacityTotal?: number | null
  ): ActivityMembersSummary {
    const acceptedMemberUserIds = members
      .filter(member => member.status === 'accepted')
      .map(member => member.userId);
    const pendingMemberUserIds = members
      .filter(member => member.status === 'pending')
      .map(member => member.userId);
    const acceptedMembers = acceptedMemberUserIds.length;
    const pendingMembers = pendingMemberUserIds.length;
    return {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      acceptedMembers,
      pendingMembers,
      capacityTotal: Math.max(
        acceptedMembers,
        this.normalizeCount(capacityTotal)
          ?? acceptedMembers
      ),
      acceptedMemberUserIds: [...acceptedMemberUserIds],
      pendingMemberUserIds: [...pendingMemberUserIds]
    };
  }

  protected cloneEntries(entries: readonly AppTypes.ActivityMemberEntry[]): AppTypes.ActivityMemberEntry[] {
    return entries.map(entry => ({ ...entry }));
  }

  protected cloneSummary(summary: ActivityMembersSummary): ActivityMembersSummary {
    return {
      ...summary,
      acceptedMemberUserIds: [...summary.acceptedMemberUserIds],
      pendingMemberUserIds: [...summary.pendingMemberUserIds]
    };
  }

  private normalizeSummary(summary: ActivityMembersSummary | null | undefined): ActivityMembersSummary | null {
    const normalizedOwner = this.normalizeOwnerRef(summary);
    if (!normalizedOwner) {
      return null;
    }
    const acceptedMemberUserIds = this.normalizeUserIds(summary?.acceptedMemberUserIds);
    const pendingMemberUserIds = this.normalizeUserIds(summary?.pendingMemberUserIds);
    const acceptedMembers = this.normalizeCount(summary?.acceptedMembers) ?? acceptedMemberUserIds.length;
    const pendingMembers = this.normalizeCount(summary?.pendingMembers) ?? pendingMemberUserIds.length;
    return {
      ownerType: normalizedOwner.ownerType,
      ownerId: normalizedOwner.ownerId,
      acceptedMembers,
      pendingMembers,
      capacityTotal: Math.max(
        acceptedMembers,
        this.normalizeCount(summary?.capacityTotal)
          ?? acceptedMembers
      ),
      acceptedMemberUserIds,
      pendingMemberUserIds
    };
  }

  private normalizeUserIds(userIds: readonly string[] | undefined): string[] {
    if (!Array.isArray(userIds)) {
      return [];
    }
    return Array.from(new Set(userIds
      .map(userId => `${userId ?? ''}`.trim())
      .filter(userId => userId.length > 0)));
  }

  private normalizeCount(value: unknown): number | null {
    if (!Number.isFinite(Number(value))) {
      return null;
    }
    return Math.max(0, Math.trunc(Number(value)));
  }

  private async postVoid(route: string, payload: unknown): Promise<void> {
    try {
      await this.http.post<void>(`${this.apiBaseUrl}${route}`, payload).toPromise();
    } catch {
      // Keep optimistic UI state until concrete backend endpoints land.
    }
  }
}
