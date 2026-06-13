import { CHATS_TABLE_NAME } from '../../source/entity/chat.entity';
import { CONTACTS_TABLE_NAME, PROFILE_EXPERIENCES_TABLE_NAME } from '../../source/entity/profile.entity';
import { EVENT_FEEDBACK_TABLE_NAME, EVENTS_TABLE_NAME } from '../../source/entity/event.entity';
import { HELP_CENTER_TABLE_NAME, IDEA_POSTS_TABLE_NAME } from '../../source/entity/content.entity';
import { SHARE_TOKENS_TABLE_NAME } from '../../source/entity/sharing.entity';
import { USER_FILTER_PREFERENCES_TABLE_NAME, USER_RATES_TABLE_NAME } from '../../source/entity/rate.entity';
import { USERS_TABLE_NAME } from '../../source/entity/user.entity';
import { Injectable, inject } from '@angular/core';

import type { UserDto } from '../../../contracts/user.interface';
import type * as AppTypes from '../../../base/models';
import { LocalMemoryDb } from '../../../base/db';
import { ACTIVITY_MEMBERS_TABLE_NAME, ACTIVITY_RESOURCES_TABLE_NAME } from '../../source/entity/activity.entity';
import { ASSETS_TABLE_NAME } from '../../source/entity/asset.entity';









import { BootstrapProcessService, bootstrapProcessStep, type BootstrapProcessListener, type BootstrapProcessStage, type BootstrapProcessState } from '../../../base/services/bootstrap.service';
import { SeedActivityMembersRepository } from '../repositories/activity-members-seed.repository';
import { SeedActivityResourcesRepository } from '../repositories/activity-resources-seed.repository';
import { SeedAssetsRepository } from '../repositories/assets-seed.repository';
import { SeedChatsRepository } from '../repositories/chats-seed.repository';
import { SeedAdminBootstrapRepository } from '../repositories/admin-bootstrap-seed.repository';
import { SeedContactsRepository } from '../repositories/contacts-seed.repository';
import { SeedEventFeedbackRepository } from '../repositories/event-feedback-seed.repository';
import { SeedEventsRepository } from '../repositories/events-seed.repository';
import { SeedProfileExperiencesRepository } from '../repositories/profile-experiences-seed.repository';
import { SeedUsersRatingsRepository } from '../repositories/users-ratings-seed.repository';
import { SeedUsersRepository } from '../repositories/users-seed.repository';
import { SeedBootstrapRegistryService } from './bootstrap-registry.service';

import type * as AppDTOs from '../../../base/dto';
export type SeedDemoBootstrapMode = 'member' | 'admin';

@Injectable({
  providedIn: 'root'
})
export class SeedDemoBootstrapService {
  private readonly process = inject(BootstrapProcessService);
  private readonly registry = inject(SeedBootstrapRegistryService);
  private readonly memoryDb = inject(LocalMemoryDb);
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
  private readonly contactsSeed = inject(SeedContactsRepository);

  private selectorPromise: Promise<void> | null = null;
  private selectorReady = false;
  private adminSelectorPromise: Promise<void> | null = null;
  private adminSelectorReady = false;
  private commonCollectionsPromise: Promise<void> | null = null;
  private commonCollectionsReady = false;
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
    if (!normalizedUserId || mode === 'admin') {
      this.emitSessionReady(onProgress);
      return;
    }

    await this.ensureDemoSelectorReady(mode, onProgress);
    await this.ensureUserSessionReady(normalizedUserId, onProgress);
  }

  async ensureUserSessionReady(
    userId: string,
    onProgress?: BootstrapProcessListener
  ): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      this.emitSessionReady(onProgress);
      return;
    }
    const filterPreferencesChanged = this.usersSeed.seedDefaultUserFilterPreferencesForUser(normalizedUserId);
    const alreadyReady = this.readyUserIds.has(normalizedUserId);
    let contextualChatsChanged = false;

    if (!alreadyReady) {
      onProgress?.(bootstrapProcessStep('session'));
      await this.process.waitForUiYield();

      onProgress?.(bootstrapProcessStep('sessionChats'));
      await this.process.waitForUiYield();
      contextualChatsChanged = this.chatsSeed.seedContextualRecordsForUser(
        normalizedUserId,
        this.eventsSeed.queryItemsByUser(normalizedUserId)
      );
    }

    const activityCountersChanged = this.usersSeed.stampSeededActivityCountsForUser(normalizedUserId);
    const impressionsChanged = this.usersSeed.stampSeededImpressionsForUser(normalizedUserId);
    await this.flushSessionTablesIfChanged(onProgress, {
      filterPreferencesChanged,
      activityCountersChanged,
      impressionsChanged,
      contextualChatsChanged
    });

    this.emitSessionReady(onProgress, alreadyReady ? undefined : normalizedUserId);
  }

  private async runMemberBootstrap(): Promise<void> {
    if (this.selectorReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      return;
    }

    await this.usersSeed.whenReady();

    await this.runBootstrapStep('selector');
    await this.ensureCommonDemoCollectionsReady();
    await this.runBootstrapStep('indexedDb');

    this.selectorReady = true;
    this.emitProgress(bootstrapProcessStep('ready'));
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

    await this.adminSeed.whenUsersReady();

    await this.runBootstrapStep('selector');
    await this.ensureCommonDemoCollectionsReady();
    await this.runBootstrapStep('helpCenter', async () => {
      await this.adminSeed.seedHelpCenter();
      await this.flushBootstrapTables([HELP_CENTER_TABLE_NAME]);
    });
    await this.runBootstrapStep('ideaPosts', async () => {
      await this.adminSeed.seedIdeaPosts();
      await this.flushBootstrapTables([IDEA_POSTS_TABLE_NAME]);
    });
    await this.seedAdminSpecificCollections();
    await this.runBootstrapStep('affinityGraph', () => this.adminSeed.buildAndWriteAffinityGraphSnapshot());
    await this.runBootstrapStep('indexedDb');

    this.selectorReady = true;
    this.adminSelectorReady = true;
    this.emitProgress(bootstrapProcessStep('ready'));
  }

  private async ensureCommonDemoCollectionsReady(): Promise<void> {
    if (this.commonCollectionsReady) {
      return;
    }
    if (!this.commonCollectionsPromise) {
      this.commonCollectionsPromise = this.seedCommonDemoCollections()
        .then(() => {
          this.commonCollectionsReady = true;
        })
        .finally(() => {
          this.commonCollectionsPromise = null;
        });
    }
    await this.commonCollectionsPromise;
  }

  private async seedCommonDemoCollections(): Promise<void> {
    this.registry.clear();
    try {
      let seededUsers: readonly UserDto[] = [];
      let seededUserIds: readonly string[] = [];
      let assetsByUserId: Map<string, AppDTOs.AssetCardDTO[]> = new Map();
      const ownerUserIds = (): readonly string[] | undefined => seededUserIds.length > 0 ? seededUserIds : undefined;

      await this.runBootstrapStep('chats', async () => {
        this.chatsSeed.seedDefaults();
        await this.flushBootstrapTables([CHATS_TABLE_NAME]);
      });
      await this.runBootstrapStep('events', () => this.eventsSeed.seedDefaults());
      await this.runBootstrapStep('users', async () => {
        seededUsers = this.usersSeed.seedDefaults();
        seededUserIds = seededUsers
          .map(user => user.id.trim())
          .filter(userId => userId.length > 0);
        this.registry.registerUsers(seededUsers);
        await this.flushBootstrapTables([USERS_TABLE_NAME]);
      });
      await this.runBootstrapStep('contacts', async () => {
        this.contactsSeed.seedDefaultContacts(seededUsers);
        await this.flushBootstrapTables([CONTACTS_TABLE_NAME]);
      });
      await this.runBootstrapStep('profileExperiences', async () => {
        this.profileExperiencesSeed.seedDefaults();
        await this.flushBootstrapTables([PROFILE_EXPERIENCES_TABLE_NAME]);
      });
      await this.runBootstrapStep('feedback', async () => {
        const eventItemsByUserId = this.eventsSeed.queryEventItemsByUsers(seededUserIds);
        const itemsByUserId = this.eventsSeed.queryItemsByUsers(seededUserIds);
        this.registry.registerEventsByUserId(itemsByUserId);
        this.eventFeedbackSeed.seedDefaults(seededUsers, eventItemsByUserId, itemsByUserId);
        await this.flushBootstrapTables([EVENT_FEEDBACK_TABLE_NAME]);
      });
      await this.runBootstrapStep('ratings', async () => {
        this.usersRatingsSeed.seedDefaults(seededUsers);
        await this.flushBootstrapTables([USER_RATES_TABLE_NAME]);
      });
      await this.runBootstrapStep('assets', () => {
        assetsByUserId = this.assetsSeed.seedDefaults(ownerUserIds(), seededUsers);
        this.registry.registerAssetsByUserId(assetsByUserId);
      });
      await this.runBootstrapStep('activityMembers', async () => {
        this.activityMembersSeed.seedDefaults(ownerUserIds(), assetsByUserId, seededUsers);
        await this.flushBootstrapTables([ACTIVITY_MEMBERS_TABLE_NAME, EVENTS_TABLE_NAME]);
      });
      await this.runBootstrapStep('activityResources', async () => {
        const sourceRecordsByUserId = this.registry.getEventsByUserId().size > 0
          ? new Map(this.registry.getEventsByUserId())
          : this.eventsSeed.queryItemsByUsers(seededUserIds);
        this.activityResourcesSeed.seedDefaults(ownerUserIds(), sourceRecordsByUserId, assetsByUserId);
        await this.flushBootstrapTables([ACTIVITY_RESOURCES_TABLE_NAME, ASSETS_TABLE_NAME]);
      });
    } finally {
      this.registry.clear();
    }
  }

  private async seedAdminSpecificCollections(): Promise<void> {
    await this.runBootstrapStep('adminUsers', async () => {
      await this.adminSeed.seedDemoAdminUsers();
      await this.flushBootstrapTables([USERS_TABLE_NAME]);
    });
    await this.runBootstrapStep('adminWorkspaceData', async () => {
      const seedState = await this.adminSeed.seedDemoAdminStores();
      await this.adminSeed.seedDemoAdminMenuCounters(seedState);
      await this.flushBootstrapTables([USERS_TABLE_NAME]);
    });
    await this.runBootstrapStep('adminHelpLinks', async () => {
      await this.adminSeed.seedDemoAdminSupport('admin-demo-ava');
      await this.adminSeed.seedDemoAdminSupport('admin-demo-noel');
      await this.flushBootstrapTables([CHATS_TABLE_NAME, SHARE_TOKENS_TABLE_NAME]);
    });
  }

  private async runBootstrapStep<T = void>(
    stage: BootstrapProcessStage,
    work?: () => T | Promise<T>
  ): Promise<T> {
    return await this.process.runStep(bootstrapProcessStep(stage), state => this.emitProgress(state), work);
  }

  private async flushBootstrapTables(tableNames: readonly string[]): Promise<void> {
    const uniqueTableNames = [...new Set(tableNames.map(tableName => tableName.trim()).filter(Boolean))];
    if (uniqueTableNames.length === 0) {
      return;
    }
    const state = this.memoryDb.read() as Record<string, unknown>;
    for (const tableName of uniqueTableNames) {
      await this.memoryDb.writeIndexedDbTableEntry(tableName, state[tableName]);
    }
    await this.process.waitForUiYield();
  }

  private async flushSessionTablesIfChanged(
    onProgress: BootstrapProcessListener | undefined,
    options: {
      filterPreferencesChanged: boolean;
      activityCountersChanged: boolean;
      impressionsChanged: boolean;
      contextualChatsChanged: boolean;
    }
  ): Promise<void> {
    const tableNames = this.sessionFlushTables(options);
    if (tableNames.length === 0) {
      return;
    }
    onProgress?.(bootstrapProcessStep('sessionIndexedDb'));
    await this.flushBootstrapTables(tableNames);
  }

  private emitSessionReady(
    onProgress: BootstrapProcessListener | undefined,
    readyUserId?: string
  ): void {
    const normalizedReadyUserId = `${readyUserId ?? ''}`.trim();
    if (normalizedReadyUserId) {
      this.readyUserIds.add(normalizedReadyUserId);
    }
    onProgress?.(bootstrapProcessStep('sessionReady'));
  }

  private sessionFlushTables(options: {
    filterPreferencesChanged: boolean;
    activityCountersChanged: boolean;
    impressionsChanged: boolean;
    contextualChatsChanged: boolean;
  }): string[] {
    const tableNames: string[] = [];
    if (options.filterPreferencesChanged) {
      tableNames.push(USER_FILTER_PREFERENCES_TABLE_NAME);
    }
    if (options.activityCountersChanged || options.impressionsChanged) {
      tableNames.push(USERS_TABLE_NAME);
    }
    if (options.contextualChatsChanged) {
      tableNames.push(CHATS_TABLE_NAME);
    }
    return tableNames;
  }

  private emitProgress(state: BootstrapProcessState): void {
    this.lastProcessState = this.process.normalize(state, 'Preparing demo data');

    for (const listener of this.listeners) {
      listener(this.lastProcessState);
    }
  }
}
