import { Injectable, signal } from '@angular/core';

import { EventFeedbackDetailDto } from '../../../core/contracts/activity.interface';
import type {
  ActivityCounterKey,
  ActivityCounters,
  ActivityEventFeedbackSubmitSyncState,
  ActivityMembersSyncState,
  ActivityResourceSyncState
} from '../app-context.types';
import { ACTIVITY_COUNTER_KEYS } from '../app-context.types';
import {
  cloneAssetCounters,
  cloneEventCounters,
  cloneEventFeedbackCounters,
  normalizeCounterValue
} from './app-context-store.utils';

@Injectable({
  providedIn: 'root'
})
export class ActivityStore {
  private readonly _counterOverridesByUserId = signal<Record<string, Partial<ActivityCounters>>>({});
  private readonly _activityMembersSync = signal<ActivityMembersSyncState | null>(null);
  private readonly _activityResourceSync = signal<ActivityResourceSyncState | null>(null);
  private readonly _activityEventFeedbackSubmitSync = signal<ActivityEventFeedbackSubmitSyncState | null>(null);

  readonly counterOverridesByUserId = this._counterOverridesByUserId.asReadonly();
  readonly activityMembersSync = this._activityMembersSync.asReadonly();
  readonly activityResourceSync = this._activityResourceSync.asReadonly();
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
    this._activityMembersSync.set({
      updatedMs: Date.now(),
      id: normalizedId,
      acceptedMembers: normalizeCounterValue(payload.acceptedMembers),
      pendingMembers: normalizeCounterValue(payload.pendingMembers),
      capacityTotal: Math.max(
        normalizeCounterValue(payload.acceptedMembers),
        normalizeCounterValue(payload.capacityTotal)
      )
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
