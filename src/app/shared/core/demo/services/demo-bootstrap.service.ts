import { Injectable, inject } from '@angular/core';

import { DemoMemoryDb } from '../../base/db';
import type { UserDto } from '../../base/interfaces/user.interface';
import { DemoActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { DemoActivityMembersRepository } from '../repositories/activity-members.repository';
import { DemoAssetsRepository } from '../repositories/assets.repository';
import { DemoChatsRepository } from '../repositories/chats.repository';
import { DemoEventsRepository } from '../repositories/events.repository';
import { DemoEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { DemoHelpCenterService } from './help-center.service';
import { DemoIdeaPostsService } from './idea-posts.service';
import { DemoProfileExperiencesRepository } from '../repositories/profile-experiences.repository';
import { DemoUsersRatingsRepository } from '../repositories/users-ratings.repository';
import { DemoUsersRepository } from '../repositories/users.repository';
import { HELP_CENTER_TABLE_NAME } from '../models/help-center.model';
import { IDEA_POSTS_TABLE_NAME } from '../models/idea-posts.model';

export type DemoBootstrapProgressStage =
  | 'selector'
  | 'helpCenter'
  | 'ideaPosts'
  | 'chats'
  | 'events'
  | 'users'
  | 'feedback'
  | 'ratings'
  | 'affinityGraph'
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
  { stage: 'helpCenter', percent: 5, label: 'Preparing help content' },
  { stage: 'ideaPosts', percent: 8, label: 'Preparing article content' },
  { stage: 'chats', percent: 11, label: 'Loading chats' },
  { stage: 'events', percent: 22, label: 'Loading events' },
  { stage: 'users', percent: 34, label: 'Preparing demo users' },
  { stage: 'feedback', percent: 44, label: 'Preparing event feedback' },
  { stage: 'ratings', percent: 52, label: 'Loading ratings' },
  { stage: 'assets', percent: 64, label: 'Preparing owned assets' },
  { stage: 'activityMembers', percent: 82, label: 'Preparing activity members' },
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
  private readonly memoryDb = inject(DemoMemoryDb);
  private readonly chatsRepository = inject(DemoChatsRepository);
  private readonly eventsRepository = inject(DemoEventsRepository);
  private readonly eventFeedbackRepository = inject(DemoEventFeedbackRepository);
  private readonly usersRatingsRepository = inject(DemoUsersRatingsRepository);
  private readonly usersRepository = inject(DemoUsersRepository);
  private readonly activityMembersRepository = inject(DemoActivityMembersRepository);
  private readonly assetsRepository = inject(DemoAssetsRepository);
  private readonly activityResourcesRepository = inject(DemoActivityResourcesRepository);
  private readonly profileExperiencesRepository = inject(DemoProfileExperiencesRepository);
  private readonly helpCenterService = inject(DemoHelpCenterService);
  private readonly ideaPostsService = inject(DemoIdeaPostsService);

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

    await this.ensureReady(onProgress);

    const filterPreferencesChanged = this.usersRepository.seedDefaultUserFilterPreferencesForUser(normalizedUserId);

    if (this.readyUserIds.has(normalizedUserId)) {
      const activityCountersChanged = this.usersRepository.stampSeededActivityCountsForUser(normalizedUserId);
      if (filterPreferencesChanged || activityCountersChanged) {
        onProgress?.(demoBootstrapProgressStep('sessionIndexedDb'));
        await this.usersRepository.flushToIndexedDb();
        await this.waitForUiYield();
      }
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
    const activityCountersChanged = this.usersRepository.stampSeededActivityCountsForUser(normalizedUserId);
    if (contextualChatsChanged || filterPreferencesChanged || activityCountersChanged) {
      onProgress?.(demoBootstrapProgressStep('sessionIndexedDb'));
      await this.usersRepository.flushToIndexedDb();
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

    await this.usersRepository.whenReady();
    await this.memoryDb.resetStoragePreservingTables([
      HELP_CENTER_TABLE_NAME,
      IDEA_POSTS_TABLE_NAME
    ]);

    let seededUsers: readonly UserDto[] = [];
    let seededUserIds: readonly string[] = [];
    let assetsByUserId: ReturnType<DemoAssetsRepository['peekOwnedAssetsByUsers']> = new Map();
    const ownerUserIds = (): readonly string[] | undefined => seededUserIds.length > 0 ? seededUserIds : undefined;

    await this.runBootstrapStep('selector');
    await this.runBootstrapStep('helpCenter', async () => {
      await this.initOptionalHelpCenter();
    });
    await this.runBootstrapStep('ideaPosts', async () => { await this.ideaPostsService.init(); });
    await this.runBootstrapStep('chats', () => this.chatsRepository.init());
    await this.runBootstrapStep('events', () => this.eventsRepository.init());
    await this.runBootstrapStep('users', () => {
      seededUsers = this.usersRepository.init();
      seededUserIds = seededUsers
        .map(user => user.id.trim())
        .filter(userId => userId.length > 0);
    });
    this.profileExperiencesRepository.init();
    await this.runBootstrapStep('feedback', () => {
      const eventItemsByUserId = this.eventsRepository.queryEventItemsByUsers(seededUserIds);
      const itemsByUserId = this.eventsRepository.queryItemsByUsers(seededUserIds);
      this.eventFeedbackRepository.seedEventFeedbackStates(seededUsers, eventItemsByUserId, itemsByUserId);
    });
    await this.runBootstrapStep('ratings', () => this.usersRatingsRepository.init(seededUsers));
    await this.runBootstrapStep('assets', () => {
      this.assetsRepository.init(ownerUserIds(), seededUsers);
      assetsByUserId = this.assetsRepository.peekOwnedAssetsByUsers(seededUserIds);
    });
    await this.runBootstrapStep('activityMembers', () => {
      this.activityMembersRepository.init(ownerUserIds(), assetsByUserId);
    });
    await this.runBootstrapStep('activityResources', () => {
      const sourceRecordsByUserId = this.eventsRepository.queryItemsByUsers(seededUserIds);
      this.activityResourcesRepository.init(ownerUserIds(), sourceRecordsByUserId, assetsByUserId);
    });
    await this.runBootstrapStep('indexedDb', () => this.usersRepository.flushToIndexedDb());

    this.ready = true;
    this.emitProgress(demoBootstrapProgressStep('ready'));
  }

  private async initOptionalHelpCenter(): Promise<void> {
    try {
      await this.helpCenterService.init();
    } catch {
      // Help, privacy, and explanation content should never block demo user bootstrap.
    }
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
