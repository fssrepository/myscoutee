import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../../environments/environment';
import type * as AppTypes from '../../../app-types';
import type { ActivityInviteOwnerContext } from '../interfaces/activity-invite.interface';
import { DemoActivityInviteCandidatesService } from '../../demo/services/activity-invite-candidates.service';
import { HttpActivityInviteCandidatesService } from '../../http/services/activity-invite-candidates.service';
import { ActivityMembersService } from './activity-members.service';
import { AppContext } from '../context';
import { EventsService } from './events.service';
import { SessionService } from './session.service';
import { AppUtils } from '../../../app-utils';

@Injectable({
  providedIn: 'root'
})
export class ActivityInviteCandidatesService {
  private readonly demoActivityInviteCandidatesService = inject(DemoActivityInviteCandidatesService);
  private readonly httpActivityInviteCandidatesService = inject(HttpActivityInviteCandidatesService);
  private readonly activityMembersService = inject(ActivityMembersService);
  private readonly eventsService = inject(EventsService);
  private readonly appCtx = inject(AppContext);
  private readonly sessionService = inject(SessionService);

  private get demoModeEnabled(): boolean {
    return this.sessionService.currentSession()?.kind === 'demo' || !environment.loginEnabled;
  }

  private get inviteCandidatesService(): DemoActivityInviteCandidatesService | HttpActivityInviteCandidatesService {
    return this.demoModeEnabled ? this.demoActivityInviteCandidatesService : this.httpActivityInviteCandidatesService;
  }

  async queryCandidatesByOwner(
    ownerId: string,
    sort: AppTypes.ActivityInviteSort,
    fallbackTitle = 'Event'
  ): Promise<AppTypes.ActivityMemberEntry[]> {
    const activeUserId = this.activeUserId();
    const normalizedOwnerId = ownerId.trim();
    if (!activeUserId || !normalizedOwnerId) {
      return [];
    }
    const owner = await this.resolveOwnerContext(activeUserId, normalizedOwnerId, fallbackTitle);
    const existingMembers = await this.activityMembersService.queryMembersByOwnerId(normalizedOwnerId);
    return this.inviteCandidatesService.queryCandidates({
      activeUserId,
      owner,
      existingMemberUserIds: existingMembers.map(member => member.userId),
      sort
    });
  }

  async applyInvites(
    ownerId: string,
    selectedCandidates: readonly AppTypes.ActivityMemberEntry[]
  ): Promise<void> {
    const normalizedOwnerId = ownerId.trim();
    const activeUserId = this.activeUserId();
    if (!normalizedOwnerId || !activeUserId || selectedCandidates.length === 0) {
      return;
    }
    const currentMembers = await this.activityMembersService.queryMembersByOwnerId(normalizedOwnerId);
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
    const summary = await this.activityMembersService.querySummaryByOwnerId(normalizedOwnerId);
    const ownerRecord = this.eventsService.peekKnownItemById(activeUserId, normalizedOwnerId)
      ?? await this.eventsService.queryKnownItemById(activeUserId, normalizedOwnerId);
    const nextMembers = [...currentMembers, ...additions];
    await this.activityMembersService.replaceMembersByOwnerId(
      normalizedOwnerId,
      nextMembers,
      summary?.capacityTotal
        ?? ownerRecord?.capacityTotal
        ?? Math.max(nextMembers.filter(member => member.status === 'accepted').length, 0)
    );
  }

  private async resolveOwnerContext(
    activeUserId: string,
    ownerId: string,
    fallbackTitle: string
  ): Promise<ActivityInviteOwnerContext> {
    const record = this.eventsService.peekKnownItemById(activeUserId, ownerId)
      ?? await this.eventsService.queryKnownItemById(activeUserId, ownerId);
    if (!record) {
      return {
        ownerId,
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
      title: record.title,
      subtitle: record.subtitle,
      detail: record.timeframe,
      dateIso: record.startAtIso,
      distanceKm: record.distanceKm,
      sourceType: record.type === 'hosting' ? 'hosting' : 'events',
      isAdmin: record.isAdmin
    };
  }

  private activeUserId(): string {
    const activeUserId = this.appCtx.getActiveUserId().trim();
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
