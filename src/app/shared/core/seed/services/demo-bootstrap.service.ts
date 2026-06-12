import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../../base/interfaces/user.interface';
import type * as AppTypes from '../../base/models';
import {
  BootstrapProcessService,
  bootstrapProcessStep,
  type BootstrapProcessListener,
  type BootstrapProcessStage,
  type BootstrapProcessState
} from '../../base/services/bootstrap.service';
import { SeedActivityMembersRepository } from '../repositories/activity-members-seed.repository';
import { SeedActivityResourcesRepository } from '../repositories/activity-resources-seed.repository';
import { SeedAssetsRepository } from '../repositories/assets-seed.repository';
import { SeedChatsRepository } from '../repositories/chats-seed.repository';
import { SeedAdminBootstrapRepository } from '../repositories/admin-bootstrap-seed.repository';
import { SeedContactsRepository } from '../repositories/contacts-seed.repository';
import { SeedEventFeedbackRepository } from '../repositories/event-feedback-seed.repository';
import { SeedEventsRepository } from '../repositories/events-seed.repository';
import { SeedHelpCenterRepository } from '../repositories/help-center-seed.repository';
import { SeedIdeaPostsRepository } from '../repositories/idea-posts-seed.repository';
import { SeedProfileExperiencesRepository } from '../repositories/profile-experiences-seed.repository';
import { SeedUsersRatingsRepository } from '../repositories/users-ratings-seed.repository';
import { SeedUsersRepository } from '../repositories/users-seed.repository';
import { SeedBootstrapRegistryService } from './bootstrap-registry.service';

export type SeedDemoBootstrapMode = 'member' | 'admin';

@Injectable({
  providedIn: 'root'
})
export class SeedDemoBootstrapService {
  private readonly process = inject(BootstrapProcessService);
  private readonly registry = inject(SeedBootstrapRegistryService);
  private readonly adminSeed = inject(SeedAdminBootstrapRepository);
  private readonly chatsSeed = inject(SeedChatsRepository);
  private readonly eventsSeed = inject(SeedEventsRepository);
  private readonly assetsSeed = inject(SeedAssetsRepository);
  private readonly eventFeedbackSeed = inject(SeedEventFeedbackRepository);
  private readonly usersRatingsSeed = inject(SeedUsersRatingsRepository);
  private readonly usersSeed = inject(SeedUsersRepository);
  private readonly activityMembersSeed = inject(SeedActivityMembersRepository);
  private readonly activityResourcesSeed = inject(SeedActivityResourcesRepository);
  private readonly profileExperiencesSeed = inject(SeedProfileExperiencesRepository);
  private readonly helpCenterSeed = inject(SeedHelpCenterRepository);
  private readonly ideaPostsSeed = inject(SeedIdeaPostsRepository);
  private readonly contactsSeed = inject(SeedContactsRepository);

  private selectorPromise: Promise<void> | null = null;
  private selectorReady = false;
  private adminSelectorPromise: Promise<void> | null = null;
  private adminSelectorReady = false;
  private readonly readyUserIds = new Set<string>();
  private lastProcessState: BootstrapProcessState = {
    percent: 0,
    label: 'Preparing demo selector',
    stage: 'selector'
  };
  private readonly listeners = new Set<BootstrapProcessListener>();

  async ensureDemoSelectorReady(
    mode: SeedDemoBootstrapMode,
    onProgress?: BootstrapProcessListener
  ): Promise<void> {
    if (mode === 'admin') {
      await this.ensureAdminSelectorReady(onProgress);
      return;
    }

    if (onProgress) {
      this.listeners.add(onProgress);
      onProgress(this.lastProcessState);
    }

    if (this.selectorReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
      return;
    }

    if (!this.selectorPromise) {
      this.selectorPromise = this.runMemberBootstrap().finally(() => {
        this.selectorPromise = null;
      });
    }

    try {
      await this.selectorPromise;
    } finally {
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
    }
  }

  async ensureUserReady(
    userId: string,
    mode: SeedDemoBootstrapMode,
    onProgress?: BootstrapProcessListener
  ): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      onProgress?.(bootstrapProcessStep('sessionReady'));
      return;
    }

    if (mode === 'admin') {
      onProgress?.(bootstrapProcessStep('sessionReady'));
      return;
    }

    await this.ensureDemoSelectorReady(mode, onProgress);

    const filterPreferencesChanged = this.usersSeed.seedDefaultUserFilterPreferencesForUser(normalizedUserId);

    if (this.readyUserIds.has(normalizedUserId)) {
      const activityCountersChanged = this.usersSeed.stampSeededActivityCountsForUser(normalizedUserId);
      const impressionsChanged = this.usersSeed.stampSeededImpressionsForUser(normalizedUserId);
      if (filterPreferencesChanged || activityCountersChanged || impressionsChanged) {
        onProgress?.(bootstrapProcessStep('sessionIndexedDb'));
        await this.usersSeed.flushToIndexedDb();
        await this.process.waitForUiYield();
      }
      onProgress?.(bootstrapProcessStep('sessionReady'));
      return;
    }

    onProgress?.(bootstrapProcessStep('session'));
    await this.process.waitForUiYield();

    onProgress?.(bootstrapProcessStep('sessionChats'));
    await this.process.waitForUiYield();
    const contextualChatsChanged = this.chatsSeed.seedContextualRecordsForUser(
      normalizedUserId,
      this.eventsSeed.queryItemsByUser(normalizedUserId)
    );
    const activityCountersChanged = this.usersSeed.stampSeededActivityCountsForUser(normalizedUserId);
    const impressionsChanged = this.usersSeed.stampSeededImpressionsForUser(normalizedUserId);
    if (contextualChatsChanged || filterPreferencesChanged || activityCountersChanged || impressionsChanged) {
      onProgress?.(bootstrapProcessStep('sessionIndexedDb'));
      await this.usersSeed.flushToIndexedDb();
      await this.process.waitForUiYield();
    }

    this.readyUserIds.add(normalizedUserId);
    onProgress?.(bootstrapProcessStep('sessionReady'));
  }

  private async runMemberBootstrap(): Promise<void> {
    if (this.selectorReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      return;
    }

    this.registry.clear();
    try {
      await this.usersSeed.whenReady();

      let seededUsers: readonly UserDto[] = [];
      let seededUserIds: readonly string[] = [];
      let assetsByUserId: Map<string, AppTypes.AssetCard[]> = new Map();
      const ownerUserIds = (): readonly string[] | undefined => seededUserIds.length > 0 ? seededUserIds : undefined;

      await this.runBootstrapStep('selector');
      await this.runBootstrapStep('helpCenter', async () => {
        await this.initOptionalHelpCenter();
      });
      await this.runBootstrapStep('ideaPosts', async () => { await this.ideaPostsSeed.seedDefaults(); });
      await this.runBootstrapStep('chats', () => this.chatsSeed.seedDefaults());
      await this.runBootstrapStep('events', () => this.eventsSeed.seedDefaults());
      await this.runBootstrapStep('users', () => {
        seededUsers = this.usersSeed.seedDefaults();
        seededUserIds = seededUsers
          .map(user => user.id.trim())
          .filter(userId => userId.length > 0);
        this.registry.registerUsers(seededUsers);
      });
      await this.runBootstrapStep('contacts', () => {
        this.contactsSeed.seedDefaultContacts(seededUsers);
      });
      this.profileExperiencesSeed.seedDefaults();
      await this.runBootstrapStep('feedback', () => {
        const eventItemsByUserId = this.eventsSeed.queryEventItemsByUsers(seededUserIds);
        const itemsByUserId = this.eventsSeed.queryItemsByUsers(seededUserIds);
        this.registry.registerEventsByUserId(itemsByUserId);
        this.eventFeedbackSeed.seedDefaults(seededUsers, eventItemsByUserId, itemsByUserId);
      });
      await this.runBootstrapStep('ratings', () => this.usersRatingsSeed.seedDefaults(seededUsers));
      await this.runBootstrapStep('assets', () => {
        assetsByUserId = this.assetsSeed.seedDefaults(ownerUserIds(), seededUsers);
        this.registry.registerAssetsByUserId(assetsByUserId);
      });
      await this.runBootstrapStep('activityMembers', () => {
        this.activityMembersSeed.seedDefaults(ownerUserIds(), assetsByUserId, seededUsers);
      });
      await this.runBootstrapStep('activityResources', () => {
        const sourceRecordsByUserId = this.registry.getEventsByUserId().size > 0
          ? new Map(this.registry.getEventsByUserId())
          : this.eventsSeed.queryItemsByUsers(seededUserIds);
        this.activityResourcesSeed.seedDefaults(ownerUserIds(), sourceRecordsByUserId, assetsByUserId);
      });
      await this.runBootstrapStep('indexedDb', () => this.usersSeed.flushToIndexedDb());

      this.selectorReady = true;
      this.emitProgress(bootstrapProcessStep('ready'));
    } finally {
      this.registry.clear();
    }
  }

  private async ensureAdminSelectorReady(onProgress?: BootstrapProcessListener): Promise<void> {
    if (onProgress) {
      this.listeners.add(onProgress);
      onProgress(this.lastProcessState);
    }

    if (this.adminSelectorReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
      return;
    }

    if (!this.adminSelectorPromise) {
      this.adminSelectorPromise = this.runAdminBootstrap().finally(() => {
        this.adminSelectorPromise = null;
      });
    }

    try {
      await this.adminSelectorPromise;
    } finally {
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
    }
  }

  private async runAdminBootstrap(): Promise<void> {
    if (this.adminSelectorReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      return;
    }

    this.registry.clear();
    try {
      await this.adminSeed.whenUsersReady();

      let seededUsers: readonly UserDto[] = [];

      await this.runBootstrapStep('selector');
      await this.runBootstrapStep('helpCenter', () => this.adminSeed.seedHelpCenter());
      await this.runBootstrapStep('ideaPosts', () => this.adminSeed.seedIdeaPosts());
      await this.runBootstrapStep('users', () => {
        seededUsers = this.adminSeed.seedUsers();
        this.registry.registerUsers(seededUsers);
      });
      await this.runBootstrapStep('ratings', () => this.adminSeed.seedUserRatings(seededUsers));
      await this.runBootstrapStep('chats', () => this.adminSeed.seedChats());
      await this.runBootstrapStep('assets', () => this.adminSeed.seedDemoAdminProfiles());
      const seedState = await this.runBootstrapStep('feedback', () => this.adminSeed.seedDemoAdminStores());
      await this.runBootstrapStep('contacts', () => this.adminSeed.seedDemoAdminMenuCounters(seedState));
      await this.runBootstrapStep('activityMembers', async () => {
        await this.adminSeed.seedDemoAdminSupport('admin-demo-ava');
        await this.adminSeed.seedDemoAdminSupport('admin-demo-noel');
      });
      await this.runBootstrapStep('affinityGraph', () => this.adminSeed.buildAndWriteAffinityGraphSnapshot());
      await this.runBootstrapStep('indexedDb', () => this.usersSeed.flushToIndexedDb());

      this.adminSelectorReady = true;
      this.emitProgress(bootstrapProcessStep('ready'));
    } finally {
      this.registry.clear();
    }
  }

  private async initOptionalHelpCenter(): Promise<void> {
    try {
      await this.helpCenterSeed.seedDefaults();
    } catch {
      // Help, privacy, and explanation content should never block demo user bootstrap.
    }
  }

  private async runBootstrapStep<T = void>(
    stage: BootstrapProcessStage,
    work?: () => T | Promise<T>
  ): Promise<T> {
    return await this.process.runStep(bootstrapProcessStep(stage), state => this.emitProgress(state), work);
  }

  private emitProgress(state: BootstrapProcessState): void {
    this.lastProcessState = this.process.normalize(state, 'Preparing demo data');

    for (const listener of this.listeners) {
      listener(this.lastProcessState);
    }
  }
}
