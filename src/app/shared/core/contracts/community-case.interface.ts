import type { ListQuery, PageResult } from './list.interface';
import type { EventPolicyDTO } from './event.interface';
export const CASE_TYPES = ['fault', 'maintenance', 'meter-replacement', 'chimney-sweep', 'renovation', 'other'] as const;
export type CaseType = typeof CASE_TYPES[number];
export type CaseStatus = 'open' | 'in-progress' | 'completed' | 'cancelled' | 'trash';
export type CaseMembershipStatus = 'invited' | 'accepted' | 'declined' | 'left' | 'removed';
export type CaseBoardTaskStatus = 'todo' | 'in-progress' | 'done' | 'deleted';
export interface CaseBoardTask { id: string; title: string; description: string; status: CaseBoardTaskStatus; assigneeAccountIds: string[]; dependsOnIds: string[]; offerIds?: string[]; startAtIso: string | null; endAtIso: string | null; }
export interface CaseMember { status: CaseMembershipStatus; accountId: string; name: string; avatarUrl: string | null; gender: 'woman' | 'man'; }
export interface CaseSupport { accountId: string; serviceId: string | null; status: 'invited' | 'accepted' | 'declined'; }
export interface CaseRecommendation { providerName?: string; recommenderName?: string; accountId: string; providerAccountId: string; serviceId: string | null; }
export interface CaseOffer { id: string; providerAccountId: string; serviceId: string | null; amount: number; currency: string; note: string; workPolicy?: string; refundPolicy?: string; workPolicies?: EventPolicyDTO[]; refundPolicies?: EventPolicyDTO[]; status: 'pending' | 'accepted' | 'rejected'; createdAtIso: string; }
export interface CaseFields { communityId: string | null; title: string; description: string; caseType: CaseType; audienceAll: boolean; audienceAccountIds: string[]; }
export interface CommunityCase extends CaseFields {
  id: string; communityName: string; ownerAccountId: string | null; status: CaseStatus; affectedCount: number;
  members: CaseMember[]; support: CaseSupport[]; recommendations: CaseRecommendation[]; offers: CaseOffer[];
  boardTasks: CaseBoardTask[]; membershipStatus: CaseMembershipStatus | null; canReviewOffers: boolean; canChat: boolean; chatAccountIds: string[];
  canManage: boolean; canTakeOver: boolean; unread: boolean; scheduledTaskId: string | null; dueAtIso: string | null;
  createdAtIso: string; updatedAtIso: string; version: number;
}
export interface SaveCommunityCase extends CaseFields { userId: string; id?: string; version?: number; }
export type CaseAction = 'take-over' | 'start' | 'complete' | 'cancel' | 'trash' | 'reopen' | 'recommend' | 'invite-provider' | 'accept-invite' | 'decline-invite' | 'offer' | 'edit-offer' | 'accept-offer' | 'reject-offer' | 'pending-offer' | 'join' | 'decline' | 'leave' | 'invite-members' | 'remove-member' | 'invite-chat' | 'save-board-task' | 'delete-board-task';
export interface CaseCommand { userId: string; action: CaseAction; version: number; memberAccountIds?: string[]; task?: CaseBoardTask; taskId?: string; providerAccountId?: string; serviceId?: string | null; offerId?: string; amount?: number; currency?: string; note?: string; workPolicy?: string; refundPolicy?: string; workPolicies?: EventPolicyDTO[]; refundPolicies?: EventPolicyDTO[]; }
export interface CaseFilters { status?: CaseStatus | 'active'; caseType?: CaseType | null; }
/** Item totals over the entire visible collection, independent of the current page/filter. */
export interface CaseListContext { total: number; [bucketAndType: string]: number; }
export type ScheduledTaskStatus = 'active' | 'paused' | 'trash';
export type ScheduledTaskAction = 'pause' | 'resume' | 'trash' | 'restore';
export interface ScheduledTaskFilters { status?: ScheduledTaskStatus; }
export interface ScheduledTaskCounters { total: number; active: number; paused: number; trash: number; }
export type TaskFrequency = 'once' | 'monthly' | 'quarterly' | 'yearly';
export interface ScheduledTaskFields extends CaseFields { startAtIso: string; nextDueAtIso: string; frequency: TaskFrequency; enabled: boolean; }
export interface CommunityScheduledTask extends ScheduledTaskFields { id: string; status: ScheduledTaskStatus; canManage: boolean; communityName: string; affectedCount: number; createdAtIso: string; updatedAtIso: string; version: number; }
export interface SaveCommunityScheduledTask extends ScheduledTaskFields { userId: string; id?: string; version?: number; }
export interface ICommunityCasesService {
  page(userId: string, query: ListQuery<CaseFilters>, signal?: AbortSignal): Promise<PageResult<CommunityCase, CaseListContext>>;
  detail(userId: string, id: string, signal?: AbortSignal): Promise<CommunityCase>;
  save(request: SaveCommunityCase): Promise<CommunityCase>;
  action(id: string, request: CaseCommand): Promise<CommunityCase>;
  read(userId: string, id: string): Promise<CommunityCase>;
  tasks(userId: string, query: ListQuery<ScheduledTaskFilters>, signal?: AbortSignal): Promise<PageResult<CommunityScheduledTask, ScheduledTaskCounters>>;
  saveTask(request: SaveCommunityScheduledTask): Promise<CommunityScheduledTask>;
  taskAction(userId: string, id: string, action: ScheduledTaskAction, version: number): Promise<CommunityScheduledTask>;
}
