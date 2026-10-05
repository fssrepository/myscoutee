import type { CommunityCase, CommunityScheduledTask } from '../../../contracts/community-case.interface';
import { caseMembershipStatus, caseChatParticipantIds, canTakeOverCase } from '../entity/community-case.entity';
import type { CommunityCaseRecord, CommunityTaskRecord } from '../entity/community-case.entity';
import type { UserRecord } from '../entity/user.entity';
export class LocalCommunityCaseMapper {
  static toDto(c: CommunityCaseRecord, actor: string, canManage: boolean, groupName: string, people: readonly UserRecord[]): CommunityCase {
    const { baseGroupId: _base, participantAccountIds: _participants, attentionAccountIds: _attention, memberStates: _states, ...fields } = structuredClone(c);
    const canReviewOffers = canManage || caseMembershipStatus(c,actor) === 'accepted';
    return { ...fields, chatAccountIds: [...(c.chatAccountIds ?? [])], canChat: caseChatParticipantIds(c).includes(actor), boardTasks: structuredClone(c.boardTasks ?? []), membershipStatus: caseMembershipStatus(c,actor), canReviewOffers, offers: canReviewOffers ? structuredClone(c.offers) : [], communityName: groupName, affectedCount: c.audienceAccountIds.length, canManage, canTakeOver: canTakeOverCase(c,actor),
      recommendations:c.recommendations.map(r=>({...r,providerName:people.find(u=>u.id===r.providerAccountId)?.name??'',recommenderName:people.find(u=>u.id===r.accountId)?.name??''})),
      unread: c.attentionAccountIds.includes(actor), members: people.filter(u=>c.participantAccountIds.includes(u.id)).map(u => ({ accountId: u.id, name: u.name, avatarUrl: u.images?.[0] ?? null, gender: u.gender, status: caseMembershipStatus(c,u.id)! })) };
  }
  static task(t: CommunityTaskRecord, groupName: string, affectedCount: number, canManage: boolean): CommunityScheduledTask {
    const { baseGroupId: _base, ownerAccountId: _owner, ...fields } = structuredClone(t);
    return { ...fields, communityName: groupName, status: t.deleted ? 'trash' : t.enabled ? 'active' : 'paused', affectedCount, canManage, startAtIso: t.startAtIso ?? t.nextDueAtIso };
  }
}
