import {
  Injectable,
  inject
} from '@angular/core';

import type {
  IActivityInviteCandidatesService,
  ActivityInviteOwnerContext,
  ActivityEventRecord
} from '../../contracts/activity.interface';
import {
  LocalActivityInviteCandidatesService
} from '../../local/source/services/activity-invite-candidates.service';
import {
  HttpActivityInviteCandidatesService
} from '../../http/services/activity-invite-candidates.service';
import {
  ActivityMembersService
} from './activity-members.service';
import {
  EventsService
} from './events.service';
import {
  BaseRouteModeService
} from './base-route-mode.service';
import {
  AppUtils
} from '../../../app-utils';
import type * as ActivityContracts from '../../contracts/activity.interface';

import type * as AppConstants from '../../common/constants';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';
const ACTIVITY_INVITE_CANDIDATES_ROUTE = '/activities/events/invite-candidates';

@Injectable({
  providedIn: 'root'
})
export class ActivityInviteCandidatesService extends BaseRouteModeService implements IActivityInviteCandidatesService {
  private readonly localActivityInviteCandidatesService = inject(LocalActivityInviteCandidatesService);
  private readonly httpActivityInviteCandidatesService = inject(HttpActivityInviteCandidatesService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventsService = inject(EventsService);
  private readonly userProfileStore = inject(UserProfileStore);
  private get inviteCandidatesService(): IActivityInviteCandidatesService {
    return this.resolveRouteService(
      ACTIVITY_INVITE_CANDIDATES_ROUTE,
      this.localActivityInviteCandidatesService,
      this.httpActivityInviteCandidatesService
    );
  }

  async queryCandidates(
    query: ActivityContracts.ActivityInviteCandidatesQuery
  ): Promise<ActivityContracts.ActivityInviteCandidatesPage> {
    return this.inviteCandidatesService.queryCandidates(query);
  }

  async queryCandidatesByOwner(
    ownerId: string,
    sort: AppConstants.ActivityInviteSort,
    fallbackTitle = 'Event',
    ownerType: AppConstants.ActivityMemberOwnerType = 'event',
    existingMemberUserIds: readonly string[] = [],
    pendingInviteUserIds: readonly string[] = [],
    parentOwner: ActivityContracts.ActivityMemberOwnerRef | null = null,
    page = 0,
    pageSize = 16
  ): Promise<ActivityContracts.ActivityInviteCandidatesPage> {
    const activeUserId = this.activeUserId();
    const normalizedOwnerId = ownerId.trim();
    if (!activeUserId || !normalizedOwnerId) {
      return { items: [], total: 0, page: 0, pageSize: Math.max(1, pageSize) };
    }
    const ownerRef: ActivityContracts.ActivityMemberOwnerRef = {
      ownerType,
      ownerId: normalizedOwnerId
    };
    const owner = this.resolveOwnerContext(activeUserId, ownerRef, fallbackTitle);
    const resolvedExistingMemberUserIds = existingMemberUserIds.length > 0
      ? [...new Set(existingMemberUserIds.map(userId => userId.trim()).filter(Boolean))]
      : [...new Set(this.activityMembersService.peekMembersByOwner(ownerRef).map(member => member.userId.trim()).filter(Boolean))];
    return this.inviteCandidatesService.queryCandidates({
      activeUserId,
      owner,
      parentOwner,
      existingMemberUserIds: resolvedExistingMemberUserIds,
      pendingInviteUserIds: [...new Set(pendingInviteUserIds.map(userId => userId.trim()).filter(Boolean))],
      sort,
      page,
      pageSize
    });
  }

  async applyInvites(
    ownerId: string,
    selectedCandidates: readonly ActivityContracts.ActivityMemberDTO[],
    ownerType: AppConstants.ActivityMemberOwnerType = 'event'
  ): Promise<void> {
    const normalizedOwnerId = ownerId.trim();
    const activeUserId = this.activeUserId();
    if (!normalizedOwnerId || !activeUserId || selectedCandidates.length === 0) {
      return;
    }
    const ownerRef: ActivityContracts.ActivityMemberOwnerRef = {
      ownerType,
      ownerId: normalizedOwnerId
    };
    const currentMembers = this.activityMembersService.peekMembersByOwner(ownerRef);
    const existingUserIds = new Set(currentMembers.map(member => member.userId));
    const nowIso = AppUtils.toIsoDateTime(new Date());
    const additions = selectedCandidates
      .filter(candidate => !existingUserIds.has(candidate.userId))
      .map(candidate => ({
        ...candidate,
        status: 'pending' as const,
        pendingSource: 'admin' as const,
        requestKind: 'invite' as const,
        invitedByActiveUser: true,
        actionAtIso: nowIso
      }));
    if (additions.length === 0) {
      return;
    }
    const summary = this.activityMembersService.peekSummaryByOwner(ownerRef);
    const ownerRecord = ownerType === 'event'
      ? (this.eventsService.peekKnownRecordById(activeUserId, normalizedOwnerId)
        ?? await this.eventsService.queryKnownRecordById(activeUserId, normalizedOwnerId))
      : null;
    const nextMembers = [...currentMembers, ...additions];
    await this.activityMembersService.replaceMembersByOwner(
      ownerRef,
      nextMembers,
      summary?.capacityTotal
        ?? ownerRecord?.capacityTotal
        ?? Math.max(nextMembers.filter(member => member.status === 'accepted').length, 0)
    );
  }

  private resolveOwnerContext(
    activeUserId: string,
    owner: ActivityContracts.ActivityMemberOwnerRef,
    fallbackTitle: string
  ): ActivityInviteOwnerContext {
    if (owner.ownerType !== 'event') {
      return {
        ownerId: owner.ownerId,
        ownerType: owner.ownerType,
        title: fallbackTitle,
        subtitle: this.ownerTypeLabel(owner.ownerType),
        detail: 'Members',
        dateIso: new Date().toISOString(),
        distanceKm: 0,
        sourceType: 'events',
        isAdmin: true
      };
    }
    const record = this.eventsService.peekKnownRecordById(activeUserId, owner.ownerId);
    if (!record) {
      return {
        ownerId: owner.ownerId,
        ownerType: owner.ownerType,
        title: fallbackTitle,
        subtitle: 'Event',
        detail: 'Members',
        dateIso: new Date().toISOString(),
        distanceKm: 0,
        sourceType: 'events',
        isAdmin: true
      };
    }
    return {
      ownerId: record.id,
      ownerType: 'event',
      title: record.title,
      subtitle: record.subtitle,
      detail: record.timeframe,
      dateIso: record.startAtIso,
      distanceKm: record.distanceKm,
      sourceType: record.type === 'hosting' ? 'hosting' : 'events',
      isAdmin: this.isEventAdminRecord(record)
    };
  }

  private isEventAdminRecord(record: ActivityEventRecord): boolean {
    const userId = `${record.userId ?? ''}`.trim();
    return !!userId && (
      record.creatorUserId === userId
      || (record.adminIds ?? []).some(adminId => `${adminId ?? ''}`.trim() === userId)
    );
  }

  private ownerTypeLabel(ownerType: AppConstants.ActivityMemberOwnerType): string {
    if (ownerType === 'asset') {
      return 'Asset';
    }
    if (ownerType === 'subEvent') {
      return 'Sub Event';
    }
    if (ownerType === 'group') {
      return 'Group';
    }
    return 'Event';
  }

  private activeUserId(): string {
    const activeUserId = this.userProfileStore.getActiveUserId().trim();
    if (activeUserId) {
      return activeUserId;
    }
    const session = this.sessionService.currentSession();
    if (session?.kind === 'demo') {
      return session.userId.trim();
    }
    return '';
  }
}
