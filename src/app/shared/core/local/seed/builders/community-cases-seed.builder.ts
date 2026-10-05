import cases from '../data/community-cases.json';
import tasks from '../data/community-scheduled-tasks.json';
import type { UserRecord } from '../../source/entity/user.entity';
import type { CommunityCaseRecord, CommunityTaskRecord } from '../../source/entity/community-case.entity';
import { COMMUNITY_BASE_GROUP_ID } from '../../../contracts/group-type';

export class SeedCommunityCasesBuilder {
  static build(users: readonly UserRecord[]): { cases: CommunityCaseRecord[]; tasks: CommunityTaskRecord[] } {
    const byName = new Map(users.filter(u => !u.workspaceGroupId).map(u => [u.name, u.id]));
    const account = (name: string): string => { const id = byName.get(name); if (!id) throw new Error(`Missing Community actor: ${name}`); return id; };
    const common = { baseGroupId: COMMUNITY_BASE_GROUP_ID, createdAtIso: '2026-10-05T00:00:00.000Z', updatedAtIso: '2026-10-05T00:00:00.000Z', version: 0 };
    return {
      cases: cases.map(({ ownerName, audienceNames, participantNames, attentionNames, support, memberStatuses, chatNames, boardTasks, offers, ...row }) => ({ ...row, ...common,
        ownerAccountId: account(ownerName), audienceAccountIds: audienceNames.map(account), participantAccountIds: participantNames.map(account),
        attentionAccountIds: attentionNames.map(account), support: support.map(({ name, ...s }) => ({ ...s, accountId: account(name) })),
        memberStates: Object.fromEntries(Object.entries(memberStatuses).map(([name,status])=>[account(name),status])),
        chatAccountIds: chatNames.map(account),
        boardTasks: boardTasks.map(({assigneeNames,...task})=>({...task,assigneeAccountIds:assigneeNames.map(account)})),
        recommendations: [], offers: offers.map(({providerName,...offer})=>({...offer,providerAccountId:account(providerName)})), scheduledTaskId: null, dueAtIso: null
      } as CommunityCaseRecord)),
      tasks: tasks.map(({ ownerName, audienceNames, ...row }) => ({ ...row, ...common,
        ownerAccountId: account(ownerName), audienceAccountIds: audienceNames.map(account)
      } as CommunityTaskRecord))
    };
  }
}
