import { UserProfileState } from '../../../common/user-profile-state';
import { Injectable, inject } from '@angular/core';
import { CAMPAIGN_CATEGORIES, CAMPAIGN_KINDS, type Campaign, type CampaignAction, type CampaignFilters, type CampaignHistoryItem, type ICampaignsService, type SaveCampaign } from '../../../contracts/campaign.interface';
import type { ListQuery, PageResult } from '@myscoutee/components';
import type { UserRecord } from '../entity/user.entity';
import type { CampaignRecord } from '../entity/campaign.entity';
import type { UserRateRecord } from '../entity/rate.entity';
import { LocalCampaignsRepository } from '../repositories/campaigns.repository';
import { LocalCommunityGroupsRepository } from '../repositories/community-groups.repository';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalCampaignMapper } from '../mappers/campaign.mapper';
import { LocalRouteDelayService } from './route-delay.service';

@Injectable({ providedIn: 'root' })
export class LocalCampaignsService extends LocalRouteDelayService implements ICampaignsService {
  private readonly campaigns = inject(LocalCampaignsRepository);
  private readonly groups = inject(LocalCommunityGroupsRepository);
  private readonly members = inject(LocalActivityMembersRepository);
  private readonly users = inject(LocalUsersRepository);
  private async actor(userId: string, signal?: AbortSignal): Promise<UserRecord> {
     await this.campaigns.ready(); signal?.throwIfAborted();
    const actor = this.users.queryUserById(userId);
    const group = actor?.workspaceGroupId ? this.groups.find(actor.workspaceGroupId) : null;
    const member = group ? this.members.peekRecordsByOwner({ ownerType: 'community', ownerId: group.id })
      .find(m => m.userId === actor?.accountUserId && m.status === 'accepted') : null;
    if (!actor || !group || group.groupType !== 'work' || group.lifecycleStatus === 'deleted' || !group.policy.workspace || !member) throw new Error('Forbidden');
    return actor;
  }
  private visible(actor: UserRecord, id: string): CampaignRecord {
    const record = this.campaigns.find(id);
    if (!record || record.workspaceGroupId !== actor.workspaceGroupId
      || (record.ownerUserId !== actor.id && record.status !== 'published')) throw new Error('Campaign not found');
    return record;
  }
  private dto(actor: UserRecord, record: CampaignRecord, rating?: UserRateRecord): Campaign {
    const owner = this.users.queryUserById(record.ownerUserId);
    if (!owner || owner.workspaceGroupId !== actor.workspaceGroupId || (owner.id !== actor.id && !UserProfileState.isActivityRateVisibleProfile(owner))) throw new Error('Campaign not found');
    return LocalCampaignMapper.toDto(record, owner, actor, rating);
  }
  async page(userId: string, query: ListQuery<CampaignFilters>, signal?: AbortSignal): Promise<PageResult<Campaign>> {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/campaigns', signal),
      (async (): Promise<PageResult<Campaign>> => {
        const actor = await this.actor(userId, signal);
            const f = query.filters ?? {}; const own = (f.scope ?? 'own') === 'own';
            const status = own ? f.status ?? 'published' : 'published';
            const needle = f.search?.trim().toLowerCase() ?? '';
            const ratings = this.campaigns.ratingEvidenceByCampaign(actor.id);
            const rows = this.campaigns.records(actor.workspaceGroupId!).filter(c => c.status === status
              && (!own || c.ownerUserId === actor.id) && (f.scope !== 'discover' || c.ownerUserId !== actor.id)
              && (!f.kind || f.kind === 'both' || c.kind === f.kind || c.kind === 'both')
              && (!f.category || c.category === f.category)
              && (!needle || `${c.title}\n${c.description}`.toLowerCase().includes(needle)))
              .filter(c => { const owner = this.users.queryUserById(c.ownerUserId); return !!owner && owner.workspaceGroupId === actor.workspaceGroupId && (owner.id === actor.id || UserProfileState.isActivityRateVisibleProfile(owner)); }).map(c => this.dto(actor, c, ratings.get(c.id)))
              .sort((a, b) => (query.sort === 'distance' ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
                : b.updatedAtIso.localeCompare(a.updatedAtIso)) || a.id.localeCompare(b.id));
            const offset = Number(query.cursor ?? 0); const limit = Math.min(50, Math.max(1, query.pageSize));
            if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid cursor');
            const items = rows.slice(offset, offset + limit);
            return { items, total: rows.length, nextCursor: offset + items.length < rows.length ? `${offset + items.length}` : null };
      })()
    ]);
    signal?.throwIfAborted();
    return response;
  }
  async detail(userId: string, id: string, signal?: AbortSignal): Promise<Campaign> {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/campaigns', signal),
      this.readDetail(userId, id, signal)
    ]);
    signal?.throwIfAborted();
    return response;
  }
  async readDetail(userId: string, id: string, signal?: AbortSignal): Promise<Campaign> {
    const actor = await this.actor(userId, signal);
    return this.dto(actor, this.visible(actor, id), this.campaigns.ratingEvidenceByCampaign(actor.id).get(id));
  }
  async history(userId: string, targetUserId: string, query: ListQuery, signal?: AbortSignal): Promise<PageResult<CampaignHistoryItem>> {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/campaigns', signal),
      (async (): Promise<PageResult<CampaignHistoryItem>> => {
        const actor = await this.actor(userId, signal);
            const target = this.users.queryUserById(targetUserId);
            if (!target || target.workspaceGroupId !== actor.workspaceGroupId || !UserProfileState.isActivityRateVisibleProfile(target)) throw new Error('Profile not found');
            const dates = this.campaigns.interactionDates(actor.id, target.id);
            const ratings = this.campaigns.ratingEvidenceByCampaign(actor.id);
            const rows = this.campaigns.records(actor.workspaceGroupId!)
              .filter(c => dates.has(c.id) && (c.ownerUserId === actor.id || c.ownerUserId === target.id)
                && (c.ownerUserId === actor.id || c.status === 'published'))
              .map(c => ({ campaign: LocalCampaignMapper.toDto(c, c.ownerUserId === actor.id ? actor : target, actor, ratings.get(c.id)), lastInteractionAtIso: dates.get(c.id)! }))
              .sort((a, b) => b.lastInteractionAtIso.localeCompare(a.lastInteractionAtIso) || a.campaign.id.localeCompare(b.campaign.id));
            const offset = Number(query.cursor ?? 0); const limit = Math.min(50, Math.max(1, query.pageSize));
            if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid cursor');
            const items = rows.slice(offset, offset + limit);
            return { items, total: rows.length, nextCursor: offset + items.length < rows.length ? `${offset + items.length}` : null };
      })()
    ]);
    signal?.throwIfAborted();
    return response;
  }
  async save(request: SaveCampaign): Promise<Campaign> {
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/campaigns'),
      (async (): Promise<Campaign> => {
        const actor = await this.actor(request.userId);
            if (!request.title.trim() || request.title.trim().length > 120 || request.description.length > 4000
              || !CAMPAIGN_KINDS.includes(request.kind) || !CAMPAIGN_CATEGORIES.includes(request.category)
              || request.imageUrls.length > 4 || request.attachments.length > 10
              || request.attachments.some(f=>!f.name||f.name.length>250||!f.mimeType||f.sizeBytes<=0||f.sizeBytes>10485760
                || !f.url?.startsWith(`data:${f.mimeType};base64,`)&&!f.url?.startsWith('/assets/'))) throw new Error('Invalid campaign');
            const existing = request.id ? this.visible(actor, request.id) : null;
            if (existing && (existing.ownerUserId !== actor.id || existing.status === 'trash')) throw new Error('Forbidden');
            if (existing && existing.version !== request.version) throw new Error('Campaign changed');
            const now = new Date().toISOString();
            const record: CampaignRecord = { id: existing?.id ?? crypto.randomUUID(), workspaceGroupId: actor.workspaceGroupId!, ownerUserId: actor.id,
              title: request.title.trim(), description: request.description.trim(), kind: request.kind, category: request.category,
              imageUrls: [...request.imageUrls], attachments:structuredClone(request.attachments),
              status: existing?.status ?? 'draft', createdAtIso: existing?.createdAtIso ?? now, updatedAtIso: now, version: (existing?.version ?? -1) + 1 };
            return this.dto(actor, this.campaigns.save(record, existing?.version));
      })()
    ]);
    return response;
  }
  async action(userId: string, id: string, action: CampaignAction, version: number): Promise<Campaign> {
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/campaigns'),
      (async (): Promise<Campaign> => {
        const actor = await this.actor(userId); const record = this.visible(actor, id);
            if (record.ownerUserId !== actor.id) throw new Error('Forbidden');
            const transitions = { publish: ['draft', 'published'], unpublish: ['published', 'draft'], trash: [record.status, 'trash'], restore: ['trash', 'draft'] } as const;
            const next = transitions[action];
            if (!next || record.status !== next[0] || (action === 'trash' && record.status === 'trash')) throw new Error('Invalid campaign action');
            return this.dto(actor, this.campaigns.save({ ...record, status: next[1], updatedAtIso: new Date().toISOString(), version: version + 1 }, version));
      })()
    ]);
    return response;
  }
}
