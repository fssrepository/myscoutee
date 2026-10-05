import type { ListQuery, PageResult } from './list.interface';
export type ServiceFeedbackBucket = 'pending' | 'feedbacked' | 'removed' | 'received';
export interface ServiceFeedback {
  id:string; baseGroupId:string; caseId:string; caseTitle:string; serviceId:string|null;
  providerAccountId:string; viewerAccountId:string; status:Exclude<ServiceFeedbackBucket,'received'>;
  criteria:Record<string,number>; average:number|null; comment:string; createdAtIso:string; submittedAtIso:string|null;
}
export interface ServiceFeedbackItem { feedback:ServiceFeedback; providerName:string; reviewerName:string; }
export interface ServiceFeedbackCommand { userId:string; action:'submit'|'remove'|'restore'; criteria?:Record<string,number>; comment?:string; }
export interface ServiceFeedbackStats { count:number; average:number; criteria:Record<string,number>; }
export interface IServiceFeedbackService {
  page(userId:string,query:ListQuery<{bucket:ServiceFeedbackBucket}>,signal?:AbortSignal):Promise<PageResult<ServiceFeedbackItem,Record<string,number>>>;
  action(id:string,command:ServiceFeedbackCommand):Promise<void>;
  stats(userId:string,provider:string,signal?:AbortSignal):Promise<ServiceFeedbackStats>;
}
