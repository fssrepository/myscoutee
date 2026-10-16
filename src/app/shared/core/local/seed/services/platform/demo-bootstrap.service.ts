import {SeedPaymentsRepository} from '../../repositories/payments/payments-seed.repository';
import { SeedServiceOfferingsRepository } from '../../repositories/community/service-offerings-seed.repository';
import { SeedCommunityAnnouncementsRepository } from '../../repositories/community/community-announcements-seed.repository';
import { SeedCommunityCasesRepository } from '../../repositories/community/community-cases-seed.repository';
import { COMMUNITY_CASES_TABLE_NAME, COMMUNITY_TASKS_TABLE_NAME } from '../../../source/entity/community/community-case.entity';
import { SeedWorkActivityRepository } from "../../repositories/common/work-activity-seed.repository";
import { SeedCampaignsRepository } from '../../repositories/campaigns/campaigns-seed.repository';
import { CAMPAIGNS_TABLE_NAME } from '../../../source/entity/campaigns/campaign.entity';
import { CHAT_MESSAGES_TABLE_NAME, CHATS_TABLE_NAME } from '../../../source/entity/chat/chat.entity';
import { CONTACTS_TABLE_NAME, PROFILE_EXPERIENCES_TABLE_NAME } from '../../../source/entity/accounts/profile.entity';
import { EVENTS_TABLE_NAME } from '../../../source/entity/events/event.entity';
import { FEEDBACK_STATES_TABLE_NAME } from '../../../source/entity/feedback/feedback.entity';
import { EVENT_TICKETS_TABLE_NAME } from '../../../source/entity/events/event-ticket.entity';
import { HELP_CENTER_TABLE_NAME, IDEA_POSTS_TABLE_NAME } from '../../../source/entity/content/content.entity';
import { SHARE_TOKENS_TABLE_NAME } from '../../../source/entity/content/sharing.entity';
import { USER_FILTER_PREFERENCES_TABLE_NAME, USER_RATES_TABLE_NAME } from '../../../source/entity/affinity/rate.entity';
import { NOTIFICATIONS_TABLE_NAME } from '../../../source/entity/notifications/notification.entity';
import { USERS_TABLE_NAME } from '../../../source/entity/accounts/user.entity';
import type { UserRecord } from '../../../source/entity/accounts/user.entity';
import { Injectable, inject } from '@angular/core';

import { LocalMemoryDb } from '../../../../common/app.db';
import { ACTIVITY_MEMBERS_TABLE_NAME, ACTIVITY_RESOURCES_TABLE_NAME } from '../../../source/entity/common/activity.entity';
import { ASSETS_TABLE_NAME, type AssetRecord } from '../../../source/entity/assets/asset.entity';

import { BootstrapProcessService, bootstrapProcessStep, type BootstrapProcessListener, type BootstrapProcessStage, type BootstrapProcessState } from '../../../../base/services/platform/bootstrap.service';
import { SeedActivityMembersRepository } from '../../repositories/events/activity-members-seed.repository';
import { SeedCommunityGroupsRepository } from '../../repositories/groups/community-groups-seed.repository';
import { COMMUNITY_GROUPS_TABLE_NAME } from '../../../source/entity/groups/community-group.entity';
import { SeedActivityResourcesRepository } from '../../repositories/events/activity-resources-seed.repository';
import { SeedAssetsRepository } from '../../repositories/assets/assets-seed.repository';
import { SeedChatsRepository } from '../../repositories/chat/chats-seed.repository';
import { SeedAdminBootstrapRepository } from '../../repositories/administration/admin-bootstrap-seed.repository';
import { SeedContactsRepository } from '../../repositories/accounts/contacts-seed.repository';
import { SeedFeedbackRepository } from '../../repositories/feedback/feedback-seed.repository';
import { SeedEventsRepository } from '../../repositories/events/events-seed.repository';
import { SeedEventTicketsRepository } from '../../repositories/events/event-tickets-seed.repository';
import { SeedNotificationsRepository } from '../../repositories/notifications/notifications-seed.repository';
import { SeedProfileExperiencesRepository } from '../../repositories/accounts/profile-experiences-seed.repository';
import { SeedUsersRatingsRepository } from '../../repositories/affinity/users-ratings-seed.repository';
import { SeedUsersRepository } from '../../repositories/accounts/users-seed.repository';
import { SeedOperatorRegistryRepository } from '../../repositories/operator/operator-registry-seed.repository';
import { SeedBootstrapRegistryService } from './bootstrap-registry.service';

export type SeedDemoBootstrapMode = 'member' | 'operator' | 'admin' | 'union';

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
  private readonly eventTicketsSeed = inject(SeedEventTicketsRepository);
  private readonly assetsSeed = inject(SeedAssetsRepository);
  private readonly feedbackSeed = inject(SeedFeedbackRepository);
  private readonly usersRatingsSeed = inject(SeedUsersRatingsRepository);
  private readonly usersSeed = inject(SeedUsersRepository);
  private readonly notificationsSeed = inject(SeedNotificationsRepository);
  private readonly activityMembersSeed = inject(SeedActivityMembersRepository);
  private readonly workActivitySeed = inject(SeedWorkActivityRepository);
  private readonly communityAnnouncementsSeed = inject(SeedCommunityAnnouncementsRepository);
  private readonly paymentsSeed=inject(SeedPaymentsRepository);
  private readonly serviceOfferingsSeed = inject(SeedServiceOfferingsRepository);
  private readonly communityCasesSeed = inject(SeedCommunityCasesRepository);
  private readonly campaignsSeed = inject(SeedCampaignsRepository);
  private readonly communityGroupsSeed = inject(SeedCommunityGroupsRepository);
  private readonly activityResourcesSeed = inject(SeedActivityResourcesRepository);
  private readonly profileExperiencesSeed = inject(SeedProfileExperiencesRepository);
  private readonly contactsSeed = inject(SeedContactsRepository);
  private readonly operatorSeed = inject(SeedOperatorRegistryRepository);

  private selectorPromise: Promise<void> | null = null;
  private selectorReady = false;
  private adminSelectorPromise: Promise<void> | null = null;
  private adminSelectorReady = false;
  private operatorSelectorPromise: Promise<void> | null = null;
  private operatorSelectorReady = false;
  private operatorSeedPromise: Promise<void> | null = null;
  private unionSelectorPromise: Promise<void> | null = null;
  private unionSelectorReady = false;
  private adminWorkspacePromise: Promise<void> | null = null;
  private adminWorkspaceReady = false;
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
    if (mode === 'union') {
      await this.ensureUnionSelectorReady(onProgress);
      return;
    }
    if (mode === 'admin') {
      await this.ensureAdminSelectorReady(onProgress);
      return;
    }
    if (mode === 'operator') {
      await this.ensureOperatorSelectorReady(onProgress);
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
      this.emitSessionReady(onProgress);
      return;
    }

    if (mode === 'admin') {
      await this.ensureAdminWorkspaceReady(normalizedUserId, onProgress);
    } else if (mode === 'operator') {
      await this.ensureOperatorSelectorReady(onProgress);
    } else {
      await this.ensureDemoSelectorReady(mode, onProgress);
      await this.ensureUserSessionReady(normalizedUserId, onProgress);
      return;
    }

    if (this.notificationsSeed.seedForUser(normalizedUserId)) {
      await this.flushBootstrapTables([NOTIFICATIONS_TABLE_NAME, USERS_TABLE_NAME]);
    }
    this.emitSessionReady(onProgress, normalizedUserId);
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
    const filterPreferencesChanged = this.usersSeed.seedDefaultUserFilterPreferencesForUsers([normalizedUserId]);
    const notificationsChanged = this.notificationsSeed.seedForUser(normalizedUserId);
    const alreadyReady = this.readyUserIds.has(normalizedUserId);
    let contextualChatsChanged = false;
    let feedbackChanged = false;

    if (!alreadyReady) {
      onProgress?.(bootstrapProcessStep('session'));
      await this.process.waitForUiYield();

      onProgress?.(bootstrapProcessStep('sessionChats'));
      await this.process.waitForUiYield();
      contextualChatsChanged = this.chatsSeed.seedContextualRecordsForUser(
        normalizedUserId,
        this.eventsSeed.queryItemsByUser(normalizedUserId)
      );

      onProgress?.(bootstrapProcessStep('sessionFeedback'));
      await this.process.waitForUiYield();
      feedbackChanged = this.seedFeedbackState();
    }

    const chatCountersChanged = this.chatsSeed.stampStoredChatCountersForUsers([normalizedUserId]);
    const activityCountersChanged = this.usersSeed.stampSeededActivityCountsForUser(normalizedUserId)
      || chatCountersChanged;
    const impressionsChanged = this.usersSeed.stampSeededImpressionsForUser(normalizedUserId);
    await this.flushSessionTablesIfChanged(onProgress, {
      filterPreferencesChanged,
      notificationsChanged,
      activityCountersChanged,
      impressionsChanged,
      contextualChatsChanged,
      feedbackChanged
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
    if (this.adminSelectorReady && this.operatorSelectorReady) {
      this.unionSelectorReady = true;
    }
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
      this.adminSelectorPromise = this.runAdminSelectorBootstrap().finally(() => {
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

  private async runAdminSelectorBootstrap(): Promise<void> {
    if (this.adminSelectorReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      return;
    }

    await this.adminSeed.whenUsersReady();

    await this.runBootstrapStep('selector');
    await this.ensureCommonDemoCollectionsReady();
    await this.seedDemoAdminUsers();
    await this.runBootstrapStep('indexedDb');

    this.selectorReady = true;
    this.adminSelectorReady = true;
    this.unionSelectorReady = this.operatorSelectorReady;
    this.emitProgress(bootstrapProcessStep('ready'));
  }

  private async ensureOperatorSelectorReady(onProgress?: BootstrapProcessListener): Promise<void> {
    if (onProgress) {
      this.listeners.add(onProgress);
      onProgress(this.lastProcessState);
    }

    if (this.operatorSelectorReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
      return;
    }

    if (!this.operatorSelectorPromise) {
      this.operatorSelectorPromise = this.runOperatorSelectorBootstrap().finally(() => {
        this.operatorSelectorPromise = null;
      });
    }

    try {
      await this.operatorSelectorPromise;
    } finally {
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
    }
  }

  private async runOperatorSelectorBootstrap(): Promise<void> {
    if (this.operatorSelectorReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      return;
    }

    await this.operatorSeed.whenReady();
    await this.runBootstrapStep('selector');
    await this.ensureDemoOperatorSeedReady();

    this.emitProgress(bootstrapProcessStep('ready'));
  }

  private async ensureUnionSelectorReady(onProgress?: BootstrapProcessListener): Promise<void> {
    if (onProgress) {
      this.listeners.add(onProgress);
      onProgress(this.lastProcessState);
    }

    if (this.unionSelectorReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
      return;
    }

    if (!this.unionSelectorPromise) {
      this.unionSelectorPromise = this.runUnionSelectorBootstrap().finally(() => {
        this.unionSelectorPromise = null;
      });
    }

    try {
      await this.unionSelectorPromise;
    } finally {
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
    }
  }

  private async runUnionSelectorBootstrap(): Promise<void> {
    if (this.unionSelectorReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      return;
    }

    await Promise.all([
      this.usersSeed.whenReady(),
      this.operatorSeed.whenReady()
    ]);

    await this.runBootstrapStep('selector');
    await this.ensureCommonDemoCollectionsReady();
    await this.seedDemoAdminUsers();
    await this.ensureDemoOperatorSeedReady();

    this.selectorReady = true;
    this.adminSelectorReady = true;
    this.operatorSelectorReady = true;
    this.unionSelectorReady = true;
    this.emitProgress(bootstrapProcessStep('ready'));
  }

  private async ensureAdminWorkspaceReady(
    adminUserId: string,
    onProgress?: BootstrapProcessListener
  ): Promise<void> {
    await this.ensureDemoSelectorReady('admin');
    if (onProgress) {
      this.listeners.add(onProgress);
    }

    if (!this.adminWorkspaceReady && !this.adminWorkspacePromise) {
      this.adminWorkspacePromise = this.runAdminWorkspaceBootstrap().finally(() => {
        this.adminWorkspacePromise = null;
      });
    }

    try {
      if (this.adminWorkspacePromise) {
        await this.adminWorkspacePromise;
      }
      this.emitSessionReady(onProgress, adminUserId);
    } finally {
      if (onProgress) {
        this.listeners.delete(onProgress);
      }
    }
  }

  private async runAdminWorkspaceBootstrap(): Promise<void> {
    if (this.adminWorkspaceReady) {
      this.emitProgress(bootstrapProcessStep('ready'));
      return;
    }

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

    this.adminWorkspaceReady = true;
    this.emitProgress(bootstrapProcessStep('ready'));
  }

  private async seedDemoAdminUsers(): Promise<void> {
    await this.runBootstrapStep('adminUsers', async () => {
      await this.adminSeed.seedDemoAdminUsers();
      await this.flushBootstrapTables([USERS_TABLE_NAME]);
    });
  }

  private async ensureDemoOperatorSeedReady(): Promise<void> {
    if (this.operatorSelectorReady) {
      return;
    }
    if (!this.operatorSeedPromise) {
      this.operatorSeedPromise = this.seedDemoOperatorTransaction()
        .then(() => {
          this.operatorSelectorReady = true;
          if (this.selectorReady && this.adminSelectorReady) {
            this.unionSelectorReady = true;
          }
        })
        .finally(() => {
          this.operatorSeedPromise = null;
        });
    }
    await this.operatorSeedPromise;
  }

  private async seedDemoOperatorTransaction(): Promise<void> {
    const context = await this.operatorSeed.prepareBootstrap();
    await this.runBootstrapStep('operatorUsers', () => this.operatorSeed.seedUsers(context));
    await this.runBootstrapStep('indexedDb', () => this.operatorSeed.seedRegistry(context));
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
      let seededUsers: readonly UserRecord[] = [];
      let seededUserIds: readonly string[] = [];
      let assetsByUserId: Map<string, AssetRecord[]> = new Map();
      const ownerUserIds = (): readonly string[] | undefined => seededUserIds.length > 0 ? seededUserIds : undefined;

      await this.adminSeed.seedNotificationCenter();
      await this.runBootstrapStep('chats', async () => {
        this.chatsSeed.seedDefaults();
        await this.flushBootstrapTables([CHATS_TABLE_NAME, CHAT_MESSAGES_TABLE_NAME]);
      });
      await this.runBootstrapStep('events', async () => {
        const eventsChanged = this.eventsSeed.seedDefaults();
        const eventTicketsChanged = this.eventTicketsSeed.seedDefaults();
        if (eventsChanged || eventTicketsChanged) {
          await this.flushBootstrapTables([EVENTS_TABLE_NAME, EVENT_TICKETS_TABLE_NAME]);
        }
      });
      await this.runBootstrapStep('users', async () => {
        seededUsers = this.usersSeed.seedDefaults();
        seededUserIds = seededUsers
          .map(user => user.id.trim())
          .filter(userId => userId.length > 0);
        this.chatsSeed.stampStoredChatCountersForUsers(seededUserIds);
        this.registry.registerUsers(seededUsers);
        this.usersSeed.seedDefaultUserFilterPreferencesForUsers(seededUserIds);
        await this.flushBootstrapTables([USERS_TABLE_NAME, USER_FILTER_PREFERENCES_TABLE_NAME]);
      });
      await this.runBootstrapStep('contacts', async () => {
        this.contactsSeed.seedDefaultContacts(seededUsers);
        await this.flushBootstrapTables([CONTACTS_TABLE_NAME]);
      });
      await this.runBootstrapStep('profileExperiences', async () => {
        this.profileExperiencesSeed.seedDefaults();
        await this.flushBootstrapTables([PROFILE_EXPERIENCES_TABLE_NAME]);
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
      await this.runBootstrapStep('communityGroups', async () => {
        await this.adminSeed.seedDemoAdminUsers();
        if (this.communityGroupsSeed.seedDefaults(this.usersSeed.seedDefaults())) {
          await this.flushBootstrapTables([COMMUNITY_GROUPS_TABLE_NAME, ACTIVITY_MEMBERS_TABLE_NAME, USERS_TABLE_NAME]);
        }
        if (this.campaignsSeed.seedDefaults()) await this.flushBootstrapTables([CAMPAIGNS_TABLE_NAME, USERS_TABLE_NAME]);
        if (this.serviceOfferingsSeed.seedDefaults()) await this.flushBootstrapTables(['serviceOfferings']);
        if (this.communityCasesSeed.seedDefaults()) await this.flushBootstrapTables([COMMUNITY_CASES_TABLE_NAME, COMMUNITY_TASKS_TABLE_NAME, CHATS_TABLE_NAME, USERS_TABLE_NAME]);
        if (this.communityAnnouncementsSeed.seedDefaults()) await this.flushBootstrapTables(['communityAnnouncements', USERS_TABLE_NAME]);
        this.workActivitySeed.seedDefaults();
        this.communityGroupsSeed.refreshCounters();
        await this.flushBootstrapTables([USER_RATES_TABLE_NAME, EVENTS_TABLE_NAME, ACTIVITY_MEMBERS_TABLE_NAME, USERS_TABLE_NAME]);
      });
      await this.runBootstrapStep('activityResources', async () => {
        const sourceRecordsByUserId = this.registry.getEventsByUserId().size > 0
          ? new Map(this.registry.getEventsByUserId())
          : this.eventsSeed.queryItemsByUsers(seededUserIds);
        this.activityResourcesSeed.seedDefaults(ownerUserIds(), sourceRecordsByUserId, assetsByUserId);
        this.paymentsSeed.seedDefaults();
        await this.flushBootstrapTables([ACTIVITY_RESOURCES_TABLE_NAME, ASSETS_TABLE_NAME, USERS_TABLE_NAME]);
      });
    } finally {
      this.registry.clear();
    }
  }

  private async seedAdminSpecificCollections(): Promise<void> {
    await this.runBootstrapStep('adminWorkspaceData', async () => {
      const seedState = await this.adminSeed.seedDemoAdminStores();
      await this.adminSeed.seedDemoAdminMenuCounters(seedState);
      await this.flushBootstrapTables([USERS_TABLE_NAME]);
    });
    await this.runBootstrapStep('adminHelpLinks', async () => {
      await this.adminSeed.seedDemoAdminSupport('admin-demo-ava');
      await this.adminSeed.seedDemoAdminSupport('admin-demo-noel');
      await this.flushBootstrapTables([CHATS_TABLE_NAME, CHAT_MESSAGES_TABLE_NAME, SHARE_TOKENS_TABLE_NAME]);
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
      notificationsChanged: boolean;
      activityCountersChanged: boolean;
      impressionsChanged: boolean;
      contextualChatsChanged: boolean;
      feedbackChanged: boolean;
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
    notificationsChanged: boolean;
    activityCountersChanged: boolean;
    impressionsChanged: boolean;
    contextualChatsChanged: boolean;
    feedbackChanged: boolean;
  }): string[] {
    const tableNames: string[] = [];
    if (options.filterPreferencesChanged) {
      tableNames.push(USER_FILTER_PREFERENCES_TABLE_NAME);
    }
    if (options.notificationsChanged) {
      tableNames.push(NOTIFICATIONS_TABLE_NAME);
    }
    if (options.notificationsChanged || options.activityCountersChanged || options.impressionsChanged) {
      tableNames.push(USERS_TABLE_NAME);
    }
    if (options.contextualChatsChanged) {
      tableNames.push(CHATS_TABLE_NAME);
      tableNames.push(CHAT_MESSAGES_TABLE_NAME);
    }
    if (options.feedbackChanged) {
      tableNames.push(FEEDBACK_STATES_TABLE_NAME);
    }
    return tableNames;
  }

  private seedFeedbackState(): boolean {
    const seededUsers = this.usersSeed.seedDefaults();
    const seededUserIds = seededUsers
      .map(user => user.id.trim())
      .filter(userId => userId.length > 0);
    if (seededUsers.length === 0 || seededUserIds.length === 0) {
      return false;
    }

    const eventItemsByUserId = this.eventsSeed.queryEventItemsByUsers(seededUserIds);
    const itemsByUserId = this.eventsSeed.queryItemsByUsers(seededUserIds);
    return this.feedbackSeed.seedDefaults(seededUsers, eventItemsByUserId, itemsByUserId);
  }

  private emitProgress(state: BootstrapProcessState): void {
    this.lastProcessState = this.process.normalize(state, 'Preparing demo data');

    for (const listener of this.listeners) {
      listener(this.lastProcessState);
    }
  }
}
