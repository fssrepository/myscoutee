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

export type DemoBootstrapProgressStage =
  | 'selector'
  | 'chats'
  | 'events'
  | 'users'
  | 'feedback'
  | 'ratings'
  | 'assets'
  | 'activityMembers'
  | 'activityResources'
  | 'indexedDb'
  | 'ready'
  | 'session'
  | 'sessionChats'
  | 'sessionIndexedDb'
  | 'sessionReady';

export interface DemoBootstrapProgressState {
  percent: number;
  label: string;
  stage: DemoBootstrapProgressStage;
}

export interface DemoBootstrapProgressStep {
  stage: DemoBootstrapProgressStage;
  percent: number;
  label: string;
}

export const DEMO_BOOTSTRAP_PROGRESS_STEPS: readonly DemoBootstrapProgressStep[] = [
  { stage: 'selector', percent: 0, label: 'Preparing demo selector' },
  { stage: 'chats', percent: 9, label: 'Loading chats' },
  { stage: 'events', percent: 22, label: 'Loading events' },
  { stage: 'users', percent: 34, label: 'Preparing demo users' },
  { stage: 'feedback', percent: 44, label: 'Preparing event feedback' },
  { stage: 'ratings', percent: 52, label: 'Loading ratings' },
  { stage: 'assets', percent: 68, label: 'Preparing owned assets' },
  { stage: 'activityMembers', percent: 80, label: 'Preparing activity members' },
  { stage: 'activityResources', percent: 94, label: 'Preparing activity resources' },
  { stage: 'indexedDb', percent: 98, label: 'Syncing demo IndexedDB' },
  { stage: 'ready', percent: 100, label: 'Demo data ready' }
];

export const DEMO_SESSION_PROGRESS_STEPS: readonly DemoBootstrapProgressStep[] = [
  { stage: 'session', percent: 0, label: 'Preparing demo session' },
  { stage: 'sessionChats', percent: 38, label: 'Preparing chat threads' },
  { stage: 'sessionIndexedDb', percent: 84, label: 'Syncing demo IndexedDB' },
  { stage: 'sessionReady', percent: 100, label: 'Demo session ready' }
];

type DemoBootstrapProgressListener = (state: DemoBootstrapProgressState) => void;

const DEMO_PROGRESS_STEP_BY_STAGE = new Map<DemoBootstrapProgressStage, DemoBootstrapProgressStep>(
  [...DEMO_BOOTSTRAP_PROGRESS_STEPS, ...DEMO_SESSION_PROGRESS_STEPS].map(step => [step.stage, step])
);

function demoBootstrapProgressStep(stage: DemoBootstrapProgressStage): DemoBootstrapProgressStep {
  return DEMO_PROGRESS_STEP_BY_STAGE.get(stage) ?? DEMO_BOOTSTRAP_PROGRESS_STEPS[0];
}

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
    label: 'Preparing demo selector',
    stage: 'selector'
  };
  private readonly listeners = new Set<DemoBootstrapProgressListener>();

  async ensureReady(onProgress?: DemoBootstrapProgressListener): Promise<void> {
    if (onProgress) {
      this.listeners.add(onProgress);
      onProgress(this.lastProgress);
    }

    if (this.ready) {
      this.emitProgress(demoBootstrapProgressStep('ready'));
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
      onProgress?.(demoBootstrapProgressStep('sessionReady'));
      return;
    }

    await this.ensureReady();

    if (this.readyUserIds.has(normalizedUserId)) {
      onProgress?.(demoBootstrapProgressStep('sessionReady'));
      return;
    }

    onProgress?.(demoBootstrapProgressStep('session'));
    await this.waitForUiYield();

    onProgress?.(demoBootstrapProgressStep('sessionChats'));
    await this.waitForUiYield();
    const contextualChatsChanged = this.chatsRepository.seedContextualRecordsForUser(
      normalizedUserId,
      this.eventsRepository.queryItemsByUser(normalizedUserId)
    );
    if (contextualChatsChanged) {
      onProgress?.(demoBootstrapProgressStep('sessionIndexedDb'));
      await this.memoryDb.flushToIndexedDb();
      await this.waitForUiYield();
    }

    this.readyUserIds.add(normalizedUserId);
    onProgress?.(demoBootstrapProgressStep('sessionReady'));
  }

  private async runBootstrap(): Promise<void> {
    if (this.ready) {
      this.emitProgress(demoBootstrapProgressStep('ready'));
      return;
    }

    await this.runBootstrapStep('selector');
    await this.runBootstrapStep('chats', () => this.chatsRepository.init());
    await this.runBootstrapStep('events', () => this.eventsRepository.init());
    await this.runBootstrapStep('users', () => { this.usersRepository.init(); });
    await this.runBootstrapStep('feedback', () => this.seedEventFeedbackStates());
    await this.runBootstrapStep('ratings', () => this.usersRatingsRepository.init());
    await this.runBootstrapStep('assets', () => this.assetsRepository.init());
    await this.runBootstrapStep('activityMembers', () => this.activityMembersRepository.init());
    await this.runBootstrapStep('activityResources', () => this.activityResourcesRepository.init());
    await this.runBootstrapStep('indexedDb', () => this.memoryDb.flushToIndexedDb());

    this.ready = true;
    this.emitProgress(demoBootstrapProgressStep('ready'));
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
    stage: DemoBootstrapProgressStage,
    work?: () => void | Promise<void>
  ): Promise<void> {
    this.emitProgress(demoBootstrapProgressStep(stage));
    await this.waitForUiYield();
    if (work) {
      await work();
      await this.waitForUiYield();
    }
  }

  private emitProgress(state: DemoBootstrapProgressState): void {
    this.lastProgress = {
      percent: Math.max(0, Math.min(100, Math.round(state.percent))),
      label: state.label.trim() || 'Preparing demo data',
      stage: state.stage
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
