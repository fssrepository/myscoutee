import { Injectable, inject } from '@angular/core';

import { AppUtils } from '../../../../app-utils';
import { ActivityResourceBuilder } from '../../../base/builders';
import type { UserDto } from '../../../contracts/user.interface';
import type { ActivityMemberRecord } from '../entity/activity.entity';
import type { NotificationRecord } from '../entity/notification.entity';
import { LocalRouteDelayService } from './route-delay.service';
import { LocalActivityMembersRepository } from '../repositories/activity-members.repository';
import { LocalAssetsRepository } from '../repositories/assets.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalEventCheckoutBasketsRepository } from '../repositories/event-checkout-baskets.repository';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { LocalAssetTicketsRepository } from '../repositories/asset-tickets.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import {
  LocalActivityMembersBuilder,
  LocalUsersMapper,
  type ActivityMemberProfileFallback,
  type LocalActivityMembersOwnerSnapshot
} from '../mappers';
import { LocalUserRealtimeSnapshotBuilder } from '../builders';
import type {
  ActivityMemberActionResultDTO,
  ActivityMemberDTO,
  ActivityMemberOwnerRef,
  ActivityMemberSyncKnownItemDTO,
  ActivityMembersQueryOptions,
  ActivityMembersSyncResultDTO,
  ActivityMembersSummaryDto
} from '../../../contracts/activity.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalActivityMembersService extends LocalRouteDelayService {
  private static readonly MEMBERS_ROUTE = '/activities/events/members';
  private readonly activityMembersRepository = inject(LocalActivityMembersRepository);
  private readonly assetsRepository = inject(LocalAssetsRepository);
  private readonly localUsersRepository = inject(LocalUsersRepository);
  private readonly eventsRepository = inject(LocalEventsRepository);
  private readonly eventCheckoutBasketsRepository = inject(LocalEventCheckoutBasketsRepository);
  private readonly notificationsRepository = inject(LocalNotificationsRepository);
  private readonly chatsRepository = inject(LocalChatsRepository);
  private readonly assetTicketsRepository = inject(LocalAssetTicketsRepository);

  peekMembersByOwner(owner: ActivityMemberOwnerRef): ActivityMemberDTO[] {
    return this.entriesFromRecords(this.activityMembersRepository.peekRecordsByOwner(owner), owner);
  }

  async queryMembersByOwner(
    owner: ActivityMemberOwnerRef,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityMemberDTO[]> {
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    return this.loadMembersByOwner(owner, options);
  }

  async syncMembersByOwner(
    owner: ActivityMemberOwnerRef,
    knownItems: readonly ActivityMemberSyncKnownItemDTO[],
    options?: ActivityMembersQueryOptions,
    signal?: AbortSignal
  ): Promise<ActivityMembersSyncResultDTO> {
    this.throwIfAborted(signal);
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    this.throwIfAborted(signal);
    const current = await this.loadMembersByOwner(owner, options);
    const currentById = new Map(current.map(member => [member.id, member] as const));
    const knownRevisionsById = new Map(knownItems
      .map(item => [`${item.id ?? ''}`.trim(), `${item.revision ?? ''}`] as const)
      .filter(([id]) => id.length > 0));
    const upserts = current.filter(member => {
      const knownRevision = knownRevisionsById.get(member.id);
      return knownRevision === undefined || knownRevision !== this.memberRevision(member);
    });
    const removedIds = [...knownRevisionsById.keys()].filter(id => !currentById.has(id));
    return {
      upserts,
      removedIds,
      total: current.length
    };
  }

  async loadMembersByOwner(
    owner: ActivityMemberOwnerRef,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityMemberDTO[]> {
    const scopedAssetMembers = this.scopedAssetMembers(owner, options);
    if (scopedAssetMembers) {
      return LocalActivityMembersBuilder.sortEntriesForManagement(scopedAssetMembers);
    }
    return this.entriesFromRecords(await this.activityMembersRepository.queryRecordsByOwner(owner, options), owner);
  }

  peekSummaryByOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummaryDto | null {
    return this.summaryFromOwner(owner);
  }

  async querySummariesByOwners(owners: readonly ActivityMemberOwnerRef[]): Promise<ActivityMembersSummaryDto[]> {
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    return this.activityMembersRepository.normalizeOwners(owners)
      .map(owner => this.summaryFromOwner(owner))
      .filter((summary): summary is ActivityMembersSummaryDto => Boolean(summary));
  }

  async replaceMembersByOwner(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityMemberDTO[],
    capacityTotal?: number | null,
    actorUserId = '',
    options?: ActivityMembersQueryOptions
  ): Promise<void> {
    const normalizedOwner = this.activityMembersRepository.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return;
    }
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    void actorUserId;
    const previousRecords = this.activityMembersRepository.peekRecordsByOwner(normalizedOwner);
    const previousMembers = this.entriesFromRecords(previousRecords, normalizedOwner);
    const existingRecordsById = new Map(previousRecords.map(record => [record.id, record] as const));
    const records = members.map(member => LocalActivityMembersBuilder.toRecord(
      normalizedOwner,
      member,
      existingRecordsById.get(member.id) ?? null
    ));
    const ownerSnapshot = this.ownerSnapshotFromOwner(normalizedOwner);
    this.activityMembersRepository.replaceRecordsByOwner(
      normalizedOwner,
      records,
      capacityTotal ?? ownerSnapshot?.capacityTotal ?? null
    );
    if (normalizedOwner.ownerType === 'event') {
      await this.finalizeNewlyAcceptedEventReservations(normalizedOwner, previousMembers, members);
      this.assetTicketsRepository.synchronizeForEvent(normalizedOwner.ownerId);
    }
    if (normalizedOwner.ownerType === 'group') {
      this.eventsRepository.syncTournamentStagePending(
        `${options?.eventId ?? ''}`.trim(),
        `${options?.subEventId ?? ''}`.trim()
      );
    }
  }

  async applyMemberAction(
    owner: ActivityMemberOwnerRef,
    actorUserId: string,
    targetUserId: string,
    action: 'accept' | 'remove' | 'disqualify' | 'reinstate' | 'promote-admin' | 'step-down-admin',
    reason?: string | null,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityMemberActionResultDTO> {
    const members = await this.applyMemberActionEntries(
      owner,
      actorUserId,
      targetUserId,
      action,
      reason,
      options
    );
    const actor = this.localUsersRepository.queryUserById(actorUserId.trim());
    return {
      members,
      counterOverrides: actor
        ? LocalUserRealtimeSnapshotBuilder.menuCountersForUser(LocalUsersMapper.toDto(actor))
        : null
    };
  }

  private async applyMemberActionEntries(
    owner: ActivityMemberOwnerRef,
    actorUserId: string,
    targetUserId: string,
    action: 'accept' | 'remove' | 'disqualify' | 'reinstate' | 'promote-admin' | 'step-down-admin',
    reason?: string | null,
    options?: ActivityMembersQueryOptions
  ): Promise<ActivityMemberDTO[]> {
    await this.waitForRouteDelay(LocalActivityMembersService.MEMBERS_ROUTE);
    void reason;
    const normalizedOwner = this.activityMembersRepository.normalizeOwnerRef(owner);
    const normalizedTargetUserId = targetUserId.trim();
    if (!normalizedOwner || !normalizedTargetUserId) {
      return normalizedOwner ? this.peekMembersByOwner(normalizedOwner) : [];
    }

    const previousRecords = this.activityMembersRepository.peekRecordsByOwner(normalizedOwner);
    const previousMembers = this.entriesFromRecords(previousRecords, normalizedOwner);
    const normalizedActorUserId = actorUserId.trim();
    const targetMember = previousMembers.find(member => member.userId === normalizedTargetUserId) ?? null;
    const actorCanManage = this.canManageOwnerMembers(
      normalizedOwner,
      previousMembers,
      normalizedActorUserId,
      options
    );
    const targetIsInvitation = targetMember?.status === 'pending'
      && this.isInvitation(targetMember);
    const actorOwnsInvitation = targetIsInvitation
      && targetMember?.invitedByUserId?.trim() === normalizedActorUserId;
    const actorIsInvitee = targetIsInvitation
      && normalizedActorUserId === normalizedTargetUserId;
    const targetIsApprovalRequest = targetMember?.status === 'pending'
      && !targetIsInvitation;
    const removingOwnAcceptedMembership = action === 'remove'
      && targetMember?.status === 'accepted'
      && normalizedActorUserId === normalizedTargetUserId
      && targetMember.role !== 'Admin'
      && targetMember.role !== 'Manager';
    const withdrawingOwnApprovalRequest = action === 'remove'
      && targetIsApprovalRequest
      && normalizedActorUserId === normalizedTargetUserId;
    const actionAllowed = action === 'accept'
      ? (
        (actorIsInvitee && targetIsInvitation)
        || (actorCanManage && targetIsApprovalRequest)
      )
      : action === 'remove'
        ? (
          actorIsInvitee
          || actorOwnsInvitation
          || (actorCanManage && !targetIsInvitation)
          || removingOwnAcceptedMembership
          || withdrawingOwnApprovalRequest
        )
        : actorCanManage;
    if (!targetMember || !actionAllowed) {
      return previousMembers;
    }
    if (normalizedOwner.ownerType === 'event'
        && action === 'accept'
        && targetIsApprovalRequest
        && this.eventsRepository.isTournamentAdmissionLocked(normalizedOwner.ownerId)) {
      throw new Error('event.tournament.registration.closed.message');
    }

    const nowIso = AppUtils.toIsoDateTime(new Date());
    const nextMembers = previousMembers.map(member => {
      if (member.userId !== normalizedTargetUserId) {
        return member;
      }
      const acceptingOwnManagedInvitation = action === 'accept'
        && normalizedOwner.ownerType !== 'event'
        && normalizedActorUserId === normalizedTargetUserId
        && this.isInvitation(member);
      if (acceptingOwnManagedInvitation
          && !this.canManageOwnerMembers(
            normalizedOwner,
            previousMembers,
            member.invitedByUserId?.trim() ?? '',
            options
          )) {
        return {
          ...member,
          status: 'pending' as const,
          pendingSource: 'member' as const,
          requestKind: 'approval' as const,
          invitedByActiveUser: false,
          actionAtIso: nowIso
        };
      }
      if (action === 'accept' && member.status === 'pending'
          && (
            member.requestKind === 'join'
            || member.requestKind === 'approval'
            || acceptingOwnManagedInvitation
          )) {
        return {
          ...member,
          status: 'accepted' as const,
          pendingSource: null,
          requestKind: null,
          invitedByUserId: null,
          invitedByActiveUser: false,
          actionAtIso: nowIso
        };
      }
      if (action === 'remove') {
        return null;
      }
      if (action === 'disqualify' && member.status === 'accepted') {
        return {
          ...member,
          status: 'disqualified' as const,
          pendingSource: null,
          requestKind: null,
          invitedByUserId: null,
          invitedByActiveUser: false,
          actionAtIso: nowIso
        };
      }
      if (action === 'reinstate' && member.status === 'disqualified') {
        return {
          ...member,
          status: 'accepted' as const,
          pendingSource: null,
          requestKind: null,
          invitedByUserId: null,
          invitedByActiveUser: false,
          actionAtIso: nowIso
        };
      }
      if (action === 'promote-admin' && member.status === 'accepted' && member.role !== 'Admin') {
        return {
          ...member,
          role: 'Admin' as const,
          actionAtIso: nowIso
        };
      }
      if (action === 'step-down-admin'
          && member.status === 'accepted'
          && (member.role === 'Admin' || member.role === 'Manager')) {
        return {
          ...member,
          role: 'Member' as const,
          actionAtIso: nowIso
        };
      }
      return member;
    }).filter((member): member is ActivityMemberDTO => member !== null);
    const changed = nextMembers.length !== previousMembers.length
      || nextMembers.some((member, index) =>
        member.status !== previousMembers[index]?.status
        || member.role !== previousMembers[index]?.role
        || member.pendingSource !== previousMembers[index]?.pendingSource
        || member.requestKind !== previousMembers[index]?.requestKind
        || member.invitedByUserId !== previousMembers[index]?.invitedByUserId);
    if (!changed) {
      return previousMembers;
    }

    const previousRecordsById = new Map(previousRecords.map(record => [record.id, record] as const));
    const nextRecords = nextMembers.map(member => LocalActivityMembersBuilder.toRecord(
      normalizedOwner,
      member,
      previousRecordsById.get(member.id) ?? null
    ));
    const ownerSnapshot = this.ownerSnapshotFromOwner(normalizedOwner);
    this.activityMembersRepository.replaceRecordsByOwner(
      normalizedOwner,
      nextRecords,
      ownerSnapshot?.capacityTotal ?? null
    );
    if (normalizedOwner.ownerType === 'event') {
      if (action === 'remove' && targetMember.status === 'accepted') {
        this.removeGeneratedTournamentRoomParticipation(
          normalizedOwner.ownerId,
          targetMember,
          nowIso
        );
      } else if (
        (action === 'disqualify' && targetMember.status === 'accepted')
        || (action === 'reinstate' && targetMember.status === 'disqualified')
      ) {
        this.updateGeneratedTournamentRoomParticipationStatus(
          normalizedOwner.ownerId,
          targetMember,
          action,
          nowIso
        );
      }
      const refreshedEvent = this.eventsRepository.synchronizeEventMemberProjection(normalizedOwner.ownerId);
      this.synchronizeEventCountersForUsers([
        ...previousMembers.map(member => member.userId),
        ...nextMembers.map(member => member.userId),
        normalizedActorUserId
      ]);
      await this.finalizeNewlyAcceptedEventReservations(normalizedOwner, previousMembers, nextMembers);
      this.assetTicketsRepository.synchronizeForMemberChange(
        normalizedOwner.ownerId,
        normalizedTargetUserId
      );
      if (action === 'accept' && targetIsApprovalRequest && actorCanManage) {
        this.appendMemberApprovedNotification(
          normalizedOwner.ownerId,
          normalizedTargetUserId,
          normalizedActorUserId,
          nowIso
        );
      }
      const systemMessage = this.eventMembershipSystemMessage(
        action,
        targetMember,
        nextMembers.find(member => member.userId === normalizedTargetUserId) ?? null,
        normalizedActorUserId
      );
      if (refreshedEvent && systemMessage) {
        this.chatsRepository.syncPublishedMainEventChat(refreshedEvent);
        this.chatsRepository.appendEventSystemMessage(
          normalizedOwner.ownerId,
          systemMessage.text,
          systemMessage.kind,
          nowIso
        );
      }
      if (refreshedEvent && action === 'remove' && targetMember.status === 'accepted') {
        this.appendEventMemberRemovedNotifications(
          refreshedEvent,
          targetMember,
          normalizedActorUserId,
          nextMembers.filter(member => member.status === 'accepted'),
          nowIso
        );
      } else if (
        refreshedEvent
        && (
          (action === 'disqualify' && targetMember.status === 'accepted')
          || (action === 'reinstate' && targetMember.status === 'disqualified')
        )
      ) {
        this.appendEventMemberStatusChangedNotifications(
          refreshedEvent,
          targetMember,
          action,
          normalizedActorUserId,
          nextMembers.filter(member => member.status === 'accepted'),
          nowIso
        );
      }
    }
    if (
      normalizedOwner.ownerType === 'event'
      && action === 'remove'
      && targetIsInvitation
    ) {
      this.notificationsRepository.markUnreadBySource(
        normalizedTargetUserId,
        'event-invite',
        'event',
        normalizedOwner.ownerId
      );
    }
    if (normalizedOwner.ownerType === 'group') {
      this.eventsRepository.syncTournamentStagePending(
        `${options?.eventId ?? ''}`.trim(),
        `${options?.subEventId ?? ''}`.trim()
      );
    }
    return this.entriesFromRecords(nextRecords, normalizedOwner);
  }

  private removeGeneratedTournamentRoomParticipation(
    parentEventId: string,
    removedMember: ActivityMemberDTO,
    removedAtIso: string
  ): void {
    const rooms = this.eventsRepository.queryGeneratedTournamentRoomsByParent(parentEventId);
    if (rooms.length === 0) {
      return;
    }
    const removedRoomRecords = this.activityMembersRepository.markAcceptedEventMembersRemoved(
      rooms.map(room => room.id),
      removedMember.userId,
      removedAtIso
    );
    if (removedRoomRecords.length === 0) {
      return;
    }
    const affectedRoomIds = new Set(removedRoomRecords.map(record => record.ownerId.trim()).filter(Boolean));
    const removedUser = this.localUsersRepository.queryUserById(removedMember.userId);
    const removedMemberName = `${removedUser?.name ?? removedMember.name ?? removedMember.userId}`.trim();
    for (const room of rooms.filter(candidate => affectedRoomIds.has(candidate.id))) {
      const refreshedRoom = this.eventsRepository.synchronizeEventMemberProjection(room.id) ?? room;
      this.chatsRepository.syncPublishedMainEventChat(refreshedRoom);
      this.chatsRepository.appendEventSystemMessage(
        room.id,
        `${removedMemberName} was removed from the tournament group.`,
        'member-removed',
        removedAtIso
      );
    }
  }

  private updateGeneratedTournamentRoomParticipationStatus(
    parentEventId: string,
    member: ActivityMemberDTO,
    action: 'disqualify' | 'reinstate',
    changedAtIso: string
  ): void {
    const rooms = this.eventsRepository.queryGeneratedTournamentRoomsByParent(parentEventId);
    if (rooms.length === 0) {
      return;
    }
    const expectedStatus = action === 'disqualify' ? 'accepted' : 'disqualified';
    const nextStatus = action === 'disqualify' ? 'disqualified' : 'accepted';
    const changedRoomRecords = this.activityMembersRepository.updateEventMemberStatus(
      rooms.map(room => room.id),
      member.userId,
      expectedStatus,
      nextStatus,
      changedAtIso
    );
    if (changedRoomRecords.length === 0) {
      return;
    }
    const affectedRoomIds = new Set(changedRoomRecords.map(record => record.ownerId.trim()).filter(Boolean));
    const user = this.localUsersRepository.queryUserById(member.userId);
    const memberName = `${user?.name ?? member.name ?? member.userId}`.trim();
    const actionText = action === 'disqualify' ? 'disqualified from' : 'reinstated to';
    for (const room of rooms.filter(candidate => affectedRoomIds.has(candidate.id))) {
      this.eventsRepository.synchronizeEventMemberProjection(room.id);
      this.chatsRepository.appendEventSystemMessage(
        room.id,
        `${memberName} was ${actionText} the tournament group.`,
        `member-${action}`,
        changedAtIso
      );
    }
  }

  private appendEventMemberRemovedNotifications(
    event: { id: string; title: string },
    removedMember: ActivityMemberDTO,
    actorUserId: string,
    remainingMembers: readonly ActivityMemberDTO[],
    removedAtIso: string
  ): void {
    const removedUser = this.localUsersRepository.queryUserById(removedMember.userId);
    const actor = this.localUsersRepository.queryUserById(actorUserId);
    const memberName = `${removedUser?.name ?? removedMember.name ?? removedMember.userId}`.trim();
    const eventTitle = `${event.title ?? event.id}`.trim() || event.id;
    const occurrenceId = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const commonPayload = {
      eventId: event.id,
      parentEventId: event.id,
      eventTitle,
      eventScope: 'members',
      memberUserId: removedMember.userId,
      memberName,
      membershipAction: 'removed',
      senderUserId: actorUserId,
      removedAtIso,
      removalOccurrenceId: occurrenceId,
      notification_tone: 'warning'
    };
    const notifications: NotificationRecord[] = [];
    if (removedMember.userId !== actorUserId) {
      notifications.push({
        id: `event-member-removed:${event.id}:${removedMember.userId}:${occurrenceId}:target`,
        recipientUserId: removedMember.userId,
        kind: 'event-member-removed',
        category: 'event',
        title: eventTitle,
        message: `You were removed from ${eventTitle}.`,
        createdAtIso: removedAtIso,
        readAtIso: null,
        senderUserId: actorUserId || null,
        senderName: actor?.name ?? null,
        senderAvatarUrl: actor?.images?.[0] ?? null,
        actionPath: '/game',
        sourceType: 'event',
        sourceId: event.id,
        payload: { ...commonPayload, recipientRole: 'removed-member' }
      });
    }
    for (const participant of remainingMembers.filter(member =>
      member.userId !== actorUserId && member.userId !== removedMember.userId)) {
      notifications.push({
        id: `event-member-removed:${event.id}:${removedMember.userId}:${occurrenceId}:participant:${participant.userId}`,
        recipientUserId: participant.userId,
        kind: 'event-member-removed',
        category: 'event',
        title: eventTitle,
        message: `${memberName} was removed from ${eventTitle}.`,
        createdAtIso: removedAtIso,
        readAtIso: null,
        senderUserId: actorUserId || null,
        senderName: actor?.name ?? null,
        senderAvatarUrl: actor?.images?.[0] ?? null,
        actionPath: '/game',
        sourceType: 'event',
        sourceId: event.id,
        payload: { ...commonPayload, recipientRole: 'event-participant' }
      });
    }
    this.notificationsRepository.append(notifications);
  }

  private appendEventMemberStatusChangedNotifications(
    event: { id: string; title: string },
    member: ActivityMemberDTO,
    action: 'disqualify' | 'reinstate',
    actorUserId: string,
    activeMembers: readonly ActivityMemberDTO[],
    changedAtIso: string
  ): void {
    const user = this.localUsersRepository.queryUserById(member.userId);
    const actor = this.localUsersRepository.queryUserById(actorUserId);
    const memberName = `${user?.name ?? member.name ?? member.userId}`.trim();
    const eventTitle = `${event.title ?? event.id}`.trim() || event.id;
    const occurrenceId = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const membershipAction = action === 'disqualify' ? 'disqualified' : 'reinstated';
    const actionText = action === 'disqualify' ? 'disqualified from' : 'reinstated to';
    const kind = `event-member-${membershipAction}`;
    const commonPayload = {
      eventId: event.id,
      parentEventId: event.id,
      eventTitle,
      eventScope: 'members',
      memberUserId: member.userId,
      memberName,
      membershipAction,
      senderUserId: actorUserId,
      changedAtIso,
      membershipOccurrenceId: occurrenceId,
      notification_tone: action === 'disqualify' ? 'warning' : 'success'
    };
    const notifications: NotificationRecord[] = [];
    if (member.userId !== actorUserId) {
      notifications.push({
        id: `${kind}:${event.id}:${member.userId}:${occurrenceId}:target`,
        recipientUserId: member.userId,
        kind,
        category: 'event',
        title: eventTitle,
        message: `You were ${actionText} ${eventTitle}.`,
        createdAtIso: changedAtIso,
        readAtIso: null,
        senderUserId: actorUserId || null,
        senderName: actor?.name ?? null,
        senderAvatarUrl: actor?.images?.[0] ?? null,
        actionPath: '/game',
        sourceType: 'event',
        sourceId: event.id,
        payload: { ...commonPayload, recipientRole: 'affected-member' }
      });
    }
    for (const participant of activeMembers.filter(candidate =>
      candidate.userId !== actorUserId && candidate.userId !== member.userId)) {
      notifications.push({
        id: `${kind}:${event.id}:${member.userId}:${occurrenceId}:participant:${participant.userId}`,
        recipientUserId: participant.userId,
        kind,
        category: 'event',
        title: eventTitle,
        message: `${memberName} was ${actionText} ${eventTitle}.`,
        createdAtIso: changedAtIso,
        readAtIso: null,
        senderUserId: actorUserId || null,
        senderName: actor?.name ?? null,
        senderAvatarUrl: actor?.images?.[0] ?? null,
        actionPath: '/game',
        sourceType: 'event',
        sourceId: event.id,
        payload: { ...commonPayload, recipientRole: 'event-participant' }
      });
    }
    this.notificationsRepository.append(notifications);
  }

  private synchronizeEventCountersForUsers(userIds: readonly string[]): void {
    for (const userId of [...new Set(userIds.map(id => id.trim()).filter(Boolean))]) {
      const user = this.localUsersRepository.queryUserById(userId);
      if (!user) {
        continue;
      }
      const counters = this.eventsRepository.queryUserEventCounterSnapshot(userId);
      this.localUsersRepository.upsertUser({
        ...user,
        activities: {
          ...user.activities,
          events: counters.events,
          invitations: counters.invitations,
          hosting: counters.hosting,
          event: { ...counters.event }
        }
      });
    }
  }

  private eventMembershipSystemMessage(
    action: 'accept' | 'remove' | 'disqualify' | 'reinstate' | 'promote-admin' | 'step-down-admin',
    previousMember: ActivityMemberDTO,
    nextMember: ActivityMemberDTO | null,
    actorUserId: string
  ): { text: string; kind: string } | null {
    const user = this.localUsersRepository.queryUserById(previousMember.userId);
    const displayName = `${user?.name ?? previousMember.name ?? previousMember.userId}`.trim();
    if (!displayName) {
      return null;
    }
    if (action === 'accept' && previousMember.status !== 'accepted' && nextMember?.status === 'accepted') {
      return { text: `${displayName} joined the event.`, kind: 'member-joined' };
    }
    if (action === 'remove' && previousMember.status === 'accepted' && !nextMember) {
      return previousMember.userId === actorUserId
        ? { text: `${displayName} left the event.`, kind: 'member-left' }
        : { text: `${displayName} was removed from the event.`, kind: 'member-removed' };
    }
    if (action === 'disqualify' && previousMember.status === 'accepted' && nextMember?.status === 'disqualified') {
      return { text: `${displayName} was disqualified from the event.`, kind: 'member-disqualify' };
    }
    if (action === 'reinstate' && previousMember.status === 'disqualified' && nextMember?.status === 'accepted') {
      return { text: `${displayName} was reinstated to the event.`, kind: 'member-reinstate' };
    }
    return null;
  }

  private appendMemberApprovedNotification(
    eventId: string,
    memberUserId: string,
    actorUserId: string,
    approvedAtIso: string
  ): void {
    const event = this.eventsRepository.peekKnownItemById(actorUserId, eventId);
    const eventTitle = `${event?.title ?? eventId}`.trim() || eventId;
    const actor = this.localUsersRepository.queryUserById(actorUserId);
    const occurrenceId = globalThis.crypto?.randomUUID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const record: NotificationRecord = {
      id: `event-member-approved:${eventId}:${memberUserId}:${occurrenceId}`,
      recipientUserId: memberUserId,
      kind: 'event-member-approved',
      category: 'event-admin',
      title: eventTitle,
      message: `Your request to join ${eventTitle} was approved.`,
      createdAtIso: approvedAtIso,
      readAtIso: null,
      senderUserId: actorUserId || null,
      senderName: actor?.name ?? null,
      senderAvatarUrl: actor?.images?.[0] ?? null,
      actionPath: '/game',
      sourceType: 'event',
      sourceId: eventId,
      payload: {
        eventId,
        eventTitle,
        eventScope: 'members',
        memberUserId,
        membershipAction: 'approved',
        senderUserId: actorUserId,
        approvedAtIso,
        notification_tone: 'success',
        notification_status_badge_fallback: 'Approved',
        notification_status_badge_tone: 'success'
      }
    };
    this.notificationsRepository.append([record]);
  }

  private async finalizeNewlyAcceptedEventReservations(
    owner: ActivityMemberOwnerRef,
    previousMembers: readonly ActivityMemberDTO[],
    nextMembers: readonly ActivityMemberDTO[]
  ): Promise<void> {
    if (owner.ownerType !== 'event') {
      return;
    }
    const previouslyAccepted = new Set(previousMembers
      .filter(member => member.status === 'accepted')
      .map(member => member.userId.trim())
      .filter(Boolean));
    const newlyAcceptedUserIds = [...new Set(nextMembers
      .filter(member => member.status === 'accepted')
      .map(member => member.userId.trim())
      .filter(userId => userId && !previouslyAccepted.has(userId)))];
    for (const userId of newlyAcceptedUserIds) {
      await this.eventCheckoutBasketsRepository.finalizeAcceptedReservation(userId, owner.ownerId);
    }
  }

  private canManageMembers(
    members: readonly ActivityMemberDTO[],
    userId: string
  ): boolean {
    const normalizedUserId = userId.trim();
    return normalizedUserId.length > 0 && members.some(member =>
      member.userId === normalizedUserId
      && member.status === 'accepted'
      && (member.role === 'Admin' || member.role === 'Manager')
    );
  }

  private canManageOwnerMembers(
    owner: ActivityMemberOwnerRef,
    members: readonly ActivityMemberDTO[],
    userId: string,
    options?: ActivityMembersQueryOptions
  ): boolean {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      return false;
    }
    if (this.canManageMembers(members, normalizedUserId)) {
      return true;
    }
    const eventId = `${options?.eventId ?? ''}`.trim().split(':slot:')[0];
    if (owner.ownerType === 'event' || !eventId) {
      return false;
    }
    const event = this.eventsRepository.peekKnownItemById(normalizedUserId, eventId);
    return event?.creatorUserId === normalizedUserId
      || (event?.adminIds ?? []).includes(normalizedUserId);
  }

  private isInvitation(member: ActivityMemberDTO): boolean {
    return member.requestKind === 'invite'
      || member.requestKind === 'waitlist-invite'
      || (member.requestKind == null && member.pendingSource === 'admin');
  }

  private entriesFromRecords(
    records: readonly ActivityMemberRecord[],
    owner?: ActivityMemberOwnerRef
  ): ActivityMemberDTO[] {
    const userIds = records.map(record => record.userId);
    const involvementRecordsByUserId = owner
      ? this.activityMembersRepository.queryInvolvementRecordsByOwnerAndUsers(owner, userIds)
      : new Map<string, ActivityMemberRecord[]>();
    return LocalActivityMembersBuilder.sortEntriesForManagement(
      records.map(record => LocalActivityMembersBuilder.toEntry(
        record,
        (userId, fallback) => this.resolveDemoUser(userId, fallback),
        involvementRecordsByUserId.get(record.userId.trim()) ?? []
      ))
    );
  }

  private summaryFromOwner(owner: ActivityMemberOwnerRef): ActivityMembersSummaryDto | null {
    const snapshot = this.ownerSnapshotFromOwner(owner);
    return snapshot ? LocalActivityMembersBuilder.ownerSnapshotToSummary(snapshot) : null;
  }

  private ownerSnapshotFromOwner(owner: ActivityMemberOwnerRef): LocalActivityMembersOwnerSnapshot | null {
    const normalizedOwner = this.activityMembersRepository.normalizeOwnerRef(owner);
    if (!normalizedOwner) {
      return null;
    }
    const records = this.activityMembersRepository.peekRecordsByOwner(normalizedOwner);
    const acceptedMembers = records.filter(record => record.status === 'accepted').length;
    const capacityTotal = this.activityMembersRepository.resolveOwnerCapacityTotal(normalizedOwner, acceptedMembers);
    return this.ownerSnapshotFromRecords(normalizedOwner, records, capacityTotal);
  }

  private ownerSnapshotFromRecords(
    owner: ActivityMemberOwnerRef,
    records: readonly ActivityMemberRecord[],
    capacityTotal?: number | null
  ): LocalActivityMembersOwnerSnapshot {
    return LocalActivityMembersBuilder.recordsToOwnerSnapshot(owner, records, capacityTotal);
  }

  private existingRecordsById(owner: ActivityMemberOwnerRef): ReadonlyMap<string, ActivityMemberRecord> {
    return new Map(this.activityMembersRepository.peekRecordsByOwner(owner).map(record => [record.id, record] as const));
  }

  private scopedAssetMembers(
    owner: ActivityMemberOwnerRef,
    options?: ActivityMembersQueryOptions
  ): ActivityMemberDTO[] | null {
    const eventId = `${options?.eventId ?? ''}`.trim();
    const subEventId = `${options?.subEventId ?? ''}`.trim();
    if (owner.ownerType !== 'asset' || !eventId || !subEventId) {
      return null;
    }
    const asset = this.assetsRepository.peekAssetForMembershipById(owner.ownerId);
    if (!asset) {
      return [];
    }
    const nowIso = AppUtils.toIsoDateTime(new Date());
    const users = this.localActivityMemberUsers;
    const ownerUserId = `${asset.ownerUserId ?? ''}`.trim();
    const storedManagersByUserId = new Map(
      this.activityMembersRepository.peekRecordsByOwner(owner)
        .filter(record => record.status === 'accepted' && (record.role === 'Manager' || record.role === 'Admin'))
        .map(record => [record.userId, record] as const)
    );
    const members: ActivityMemberDTO[] = [];
    if (options?.pendingOnly !== true && ownerUserId && !asset.ownerReleasedAtIso) {
      const profile = this.resolveDemoUser(ownerUserId, {
        name: asset.ownerName,
        city: asset.city
      });
      members.push({
        id: `${asset.id}:owner`,
        userId: profile.id,
        name: profile.name,
        initials: profile.initials,
        gender: profile.gender,
        city: profile.city || asset.city,
        statusText: 'Responsible manager for this asset.',
        role: 'Manager',
        status: 'accepted',
        pendingSource: null,
        requestKind: null,
        invitedByActiveUser: false,
        invitedByUserId: null,
        metAtIso: nowIso,
        actionAtIso: nowIso,
        metWhere: asset.title,
        avatarUrl: AppUtils.firstImageUrl(profile.images),
        profile
      });
    }

    const authorizationEventId = ActivityResourceBuilder.authorizationEventId(eventId, subEventId);
    const acceptedEventIds = new Set([eventId, authorizationEventId].filter(Boolean));
    for (const request of asset.requests ?? []) {
      const bookingEventId = `${request.booking?.eventId ?? ''}`.trim();
      const bookingSubEventId = `${request.booking?.subEventId ?? ''}`.trim();
      if (!acceptedEventIds.has(bookingEventId) || bookingSubEventId !== subEventId) {
        continue;
      }
      if (options?.pendingOnly === true && request.status !== 'pending') {
        continue;
      }
      const userId = AppUtils.resolveAssetRequestUserId(request, users);
      if (!userId || userId === ownerUserId) {
        continue;
      }
      const profile = this.resolveDemoUser(userId, {
        name: request.name,
        initials: request.initials,
        city: asset.city,
        gender: request.gender
      });
      const requestedAtIso = `${request.requestedAtIso ?? ''}`.trim() || nowIso;
      const pending = request.status === 'pending';
      const borrowerInitiated = request.requestKind === 'borrow';
      const managerRecord = pending ? null : storedManagersByUserId.get(userId) ?? null;
      members.push({
        id: request.id?.trim() || `${asset.id}:request:${userId}`,
        userId: profile.id,
        name: profile.name,
        initials: profile.initials,
        gender: profile.gender,
        city: profile.city || asset.city,
        statusText: pending
          ? (borrowerInitiated ? 'Waiting for admin approval.' : 'Invitation pending.')
          : 'Borrowing this asset.',
        role: managerRecord ? 'Manager' : 'Member',
        status: request.status,
        pendingSource: pending ? (borrowerInitiated ? 'member' : 'admin') : null,
        requestKind: pending ? (borrowerInitiated ? 'join' : 'invite') : null,
        invitedByActiveUser: false,
        invitedByUserId: null,
        metAtIso: managerRecord?.actionAtIso ?? requestedAtIso,
        actionAtIso: managerRecord?.actionAtIso ?? requestedAtIso,
        metWhere: asset.title,
        avatarUrl: AppUtils.firstImageUrl(profile.images),
        revision: managerRecord?.updatedAtIso ?? requestedAtIso,
        managerGrantedByUserId: managerRecord?.managerGrantedByUserId ?? null,
        profile
      });
    }
    return members;
  }

  private resolveDemoUser(userId: string, fallback: ActivityMemberProfileFallback): UserDto {
    const normalizedUserId = userId.trim();
    const fallbackName = fallback.name?.trim() || 'Unknown User';
    const fallbackInitials = fallback.initials?.trim() || AppUtils.initialsFromText(fallbackName);
    const fallbackCity = fallback.city?.trim() || '';
    const fallbackGender = fallback.gender ?? 'man';
    const demoUsers = this.localActivityMemberUsers;
    const byId = demoUsers.find(user => user.id === normalizedUserId);
    if (byId) {
      return byId;
    }
    const templateSeed = AppUtils.hashText(`${normalizedUserId}:${fallbackName}`);
    const template = demoUsers[templateSeed % demoUsers.length];
    return {
      ...(template ?? demoUsers[0]),
      id: normalizedUserId || template?.id || 'unknown-user',
      name: fallbackName || template?.name || 'Unknown User',
      initials: fallbackInitials || template?.initials || 'UN',
      city: fallbackCity || template?.city || '',
      gender: fallbackGender || template?.gender || 'man'
    };
  }

  private get localActivityMemberUsers(): UserDto[] {
    return (this.localUsersRepository.queryAllUsers() as UserDto[])
      .filter(user => user.id.trim().length > 0);
  }

  private memberRevision(member: ActivityMemberDTO): string {
    return `${member.revision ?? member.actionAtIso ?? member.id}`;
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (!signal?.aborted) {
      return;
    }
    const error = new Error('Request aborted.');
    error.name = 'AbortError';
    throw error;
  }
}
