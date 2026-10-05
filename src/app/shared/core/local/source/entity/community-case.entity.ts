import type { CaseFields, CaseStatus, CaseMembershipStatus, CaseBoardTask, CaseSupport, CaseRecommendation, CaseOffer, ScheduledTaskFields } from '../../../contracts/community-case.interface';
export const COMMUNITY_CASES_TABLE_NAME = 'serviceCases' as const;
export const COMMUNITY_TASKS_TABLE_NAME = 'communityScheduledTasks' as const;
export interface CommunityCaseFeedbackWork { reviewers:string[]; providers:CaseSupport[]; createdAtIso:string; caseTitle:string; }
export interface CommunityCaseRecord extends CaseFields {
  feedback?:import('../../../contracts/service-feedback.interface').ServiceFeedback[];
  feedbackWork?:CommunityCaseFeedbackWork|null;
  id: string; baseGroupId: string; ownerAccountId: string | null; status: CaseStatus;
  chatAccountIds?: string[];
  memberStates?: Record<string, CaseMembershipStatus>; boardTasks?: CaseBoardTask[];
  participantAccountIds: string[]; attentionAccountIds: string[]; support: CaseSupport[];
  recommendations: CaseRecommendation[]; offers: CaseOffer[]; scheduledTaskId: string | null; dueAtIso: string | null;
  createdAtIso: string; updatedAtIso: string; version: number;
}
export interface CommunityTaskRecord extends ScheduledTaskFields { deleted?: boolean; id: string; baseGroupId: string; ownerAccountId: string; createdAtIso: string; updatedAtIso: string; version: number; }
export interface CommunityCasesMemorySchema {
  [COMMUNITY_CASES_TABLE_NAME]: { byId: Record<string, CommunityCaseRecord>; ids: string[] };
  [COMMUNITY_TASKS_TABLE_NAME]: { byId: Record<string, CommunityTaskRecord>; ids: string[] };
}

export function caseMembershipStatus(c: CommunityCaseRecord, id: string): CaseMembershipStatus | null {
  if (!c.participantAccountIds.includes(id)) return null;
  return c.memberStates?.[id] ?? c.support.find(s => s.accountId === id)?.status ?? 'accepted';
}
export function activeCaseParticipantIds(c: CommunityCaseRecord): string[] {
  return c.participantAccountIds.filter(id => caseMembershipStatus(c, id) === 'accepted');
}
export function notifiedCaseParticipantIds(c: CommunityCaseRecord): string[] {
  return c.participantAccountIds.filter(id => ['accepted', 'invited'].includes(caseMembershipStatus(c, id) ?? ''));
}

/** Providers join the common channel only after an explicit chat invitation. */
export function caseChatParticipantIds(c: CommunityCaseRecord): string[] {
  return activeCaseParticipantIds(c).filter(id => !c.support.some(s => s.accountId === id)
    || c.audienceAccountIds.includes(id) || id === c.ownerAccountId || (c.chatAccountIds ?? []).includes(id));
}

/** Each quotation has its own group, with the residents and only that quotation's provider. */
export function caseOfferChatParticipantIds(c: CommunityCaseRecord, offerId: string): string[] {
  const offer = c.offers.find(o => o.id === offerId);
  if (!offer) return [];
  return activeCaseParticipantIds(c).filter(id => id === offer.providerAccountId || !c.support.some(s => s.accountId === id)
    || c.audienceAccountIds.includes(id) || id === c.ownerAccountId);
}

/** Taking responsibility is separate from accepting a case invitation. */
export function canTakeOverCase(c: CommunityCaseRecord, actor: string): boolean {
  return !c.ownerAccountId && c.status !== 'trash'
    && ['invited', 'accepted'].includes(caseMembershipStatus(c, actor) ?? '');
}
