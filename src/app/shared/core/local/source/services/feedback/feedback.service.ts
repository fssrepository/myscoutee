import { LocalFeedbackEvaluationsRepository } from '../../repositories/feedback/feedback-evaluations.repository';
import type { FeedbackQueryDto, FeedbackReceivedEventDto, FeedbackNoteRequestDto, FeedbackPageQueryDto, FeedbackStatDto, FeedbackStatQueryDto, FeedbackStateDto } from '../../../../contracts/feedback/feedback.interface';
import { FeedbackDetailDto, FeedbackPageResultDto } from '../../../../contracts/feedback/feedback.interface';
import { LocalFeedbackRepository } from '../../repositories/feedback/feedback.repository';
import { LocalEventsRepository } from '../../repositories/events/events.repository';
import { LocalActivityEventsMapper, LocalFeedbackMapper, LocalUsersMapper } from '../../mappers';
import { Injectable, inject } from '@angular/core';
import { LocalCommunityCasesRepository } from '../../repositories/community/community-cases.repository';
import { LocalCommunityAccessService } from '../community/community-access.service';
import { LocalUsersRepository } from '../../repositories/accounts/users.repository';
import { LocalNotificationsRepository } from '../../repositories/notifications/notifications.repository';
import { LocalServiceOfferingsRepository } from '../../repositories/community/service-offerings.repository';
import { LocalRouteDelayService } from '../platform/route-delay.service';
import { COMMUNITY_BASE_GROUP_ID } from '../../../../contracts/groups/group-type';
import { SERVICE_RATING_CRITERIA } from '../../../../contracts/affinity/rating-snapshot';
import type { IFeedbackService, FeedbackEvaluation, FeedbackCommand, FeedbackBucket } from '../../../../contracts/feedback/feedback.interface';
import { LocalCommunityGroupsRepository } from '../../repositories/groups/community-groups.repository';

@Injectable({providedIn:'root'})
export class LocalFeedbackService extends LocalRouteDelayService implements IFeedbackService {
  private readonly repository=inject(LocalCommunityCasesRepository);
  private readonly evaluations=inject(LocalFeedbackEvaluationsRepository);
  private readonly access=inject(LocalCommunityAccessService);
  private readonly users=inject(LocalUsersRepository);
  private readonly notifications=inject(LocalNotificationsRepository);
  private readonly offerings=inject(LocalServiceOfferingsRepository);
  private readonly groups = inject(LocalCommunityGroupsRepository);
  private running=false;
  /** Wake the existing local job loop; the saved request is also drained after reload. */
  wake():void { queueMicrotask(()=>{void this.drain().catch(error=>console.error('Feedback worker failed',error));}); }
  async drain():Promise<void> {
    if(this.running)return;this.running=true;
    try {
      await this.repository.ready();
      for(const { caseId, work } of this.repository.pendingFeedbackWork()) {
        const feedback=this.evaluations.rows().filter(row=>row.caseId===caseId);
        for(const provider of work.providers)for(const viewer of work.reviewers) {
          if(viewer===provider.accountId)continue;
          const id=`${caseId}:${provider.accountId}:${viewer}`;
          if(!feedback.some(r=>r.id===id))feedback.push({id,baseGroupId:COMMUNITY_BASE_GROUP_ID,caseId,caseTitle:work.caseTitle,serviceId:provider.serviceId,
            providerAccountId:provider.accountId,viewerAccountId:viewer,status:'pending',criteria:{},average:null,comment:'',createdAtIso:work.createdAtIso,submittedAtIso:null});
          this.notify(id,'feedback-evaluation-ready',viewer,work.caseTitle,caseId);
        }
        this.evaluations.save(caseId,feedback);
        this.repository.completeFeedbackWork(caseId);
      }
      await this.repository.flush();
    } finally {this.running=false;}
  }
  private async actor(id:string,signal?:AbortSignal) {await this.repository.ready();signal?.throwIfAborted();return this.access.actor(id);}
  private rows():FeedbackEvaluation[] {return this.evaluations.rows();}
  private async evaluationWindow(userId: string, bucket: FeedbackBucket, offset: number, size: number) {
    const actor = await this.actor(userId);
    const rows = this.rows().filter(row => bucket === 'received'
      ? row.providerAccountId === actor && row.status === 'feedbacked'
      : row.viewerAccountId === actor && row.status === bucket)
      .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso) || a.id.localeCompare(b.id));
    const items = rows.slice(offset, offset + size).map(feedback => {
      const offering = feedback.serviceId ? this.offerings.find(feedback.serviceId) : null;
      const visible = offering?.baseGroupId === COMMUNITY_BASE_GROUP_ID
        && (offering.status === 'published' || offering.ownerAccountId === actor || offering.staffAccountIds.includes(actor));
      return {
        feedback: structuredClone(feedback),
        providerName: this.users.queryUserById(feedback.providerAccountId)?.name ?? '',
        reviewerName: this.users.queryUserById(feedback.viewerAccountId)?.name ?? '',
        serviceTitle: visible ? offering.title : null,
        serviceImageUrl: visible ? offering.imageUrls[0] ?? null : null
      };
    });
    const stored = this.users.queryUserById(actor)?.menuCounters ?? {};
    const counts = Object.fromEntries(['pending', 'feedbacked', 'removed', 'received']
      .map(key => [key, stored[`feedbackEvaluation_${key}`] ?? 0]));
    return { items, total: counts[bucket], counts };
  }
  async action(id:string,command:FeedbackCommand):Promise<void> {
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/feedback'),
      (async (): Promise<void> => {
        const actor=await this.actor(command.userId),row=this.rows().find(r=>r.id===id&&r.viewerAccountId===actor);if(!row)throw new Error('Feedback not found');
            let next:FeedbackEvaluation;
            if(command.action==='submit'&&row.status==='pending') {
              const criteria=command.criteria??{},keys=SERVICE_RATING_CRITERIA.criteria.map(c=>c.id),comment=command.comment??'';
              if(Object.keys(criteria).length!==keys.length||keys.some(k=>!Number.isInteger(criteria[k])||criteria[k]<1||criteria[k]>10)||comment.length>160)throw new Error('Invalid feedback');
              next={...row,status:'feedbacked',criteria:{...criteria},average:keys.reduce((n,k)=>n+criteria[k],0)/keys.length,comment:comment.trim(),submittedAtIso:new Date().toISOString()};
            } else if(command.action==='remove'&&row.status==='pending')next={...row,status:'removed'};
            else if(command.action==='restore'&&row.status==='removed')next={...row,status:'pending'};
            else throw new Error('Feedback changed');
            this.evaluations.save(row.caseId,this.rows().filter(r=>r.caseId===row.caseId).map(r=>r.id===id?next:r));
            if(command.action==='submit')this.notify(id,'feedback-evaluation-submitted',row.providerAccountId,row.caseTitle,row.caseId);
            await this.repository.flush();
      })()
    ]);
    return response;
  }
  async stats(userId:string,provider:string,signal?:AbortSignal) {
    signal?.throwIfAborted();
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/feedback', signal),
      (async () => {
        await this.actor(userId,signal);const rows=this.rows().filter(r=>r.providerAccountId===provider&&r.status==='feedbacked');
            return {count:rows.length,average:rows.length?rows.reduce((n,r)=>n+(r.average??0),0)/rows.length:0,
              criteria:Object.fromEntries(SERVICE_RATING_CRITERIA.criteria.map(c=>[c.id,rows.length?rows.reduce((n,r)=>n+r.criteria[c.id],0)/rows.length:0]))};
      })()
    ]);
    signal?.throwIfAborted();
    return response;
  }
  private notify(id:string,kind:string,actor:string,title:string,caseId:string):void {
    if(!this.users.queryUserById(`group:${COMMUNITY_BASE_GROUP_ID}:${actor}`))return;
    this.notifications.append([{id:`${kind}:${id}`,recipientUserId:`group:${COMMUNITY_BASE_GROUP_ID}:${actor}`,kind,category:'scheduled',title,message:title,createdAtIso:new Date().toISOString(),sourceType:'feedback-evaluation',sourceId:id,
      actionPath:`/game?feedback=true&workspaceGroupId=${COMMUNITY_BASE_GROUP_ID}`,payload:{workspaceGroupId:COMMUNITY_BASE_GROUP_ID,caseId,notification_message_key:`notification.kind.${kind}.message`}}]);
  }

private readonly eventsRepository = inject(LocalEventsRepository);
private readonly feedbackRepository = inject(LocalFeedbackRepository);
private readonly usersRepository = inject(LocalUsersRepository);
private readonly notificationsRepository = inject(LocalNotificationsRepository);
async queryStates(userId: string): Promise<FeedbackStateDto[]> {
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/feedback'),
      (async (): Promise<FeedbackStateDto[]> => {
        return this.feedbackRepository.queryFeedbackStates(userId);
      })()
    ]);
    return response;
  }

async queryReceived(userId: string): Promise<FeedbackReceivedEventDto[]> {
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/feedback'),
      (async (): Promise<FeedbackReceivedEventDto[]> => {
        return this.feedbackRepository.queryReceivedFeedback(userId);
      })()
    ]);
    return response;
  }

async loadPage(query: FeedbackPageQueryDto): Promise<FeedbackPageResultDto> {
    const normalizedUserId = query.userId.trim();
    if (!normalizedUserId) {
      return new FeedbackPageResultDto();
    }
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/feedback'),
      (async (): Promise<FeedbackPageResultDto> => {
        await this.repository.ready();
        query = { ...query, page: Math.max(0, Math.trunc(query.page || 0)), pageSize: Math.max(1, Math.min(50, Math.trunc(query.pageSize || 1))) };
        const records = this.eventsRepository.queryFeedbackCandidateItemsByUser(normalizedUserId)
          .filter(event => !query.campaignId || event.campaignId === query.campaignId);
        const organizerRecords = this.eventsRepository.queryHostingItemsByUser(normalizedUserId)
          .filter(event => !query.campaignId || event.campaignId === query.campaignId);
        const events = LocalActivityEventsMapper.toDtoList(records);
        const organizerEvents = LocalActivityEventsMapper.toDtoList(organizerRecords);
        const users = this.usersRepository.queryAllUsers();
        const activeUserRecord = this.usersRepository.queryUserById(normalizedUserId);
        const activeUser = activeUserRecord ? LocalUsersMapper.toDto(activeUserRecord) : users[0] ?? null;
        if (!activeUser) {
          return new FeedbackPageResultDto();
        }
        const result = LocalFeedbackMapper.toPageResult({
          query,
          events,
          organizerEvents,
          users,
          activeUser,
          minglePeersByEventId: this.feedbackRepository.queryMinglePeers(normalizedUserId, records),
          states: this.feedbackRepository.queryFeedbackStates(normalizedUserId),
          receivedEvents: this.feedbackRepository.queryReceivedFeedback(normalizedUserId)
        });
        const workspaceId = activeUserRecord?.workspaceGroupId;
        if (query.campaignId || (workspaceId !== COMMUNITY_BASE_GROUP_ID
          && (!workspaceId || this.groups.find(workspaceId)?.groupType !== 'community'))) return result;
        const size = Math.max(1, Math.min(50, Math.trunc(query.pageSize)));
        const evaluations = await this.evaluationWindow(normalizedUserId,
          query.filter === 'own-events' ? 'received' : query.filter,
          Math.max(0, query.page * size - result.total), Math.max(0, size - result.items.length));
        return new FeedbackPageResultDto({ ...result, total: result.total + evaluations.total,
          evaluations: evaluations.items, evaluationCounts: evaluations.counts });
      })()
    ]);
    return response;
  }

async loadStatistics(query: FeedbackStatQueryDto): Promise<FeedbackStatDto> {
    const normalizedUserId = query.userId.trim();
    const normalizedEventId = query.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return {
        eventId: normalizedEventId,
        totalResponses: 0,
        sections: []
      };
    }
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/feedback'),
      (async (): Promise<FeedbackStatDto> => {
        return LocalFeedbackMapper.toStat({
          query: {
            userId: normalizedUserId,
            eventId: normalizedEventId
          },
          records: this.feedbackRepository.queryReceivedFeedbackStatRecords(
            normalizedUserId,
            normalizedEventId
          )
        });
      })()
    ]);
    return response;
  }

async loadDetail(query: FeedbackQueryDto): Promise<FeedbackDetailDto> {
    const [, response] = await Promise.all([
      this.waitForRouteDelay('/feedback'),
      this.readDetail(query)
    ]);
    return response;
  }

async readDetail(query: FeedbackQueryDto): Promise<FeedbackDetailDto> {
    const normalizedUserId = query.userId.trim();
    const normalizedEventId = query.eventId.trim();
    if (!normalizedUserId || !normalizedEventId) {
      return new FeedbackDetailDto({ eventId: normalizedEventId });
    }

    const records = this.eventsRepository.queryFeedbackCandidateItemsByUser(normalizedUserId);
    const events = LocalActivityEventsMapper.toDtoList(records);
    const users = this.usersRepository.queryAllUsers();
    const activeUserRecord = this.usersRepository.queryUserById(normalizedUserId);
    const activeUser = activeUserRecord ? LocalUsersMapper.toDto(activeUserRecord) : users[0] ?? null;
    if (!activeUser) {
      return new FeedbackDetailDto({ eventId: normalizedEventId });
    }
    const detail = LocalFeedbackMapper.toDetail({
      query: {
        userId: normalizedUserId,
        eventId: normalizedEventId
      },
      events,
      users,
      activeUser,
      minglePeersByEventId: this.feedbackRepository.queryMinglePeers(normalizedUserId, records)
    });
    const state = this.feedbackRepository
      .queryFeedbackStates(normalizedUserId)
      .find(item => item.eventId === normalizedEventId);
    return detail.withPersistedState(state);
  }

async submit(userId: string, request: FeedbackDetailDto): Promise<FeedbackDetailDto> {
    return this.withRouteDelay('/feedback', async (): Promise<FeedbackDetailDto> => {
      const event = this.eventsRepository.queryEventRecordById(userId, request.eventId);
      const allowed = await this.readDetail({ userId, eventId: request.eventId });
      if (event?.mode === 'Mingle') {
        const cards = new Map(allowed.cards.map(card => [card.id, card]));
        if (request.cards.some(card => {
          const target = cards.get(card.id);
          return !target || target.kind !== card.kind || target.targetUserId !== card.targetUserId;
        })) throw new Error('Invalid feedback target for this event.');
      }
      const previous = this.feedbackRepository.queryFeedbackStates(userId)
        .find(item => item.eventId === request.eventId.trim());
      this.feedbackRepository.submitFeedback(userId, request);
      if (event && (!previous?.submittedAtIso || previous.removed)) {
        const actorId = userId.trim();
        const actor = this.usersRepository.queryUserById(actorId);
        const allowedTargets = new Set(allowed.cards.map(card => card.targetUserId));
        const recipients = [...new Set(request.cards.map(card => card.targetUserId?.trim() ?? ''))]
          .filter(id => id && id !== actorId && allowedTargets.has(id));
        const eventTitle = event.title?.trim() || 'Event';
        const createdAtIso = new Date().toISOString();
        this.notificationsRepository.append(recipients.map(recipientUserId => ({
          id: `feedback-submitted:${event.id}:${actorId}:${recipientUserId}`,
          recipientUserId,
          kind: 'feedback-submitted',
          category: 'event',
          title: 'New feedback',
          message: `You received feedback for ${eventTitle}.`,
          createdAtIso,
          readAtIso: null,
          senderUserId: actorId,
          senderName: actor?.name ?? null,
          senderAvatarUrl: actor?.images?.[0] ?? null,
          actionPath: '/game',
          sourceType: 'event',
          sourceId: event.id,
          payload: { eventId: event.id, eventTitle, senderUserId: actorId }
        })));
      }
      await this.feedbackRepository.flushToIndexedDb();
      const normalizedUserId = userId.trim();
      const persistedState = this.feedbackRepository
        .queryFeedbackStates(normalizedUserId)
        .find(item => item.eventId === request.eventId.trim());
      const persisted = new FeedbackDetailDto(request).withPersistedState(persistedState);
      if (!persisted.submittedAtIso) {
        throw new Error('Local feedback persistence was not confirmed.');
      }
      return persisted;
    });
  }

async saveNote(request: FeedbackNoteRequestDto): Promise<void> {
    await this.waitForRouteDelay('/feedback');
    this.feedbackRepository.saveFeedbackNote(request);
    await this.feedbackRepository.flushToIndexedDb();
  }

async remove(userId: string, eventId: string): Promise<void> {
    return this.withRouteDelay('/feedback', async (): Promise<void> => {
      this.feedbackRepository.removeFeedbackEvent(userId, eventId);
      await this.feedbackRepository.flushToIndexedDb();
    });
  }

async restore(userId: string, eventId: string): Promise<void> {
    return this.withRouteDelay('/feedback', async (): Promise<void> => {
      this.feedbackRepository.restoreFeedbackEvent(userId, eventId);
      await this.feedbackRepository.flushToIndexedDb();
    });
  }
}
