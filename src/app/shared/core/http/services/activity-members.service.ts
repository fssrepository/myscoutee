import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import type {
  ActivityMemberActionResultDTO,
  ActivityMemberOwnerRef,
  ActivityMemberSyncKnownItemDTO,
  ActivityMembersQueryOptions,
  ActivityMembersSyncResultDTO,
  ActivityMembersSummaryDto
} from '../../contracts/activity.interface';
import type * as ActivityContracts from '../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class HttpActivityMembersService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl ?? '/api';
  private readonly cachedMembersByOwnerKey: Record<string, ActivityContracts.ActivityMemberDTO[]> = {};
  private readonly cachedSummariesByOwnerKey: Record<string, ActivityMembersSummaryDto> = {};

  peekMembersByOwner(owner: ActivityMemberOwnerRef): ActivityContracts.ActivityMemberDTO[] {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return [];
    }
    return this.cloneEntries(this.cachedMembersByOwnerKey[this.ownerKey(normalizedOwner)] ?? []);
  }

  async queryMembersByOwner(
    owner: ActivityMemberOwnerRef,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityContracts.ActivityMemberDTO[]> {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return [];
    }
    const pendingOnly = options?.pendingOnly === true;
    let params = new HttpParams()
      .set('ownerType', normalizedOwner.ownerType)
      .set('ownerId', normalizedOwner.ownerId);
    const eventId = `${options?.eventId ?? ''}`.trim();
    const subEventId = `${options?.subEventId ?? ''}`.trim();
    if (eventId) {
      params = params.set('eventId', eventId);
    }
    if (subEventId) {
      params = params.set('subEventId', subEventId);
    }
    try {
      const response = await this.http
        .get<ActivityContracts.ActivityMemberDTO[] | null>(`${this.apiBaseUrl}/activities/events/members`, {
          params: pendingOnly ? params.set('pendingOnly', 'true') : params
        })
        .toPromise();
      const members = this.cloneEntries(Array.isArray(response) ? response : []);
      if (!pendingOnly) {
        this.cacheMembers(normalizedOwner, members, this.cachedSummariesByOwnerKey[this.ownerKey(normalizedOwner)]?.capacityTotal ?? null);
      }
      return this.cloneEntries(members);
    } catch {
      if (pendingOnly) {
        return [];
      }
      return this.peekMembersByOwner(normalizedOwner);
    }
  }

  async syncMembersByOwner(
    owner: ActivityMemberOwnerRef,
    knownItems: readonly ActivityMemberSyncKnownItemDTO[],
    options?: ActivityMembersQueryOptions,
    signal?: AbortSignal
  ): Promise<ActivityMembersSyncResultDTO> {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return { upserts: [], removedIds: [], total: 0 };
    }
    const response = await this.requestWithAbort(
      this.http.post<ActivityMembersSyncResultDTO | null>(
        `${this.apiBaseUrl}/activities/events/members/sync`,
        {
          owner: normalizedOwner,
          knownItems: knownItems.map(item => ({
            id: `${item.id ?? ''}`.trim(),
            revision: `${item.revision ?? ''}`
          })).filter(item => item.id.length > 0),
          eventId: `${options?.eventId ?? ''}`.trim() || null,
          subEventId: `${options?.subEventId ?? ''}`.trim() || null
        }
      ),
      signal
    );
    const result: ActivityMembersSyncResultDTO = {
      upserts: this.cloneEntries(Array.isArray(response?.upserts) ? response.upserts : []),
      removedIds: Array.isArray(response?.removedIds)
        ? response.removedIds.map(id => `${id ?? ''}`.trim()).filter(Boolean)
        : [],
      total: Math.max(0, Math.trunc(Number(response?.total) || 0))
    };
    this.applySyncToCache(normalizedOwner, result);
    return {
      upserts: this.cloneEntries(result.upserts),
      removedIds: [...result.removedIds],
      total: result.total
    };
  }

  peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummaryDto | null {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return null;
    }
    const summary = this.cachedSummariesByOwnerKey[this.ownerKey(normalizedOwner)];
    return summary ? this.cloneSummary(summary) : null;
  }

  async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummaryDto[]> {
    const normalizedOwners = this.normalizeOwners(owners);
    if (normalizedOwners.length === 0) {
      return [];
    }
    try {
      const response = await this.http
        .post<ActivityMembersSummaryDto[] | null>(`${this.apiBaseUrl}/activities/events/members/summaries`, {
          owners: normalizedOwners
        })
        .toPromise();
      const summaries = (Array.isArray(response) ? response : [])
        .map(summary => this.normalizeSummary(summary))
        .filter((summary): summary is ActivityMembersSummaryDto => Boolean(summary));
      this.cacheSummaries(summaries);
      return summaries.map(summary => this.cloneSummary(summary));
    } catch {
      return normalizedOwners
        .map(owner => this.peekSummaryByOwner(owner))
        .filter((summary): summary is ActivityMembersSummaryDto => Boolean(summary));
    }
  }

  async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityContracts.ActivityMemberDTO[],
    capacityTotal?: number | null,
    actorUserId = '',
    options?: ActivityMembersQueryOptions
  ): Promise<void> {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    await this.http
      .post<void>(`${this.apiBaseUrl}/activities/events/members/replace`, {
        owner: normalizedOwner,
        members: this.cloneEntries(members),
        capacityTotal: this.normalizeCount(capacityTotal),
        actorUserId: actorUserId.trim(),
        eventId: `${options?.eventId ?? ''}`.trim() || null,
        subEventId: `${options?.subEventId ?? ''}`.trim() || null
      })
      .toPromise();
    this.cacheMembers(normalizedOwner, members, capacityTotal);
  }

  async inviteEventMembers(
    owner: ActivityMemberOwnerRef,
    actorUserId: string,
    userIds: readonly string[]
  ): Promise<ActivityContracts.ActivityMemberDTO[]> {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    const normalizedUserIds = [...new Set(userIds.map(userId => userId.trim()).filter(Boolean))];
    if (!normalizedOwner || normalizedOwner.ownerType !== 'event' || normalizedUserIds.length === 0) {
      return normalizedOwner ? this.peekMembersByOwner(normalizedOwner) : [];
    }
    const response = await this.http
      .post<ActivityContracts.ActivityMemberDTO[] | null>(
        `${this.apiBaseUrl}/activities/events/members/invite`,
        {
          owner: normalizedOwner,
          actorUserId: actorUserId.trim(),
          userIds: normalizedUserIds
        }
      )
      .toPromise();
    const members = this.cloneEntries(Array.isArray(response) ? response : []);
    this.cacheMembers(
      normalizedOwner,
      members,
      this.cachedSummariesByOwnerKey[this.ownerKey(normalizedOwner)]?.capacityTotal ?? null
    );
    return this.cloneEntries(members);
  }

  async applyMemberAction(
    owner: ActivityMemberOwnerRef,
    actorUserId: string,
    targetUserId: string,
    action: 'accept' | 'remove' | 'disqualify' | 'reinstate' | 'promote-admin' | 'step-down-admin',
    reason?: string | null,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityMemberActionResultDTO> {
    const normalizedOwner = this.normalizeOwnerRef(owner);
    const normalizedTargetUserId = targetUserId.trim();
    if (!normalizedOwner || !normalizedTargetUserId) {
      return {
        members: normalizedOwner ? this.peekMembersByOwner(normalizedOwner) : [],
        counterOverrides: null
      };
    }
    const response = await this.http
      .post<ActivityMemberActionResultDTO | ActivityContracts.ActivityMemberDTO[] | null>(`${this.apiBaseUrl}/activities/events/members/action`, {
        owner: normalizedOwner,
        actorUserId: actorUserId.trim(),
        targetUserId: normalizedTargetUserId,
        action,
        reason: reason?.trim() || null,
        eventId: `${options?.eventId ?? ''}`.trim() || null,
        subEventId: `${options?.subEventId ?? ''}`.trim() || null
      })
      .toPromise();
    const members = this.cloneEntries(Array.isArray(response)
      ? response
      : (Array.isArray(response?.members) ? response.members : []));
    this.cacheMembers(normalizedOwner, members, this.cachedSummariesByOwnerKey[this.ownerKey(normalizedOwner)]?.capacityTotal ?? null);
    return {
      members: this.cloneEntries(members),
      counterOverrides: !Array.isArray(response) && response?.counterOverrides
        ? { ...response.counterOverrides }
        : null
    };
  }

  private ownerKey(owner: ActivityMemberOwnerRef): string {
    return `${owner.ownerType}:${owner.ownerId}`;
  }

  private normalizeOwnerRef(owner: ActivityMemberOwnerRef | null | undefined): ActivityMemberOwnerRef | null {
    const ownerType = owner?.ownerType;
    const ownerId = owner?.ownerId?.trim() ?? '';
    if ((ownerType !== 'event' && ownerType !== 'subEvent' && ownerType !== 'group' && ownerType !== 'asset') || !ownerId) {
      return null;
    }
    return {
      ownerType,
      ownerId
    };
  }

  private normalizeOwners(owners: readonly ActivityMemberOwnerRef[]): ActivityMemberOwnerRef[] {
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

  private cacheMembers(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityContracts.ActivityMemberDTO[],
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

  private applySyncToCache(
    owner: ActivityMemberOwnerRef,
    result: ActivityMembersSyncResultDTO
  ): void {
    const current = this.peekMembersByOwner(owner);
    const removedIds = new Set(result.removedIds);
    const upsertsById = new Map(result.upserts.map(member => [member.id, member] as const));
    const next = current
      .filter(member => !removedIds.has(member.id))
      .map(member => upsertsById.get(member.id) ?? member);
    const knownIds = new Set(next.map(member => member.id));
    for (const upsert of result.upserts) {
      if (!knownIds.has(upsert.id)) {
        next.push(upsert);
        knownIds.add(upsert.id);
      }
    }
    this.cacheMembers(
      owner,
      next,
      this.cachedSummariesByOwnerKey[this.ownerKey(owner)]?.capacityTotal ?? null
    );
  }

  private cacheSummaries(summaries: readonly ActivityMembersSummaryDto[]): void {
    for (const summary of summaries) {
      const normalizedSummary = this.normalizeSummary(summary);
      if (!normalizedSummary) {
        continue;
      }
      this.cachedSummariesByOwnerKey[this.ownerKey(normalizedSummary)] = normalizedSummary;
    }
  }

  private buildSummary(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityContracts.ActivityMemberDTO[],
    capacityTotal?: number | null
  ): ActivityMembersSummaryDto {
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

  private cloneEntries(entries: readonly ActivityContracts.ActivityMemberDTO[]): ActivityContracts.ActivityMemberDTO[] {
    return entries.map(entry => ({
      ...entry,
      involvements: Array.isArray(entry.involvements)
        ? entry.involvements.map(involvement => ({ ...involvement }))
        : []
    }));
  }

  private cloneSummary(summary: ActivityMembersSummaryDto): ActivityMembersSummaryDto {
    return {
      ...summary,
      acceptedMemberUserIds: [...summary.acceptedMemberUserIds],
      pendingMemberUserIds: [...summary.pendingMemberUserIds]
    };
  }

  private normalizeSummary(summary: ActivityMembersSummaryDto | null | undefined): ActivityMembersSummaryDto | null {
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

  private requestWithAbort<T>(request$: Observable<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(this.createAbortError());
        return;
      }
      let settled = false;
      let subscription: { unsubscribe: () => void } | null = null;
      const cleanup = () => signal?.removeEventListener('abort', onAbort);
      const onAbort = () => {
        if (settled) {
          return;
        }
        settled = true;
        subscription?.unsubscribe();
        cleanup();
        reject(this.createAbortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      subscription = request$.subscribe({
        next: value => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(value);
        },
        error: error => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          reject(error);
        },
        complete: () => cleanup()
      });
    });
  }

  private createAbortError(): Error {
    const error = new Error('Request aborted.');
    error.name = 'AbortError';
    return error;
  }

}
