import { Injectable, inject } from '@angular/core';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalCommunityAccessService } from './community-access.service';
import { LocalCommunityAnnouncementsRepository } from '../repositories/community-announcements.repository';
import { LocalCommunityGroupsRepository } from '../repositories/community-groups.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { COMMUNITY_BASE_GROUP_ID } from '../../../contracts/group-type';
import { VOTE_CHOICES, type ICommunityAnnouncementsService, type CommunityAnnouncement, type SaveAnnouncement, type AnnouncementCommand, type AnnouncementFilters } from '../../../contracts/community-announcement.interface';
import type { CommunityAnnouncementRecord } from '../entity/community-announcement.entity';
import type { ListQuery } from '@myscoutee/components';

@Injectable({ providedIn: 'root' })
export class LocalCommunityAnnouncementsService extends LocalRouteDelayService implements ICommunityAnnouncementsService {
  private readonly repository = inject(LocalCommunityAnnouncementsRepository);
  private readonly access = inject(LocalCommunityAccessService);
  private readonly groups = inject(LocalCommunityGroupsRepository);
  private readonly users = inject(LocalUsersRepository);
  private readonly notifications = inject(LocalNotificationsRepository);
  private async actor(profile: string, signal?: AbortSignal) {
     await this.repository.ready(); signal?.throwIfAborted();
    return this.access.actor(profile);
  }
  private visible(actor: string, id: string) {
    const a = this.repository.find(id); if (!a) throw new Error('Announcement not found');
    this.access.requireMember(a.communityId, actor);
    if (a.status !== 'published' && !this.access.admin(a.communityId, actor)) throw new Error('Announcement not found');
    return a;
  }
  async detail(userId: string, id: string, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/community-announcements', signal),
      (async () => {
        const actor = await this.actor(userId, signal); return this.dto(actor, this.visible(actor, id));
      })()
    ]);
    signal?.throwIfAborted();
    return response;
  }
  async page(userId: string, query: ListQuery<AnnouncementFilters>, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/community-announcements', signal),
      (async () => {
        const actor = await this.actor(userId, signal), group = query.filters?.communityId ?? '', status = query.filters?.status ?? 'published';
            this.access.requireMember(group, actor);
            if (!['published', 'draft', 'trash'].includes(status) || status !== 'published' && !this.access.admin(group, actor)) throw new Error('Forbidden');
            const rows = this.repository.records().filter(a => a.communityId === group && a.status === status && (query.filters?.voting == null || a.voting === query.filters.voting))
              .sort((a,b) => (b.publishedAtIso ?? '').localeCompare(a.publishedAtIso ?? '') || b.createdAtIso.localeCompare(a.createdAtIso) || a.id.localeCompare(b.id));
            const page = Number(query.cursor ?? 0), size = Math.max(1, Math.min(50, query.pageSize));
            if (!Number.isSafeInteger(page) || page < 0 || page > 1000000) throw new Error('Invalid cursor');
            const start = page * size, end = start + size;
            const voters = this.eligibleVoters(group);
            return { items: rows.slice(start, end).map(a => this.dto(actor, a, voters)), total: rows.length, nextCursor: end < rows.length ? `${page+1}` : null };
      })()
    ]);
    signal?.throwIfAborted();
    return response;
  }
  async save(r: SaveAnnouncement) {
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/community-announcements'),
      (async () => {
        const actor = await this.actor(r.userId); this.access.requireAdmin(r.communityId, actor);
            if (!r.title?.trim() || r.title.trim().length > 160 || r.body == null || r.body.length > 12000 || r.attachments.length > 10
              || r.attachments.some(f => !f.name || f.name.length > 250 || !f.url || !f.mimeType || f.sizeBytes <= 0 || f.sizeBytes > 10485760
                || !f.url.startsWith(`data:${f.mimeType};base64,`) && !f.url.startsWith('/assets/'))) throw new Error('Invalid announcement');
            const old = r.id ? this.visible(actor, r.id) : null;
            if (old && (old.communityId !== r.communityId || old.status === 'trash' || old.version !== r.version)) throw new Error('announcement.changed');
            if (old?.ballots.length && !r.voting) throw new Error('announcement.changed');
            const now = new Date().toISOString(), deadline = r.voting ? new Date(r.deadlineIso ?? '').toISOString() : null;
            const reopened = old?.status === 'published' && !!deadline && deadline > now && deadline !== old.deadlineIso;
            const a: CommunityAnnouncementRecord = { id: old?.id ?? crypto.randomUUID(), communityId: r.communityId, authorAccountId: old?.authorAccountId ?? actor,
              title: r.title.trim(), body: r.body.trim(), attachments: structuredClone(r.attachments), status: old?.status ?? 'draft', voting: r.voting, deadlineIso: deadline,
              closedAtIso: reopened ? null : old?.closedAtIso ?? null, closureNotifiedAtIso: reopened ? null : old?.closureNotifiedAtIso ?? null,
              ballots: structuredClone(old?.ballots ?? []), publishedAtIso: old?.publishedAtIso ?? null, createdAtIso: old?.createdAtIso ?? now, updatedAtIso: now, version: (old?.version ?? -1) + 1 };
            this.repository.save(a, old?.version);
            if (a.status === 'published') this.notify(a, actor, reopened ? 'reopened' : 'updated', `${a.version}`);
            await this.repository.flush(); return this.dto(actor, a);
      })()
    ]);
    return response;
  }
  async action(id: string, r: AnnouncementCommand) {
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/community-announcements'),
      (async () => {
        if (!['publish', 'unpublish', 'trash', 'restore', 'close', 'vote'].includes(r.action)) throw new Error('Invalid action');
            const actor = await this.actor(r.userId), old = this.visible(actor, id), a = structuredClone(old), now = new Date().toISOString();
            if (old.version !== r.version) throw new Error('announcement.changed');
            if (r.action === 'vote') {
              if (!this.access.member(a.communityId, actor)?.votingEligible) throw new Error('Forbidden');
              if (a.status !== 'published' || !a.voting || a.closedAtIso || !a.deadlineIso || a.deadlineIso <= now || !r.choice || !VOTE_CHOICES.includes(r.choice)
                || a.ballots.some(b => b.voterAccountId === actor)) throw new Error('announcement.changed');
              a.ballots.push({ voterAccountId: actor, choice: r.choice, castAtIso: now });
            } else {
              this.access.requireAdmin(a.communityId, actor);
              if (r.action === 'close') {
                if (!a.voting || a.status !== 'published') throw new Error('Invalid vote'); a.closedAtIso ??= now;
              } else {
                a.status = r.action === 'publish' ? 'published' : r.action === 'trash' ? 'trash' : 'draft';
                if (a.status === 'published') a.publishedAtIso ??= now;
              }
            }
            a.updatedAtIso = now; a.version++; this.repository.save(a, old.version);
            if (r.action === 'close') this.notifyClosure(a, actor);
            else if (r.action === 'vote') this.notify(a, actor, 'voted', actor, true);
            else if (a.status === 'published' || old.status === 'published') this.notify(a, actor, r.action, `${a.version}`);
            await this.repository.flush(); return this.dto(actor, a);
      })()
    ]);
    return response;
  }
  async closeDue(groupId: string | null, now = new Date()): Promise<number> {
    if (groupId !== COMMUNITY_BASE_GROUP_ID) return 0;
    await this.repository.ready(); const iso = now.toISOString(); let count = 0;
    for (const old of this.repository.records().filter(a => a.status === 'published' && a.voting && !a.closureNotifiedAtIso && (!!a.closedAtIso || !!a.deadlineIso && a.deadlineIso <= iso) && (() => { const g = this.groups.find(a.communityId); return g?.groupType === 'community' && !['deleted', 'under-review'].includes(g.lifecycleStatus ?? ''); })()).slice(0,100)) {

      const a = old.closedAtIso ? old : this.repository.save({ ...old, closedAtIso: iso, updatedAtIso: iso, version: old.version+1 }, old.version);
      this.notifyClosure(a, 'community-voting-close'); count++;
    }
    await this.repository.flush(); return count;
  }
  private notifyClosure(a: CommunityAnnouncementRecord, actor: string) {
    if (a.closureNotifiedAtIso) return;
    this.notify(a, actor, 'closed', a.closedAtIso!);
    this.repository.save({ ...a, closureNotifiedAtIso: new Date().toISOString() }, a.version);
  }
  private notify(a: CommunityAnnouncementRecord, actor: string, action: string, occurrence: string, adminsOnly = false) {
    const sender = this.users.queryUserById(actor), kind = `announcement-${action}`;
    const ids = [...new Set(this.access.roster(a.communityId).filter(m => m.userId !== actor && (!adminsOnly || m.role === 'Admin')).map(m => m.userId))];
    this.notifications.append(ids.filter(id => !!this.users.queryUserById(`group:${a.communityId}:${id}`)).map(id => ({
      id: `${kind}:${a.id}:${occurrence}:${id}`, recipientUserId: `group:${a.communityId}:${id}`, kind, category: action === 'closed' ? 'scheduled' : 'user',
      title: a.title, message: a.title, createdAtIso: a.updatedAtIso, senderUserId: actor, senderName: sender?.name, senderAvatarUrl: sender?.images?.[0], sourceType: 'announcement', sourceId: a.id,
      actionPath: `/game?announcementId=${a.id}&workspaceGroupId=${a.communityId}`, payload: { workspaceGroupId: a.communityId, announcementId: a.id, notification_message_key: `notification.kind.${kind}.message` }
    })));
  }
  private eligibleVoters(group: string): Set<string> {
    return new Set(this.access.roster(group).filter(m => m.votingEligible).map(m => m.userId));
  }
  private dto(actor: string, a: CommunityAnnouncementRecord, voters = this.eligibleVoters(a.communityId)): CommunityAnnouncement {
    const results = { yes: 0, no: 0, abstain: 0 }; a.ballots.forEach(b => results[b.choice]++);
    return { id: a.id, communityId: a.communityId, authorAccountId: a.authorAccountId, title: a.title, body: a.body, attachments: structuredClone(a.attachments), status: a.status,
      voting: a.voting, deadlineIso: a.deadlineIso, closed: !!a.closedAtIso || a.voting && !!a.deadlineIso && Date.parse(a.deadlineIso) <= Date.now(),
      canVote: voters.has(actor), myBallot: a.ballots.find(b => b.voterAccountId === actor)?.choice ?? null, results,
      eligibleMembers: new Set([...voters, ...a.ballots.map(b => b.voterAccountId)]).size, castVotes: a.ballots.length,
      canManage: this.access.admin(a.communityId, actor), publishedAtIso: a.publishedAtIso, createdAtIso: a.createdAtIso, updatedAtIso: a.updatedAtIso, version: a.version };
  }
}
