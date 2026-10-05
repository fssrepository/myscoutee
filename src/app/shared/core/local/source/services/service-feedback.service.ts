import { Injectable, inject } from '@angular/core';
import { LocalCommunityCasesRepository } from '../repositories/community-cases.repository';
import { LocalCommunityAccessService } from './community-access.service';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalRouteDelayService } from './route-delay.service';
import { activeCaseParticipantIds, type CommunityCaseRecord } from '../entity/community-case.entity';
import { COMMUNITY_BASE_GROUP_ID } from '../../../contracts/group-type';
import { SERVICE_RATING_CRITERIA } from '../../../contracts/rating-snapshot';
import type { IServiceFeedbackService, ServiceFeedback, ServiceFeedbackCommand, ServiceFeedbackBucket } from '../../../contracts/service-feedback.interface';
import type { ListQuery } from '../../../contracts/list.interface';

@Injectable({providedIn:'root'})
export class LocalServiceFeedbackService extends LocalRouteDelayService implements IServiceFeedbackService {
  private readonly repository=inject(LocalCommunityCasesRepository);
  private readonly access=inject(LocalCommunityAccessService);
  private readonly users=inject(LocalUsersRepository);
  private readonly notifications=inject(LocalNotificationsRepository);
  private running=false;
  /** Wake the existing local job loop; the saved request is also drained after reload. */
  wake():void { queueMicrotask(()=>{void this.drain().catch(error=>console.error('Service feedback worker failed',error));}); }
  request(c:CommunityCaseRecord):void {
    const active=activeCaseParticipantIds(c);
    c.feedbackWork={reviewers:active.filter(id=>!c.support.some(s=>s.accountId===id)||c.audienceAccountIds.includes(id)||id===c.ownerAccountId),
      providers:c.support.filter(s=>s.status==='accepted'&&active.includes(s.accountId)),createdAtIso:c.updatedAtIso,caseTitle:c.title};
  }
  async drain():Promise<void> {
    if(this.running)return;this.running=true;
    try {
      await this.repository.ready();
      for(const c of this.repository.cases()) {
        const work=c.feedbackWork;if(!work||c.baseGroupId!==COMMUNITY_BASE_GROUP_ID)continue;
        const feedback=[...(c.feedback??[])];
        for(const provider of work.providers)for(const viewer of work.reviewers) {
          if(viewer===provider.accountId)continue;
          const id=`${c.id}:${provider.accountId}:${viewer}`;
          if(!feedback.some(r=>r.id===id))feedback.push({id,baseGroupId:COMMUNITY_BASE_GROUP_ID,caseId:c.id,caseTitle:work.caseTitle,serviceId:provider.serviceId,
            providerAccountId:provider.accountId,viewerAccountId:viewer,status:'pending',criteria:{},average:null,comment:'',createdAtIso:work.createdAtIso,submittedAtIso:null});
          this.notify(id,'service-feedback-ready',viewer,work.caseTitle,c.id);
        }
        this.repository.saveFeedback(c.id,feedback,null);
      }
      await this.repository.flush();
    } finally {this.running=false;}
  }
  private async actor(id:string,signal?:AbortSignal) {await this.waitForRouteDelay('/community-cases',signal);await this.repository.ready();signal?.throwIfAborted();return this.access.actor(id);}
  private rows():ServiceFeedback[] {return this.repository.cases().filter(c=>c.baseGroupId===COMMUNITY_BASE_GROUP_ID).flatMap(c=>c.feedback??[]);}
  async page(userId:string,query:ListQuery<{bucket:ServiceFeedbackBucket}>,signal?:AbortSignal) {
    const actor=await this.actor(userId,signal),bucket=query.filters?.bucket??'pending';
    if(!['pending','feedbacked','removed','received'].includes(bucket))throw new Error('Invalid feedback bucket');
    const all=this.rows(),matches=(r:ServiceFeedback,b:string)=>b==='received'?r.providerAccountId===actor&&r.status==='feedbacked':r.viewerAccountId===actor&&r.status===b;
    const rows=all.filter(r=>matches(r,bucket)).sort((a,b)=>b.createdAtIso.localeCompare(a.createdAtIso)||a.id.localeCompare(b.id));
    const page=Number(query.cursor??0),size=Math.max(1,Math.min(50,query.pageSize));if(!Number.isSafeInteger(page)||page<0)throw new Error('Invalid cursor');
    const items=rows.slice(page*size,(page+1)*size).map(feedback=>({feedback:structuredClone(feedback),providerName:this.users.queryUserById(feedback.providerAccountId)?.name??'',reviewerName:this.users.queryUserById(feedback.viewerAccountId)?.name??''}));
    return {items,total:rows.length,nextCursor:(page+1)*size<rows.length?String(page+1):null,context:Object.fromEntries(['pending','feedbacked','removed','received'].map(b=>[b,all.filter(r=>matches(r,b)).length]))};
  }
  async action(id:string,command:ServiceFeedbackCommand):Promise<void> {
    const actor=await this.actor(command.userId),row=this.rows().find(r=>r.id===id&&r.viewerAccountId===actor);if(!row)throw new Error('Feedback not found');
    let next:ServiceFeedback;
    if(command.action==='submit'&&row.status==='pending') {
      const criteria=command.criteria??{},keys=SERVICE_RATING_CRITERIA.criteria.map(c=>c.id),comment=command.comment??'';
      if(Object.keys(criteria).length!==keys.length||keys.some(k=>!Number.isInteger(criteria[k])||criteria[k]<1||criteria[k]>10)||comment.length>160)throw new Error('Invalid feedback');
      next={...row,status:'feedbacked',criteria:{...criteria},average:keys.reduce((n,k)=>n+criteria[k],0)/keys.length,comment:comment.trim(),submittedAtIso:new Date().toISOString()};
    } else if(command.action==='remove'&&row.status==='pending')next={...row,status:'removed'};
    else if(command.action==='restore'&&row.status==='removed')next={...row,status:'pending'};
    else throw new Error('Feedback changed');
    const c=this.repository.findCase(row.caseId)!;
    this.repository.saveFeedback(c.id,(c.feedback??[]).map(r=>r.id===id?next:r),c.feedbackWork??null);
    if(command.action==='submit')this.notify(id,'service-feedback-submitted',row.providerAccountId,row.caseTitle,row.caseId);
    await this.repository.flush();
  }
  async stats(userId:string,provider:string,signal?:AbortSignal) {
    await this.actor(userId,signal);const rows=this.rows().filter(r=>r.providerAccountId===provider&&r.status==='feedbacked');
    return {count:rows.length,average:rows.length?rows.reduce((n,r)=>n+(r.average??0),0)/rows.length:0,
      criteria:Object.fromEntries(SERVICE_RATING_CRITERIA.criteria.map(c=>[c.id,rows.length?rows.reduce((n,r)=>n+r.criteria[c.id],0)/rows.length:0]))};
  }
  private notify(id:string,kind:string,actor:string,title:string,caseId:string):void {
    if(!this.users.queryUserById(`group:${COMMUNITY_BASE_GROUP_ID}:${actor}`))return;
    this.notifications.append([{id:`${kind}:${id}`,recipientUserId:`group:${COMMUNITY_BASE_GROUP_ID}:${actor}`,kind,category:'scheduled',title,message:title,createdAtIso:new Date().toISOString(),sourceType:'service-feedback',sourceId:id,
      actionPath:`/game?serviceFeedback=true&workspaceGroupId=${COMMUNITY_BASE_GROUP_ID}`,payload:{workspaceGroupId:COMMUNITY_BASE_GROUP_ID,caseId,notification_message_key:`notification.kind.${kind}.message`}}]);
  }
}
