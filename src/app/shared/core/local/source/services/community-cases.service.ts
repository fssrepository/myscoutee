import { LocalServiceFeedbackService } from './service-feedback.service';
import { LocalServiceOfferingsRepository } from '../repositories/service-offerings.repository';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { caseChatParticipantIds, activeCaseParticipantIds, notifiedCaseParticipantIds, caseMembershipStatus, canTakeOverCase } from '../entity/community-case.entity';
import { Injectable, inject } from '@angular/core';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalCommunityCasesRepository } from '../repositories/community-cases.repository';
import { LocalCommunityAccessService } from './community-access.service';
import { LocalCommunityGroupsRepository } from '../repositories/community-groups.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalCommunityCaseMapper } from '../mappers/community-case.mapper';
import { COMMUNITY_BASE_GROUP_ID } from '../../../contracts/group-type';
import { CASE_TYPES, type ICommunityCasesService, type CommunityCase, type CaseFilters, type CaseListContext, type SaveCommunityCase, type CaseCommand, type SaveCommunityScheduledTask, type ScheduledTaskAction, type ScheduledTaskFilters, type ScheduledTaskCounters } from '../../../contracts/community-case.interface';
import type { CommunityCaseRecord, CommunityTaskRecord } from '../entity/community-case.entity';
import type { ListQuery, PageResult } from '../../../contracts/list.interface';

@Injectable({ providedIn: 'root' })
export class LocalCommunityCasesService extends LocalRouteDelayService implements ICommunityCasesService {
  private readonly feedback=inject(LocalServiceFeedbackService);
  private readonly offerings = inject(LocalServiceOfferingsRepository);
  private readonly repository = inject(LocalCommunityCasesRepository);
  private readonly access = inject(LocalCommunityAccessService);
  private readonly groups = inject(LocalCommunityGroupsRepository);
  private readonly users = inject(LocalUsersRepository);
  private readonly notifications = inject(LocalNotificationsRepository);
  private readonly chats = inject(LocalChatsRepository);
  private async actor(userId: string, signal?: AbortSignal): Promise<string> {
    await this.waitForRouteDelay('/community-cases', signal); await this.repository.ready(); signal?.throwIfAborted();
    return this.access.actor(userId);
  }
  canManage(c: CommunityCaseRecord, actor: string): boolean { return c.ownerAccountId === actor; }
  visible(actor: string, id: string): CommunityCaseRecord {
    const c = this.repository.findCase(id);
    if (!c || c.baseGroupId !== COMMUNITY_BASE_GROUP_ID || (!c.participantAccountIds.includes(actor) || caseMembershipStatus(c, actor) === 'removed') && !this.canManage(c, actor) && !(c.communityId && this.access.admin(c.communityId, actor))) throw new Error('Case not found');
    return c;
  }
  private dto(actor: string, c: CommunityCaseRecord): CommunityCase {
    return LocalCommunityCaseMapper.toDto(c, actor, this.canManage(c, actor), c.communityId ? this.groups.find(c.communityId)?.name ?? '' : '',
      [...new Set([...c.participantAccountIds,...c.recommendations.flatMap(r=>[r.accountId,r.providerAccountId])])].flatMap(id => { const user = this.users.queryUserById(id); return user ? [user] : []; }));
  }
  async detail(userId: string, id: string, signal?: AbortSignal) { const actor = await this.actor(userId, signal); return this.dto(actor, this.visible(actor, id)); }
  async read(userId: string, id: string) {
    const actor = await this.actor(userId); const c = this.visible(actor, id);
    if (!c.attentionAccountIds.includes(actor)) return this.dto(actor, c);
    const next = this.repository.saveCase({ ...c, attentionAccountIds: c.attentionAccountIds.filter(id => id !== actor), version: c.version + 1 }, c.version);
    await this.repository.flush(); return this.dto(actor, next);
  }
  async page(userId: string, query: ListQuery<CaseFilters>, signal?: AbortSignal): Promise<PageResult<CommunityCase, CaseListContext>> {
    const actor = await this.actor(userId, signal); const f = query.filters ?? {};
    const statuses = !f.status || f.status === 'active' ? ['open', 'in-progress'] : [f.status];
    if (statuses.some(status => !['open', 'in-progress', 'completed', 'cancelled', 'trash'].includes(status)) || f.caseType && !CASE_TYPES.includes(f.caseType)) throw new Error('Invalid case filter');
    const managed = this.access.managedGroups(actor);
    const visible = this.repository.visibleCases(actor, managed);
    const rows = visible.filter(c => statuses.includes(c.status) && (!f.caseType || c.caseType === f.caseType))
      .sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso) || a.id.localeCompare(b.id));
    const result = this.pageRows(rows, query);
    const context: CaseListContext = { total: 0 };
    for (const c of visible) {
      const key = `${c.status}:${c.caseType}`;
      context[key] = (context[key] ?? 0) + 1;
      if (c.status !== 'trash') context.total++;
    }
    return { ...result, items: result.items.map(c => this.dto(actor, c)), context };
  }
  async save(r: SaveCommunityCase): Promise<CommunityCase> {
    const actor = await this.actor(r.userId); this.validate(r);
    const old = r.id ? this.visible(actor, r.id) : null;
    if (old && (!this.canManage(old, actor) || old.status === 'trash')) throw new Error('Forbidden');
    if (old && old.version !== r.version) throw new Error('case.changed');
    const communityId = old ? old.communityId : r.communityId || null;
    if (!communityId && !old?.scheduledTaskId) throw new Error('A community group is required');
    if (communityId) this.access.requireMember(communityId, actor);
    const manager = old ? this.canManage(old, actor) : this.access.admin(communityId, actor);
    if (!manager && (r.audienceAll || r.audienceAccountIds.some(id => id !== actor))) throw new Error('Forbidden');
    const audience = communityId ? this.access.audience(communityId, r.audienceAll, r.audienceAccountIds) : [actor];
    const admins = (communityId ? this.access.roster(communityId) : []).filter(m => m.role === 'Admin').map(m => m.userId);
    const participants = [...new Set([...audience, ...admins, old?.ownerAccountId ?? actor,
      ...(old?.participantAccountIds ?? [])])].filter(id => old?.memberStates?.[id] !== 'removed');
    const now = new Date().toISOString();
    const c: CommunityCaseRecord = { id: old?.id ?? crypto.randomUUID(), baseGroupId: COMMUNITY_BASE_GROUP_ID, communityId,
      ownerAccountId: old?.ownerAccountId ?? actor, title: r.title.trim(), description: r.description.trim(), caseType: r.caseType,
      status: old?.status ?? 'open', audienceAll: r.audienceAll, audienceAccountIds: audience, participantAccountIds: participants,
      memberStates: { ...(old?.memberStates ?? {}), ...Object.fromEntries(participants.filter(id => !old?.participantAccountIds.includes(id)).map(id => [id, id === actor ? 'accepted' as const : 'invited' as const])) },
      feedback:structuredClone(old?.feedback??[]),feedbackWork:structuredClone(old?.feedbackWork??null),
      boardTasks: structuredClone(old?.boardTasks ?? []), chatAccountIds: [...(old?.chatAccountIds ?? [])],
      attentionAccountIds: participants.filter(id => id !== actor), support: structuredClone(old?.support ?? []),
      recommendations: structuredClone(old?.recommendations ?? []), offers: structuredClone(old?.offers ?? []),
      scheduledTaskId: old?.scheduledTaskId ?? null, dueAtIso: old?.dueAtIso ?? null,
      createdAtIso: old?.createdAtIso ?? now, updatedAtIso: now, version: (old?.version ?? -1) + 1 };
    c.attentionAccountIds = notifiedCaseParticipantIds(c).filter(id => id !== actor);
    this.repository.saveCase(c, old?.version); this.notify(c, actor, old ? 'updated' : 'created', `${c.id}:${c.version}`);
    await this.repository.flush(); return this.dto(actor, c);
  }
  async action(id: string, r: CaseCommand): Promise<CommunityCase> {
    const actor = await this.actor(r.userId); const old = this.visible(actor, id);
    if (old.version !== r.version) throw new Error('case.changed');
    const c = structuredClone(old), manager = this.canManage(c, actor);
    c.memberStates ??= {}; c.boardTasks ??= [];
    switch (r.action) {
      case 'take-over': {
        if (!canTakeOverCase(c,actor)) throw new Error('Forbidden');
        c.ownerAccountId = actor; c.memberStates[actor] = 'accepted'; break;
      }
      case 'join': case 'decline': case 'leave': {
        const current = caseMembershipStatus(c, actor);
        if (c.status === 'trash' || !current || current === 'removed') throw new Error('Forbidden');
        if (r.action === 'decline' && current !== 'invited' || r.action === 'leave' && current !== 'accepted') throw new Error('case.changed');
        const next = r.action === 'join' ? 'accepted' : r.action === 'decline' ? 'declined' : 'left';
        if (next === current) return this.dto(actor, c);
        c.memberStates[actor] = next;
        if (r.action === 'leave' && manager) c.ownerAccountId = null;
        if (!notifiedCaseParticipantIds(c).length) c.status = 'trash';
        const support = c.support.find(s => s.accountId === actor); if (support) support.status = next === 'accepted' ? 'accepted' : 'declined';
        break;
      }
      case 'invite-members': case 'remove-member': {
        if (!manager || c.status === 'trash' || !r.memberAccountIds?.length || r.memberAccountIds.length > 100) throw new Error('Forbidden');
        for (const member of new Set(r.memberAccountIds)) {
          if (r.action === 'invite-members') {
            this.access.requireBaseMember(member);
            if (caseMembershipStatus(c, member) !== 'accepted') c.memberStates[member] = 'invited';
            if (!c.participantAccountIds.includes(member)) c.participantAccountIds.push(member);
          } else {
            if (!c.participantAccountIds.includes(member) || member === actor) throw new Error('Invalid member');
            c.memberStates[member] = 'removed'; c.participantAccountIds = c.participantAccountIds.filter(id => id !== member);
          }
        } break;
      }
      case 'invite-chat': {
        if (!manager || c.status === 'trash' || !r.memberAccountIds?.length || r.memberAccountIds.length > 100
          || r.memberAccountIds.some(id => !c.participantAccountIds.includes(id))) throw new Error('Forbidden');
        c.chatAccountIds = [...new Set([...(c.chatAccountIds ?? []), ...r.memberAccountIds])];
        break;
      }
      case 'save-board-task': case 'delete-board-task': {
        if (!manager) throw new Error('Forbidden');
        if (r.action === 'delete-board-task') {
          if (!c.boardTasks.some(t => t.id === r.taskId)) throw new Error('Task not found');
          c.boardTasks = c.boardTasks.map(t => t.id === r.taskId ? {...t,status:'deleted'} : t);
        } else {
          if (!['open', 'in-progress'].includes(c.status)) throw new Error('case.changed');
          const task = r.task;
          if (!task || !task.id?.trim() || task.id.length > 100 || !task.title?.trim() || task.title.length > 120 || task.description == null || task.description.length > 4000
            || !['todo','in-progress','done','deleted'].includes(task.status) || !Array.isArray(task.assigneeAccountIds) || !Array.isArray(task.dependsOnIds) || task.assigneeAccountIds.length > 100 || task.dependsOnIds.length > 200) throw new Error('Invalid task');
          if ((task.offerIds?.length ?? 0) > 100 || task.offerIds?.some(id => !c.offers.some(o => o.id === id && o.status === 'accepted')) || new Set(task.offerIds ?? []).size !== (task.offerIds?.length ?? 0)) throw new Error('Invalid task quotation');
          const previous = c.boardTasks.find(t => t.id === task.id);
          if (task.assigneeAccountIds.some(id => !activeCaseParticipantIds(c).includes(id) && !previous?.assigneeAccountIds.includes(id))) throw new Error('Invalid assignee');
          const start = task.startAtIso == null ? null : Date.parse(task.startAtIso), end = task.endAtIso == null ? null : Date.parse(task.endAtIso);
          if (start !== null && !Number.isFinite(start) || end !== null && (!Number.isFinite(end) || start === null || end <= start)) throw new Error('Invalid time');
          c.boardTasks = [...c.boardTasks.filter(t => t.id !== task.id), structuredClone(task)];
          if (c.boardTasks.length > 200) throw new Error('Too many tasks');
          const byId = new Map(c.boardTasks.map(t => [t.id,t])), done = new Set<string>();
          const visit = (id: string, path = new Set<string>()) => {
            if (done.has(id)) return;
            if (!byId.has(id) || path.has(id)) throw new Error('case.task.dependencies.cycle');
            path.add(id); byId.get(id)!.dependsOnIds.forEach(id => visit(id,path)); path.delete(id); done.add(id);
          };
          c.boardTasks.forEach(t => visit(t.id));
        } break;
      }

      case 'start': case 'complete': case 'cancel': case 'trash': case 'reopen': {
        if (!manager) throw new Error('Forbidden');
        c.status = ({ start: 'in-progress', complete: 'completed', cancel: 'cancelled', trash: 'trash', reopen: 'open' } as const)[r.action]; break;
      }
      case 'recommend': case 'invite-provider': {
        if (!r.providerAccountId || c.status === 'trash') throw new Error('Invalid provider');
        this.access.requireBaseMember(r.providerAccountId);
        if (r.serviceId) {
          const offering = this.offerings.find(r.serviceId);
          if (!offering || offering.baseGroupId !== COMMUNITY_BASE_GROUP_ID || offering.status !== 'published'
            || offering.ownerAccountId !== r.providerAccountId && !offering.staffAccountIds.includes(r.providerAccountId)) throw new Error('Invalid service');
        }
        if (r.action === 'recommend') {
          if (!manager && !activeCaseParticipantIds(c).includes(actor)) throw new Error('Forbidden');
          c.recommendations = c.recommendations.filter(v => !(v.accountId === actor && v.providerAccountId === r.providerAccountId));
          c.recommendations.push({ accountId: actor, providerAccountId: r.providerAccountId, serviceId: r.serviceId ?? null });
        } else {
          if (!manager) throw new Error('Forbidden');
          if(c.support.some(s=>s.accountId===r.providerAccountId && s.serviceId===(r.serviceId??null) && s.status!=='declined'))return this.dto(actor,c);
          c.support = c.support.filter(s => s.accountId !== r.providerAccountId);
          const status = caseMembershipStatus(c, r.providerAccountId) === 'accepted' ? 'accepted' : 'invited';
          c.memberStates[r.providerAccountId] = status;
          c.support.push({ accountId: r.providerAccountId, serviceId: r.serviceId ?? null, status });
          c.participantAccountIds = [...new Set([...c.participantAccountIds, r.providerAccountId])];
        } break;
      }
      case 'accept-invite': case 'decline-invite': {
        const own = c.support.find(s => s.accountId === actor && s.status === 'invited');
        if (!own) throw new Error('Forbidden'); own.status = r.action === 'accept-invite' ? 'accepted' : 'declined'; c.memberStates[actor] = own.status; break;
      }
      case 'offer': case 'edit-offer': {
        const existing = r.action === 'edit-offer' ? c.offers.find(o => o.id === r.offerId) : null;
        const own = c.support.find(s => s.accountId === actor && s.status === 'accepted' && caseMembershipStatus(c,actor) === 'accepted');
        if (r.action === 'edit-offer' ? !manager : !own) throw new Error('Forbidden');
        if (r.action === 'edit-offer' && !existing || !['open','in-progress'].includes(c.status)) throw new Error('case.changed');
        if (r.amount == null || !Number.isFinite(r.amount) || r.amount < 0 || r.amount > 100000000 || r.note == null || r.note.length > 4000 || (r.workPolicy?.length ?? 0) > 4000 || (r.refundPolicy?.length ?? 0) > 4000 || !r.currency || !/^[A-Z]{3}$/.test(r.currency)) throw new Error('Invalid offer');
        const policies = (items: typeof r.workPolicies) => {
          if (!Array.isArray(items ?? []) || (items?.length ?? 0) > 100 || items?.some(p => !p || !p.id?.trim() || p.id.length > 100 || !p.title?.trim() || p.title.length > 120 || !p.description?.trim() || p.description.length > 4000 || typeof p.required !== 'boolean') || new Set(items?.map(p => p.id)).size !== (items?.length ?? 0)) throw new Error('Invalid offer policy');
          return structuredClone(items ?? []);
        };
        const content = {amount:r.amount,currency:r.currency,note:r.note,workPolicy:r.workPolicy??'',refundPolicy:r.refundPolicy??'',workPolicies:policies(r.workPolicies),refundPolicies:policies(r.refundPolicies)};
        if (existing) Object.assign(existing,content);
        else c.offers.push({id:crypto.randomUUID(),providerAccountId:actor,serviceId:own!.serviceId,...content,status:'pending',createdAtIso:new Date().toISOString()});
        break;
      }
      case 'accept-offer': case 'reject-offer': case 'pending-offer': {
        if (!manager) throw new Error('Forbidden');
        const offer = c.offers.find(o => o.id === r.offerId); if (!offer || c.status === 'trash') throw new Error('case.changed');
        offer.status = r.action === 'accept-offer' ? 'accepted' : r.action === 'reject-offer' ? 'rejected' : 'pending'; break;
      }
      default: throw new Error('Invalid case action');
    }
    c.attentionAccountIds = notifiedCaseParticipantIds(c).filter(id => id !== actor); c.updatedAtIso = new Date().toISOString(); c.version++;
    if(r.action==='complete'&&old.status!=='completed')this.feedback.request(c);
    this.repository.saveCase(c, old.version); this.notify(c, actor, r.action === 'leave' && manager ? 'owner-left' : ['join','decline','leave','invite-members','remove-member','invite-chat','save-board-task','delete-board-task','edit-offer','pending-offer'].includes(r.action) ? 'updated' : r.action, `${c.id}:${c.version}`);
    await this.repository.flush(); if(c.feedbackWork)this.feedback.wake(); return this.dto(actor, c);
  }
  async tasks(userId: string, query: ListQuery<ScheduledTaskFilters>, signal?: AbortSignal) {
    const actor = await this.actor(userId, signal); const managed = this.access.managedGroups(actor);
    const rows = this.repository.tasks().filter(t => {
      if (t.baseGroupId !== COMMUNITY_BASE_GROUP_ID) return false;
      if (!t.communityId) return t.ownerAccountId === actor;
      const group = this.groups.find(t.communityId);
      return !!group && group.groupType === 'community' && !['deleted','under-review'].includes(group.lifecycleStatus ?? '')
        && (managed.has(t.communityId) || !!this.access.member(t.communityId, actor) && (t.audienceAll || t.audienceAccountIds.includes(actor)));
    })
      .sort((a, b) => a.nextDueAtIso.localeCompare(b.nextDueAtIso) || a.id.localeCompare(b.id));
    const status = query.filters?.status ?? 'active';
    if (!['active','paused','trash'].includes(status)) throw new Error('Invalid schedule status');
    const context: ScheduledTaskCounters = { total: 0, active: 0, paused: 0, trash: 0 };
    const taskStatus = (t: CommunityTaskRecord) => t.deleted ? 'trash' : t.enabled ? 'active' : 'paused';
    for (const task of rows) { context[taskStatus(task)]++; if (!task.deleted) context.total++; }
    const result = this.pageRows(rows.filter(t => taskStatus(t) === status), query);
    return { ...result, context, items: result.items.map(t => this.taskDto(t, actor)) };
  }
  async saveTask(r: SaveCommunityScheduledTask) {
    const actor = await this.actor(r.userId); this.validate(r);
    if (!['once', 'monthly', 'quarterly', 'yearly'].includes(r.frequency) || !Number.isFinite(Date.parse(r.startAtIso))) throw new Error('Invalid schedule');
    const old = r.id ? this.repository.findTask(r.id) : null;
    if (r.id && (!old || old.deleted)) throw new Error('Task not found');
    const groupId = old ? old.communityId : r.communityId || null;
    if (groupId) this.access.requireAdmin(groupId, actor);
    else if (old && old.ownerAccountId !== actor) throw new Error('Forbidden');
    if (old && (old.baseGroupId !== COMMUNITY_BASE_GROUP_ID || old.version !== r.version)) throw new Error('case.changed');
    const audience = groupId ? this.access.audience(groupId, r.audienceAll, r.audienceAccountIds) : [actor];
    if (!audience.length) throw new Error('Invalid audience');
    const now = new Date().toISOString(), startAtIso = new Date(r.startAtIso).toISOString();
    const unchangedSchedule = old && (old.startAtIso ?? old.nextDueAtIso) === startAtIso && old.frequency === r.frequency;
    const task: CommunityTaskRecord = { id: old?.id ?? crypto.randomUUID(), baseGroupId: COMMUNITY_BASE_GROUP_ID,
      communityId: groupId, ownerAccountId: old?.ownerAccountId ?? actor, title: r.title.trim(), description: r.description.trim(), caseType: r.caseType,
      audienceAll: !!groupId && r.audienceAll, audienceAccountIds: groupId && r.audienceAll ? [] : audience,
      startAtIso, nextDueAtIso: unchangedSchedule ? old.nextDueAtIso : startAtIso,
      frequency: r.frequency, enabled: old?.enabled ?? true, createdAtIso: old?.createdAtIso ?? now, updatedAtIso: now, version: (old?.version ?? -1) + 1 };
    this.repository.saveTask(task, old?.version); await this.repository.flush(); return this.taskDto(task, actor);
  }
  async taskAction(userId: string, id: string, action: ScheduledTaskAction, version: number) {
    const actor = await this.actor(userId), task = this.repository.findTask(id);
    if (!task || task.baseGroupId !== COMMUNITY_BASE_GROUP_ID) throw new Error('Task not found');
    if (task.communityId) this.access.requireAdmin(task.communityId, actor);
    else if (task.ownerAccountId !== actor) throw new Error('Forbidden');
    if (task.version !== version) throw new Error('case.changed');
    if (!(task.deleted ? action === 'restore' : action === 'trash' || action === (task.enabled ? 'pause' : 'resume'))) throw new Error('Invalid schedule action');
    const updated = { ...task, deleted: action === 'trash', enabled: action === 'resume' || action === 'restore', updatedAtIso: new Date().toISOString(), version: task.version + 1 };
    this.repository.saveTask(updated, task.version); await this.repository.flush(); return this.taskDto(updated, actor);
  }
  private taskDto(t: CommunityTaskRecord, actor: string) {
    const group = t.communityId ? this.access.group(t.communityId) : null;
    const accepted = new Set(group ? this.access.roster(group.id).map(m => m.userId) : [t.ownerAccountId]);
    return LocalCommunityCaseMapper.task(t, group?.name ?? '', t.audienceAll ? accepted.size : t.audienceAccountIds.filter(id => accepted.has(id)).length,
      group ? this.access.admin(group.id, actor) : t.ownerAccountId === actor);
  }
  async createScheduledCases(groupId: string | null, now = new Date()): Promise<number> {
    if (groupId !== COMMUNITY_BASE_GROUP_ID) return 0;
    await this.repository.ready(); let created = 0;
    const horizon = now.getTime() + 45 * 86400000;
    const tasks = this.repository.tasks().filter(t => t.baseGroupId === COMMUNITY_BASE_GROUP_ID && t.enabled && !t.deleted && Date.parse(t.nextDueAtIso) <= horizon)
      .sort((a, b) => a.nextDueAtIso.localeCompare(b.nextDueAtIso) || a.id.localeCompare(b.id)).slice(0, 100);
    for (const t of tasks) {
      const group = t.communityId ? this.groups.find(t.communityId) : null;
      if (t.communityId && (!group || ['deleted', 'under-review'].includes(group.lifecycleStatus ?? ''))) continue;
      const roster = group ? this.access.roster(group.id) : [], accepted = new Set(group ? roster.map(m => m.userId) : [t.ownerAccountId]);
      const audience = t.audienceAll ? [...accepted] : t.audienceAccountIds.filter(id => accepted.has(id)); if (!audience.length) continue;
      const participants = [...new Set([...audience, ...roster.filter(m => m.role === 'Admin').map(m => m.userId)])];
      const id = `scheduled-case:${t.id}:${t.nextDueAtIso}`;
      let c = this.repository.findCase(id);
      if (!c) {
        c = { id, baseGroupId: COMMUNITY_BASE_GROUP_ID, communityId: t.communityId, ownerAccountId: t.communityId ? null : t.ownerAccountId,
          title: t.title, description: t.description, caseType: t.caseType, status: 'open', audienceAll: t.audienceAll,
          audienceAccountIds: audience, participantAccountIds: participants, attentionAccountIds: participants,
          memberStates: Object.fromEntries(participants.map(id => [id, t.communityId ? 'invited' : 'accepted'])), boardTasks: [], chatAccountIds: [],
          support: [], recommendations: [], offers: [], scheduledTaskId: t.id, dueAtIso: t.nextDueAtIso,
          createdAtIso: now.toISOString(), updatedAtIso: now.toISOString(), version: 0 };
        this.repository.saveCase(c); created++;
      }
      this.notify(c, 'community-scheduled-cases', 'reminder', id);
      const next = this.nextDue(t);
      this.repository.saveTask({ ...t, nextDueAtIso: next ?? t.nextDueAtIso, enabled: next !== null, updatedAtIso: now.toISOString(), version: t.version + 1 }, t.version);
    }
    await this.repository.flush(); return created;
  }
  private nextDue(task: CommunityTaskRecord): string | null {
    if (task.frequency === 'once') return null;
    const date = new Date(task.nextDueAtIso), day = date.getUTCDate(); date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + ({ monthly: 1, quarterly: 3, yearly: 12 })[task.frequency]);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay)); return date.toISOString();
  }
  notify(c: CommunityCaseRecord, actor: string, action: string, occurrence: string): void {
    this.chats.syncCaseChat(c);
    const kind = `case-${action}`, sender = this.users.queryUserById(actor);
    this.notifications.append(notifiedCaseParticipantIds(c).filter(id => id !== actor && this.users.queryUserById(`group:${COMMUNITY_BASE_GROUP_ID}:${id}`)).map(accountId => ({
      id: `${kind}:${occurrence}:${accountId}`, recipientUserId: `group:${COMMUNITY_BASE_GROUP_ID}:${accountId}`,
      kind, category: action === 'reminder' ? 'scheduled' : 'user', title: c.title, message: c.title, createdAtIso: c.updatedAtIso,
      senderUserId: actor, senderName: sender?.name, senderAvatarUrl: sender?.images?.[0], sourceType: 'case', sourceId: c.id,
      actionPath: `/game?caseId=${encodeURIComponent(c.id)}&workspaceGroupId=${COMMUNITY_BASE_GROUP_ID}`, payload: { workspaceGroupId: COMMUNITY_BASE_GROUP_ID, caseId: c.id,
        notification_message_key: `notification.kind.${kind}.message` }
    })));
  }
  private validate(r: SaveCommunityCase | SaveCommunityScheduledTask): void {
    if (!r.title?.trim() || r.title.trim().length > 120 || r.description == null || r.description.length > 120 || !CASE_TYPES.includes(r.caseType)) throw new Error('Invalid case');
  }
  private pageRows<T>(rows: T[], query: ListQuery) {
    const page = Number(query.cursor ?? 0), limit = Math.min(50, Math.max(1, query.pageSize));
    if (!Number.isSafeInteger(page) || page < 0 || page > 1000000) throw new Error('Invalid cursor');
    const start = page * limit, end = Math.min(start + limit, rows.length);
    return { items: rows.slice(start, end), total: rows.length, nextCursor: end < rows.length ? `${page + 1}` : null };
  }
}
