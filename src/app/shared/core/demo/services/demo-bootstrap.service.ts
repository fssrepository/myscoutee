import { Injectable, inject } from '@angular/core';

import { APP_STATIC_DATA } from '../../../app-static-data';
import type { EventMenuItem } from '../../base/interfaces/activity-feed.interface';
import { AppMemoryDb } from '../../base/db';
import { DemoEventFeedbackBuilder } from '../builders';
import { DemoActivityMembersRepository } from '../repositories/activity-members.repository';
import { DemoActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { DemoAssetsRepository } from '../repositories/assets.repository';
import { DemoChatsRepository } from '../repositories/chats.repository';
import { DemoEventsRepository } from '../repositories/events.repository';
import { EVENT_FEEDBACK_TABLE_NAME } from '../models/event-feedback.model';
import type { DemoEventRecord } from '../models/events.model';
import { DemoUsersRatingsRepository } from '../repositories/users-ratings.repository';
import { DemoUsersRepository } from '../repositories/users.repository';

export interface DemoBootstrapProgressState {
  percent: number;
  label: string;
}

type DemoBootstrapProgressListener = (state: DemoBootstrapProgressState) => void;

@Injectable({
  providedIn: 'root'
})
export class DemoBootstrapService {
  private static readonly EVENT_FEEDBACK_UNLOCK_DELAY_MS = 2 * 60 * 60 * 1000;
  private readonly memoryDb = inject(AppMemoryDb);
  private readonly chatsRepository = inject(DemoChatsRepository);
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly activityMembersRepository = inject(DemoActivityMembersRepository);
  private readonly assetsRepository = inject(DemoAssetsRepository);
  private readonly activityResourcesRepository = inject(DemoActivityResourcesRepository);

  private bootstrapPromise: Promise<void> | null = null;
  private ready = false;
  private readonly readyUserIds = new Set<string>();
  private lastProgress: DemoBootstrapProgressState = {
    percent: 0,
    label: 'Preparing demo data'
  };
  private readonly listeners = new Set<DemoBootstrapProgressListener>();

  async ensureReady(onProgress?: DemoBootstrapProgressListener): Promise<void> {
    if (onProgress) {
      this.listeners.add(onProgress);
      onProgress(this.lastProgress);
    }

    if (this.ready) {
      this.emitProgress({
        percent: 100,
        label: 'Demo data ready'
      });
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
      return;
    }

    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.runBootstrap().finally(() => {
        this.bootstrapPromise = null;
      });
    }

    try {
      await this.bootstrapPromise;
    } finally {
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
    }
  }

  async ensureUserReady(userId: string, onProgress?: DemoBootstrapProgressListener): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      onProgress?.({
        percent: 100,
        label: 'Demo session ready'
      });
      return;
    }

    await this.ensureReady();

    if (this.readyUserIds.has(normalizedUserId)) {
      onProgress?.({
        percent: 100,
        label: 'Demo session ready'
      });
      return;
    }

    onProgress?.({
      percent: 0,
      label: 'Preparing demo session'
    });
    await this.waitForUiYield();

    onProgress?.({
      percent: 45,
      label: 'Preparing chat threads'
    });
    await this.waitForUiYield();
    const contextualChatsChanged = this.chatsRepository.seedContextualRecordsForUser(
      normalizedUserId,
      this.eventsRepository.queryItemsByUser(normalizedUserId)
    );
    if (contextualChatsChanged) {
      onProgress?.({
        percent: 80,
        label: 'Syncing demo IndexedDB'
      });
      await this.memoryDb.flushToIndexedDb();
      await this.waitForUiYield();
    }

    this.readyUserIds.add(normalizedUserId);
    onProgress?.({
      percent: 100,
      label: 'Demo session ready'
    });
  }

  private async runBootstrap(): Promise<void> {
    if (this.ready) {
      this.emitProgress({
        percent: 100,
        label: 'Demo data ready'
      });
      return;
    }

    await this.runBootstrapStep(0, 'Preparing demo selector');
    await this.runBootstrapStep(16, 'Loading chats', () => this.chatsRepository.init());
    await this.runBootstrapStep(36, 'Loading events', () => this.eventsRepository.init());
    await this.runBootstrapStep(52, 'Preparing demo users', () => { this.usersRepository.init(); });
    await this.runBootstrapStep(60, 'Preparing event feedback', () => this.seedEventFeedbackStates());
    await this.runBootstrapStep(68, 'Loading ratings', () => this.usersRatingsRepository.init());
    await this.runBootstrapStep(80, 'Preparing owned assets', () => this.assetsRepository.init());
    await this.runBootstrapStep(90, 'Preparing activity members', () => this.activityMembersRepository.init());
    await this.runBootstrapStep(96, 'Preparing activity resources', () => this.activityResourcesRepository.init());
    await this.runBootstrapStep(100, 'Syncing demo IndexedDB', () => this.memoryDb.flushToIndexedDb());

    this.ready = true;
    this.emitProgress({
      percent: 100,
      label: 'Demo data ready'
    });
  }


  private seedEventFeedbackStates(): void {
    const users = this.usersRepository.queryAllUsers();
    if (users.length === 0) {
      return;
    }

    const currentTable = this.memoryDb.read()[EVENT_FEEDBACK_TABLE_NAME];
    const nextById = { ...currentTable.byId };
    const nextIds = [...currentTable.ids];
    let changed = false;

    for (const activeUser of users) {
      const eventRecords = this.eventsRepository.queryEventItemsByUser(activeUser.id);
      if (eventRecords.length === 0) {
        continue;
      }
      const seededRecords = DemoEventFeedbackBuilder.buildSeededPersistedStates({
        eventItems: eventRecords.map(record => this.toEventMenuItem(record)),
        users,
        activeUser,
        eventDatesById: Object.fromEntries(eventRecords.map(record => [record.id, record.startAtIso])),
        activityImageById: Object.fromEntries(eventRecords.map(record => [record.id, record.imageUrl ?? ''])),
        eventFeedbackUnlockDelayMs: DemoBootstrapService.EVENT_FEEDBACK_UNLOCK_DELAY_MS,
        eventOverallOptions: APP_STATIC_DATA.eventFeedbackEventOverallOptions,
        hostImproveOptions: APP_STATIC_DATA.eventFeedbackHostImproveOptions,
        attendeeCollabOptions: APP_STATIC_DATA.eventFeedbackAttendeeCollabOptions,
        attendeeRejoinOptions: APP_STATIC_DATA.eventFeedbackAttendeeRejoinOptions,
        personalityTraitOptions: APP_STATIC_DATA.eventFeedbackPersonalityTraitOptions
      });

      for (const record of seededRecords) {
        if (nextById[record.id]) {
          continue;
        }
        nextById[record.id] = {
          ...record,
          answersByCardId: { ...(record.answersByCardId ?? {}) }
        };
        nextIds.push(record.id);
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    this.memoryDb.write(state => ({
      ...state,
      [EVENT_FEEDBACK_TABLE_NAME]: {
        byId: nextById,
        ids: nextIds
      }
    }));
  }

  private toEventMenuItem(record: DemoEventRecord): EventMenuItem {
    return {
      id: record.id,
      avatar: record.creatorInitials,
      title: record.title,
      shortDescription: record.subtitle,
      timeframe: record.timeframe,
      activity: record.activity,
      isAdmin: record.isAdmin,
      creatorUserId: record.creatorUserId,
      startAt: record.startAtIso,
      endAt: record.endAtIso,
      distanceKm: record.distanceKm,
      acceptedMemberUserIds: [...record.acceptedMemberUserIds],
      pendingMemberUserIds: [...record.pendingMemberUserIds],
      visibility: record.visibility,
      blindMode: record.blindMode,
      imageUrl: record.imageUrl,
      sourceLink: record.sourceLink,
      location: record.location,
      capacityMin: record.capacityMin,
      capacityMax: record.capacityMax,
      ticketing: record.ticketing,
      topics: [...record.topics],
      rating: record.rating,
      relevance: record.relevance,
      published: record.published
    };
  }

  private async runBootstrapStep(
    percent: number,
    label: string,
    work?: () => void | Promise<void>
  ): Promise<void> {
    this.emitProgress({ percent, label });
    await this.waitForUiYield();
    if (work) {
      await work();
      await this.waitForUiYield();
    }
  }

  private emitProgress(state: DemoBootstrapProgressState): void {
    this.lastProgress = {
      percent: Math.max(0, Math.min(100, Math.round(state.percent))),
      label: state.label.trim() || 'Preparing demo data'
    };

    for (const listener of this.listeners) {
      listener(this.lastProgress);
    }
  }

  private waitForUiYield(): Promise<void> {
    return new Promise(resolve => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(resolve, 0);
    });
  }
}
