import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../base/db';
import type { UserDto } from '../../base/interfaces/user.interface';
import {
  BootstrapProcessService,
  bootstrapProcessStep,
  type BootstrapProcessStage,
  type BootstrapProcessListener,
  type BootstrapProcessState
} from '../../base/services/bootstrap.service';
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

@Injectable({
  providedIn: 'root'
})
export class LocalBootstrapService {
  private readonly process = inject(BootstrapProcessService);
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
  private lastProcessState: BootstrapProcessState = {
    percent: 0,
    label: 'Preparing demo selector',
    stage: 'selector'
  };
  private readonly listeners = new Set<BootstrapProcessListener>();

  async ensureReady(onProgress?: BootstrapProcessListener): Promise<void> {
    if (onProgress) {
      this.listeners.add(onProgress);
      onProgress(this.lastProcessState);
    }

    if (this.ready) {
      this.emitProgress(bootstrapProcessStep('ready'));
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

  async ensureStaticContentReady(): Promise<void> {
    await this.memoryDb.resetStorageOnce();
    await this.helpCenterService.init();
    await this.ideaPostsService.init();
  }

  async ensureUserReady(userId: string, onProgress?: BootstrapProcessListener): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      onProgress?.(bootstrapProcessStep('sessionReady'));
      return;
    }

    await this.ensureReady(onProgress);

    const filterPreferencesChanged = this.usersRepository.seedDefaultUserFilterPreferencesForUser(normalizedUserId);

    if (this.readyUserIds.has(normalizedUserId)) {
      const activityCountersChanged = this.usersRepository.stampSeededActivityCountsForUser(normalizedUserId);
      const impressionsChanged = this.usersRepository.stampSeededImpressionsForUser(normalizedUserId);
      if (filterPreferencesChanged || activityCountersChanged || impressionsChanged) {
        onProgress?.(bootstrapProcessStep('sessionIndexedDb'));
        await this.usersRepository.flushToIndexedDb();
        await this.process.waitForUiYield();
      }
      onProgress?.(bootstrapProcessStep('sessionReady'));
      return;
    }

    onProgress?.(bootstrapProcessStep('session'));
    await this.process.waitForUiYield();

    onProgress?.(bootstrapProcessStep('sessionChats'));
    await this.process.waitForUiYield();
    const contextualChatsChanged = this.chatsRepository.seedContextualRecordsForUser(
      normalizedUserId,
      this.eventsRepository.queryItemsByUser(normalizedUserId)
    );
    const activityCountersChanged = this.usersRepository.stampSeededActivityCountsForUser(normalizedUserId);
    const impressionsChanged = this.usersRepository.stampSeededImpressionsForUser(normalizedUserId);
    if (contextualChatsChanged || filterPreferencesChanged || activityCountersChanged || impressionsChanged) {
      onProgress?.(bootstrapProcessStep('sessionIndexedDb'));
      await this.usersRepository.flushToIndexedDb();
      await this.process.waitForUiYield();
    }

    this.readyUserIds.add(normalizedUserId);
    onProgress?.(bootstrapProcessStep('sessionReady'));
  }

  private async runBootstrap(): Promise<void> {
    if (this.ready) {
      this.emitProgress(bootstrapProcessStep('ready'));
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
    this.emitProgress(bootstrapProcessStep('ready'));
  }

  private async initOptionalHelpCenter(): Promise<void> {
    try {
      await this.helpCenterService.init();
    } catch {
      // Help, privacy, and explanation content should never block demo user bootstrap.
    }
  }

  private async runBootstrapStep(
    stage: BootstrapProcessStage,
    work?: () => void | Promise<void>
  ): Promise<void> {
    await this.process.runStep(bootstrapProcessStep(stage), state => this.emitProgress(state), work);
  }

  private emitProgress(state: BootstrapProcessState): void {
    this.lastProcessState = this.process.normalize(state, 'Preparing demo data');

    for (const listener of this.listeners) {
      listener(this.lastProcessState);
    }
  }
}
