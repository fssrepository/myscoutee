import { Injectable, signal } from '@angular/core';

import { EventFeedbackDetailDto } from '../../../core/contracts/activity.interface';
import type { ChatMetricBucketDTO } from '../../../core/contracts/chat.interface';
import type { UserMenuCounterDeltasDto } from '../../../core/contracts/user.interface';
import {
  cloneAssetCounters,
  cloneEventCounters,
  cloneEventFeedbackCounters,
  normalizeCounterValue
} from './app-context-store.utils';

export type ActivityCounterKey =
  | 'game'
  | 'chat'
  | 'invitations'
  | 'events'
  | 'hosting'
  | 'cars'
  | 'accommodation'
  | 'supplies'
  | 'tickets'
  | 'contacts'
  | 'feedback'
  | 'adminJobs'
  | 'adminMetrics';

export interface ActivityCounters {
  game: number;
  chat: number;
  invitations: number;
  events: number;
  hosting: number;
  cars: number;
  accommodation: number;
  supplies: number;
  tickets: number;
  contacts: number;
  feedback: number;
  event?: ActivityEventCounters;
  asset?: ActivityAssetCounters;
  eventFeedback?: ActivityEventFeedbackCounters;
  adminJobs: number;
  adminMetrics: number;
}

export interface ActivityEventCounters {
  all: number;
  active: number;
  pending: number;
  invitations: number;
  hosting: number;
  drafts: number;
  trash: number;
}

export interface ActivityAssetCounters {
  cars: number;
  accommodation: number;
  supplies: number;
  tickets: number;
}

export interface ActivityEventFeedbackCounters {
  ownEvents: number;
  pending: number;
  feedbacked: number;
  removed: number;
}

export interface ActivityMembersSyncState {
  updatedMs: number;
  id: string;
  acceptedMembers: number;
  pendingMembers: number;
  capacityTotal: number;
  acceptedMemberDelta?: number;
  pendingMemberDelta?: number;
}

export interface ActivityResourceSyncState {
  updatedMs: number;
  ownerId: string;
  subEventId: string;
  assetOwnerUserId: string;
}

export type ActivityChatMetricBucketType = 'members' | 'transport' | 'accommodation' | 'supplies';

export interface ActivityChatMetricBucketPatch {
  updatedMs: number;
  identity: string;
  bucketType: ActivityChatMetricBucketType;
  bucket: ChatMetricBucketDTO;
}

export interface ActivityEventFeedbackSubmitSyncState {
  updatedMs: number;
  dto: EventFeedbackDetailDto;
}

export const ACTIVITY_COUNTER_KEYS: ActivityCounterKey[] = [
  'game',
  'chat',
  'invitations',
  'events',
  'hosting',
  'cars',
  'accommodation',
  'supplies',
  'tickets',
  'contacts',
  'feedback',
  'adminJobs',
  'adminMetrics'
];

@Injectable({
  providedIn: 'root'
})
export class ActivityStore {
  private readonly _counterOverridesByUserId = signal<Record<string, Partial<ActivityCounters>>>({});
  private readonly _activityMembersSync = signal<ActivityMembersSyncState | null>(null);
  private readonly _activityResourceSync = signal<ActivityResourceSyncState | null>(null);
  private readonly _activityChatMetricBucketPatch = signal<ActivityChatMetricBucketPatch | null>(null);
  private readonly _activityEventFeedbackSubmitSync = signal<ActivityEventFeedbackSubmitSyncState | null>(null);

  readonly counterOverridesByUserId = this._counterOverridesByUserId.asReadonly();
  readonly activityMembersSync = this._activityMembersSync.asReadonly();
  readonly activityResourceSync = this._activityResourceSync.asReadonly();
  readonly activityChatMetricBucketPatch = this._activityChatMetricBucketPatch.asReadonly();
  readonly activityEventFeedbackSubmitSync = this._activityEventFeedbackSubmitSync.asReadonly();

  getUserCounterOverride(userId: string, key: ActivityCounterKey): number | null {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return null;
    }
    const value = this._counterOverridesByUserId()[normalizedUserId]?.[key];
    if (!Number.isFinite(value)) {
      return null;
    }
    return normalizeCounterValue(value);
  }

  getUserCounterOverrides(userId: string): Partial<ActivityCounters> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return {};
    }
    const overrides = this._counterOverridesByUserId()[normalizedUserId];
    if (!overrides) {
      return {};
    }
    return { ...overrides };
  }

  setUserCounterOverride(userId: string, key: ActivityCounterKey, value: number): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedValue = normalizeCounterValue(value);
    this._counterOverridesByUserId.update(state => ({
      ...state,
      [normalizedUserId]: {
        ...(state[normalizedUserId] ?? {}),
        [key]: normalizedValue
      }
    }));
  }

  patchUserCounterOverrides(userId: string, patch: Partial<ActivityCounters>): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    const normalizedPatch: Partial<ActivityCounters> = {};
    for (const key of ACTIVITY_COUNTER_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) {
        continue;
      }
      const value = patch[key];
      if (!Number.isFinite(value)) {
        continue;
      }
      normalizedPatch[key] = normalizeCounterValue(value);
    }
    if (patch.event) {
      normalizedPatch.event = cloneEventCounters(patch.event);
    }
    if (patch.asset) {
      normalizedPatch.asset = cloneAssetCounters(patch.asset);
    }
    if (patch.eventFeedback) {
      normalizedPatch.eventFeedback = cloneEventFeedbackCounters(patch.eventFeedback);
    }
    if (Object.keys(normalizedPatch).length === 0) {
      return;
    }
    this._counterOverridesByUserId.update(state => ({
      ...state,
      [normalizedUserId]: {
        ...(state[normalizedUserId] ?? {}),
        ...normalizedPatch
      }
    }));
  }

  patchUserCounterDeltas(
    userId: string,
    delta: UserMenuCounterDeltasDto | null | undefined,
    baseCounters: Partial<ActivityCounters> | null | undefined = null
  ): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !delta) {
      return;
    }
    const currentOverrides = this._counterOverridesByUserId()[normalizedUserId] ?? {};
    const normalizedPatch: Partial<ActivityCounters> = {};
    const normalizedPatchRecord = normalizedPatch as Record<string, number>;
    const overrideRecord = currentOverrides as Record<string, unknown>;
    const baseRecord = (baseCounters ?? {}) as Record<string, unknown>;
    const deltaRecord = delta as Record<string, unknown>;
    for (const key of ACTIVITY_COUNTER_KEYS) {
      const value = deltaRecord[key];
      if (!Number.isFinite(value)) {
        continue;
      }
      const baseValue = Number.isFinite(overrideRecord[key])
        ? overrideRecord[key]
        : baseRecord[key];
      normalizedPatchRecord[key] = normalizeCounterValue(
        normalizeCounterValue(baseValue) + Number(value)
      );
    }

    const event = this.applyNestedCounterDeltas<ActivityEventCounters>(
      delta.event,
      currentOverrides.event,
      baseCounters?.event,
      ['all', 'active', 'pending', 'invitations', 'hosting', 'drafts', 'trash']
    );
    if (event) {
      normalizedPatch.event = event;
    }

    const asset = this.applyNestedCounterDeltas<ActivityAssetCounters>(
      delta.asset,
      currentOverrides.asset,
      baseCounters?.asset,
      ['cars', 'accommodation', 'supplies', 'tickets']
    );
    if (asset) {
      normalizedPatch.asset = asset;
    }

    const eventFeedback = this.applyNestedCounterDeltas<ActivityEventFeedbackCounters>(
      delta.eventFeedback,
      currentOverrides.eventFeedback,
      baseCounters?.eventFeedback,
      ['ownEvents', 'pending', 'feedbacked', 'removed']
    );
    if (eventFeedback) {
      normalizedPatch.eventFeedback = eventFeedback;
    }

    if (Object.keys(normalizedPatch).length === 0) {
      return;
    }
    this._counterOverridesByUserId.update(state => ({
      ...state,
      [normalizedUserId]: {
        ...(state[normalizedUserId] ?? {}),
        ...normalizedPatch
      }
    }));
  }

  private applyNestedCounterDeltas<T extends object>(
    delta: Partial<Record<keyof T, number>> | null | undefined,
    current: Partial<T> | null | undefined,
    base: Partial<T> | null | undefined,
    keys: Array<keyof T>
  ): T | null {
    if (!delta) {
      return null;
    }
    const deltaRecord = delta as Record<string, unknown>;
    const currentRecord = (current ?? {}) as Record<string, unknown>;
    const baseRecord = (base ?? {}) as Record<string, unknown>;
    const next: Record<string, number> = {};
    let changed = false;
    for (const key of keys) {
      const keyName = String(key);
      const baseValue = Number.isFinite(currentRecord[keyName])
        ? currentRecord[keyName]
        : baseRecord[keyName];
      next[keyName] = normalizeCounterValue(baseValue);
      const value = deltaRecord[keyName];
      if (!Object.prototype.hasOwnProperty.call(deltaRecord, keyName) || !Number.isFinite(value)) {
        continue;
      }
      next[keyName] = normalizeCounterValue(next[keyName] + Number(value));
      changed = true;
    }
    return changed ? (next as T) : null;
  }

  clearUserCounterOverrides(userId: string, keys?: ActivityCounterKey[]): void {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return;
    }
    this._counterOverridesByUserId.update(state => {
      const current = state[normalizedUserId];
      if (!current) {
        return state;
      }
      if (!keys || keys.length === 0) {
        const { [normalizedUserId]: _removed, ...rest } = state;
        return rest;
      }
      const next = { ...current };
      for (const key of keys) {
        delete next[key];
      }
      if (Object.keys(next).length === 0) {
        const { [normalizedUserId]: _removed, ...rest } = state;
        return rest;
      }
      return {
        ...state,
        [normalizedUserId]: next
      };
    });
  }

  resolveUserCounter(userId: string, key: ActivityCounterKey, fallbackValue: number): number {
    const override = this.getUserCounterOverride(userId, key);
    if (override !== null) {
      return override;
    }
    return normalizeCounterValue(fallbackValue);
  }

  emitActivityMembersSync(payload: Omit<ActivityMembersSyncState, 'updatedMs'>): void {
    const normalizedId = payload.id.trim();
    if (!normalizedId) {
      return;
    }
    const acceptedMemberDelta = Number.isFinite(Number(payload.acceptedMemberDelta))
      ? Math.trunc(Number(payload.acceptedMemberDelta))
      : null;
    const pendingMemberDelta = Number.isFinite(Number(payload.pendingMemberDelta))
      ? Math.trunc(Number(payload.pendingMemberDelta))
      : null;
    this._activityMembersSync.set({
      updatedMs: Date.now(),
      id: normalizedId,
      acceptedMembers: normalizeCounterValue(payload.acceptedMembers),
      pendingMembers: normalizeCounterValue(payload.pendingMembers),
      capacityTotal: Math.max(
        normalizeCounterValue(payload.acceptedMembers),
        normalizeCounterValue(payload.capacityTotal)
      ),
      ...(acceptedMemberDelta !== null ? { acceptedMemberDelta } : {}),
      ...(pendingMemberDelta !== null ? { pendingMemberDelta } : {})
    });
  }

  emitActivityResourceSync(payload: Omit<ActivityResourceSyncState, 'updatedMs'>): void {
    const ownerId = payload.ownerId.trim();
    const subEventId = payload.subEventId.trim();
    const assetOwnerUserId = payload.assetOwnerUserId.trim();
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return;
    }
    this._activityResourceSync.set({
      updatedMs: Date.now(),
      ownerId,
      subEventId,
      assetOwnerUserId
    });
  }

  emitActivityChatMetricBucketPatch(payload: Omit<ActivityChatMetricBucketPatch, 'updatedMs'>): void {
    const identity = payload.identity.trim();
    if (!identity) {
      return;
    }
    this._activityChatMetricBucketPatch.set({
      updatedMs: Date.now(),
      identity,
      bucketType: payload.bucketType,
      bucket: {
        accepted: normalizeCounterValue(payload.bucket.accepted),
        pending: normalizeCounterValue(payload.bucket.pending),
        capacityMin: normalizeCounterValue(payload.bucket.capacityMin),
        capacityMax: Math.max(
          normalizeCounterValue(payload.bucket.capacityMin),
          normalizeCounterValue(payload.bucket.capacityMax)
        )
      }
    });
  }

  emitActivityEventFeedbackSubmit(dto: EventFeedbackDetailDto): void {
    const eventId = dto.eventId.trim();
    if (!eventId) {
      return;
    }
    this._activityEventFeedbackSubmitSync.set({
      updatedMs: Date.now(),
      dto: new EventFeedbackDetailDto({
        ...dto,
        eventId
      })
    });
  }
}
