import { Injectable, inject } from '@angular/core';
import type { AdminUserDto } from '../../../contracts/admin.interface';
import { GROUP_MODERATION_CATEGORIES } from '../../../contracts/content-moderation.interface';
import { LocalUsersRepository } from '../repositories/users.repository';
import type { ContentModerationDecision, ContentModerationSettings, ModerationCategoryFilter, ModerationStatus } from '../../../contracts/content-moderation.interface';
import type { ListQuery } from '../../../contracts/list.interface';
import { LocalContentModerationRepository } from '../repositories/content-moderation.repository';
import { LocalAssetsService } from './assets.service';
import { LocalEventsService } from './events.service';
import { LocalPhotoFeedRepository } from '../repositories/photo-feed.repository';
import { LocalPhotoFeedMapper } from '../mappers/photo-feed.mapper';
import { LocalCommunityGroupsService } from './community-groups.service';
import { LocalCommunityGroupsRepository } from '../repositories/community-groups.repository';
import { LocalAdminModerationService } from './admin-moderation.service';
import { LocalRouteDelayService } from './route-delay.service';
@Injectable({ providedIn: 'root' })
export class LocalContentModerationService extends LocalRouteDelayService {
  private readonly users = inject(LocalUsersRepository);
  private readonly repository = inject(LocalContentModerationRepository);
  private readonly assets = inject(LocalAssetsService);
  private readonly events = inject(LocalEventsService);
  private readonly feed = inject(LocalPhotoFeedRepository);
  private readonly groups = inject(LocalCommunityGroupsService);
  private readonly groupRecords = inject(LocalCommunityGroupsRepository);
  private readonly support = inject(LocalAdminModerationService);
  private async prepare(adminUserId: string, groupId?: string | null): Promise<AdminUserDto | undefined> {
    await this.repository.whenReady();
    let moderator: AdminUserDto | undefined;
    if (groupId) {
      const accountId = this.users.queryUserById(adminUserId)?.accountUserId ?? adminUserId;
      const group = await this.groups.detail(accountId, groupId);
      if (group.role !== 'Admin' || group.membershipStatus !== 'accepted') throw new Error('groups.forbidden');
      const { profile } = await this.groups.selectWorkspace(accountId, groupId);
      moderator = { id: profile.id, name: profile.name, initials: profile.initials, email: '', headline: '', about: '', images: [...(profile.images ?? [])] };
    }
    await this.deliverMessages();
    await this.waitForRouteDelay(groupId ? '/groups' : '/admin/content-moderation');
    return moderator;
  }
  private scopedItem(id: string, groupId?: string | null) {
    const item = this.repository.item(id);
    if (!item || item.deleted || (item.workspaceGroupId ?? null) !== (groupId ?? null)) throw new Error('moderation.changed');
    return item;
  }
  async snapshot(adminUserId: string, groupId?: string | null) { await this.prepare(adminUserId, groupId); return this.repository.snapshot(groupId); }
  async page(adminUserId: string, category: ModerationCategoryFilter, status: ModerationStatus, query: ListQuery, groupId?: string | null) {
    await this.prepare(adminUserId, groupId);
    if (groupId && category === 'group') throw new Error('moderation.changed');
    return this.repository.page(category, status, query, groupId);
  }
  async settings(adminUserId: string, revision: number, settings: ContentModerationSettings, groupId?: string | null) {
    await this.prepare(adminUserId, groupId);
    if (groupId && settings.categories.some(category => !GROUP_MODERATION_CATEGORIES.includes(category))) throw new Error('moderation.invalidSettings');
    if (!Number.isInteger(settings.delayMinutes) || settings.delayMinutes < 0 || settings.delayMinutes > 43200) throw new Error('moderation.invalidSettings');
    return this.repository.saveSettings(settings, revision, groupId);
  }
  async decide(id: string, request: ContentModerationDecision, admin?: AdminUserDto, groupId?: string | null) {
    const moderator = await this.prepare(request.adminUserId, groupId);
    this.scopedItem(id, groupId);
    await this.repository.decide(id, moderator ? { ...request, adminUserId: moderator.id } : request, moderator ?? admin);
    await this.deliverMessages();
    return { snapshot: this.repository.snapshot(groupId), item: this.repository.item(id)! };
  }
  private async deliverMessages() {
    for (const pending of this.repository.state().pendingMessages ?? []) {
      await this.support.sendSupportMessage(pending.ownerUserId, pending.admin, pending.message, 'warned', `content-moderation:${pending.commandId}`);
      await this.repository.acknowledgeMessage(pending.commandId);
    }
  }
  async detail<T>(adminUserId: string, id: string, groupId?: string | null): Promise<T> {
    await this.prepare(adminUserId, groupId);
    if (!groupId && id.startsWith('group:')) { const group = this.groupRecords.find(id.slice(6));
      if (!group) throw new Error('moderation.changed');
      return await this.groups.detail(group.ownerUserId, group.id) as T;
    }
    const item = this.scopedItem(id, groupId);
    if (!item) throw new Error('moderation.changed');
    let detail: unknown;
    if (item.category === 'asset') detail = await this.assets.loadOwnedAssetDetailById(item.ownerUserId, item.sourceId);
    else if (item.category === 'group') detail = await this.groups.detail(item.ownerUserId, item.sourceId);
    else if (item.category === 'event') detail = await this.events.loadEventDetailById(item.ownerUserId, item.sourceId);
    else { const record = this.feed.find(item.sourceId); detail = record ? LocalPhotoFeedMapper.toDto(record, record.locationCoordinates) : null; }
    if (!detail) throw new Error('moderation.changed'); return detail as T;
  }
}
