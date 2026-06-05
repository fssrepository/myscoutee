import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../base/db';
import type { UserDto } from '../../base/interfaces/user.interface';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalAssetsRepository } from '../repositories/assets.repository';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { LocalHelpCenterService } from './help-center.service';
import { LocalIdeaPostsService } from './idea-posts.service';
import { LocalContactsService } from './contacts.service';
import { LocalProfileExperiencesRepository } from '../repositories/profile-experiences.repository';
import { LocalUsersRatingsRepository } from '../repositories/users-ratings.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { HELP_CENTER_TABLE_NAME } from '../../base/models/help-center.model';
import { IDEA_POSTS_TABLE_NAME } from '../../base/models/idea-posts.model';

export type LocalBootstrapProgressStage =
  | 'selector'
  | 'helpCenter'
  | 'ideaPosts'
  | 'chats'
  | 'events'
  | 'users'
  | 'contacts'
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

export interface LocalBootstrapProgressState {
  percent: number;
  label: string;
  stage: LocalBootstrapProgressStage;
}

export interface LocalBootstrapProgressStep {
  stage: LocalBootstrapProgressStage;
  percent: number;
  label: string;
}

export const LOCAL_BOOTSTRAP_PROGRESS_STEPS: readonly LocalBootstrapProgressStep[] = [
  { stage: 'selector', percent: 0, label: 'Preparing demo selector' },
  { stage: 'helpCenter', percent: 5, label: 'Preparing help content' },
  { stage: 'ideaPosts', percent: 8, label: 'Preparing article content' },
  { stage: 'chats', percent: 11, label: 'Loading chats' },
  { stage: 'events', percent: 22, label: 'Loading events' },
  { stage: 'users', percent: 34, label: 'Preparing demo users' },
  { stage: 'contacts', percent: 40, label: 'Preparing contacts' },
  { stage: 'feedback', percent: 46, label: 'Preparing event feedback' },
  { stage: 'ratings', percent: 52, label: 'Loading ratings' },
  { stage: 'assets', percent: 64, label: 'Preparing owned assets' },
  { stage: 'activityMembers', percent: 82, label: 'Preparing activity members' },
  { stage: 'activityResources', percent: 94, label: 'Preparing activity resources' },
  { stage: 'indexedDb', percent: 98, label: 'Syncing demo IndexedDB' },
  { stage: 'ready', percent: 100, label: 'Demo data ready' }
];

export const LOCAL_SESSION_PROGRESS_STEPS: readonly LocalBootstrapProgressStep[] = [
  { stage: 'session', percent: 0, label: 'Preparing demo session' },
  { stage: 'sessionChats', percent: 38, label: 'Preparing chat threads' },
  { stage: 'sessionIndexedDb', percent: 84, label: 'Syncing demo IndexedDB' },
  { stage: 'sessionReady', percent: 100, label: 'Demo session ready' }
];

type LocalBootstrapProgressListener = (state: LocalBootstrapProgressState) => void;

const LOCAL_PROGRESS_STEP_BY_STAGE = new Map<LocalBootstrapProgressStage, LocalBootstrapProgressStep>(
  [...LOCAL_BOOTSTRAP_PROGRESS_STEPS, ...LOCAL_SESSION_PROGRESS_STEPS].map(step => [step.stage, step])
);

function localBootstrapProgressStep(stage: LocalBootstrapProgressStage): LocalBootstrapProgressStep {
  return LOCAL_PROGRESS_STEP_BY_STAGE.get(stage) ?? LOCAL_BOOTSTRAP_PROGRESS_STEPS[0];
}

@Injectable({
  providedIn: 'root'
})
export class LocalBootstrapService {
  private readonly memoryDb = inject(LocalMemoryDb);
  private readonly chatsRepository = inject(LocalChatsRepository);
  private readonly eventsRepository = inject(LocalEventsRepository);
  private readonly eventFeedbackRepository = inject(LocalEventFeedbackRepository);
  private readonly usersRatingsRepository = inject(LocalUsersRatingsRepository);
  private readonly usersRepository = inject(LocalUsersRepository);
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly assetsRepository = inject(LocalAssetsRepository);
  private readonly activityResourcesRepository = inject(LocalActivityResourcesRepository);
  private readonly profileExperiencesRepository = inject(LocalProfileExperiencesRepository);
  private readonly helpCenterService = inject(LocalHelpCenterService);
  private readonly ideaPostsService = inject(LocalIdeaPostsService);
  private readonly contactsService = inject(LocalContactsService);

  private bootstrapPromise: Promise<void> | null = null;
  private ready = false;
  private readonly readyUserIds = new Set<string>();
  private lastProgress: LocalBootstrapProgressState = {
    percent: 0,
    label: 'Preparing demo selector',
    stage: 'selector'
  };
  private readonly listeners = new Set<LocalBootstrapProgressListener>();

  async ensureReady(onProgress?: LocalBootstrapProgressListener): Promise<void> {
    if (onProgress) {
      this.listeners.add(onProgress);
      onProgress(this.lastProgress);
    }

    if (this.ready) {
      this.emitProgress(localBootstrapProgressStep('ready'));
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

  async ensureUserReady(userId: string, onProgress?: LocalBootstrapProgressListener): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      onProgress?.(localBootstrapProgressStep('sessionReady'));
      return;
    }

    await this.ensureReady(onProgress);

    const filterPreferencesChanged = this.usersRepository.seedDefaultUserFilterPreferencesForUser(normalizedUserId);

    if (this.readyUserIds.has(normalizedUserId)) {
      const activityCountersChanged = this.usersRepository.stampSeededActivityCountsForUser(normalizedUserId);
      if (filterPreferencesChanged || activityCountersChanged) {
        onProgress?.(localBootstrapProgressStep('sessionIndexedDb'));
        await this.usersRepository.flushToIndexedDb();
        await this.waitForUiYield();
      }
      onProgress?.(localBootstrapProgressStep('sessionReady'));
      return;
    }

    onProgress?.(localBootstrapProgressStep('session'));
    await this.waitForUiYield();

    onProgress?.(localBootstrapProgressStep('sessionChats'));
    await this.waitForUiYield();
    const contextualChatsChanged = this.chatsRepository.seedContextualRecordsForUser(
      normalizedUserId,
      this.eventsRepository.queryItemsByUser(normalizedUserId)
    );
    const activityCountersChanged = this.usersRepository.stampSeededActivityCountsForUser(normalizedUserId);
    if (contextualChatsChanged || filterPreferencesChanged || activityCountersChanged) {
      onProgress?.(localBootstrapProgressStep('sessionIndexedDb'));
      await this.usersRepository.flushToIndexedDb();
      await this.waitForUiYield();
    }

    this.readyUserIds.add(normalizedUserId);
    onProgress?.(localBootstrapProgressStep('sessionReady'));
  }

  private async runBootstrap(): Promise<void> {
    if (this.ready) {
      this.emitProgress(localBootstrapProgressStep('ready'));
      return;
    }

    await this.usersRepository.whenReady();
    await this.memoryDb.resetStoragePreservingTables([
      HELP_CENTER_TABLE_NAME,
      IDEA_POSTS_TABLE_NAME
    ]);

    let seededUsers: readonly UserDto[] = [];
    let seededUserIds: readonly string[] = [];
    let assetsByUserId: ReturnType<LocalAssetsRepository['peekOwnedAssetsByUsers']> = new Map();
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
    await this.runBootstrapStep('contacts', () => {
      this.contactsService.seedDefaultContacts(seededUsers);
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
    this.emitProgress(localBootstrapProgressStep('ready'));
  }

  private async initOptionalHelpCenter(): Promise<void> {
    try {
      await this.helpCenterService.init();
    } catch {
      // Help, privacy, and explanation content should never block demo user bootstrap.
    }
  }

  private async runBootstrapStep(
    stage: LocalBootstrapProgressStage,
    work?: () => void | Promise<void>
  ): Promise<void> {
    this.emitProgress(localBootstrapProgressStep(stage));
    await this.waitForUiYield();
    if (work) {
      await work();
      await this.waitForUiYield();
    }
  }

  private emitProgress(state: LocalBootstrapProgressState): void {
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
