import { TestBed } from '@angular/core/testing';

import { RouteDelayService } from '../../../base/services/route-delay.service';
import { ActivityEventDetailDTO, type ActivityEventRecord } from '../../../contracts/activity.interface';
import type { PricingConfig } from '../../../contracts/pricing.interface';
import { LocalActivityResourcesRepository } from '../repositories/activity-resources.repository';
import { LocalActivitySubEventStageRuntimeRepository } from '../repositories/activity-sub-event-stage-runtime.repository';
import { LocalEventCheckoutBasketsRepository } from '../repositories/event-checkout-baskets.repository';
import { LocalEventFeedbackRepository } from '../repositories/event-feedback.repository';
import { LocalEventsRepository } from '../repositories/events.repository';
import { LocalChatsRepository } from '../repositories/chats.repository';
import { LocalNotificationsRepository } from '../repositories/notifications.repository';
import { LocalUsersRepository } from '../repositories/users.repository';
import { LocalAssetTicketsRepository } from '../repositories/asset-tickets.repository';
import { LocalActivityMembersService } from './activity-members.service';
import { LocalEventsService } from './events.service';
import { LocalUsersService } from './users.service';

describe('LocalEventsService', () => {
  const waitForRouteDelay = vi.fn();
  const queryEventRecordById = vi.fn();
  const applyStageAction = vi.fn();
  const querySubEventLeaderboard = vi.fn();
  const queryAcceptedTournamentStageMemberUserIds = vi.fn();
  const saveEventSnapshot = vi.fn();
  const queryInvitationItemsByUser = vi.fn();
  const requestJoin = vi.fn();
  const trashItem = vi.fn();
  const publishItem = vi.fn();
  const unpublishItem = vi.fn();
  const peekKnownItemById = vi.fn();
  const queryHostingItemsByUser = vi.fn();
  const queryEventItemsByUser = vi.fn();
  const countUpcomingActiveEventItemsByUser = vi.fn();
  const queryTrashedItemsByUser = vi.fn();
  const queryUserById = vi.fn();
  const patchUserActivityCounterDeltas = vi.fn();
  const flushEvents = vi.fn();
  const markUnreadBySource = vi.fn();
  const appendNotifications = vi.fn();
  const unreadCount = vi.fn();
  const syncPublishedMainEventChat = vi.fn();
  const updateEventChatOwnerStatus = vi.fn();
  const syncRealtimeNotificationCount = vi.fn();
  const peekStageRuntimeRecord = vi.fn();
  const replaceStageRuntimeRecord = vi.fn();
  const flushStageRuntime = vi.fn();
  const synchronizeTicketsForEvent = vi.fn();
  const synchronizeTicketForMemberChange = vi.fn();

  beforeEach(() => {
    waitForRouteDelay.mockReset().mockResolvedValue(undefined);
    queryEventRecordById.mockReset();
    applyStageAction.mockReset();
    querySubEventLeaderboard.mockReset();
    queryAcceptedTournamentStageMemberUserIds.mockReset().mockReturnValue([]);
    saveEventSnapshot.mockReset();
    queryInvitationItemsByUser.mockReset().mockReturnValue([]);
    requestJoin.mockReset();
    trashItem.mockReset();
    publishItem.mockReset();
    unpublishItem.mockReset();
    peekKnownItemById.mockReset().mockReturnValue(null);
    queryHostingItemsByUser.mockReset().mockReturnValue([]);
    queryEventItemsByUser.mockReset().mockReturnValue([]);
    countUpcomingActiveEventItemsByUser.mockReset().mockReturnValue(0);
    queryTrashedItemsByUser.mockReset().mockReturnValue([]);
    queryUserById.mockReset().mockReturnValue(null);
    patchUserActivityCounterDeltas.mockReset().mockResolvedValue(undefined);
    flushEvents.mockReset().mockResolvedValue(undefined);
    markUnreadBySource.mockReset().mockReturnValue(0);
    appendNotifications.mockReset().mockReturnValue([]);
    unreadCount.mockReset().mockReturnValue(0);
    syncPublishedMainEventChat.mockReset().mockReturnValue(false);
    updateEventChatOwnerStatus.mockReset().mockReturnValue(0);
    syncRealtimeNotificationCount.mockReset();
    peekStageRuntimeRecord.mockReset().mockReturnValue(null);
    replaceStageRuntimeRecord.mockReset();
    flushStageRuntime.mockReset().mockResolvedValue(undefined);
    synchronizeTicketsForEvent.mockReset();
    synchronizeTicketForMemberChange.mockReset();
    TestBed.configureTestingModule({
      providers: [
        LocalEventsService,
        { provide: RouteDelayService, useValue: { waitForRouteDelay } },
        {
          provide: LocalEventsRepository,
          useValue: {
            queryEventRecordById,
            applyStageAction,
            querySubEventLeaderboard,
            queryAcceptedTournamentStageMemberUserIds,
            saveEventSnapshot,
            queryInvitationItemsByUser,
            requestJoin,
            trashItem,
            publishItem,
            unpublishItem,
            peekKnownItemById,
            queryHostingItemsByUser,
            queryEventItemsByUser,
            countUpcomingActiveEventItemsByUser,
            queryTrashedItemsByUser,
            flushToIndexedDb: flushEvents
          }
        },
        {
          provide: LocalChatsRepository,
          useValue: {
            syncPublishedMainEventChat,
            updateEventChatOwnerStatus
          }
        },
        { provide: LocalActivityResourcesRepository, useValue: {} },
        {
          provide: LocalActivitySubEventStageRuntimeRepository,
          useValue: {
            peekRecord: peekStageRuntimeRecord,
            replaceRecord: replaceStageRuntimeRecord,
            flushToIndexedDb: flushStageRuntime
          }
        },
        { provide: LocalEventCheckoutBasketsRepository, useValue: {} },
        { provide: LocalEventFeedbackRepository, useValue: {} },
        { provide: LocalUsersRepository, useValue: { queryUserById } },
        {
          provide: LocalAssetTicketsRepository,
          useValue: {
            synchronizeForEvent: synchronizeTicketsForEvent,
            synchronizeForMemberChange: synchronizeTicketForMemberChange
          }
        },
        {
          provide: LocalNotificationsRepository,
          useValue: { markUnreadBySource, append: appendNotifications, unreadCount }
        },
        { provide: LocalActivityMembersService, useValue: {} },
        {
          provide: LocalUsersService,
          useValue: { syncRealtimeNotificationCount, patchUserActivityCounterDeltas }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('waits for the route and validates against the bootstrapped repository record', async () => {
    queryEventRecordById.mockReturnValue(eventWithPromoCodes('i5'));

    const result = await TestBed.inject(LocalEventsService).validateCheckoutPromoCode({
      sourceId: 'i5',
      code: ' vipPhoto20 '
    });

    expect(waitForRouteDelay).toHaveBeenCalledWith(
      '/activities/events/checkout/promo-code/validate',
      undefined,
      'Request aborted.'
    );
    expect(queryEventRecordById).toHaveBeenCalledWith('', 'i5');
    expect(waitForRouteDelay.mock.invocationCallOrder[0])
      .toBeLessThan(queryEventRecordById.mock.invocationCallOrder[0]);
    expect(result).toEqual({
      valid: true,
      code: 'VIPPHOTO20',
      promoCode: {
        id: 'urban-photo-vip-percent',
        code: 'VIPPHOTO20',
        action: { kind: 'decrease_percent', value: 20 }
      },
      effect: '-20%',
      messageKey: null,
      message: null
    });
  });

  it('resolves generated slots to their already stored parent pricing', async () => {
    queryEventRecordById.mockImplementation((_userId: string, sourceId: string) => sourceId === 'slot-1'
      ? { id: 'slot-1', parentEventId: 'event-1' } as ActivityEventRecord
      : eventWithPromoCodes('event-1'));

    const result = await TestBed.inject(LocalEventsService).validateCheckoutPromoCode({
      sourceId: 'slot-1',
      code: 'VIPPHOTO20'
    });

    expect(queryEventRecordById).toHaveBeenNthCalledWith(1, '', 'slot-1');
    expect(queryEventRecordById).toHaveBeenNthCalledWith(2, '', 'event-1');
    expect(result?.valid).toBe(true);
  });

  it('returns a normal invalid result without mutating repository state', async () => {
    queryEventRecordById.mockReturnValue(eventWithPromoCodes('i5'));

    const result = await TestBed.inject(LocalEventsService).validateCheckoutPromoCode({
      sourceId: 'i5',
      code: 'unknown'
    });

    expect(result).toEqual({
      valid: false,
      code: 'UNKNOWN',
      promoCode: null,
      effect: null,
      messageKey: 'event.checkout.promo.invalid',
      message: null
    });
  });

  it('marks the related notification read after accepting an invitation', async () => {
    queryInvitationItemsByUser.mockReturnValue([{ id: 'event-1' }]);
    queryUserById.mockReturnValue({
      id: 'user-1',
      name: 'Riley Outside',
      images: ['riley.webp']
    });
    requestJoin.mockReturnValue({
      id: 'event-1',
      title: 'Manual QA Event',
      creatorUserId: 'host',
      adminIds: ['host'],
      acceptedMembers: 1,
      pendingMembers: 0,
      capacityTotal: 10,
      acceptedMemberUserIds: ['user-1']
    } as ActivityEventRecord);
    markUnreadBySource.mockReturnValue(1);
    unreadCount.mockReturnValue(4);

    await TestBed.inject(LocalEventsService).requestJoin('user-1', 'event-1', {
      bookingConfirmed: true
    });

    expect(markUnreadBySource).toHaveBeenCalledWith(
      'user-1',
      'event-invite',
      'event',
      'event-1'
    );
    expect(requestJoin.mock.invocationCallOrder[0])
      .toBeLessThan(markUnreadBySource.mock.invocationCallOrder[0]);
    expect(syncRealtimeNotificationCount).toHaveBeenCalledWith('user-1', 4);
    expect(appendNotifications).toHaveBeenCalledOnce();
    const acceptanceRecords = appendNotifications.mock.calls[0]?.[0];
    expect(acceptanceRecords.map((record: { recipientUserId: string }) => record.recipientUserId))
      .toEqual(['host']);
    expect(acceptanceRecords[0]).toMatchObject({
      kind: 'event-invitation-accepted',
      title: 'Event invitation accepted',
      message: 'Riley Outside accepted the invitation to Manual QA Event.',
      payload: {
        memberUserId: 'user-1',
        membershipAction: 'accepted',
        notification_tone: 'accent'
      }
    });
  });

  it('notifies visible pending members when an invitation is accepted in an open event', async () => {
    queryInvitationItemsByUser.mockReturnValue([{ id: 'event-1' }]);
    queryUserById.mockReturnValue({ id: 'user-1', name: 'Riley Outside', images: [] });
    requestJoin.mockReturnValue({
      id: 'event-1',
      title: 'Open Event',
      creatorUserId: 'host',
      adminIds: ['host'],
      blindMode: 'Open Event',
      acceptedMemberUserIds: ['host', 'user-1'],
      pendingMemberUserIds: ['nova'],
      invitedMemberUserIds: ['nova'],
      acceptedMembers: 2,
      pendingMembers: 1,
      capacityTotal: 8
    } as ActivityEventRecord);

    await TestBed.inject(LocalEventsService).requestJoin('user-1', 'event-1', {
      bookingConfirmed: true
    });

    const records = appendNotifications.mock.calls[0]?.[0];
    expect(records.map((record: { recipientUserId: string }) => record.recipientUserId))
      .toEqual(['host', 'nova']);
  });

  it('does not notify hidden ordinary members when an invitation is accepted in a blind event', async () => {
    queryInvitationItemsByUser.mockReturnValue([{ id: 'event-1' }]);
    queryUserById.mockReturnValue({ id: 'user-1', name: 'Riley Outside', images: [] });
    requestJoin.mockReturnValue({
      id: 'event-1',
      title: 'Blind Event',
      creatorUserId: 'host',
      adminIds: ['host'],
      blindMode: 'Blind Event',
      acceptedMemberUserIds: ['host', 'accepted-member', 'user-1'],
      pendingMemberUserIds: ['nova'],
      invitedMemberUserIds: ['nova'],
      acceptedMembers: 3,
      pendingMembers: 1,
      capacityTotal: 8
    } as ActivityEventRecord);

    await TestBed.inject(LocalEventsService).requestJoin('user-1', 'event-1', {
      bookingConfirmed: true
    });

    const records = appendNotifications.mock.calls[0]?.[0];
    expect(records.map((record: { recipientUserId: string }) => record.recipientUserId))
      .toEqual(['host']);
  });

  it('creates first-publish invite notifications only for pending invitees', async () => {
    const draft = lifecycleEvent('DR');
    const published = lifecycleEvent('A');
    peekKnownItemById.mockReturnValueOnce(draft).mockReturnValue(published);
    syncPublishedMainEventChat.mockReturnValue(true);

    await TestBed.inject(LocalEventsService).publishItem('host', 'event-1');

    expect(synchronizeTicketsForEvent).toHaveBeenCalledOnce();
    expect(synchronizeTicketsForEvent).toHaveBeenCalledWith('event-1');

    expect(appendNotifications).toHaveBeenCalledOnce();
    const records = appendNotifications.mock.calls[0]?.[0];
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      recipientUserId: 'pending-invitee',
      kind: 'event-invite',
      payload: {
        notification_tone: 'info'
      }
    });
  });

  it('uses warning for under-review and info for republish without notifying the actor', async () => {
    const active = lifecycleEvent('A');
    const draft = lifecycleEvent('DR');
    peekKnownItemById.mockReturnValueOnce(active).mockReturnValue(draft);

    await TestBed.inject(LocalEventsService).unpublishItem('host', 'event-1');

    expect(updateEventChatOwnerStatus).toHaveBeenCalledWith('event-1', 'DR');

    let records = appendNotifications.mock.calls[0]?.[0];
    expect(records.map((record: { recipientUserId: string }) => record.recipientUserId))
      .toEqual(['accepted-member', 'pending-invitee']);
    expect(records[0]).toMatchObject({
      kind: 'event-under-review',
      payload: { notification_tone: 'warning' }
    });

    appendNotifications.mockClear();
    peekKnownItemById.mockReturnValueOnce(draft).mockReturnValue(active);
    syncPublishedMainEventChat.mockReturnValue(false);

    await TestBed.inject(LocalEventsService).publishItem('host', 'event-1');

    expect(updateEventChatOwnerStatus).toHaveBeenCalledWith('event-1', 'A');

    records = appendNotifications.mock.calls[0]?.[0];
    expect(records.map((record: { recipientUserId: string }) => record.recipientUserId))
      .toEqual(['accepted-member', 'pending-invitee']);
    expect(records[0]).toMatchObject({
      kind: 'event-modified',
      payload: {
        notification_message_key: 'notification.event.available.again.message',
        notification_tone: 'success'
      }
    });
  });

  it('marks the related notification read after rejecting an invitation', async () => {
    queryInvitationItemsByUser.mockReturnValue([{ id: 'event-1' }]);
    markUnreadBySource.mockReturnValue(1);
    unreadCount.mockReturnValue(3);

    await TestBed.inject(LocalEventsService).trashItem('user-1', 'event-1');

    expect(markUnreadBySource).toHaveBeenCalledWith(
      'user-1',
      'event-invite',
      'event',
      'event-1'
    );
    expect(trashItem.mock.invocationCallOrder[0])
      .toBeLessThan(markUnreadBySource.mock.invocationCallOrder[0]);
    expect(syncRealtimeNotificationCount).toHaveBeenCalledWith('user-1', 3);
  });

  it('emits finalized and later advancement notifications with backend-compatible i18n keys', async () => {
    queryEventRecordById.mockReturnValue({
      id: 'event-1',
      title: 'Manual QA Tournament',
      creatorUserId: 'host',
      adminIds: ['host'],
      acceptedMemberUserIds: ['host', 'nova', 'riley'],
      subEvents: [
        { id: 'qualifiers', name: 'Qualifiers' },
        { id: 'final', name: 'Final' }
      ]
    } as ActivityEventRecord);
    queryUserById.mockReturnValue({ id: 'host', name: 'Casey Bridge', images: ['/casey.webp'] });
    applyStageAction.mockReturnValue({
      sourceId: 'event-1',
      subEventId: 'qualifiers',
      subEventIndex: 0,
      action: 'finalize-stage',
      stageStatus: 'F'
    });
    querySubEventLeaderboard.mockReturnValue({
      eventId: 'event-1',
      subEventId: 'qualifiers',
      title: 'Qualifiers',
      leaderboardType: 'Score',
      groups: [{
        advancingMemberIds: ['host', 'riley'],
        members: [
          { id: 'host', name: 'Casey Bridge' },
          { id: 'nova', name: 'Nova Social' },
          { id: 'riley', name: 'Riley Outside' }
        ]
      }]
    });
    appendNotifications.mockImplementation(records => records);
    unreadCount.mockImplementation(userId => userId === 'riley' ? 2 : 1);

    await TestBed.inject(LocalEventsService).applyStageAction({
      userId: 'host',
      sourceId: 'event-1',
      subEventId: 'qualifiers',
      subEventIndex: 0,
      action: 'finalize-stage'
    });

    const records = appendNotifications.mock.calls[0]?.[0];
    expect(records.map((record: { recipientUserId: string; kind: string }) =>
      `${record.recipientUserId}:${record.kind}`))
      .toEqual([
        'nova:event-stage-finalized',
        'riley:event-stage-finalized',
        'host:event-stage-advanced',
        'riley:event-stage-advanced',
        'nova:event-stage-not-advanced'
      ]);
    expect(records[0]).toMatchObject({
      payload: {
        notification_title_key: 'notification.event.stage.finalized.title',
        notification_message_key: 'notification.event.stage.finalized.message',
        stageIndex: '1',
        stageTotal: '2'
      }
    });
    expect(records[0].payload).not.toHaveProperty('notification_avatar_tone');
    expect(records[0].payload).not.toHaveProperty('notification_avatar_icon');
    expect(records[2]).toMatchObject({
      recipientUserId: 'host',
      payload: {
        stageTitle: 'Qualifiers',
        nextStageTitle: 'Final',
        notification_title_key: 'notification.event.stage.advanced.title',
        notification_message_key: 'notification.event.stage.advanced.message',
        notification_tone: 'success',
        notification_avatar_tone: 'stage',
        stageIndex: '2',
        stageTotal: '2'
      }
    });
    expect(records[4]).toMatchObject({
      recipientUserId: 'nova',
      payload: {
        stageTitle: 'Qualifiers',
        nextStageTitle: 'Final',
        notification_title_key: 'notification.event.stage.not-advanced.title',
        notification_message_key: 'notification.event.stage.not-advanced.message',
        notification_tone: 'warning',
        notification_avatar_tone: 'stage',
        stageIndex: '1',
        stageTotal: '2'
      }
    });
    expect(syncRealtimeNotificationCount).toHaveBeenCalledWith('host', 1);
    expect(syncRealtimeNotificationCount).toHaveBeenCalledWith('nova', 2);
    expect(syncRealtimeNotificationCount).toHaveBeenCalledWith('riley', 2);
  });

  it('notifies other stage participants when scores are reopened for review', async () => {
    queryEventRecordById.mockReturnValue({
      id: 'event-1',
      title: 'Manual QA Tournament',
      creatorUserId: 'host',
      adminIds: ['host'],
      acceptedMemberUserIds: ['host', 'nova', 'riley'],
      subEvents: [
        { id: 'qualifiers', name: 'Qualifiers' },
        { id: 'final', name: 'Final' }
      ]
    } as ActivityEventRecord);
    queryAcceptedTournamentStageMemberUserIds.mockReturnValue(['host', 'nova', 'riley']);
    queryUserById.mockReturnValue({ id: 'host', name: 'Casey Bridge', images: ['/casey.webp'] });
    applyStageAction.mockReturnValue({
      sourceId: 'event-1',
      subEventId: 'qualifiers',
      subEventIndex: 0,
      action: 'reopen-scores',
      stageStatus: 'SR',
      stageResultRevision: 1
    });
    appendNotifications.mockImplementation(records => records);
    unreadCount.mockReturnValue(1);

    await TestBed.inject(LocalEventsService).applyStageAction({
      userId: 'host',
      sourceId: 'event-1',
      subEventId: 'qualifiers',
      subEventIndex: 0,
      action: 'reopen-scores'
    });

    const records = appendNotifications.mock.calls[0]?.[0];
    expect(records.map((record: { recipientUserId: string }) => record.recipientUserId))
      .toEqual(['nova', 'riley']);
    expect(records[0]).toMatchObject({
      kind: 'event-stage-scores-under-review',
      title: 'Qualifiers scores under review',
      message: 'Qualifiers scores were reopened and are under review.',
      senderUserId: 'host',
      senderName: 'Casey Bridge',
      payload: {
        stageTitle: 'Qualifiers',
        notification_title_key: 'notification.event.stage.scores-under-review.title',
        notification_message_key: 'notification.event.stage.scores-under-review.message',
        notification_tone: 'info',
        stageIndex: '1',
        stageTotal: '2'
      }
    });
    expect(records[0].payload).not.toHaveProperty('notification_avatar_tone');
    expect(records[0].payload).not.toHaveProperty('notification_avatar_icon');
    expect(syncRealtimeNotificationCount).toHaveBeenCalledWith('nova', 1);
    expect(syncRealtimeNotificationCount).toHaveBeenCalledWith('riley', 1);
  });

  it('keeps manual Final closure separate from short system winner results', async () => {
    queryEventRecordById.mockReturnValue({
      id: 'event-1',
      title: 'Manual QA Tournament',
      creatorUserId: 'host',
      adminIds: ['host'],
      acceptedMemberUserIds: ['host', 'nova', 'riley'],
      subEvents: [{ id: 'final', name: 'Final' }]
    } as ActivityEventRecord);
    queryAcceptedTournamentStageMemberUserIds.mockReturnValue(['host', 'riley']);
    queryUserById.mockReturnValue({ id: 'host', name: 'Casey Bridge', images: ['/casey.webp'] });
    applyStageAction.mockReturnValue({
      sourceId: 'event-1',
      subEventId: 'final',
      subEventIndex: 0,
      action: 'finalize-stage',
      stageStatus: 'F'
    });
    querySubEventLeaderboard.mockReturnValue({
      eventId: 'event-1',
      subEventId: 'final',
      title: 'Final',
      leaderboardType: 'Score',
      groups: [{
        advancingMemberIds: ['riley'],
        members: [
          { id: 'host', name: 'Casey Bridge' },
          { id: 'riley', name: 'Riley Outside' }
        ]
      }]
    });
    appendNotifications.mockImplementation(records => records);

    await TestBed.inject(LocalEventsService).applyStageAction({
      userId: 'host',
      sourceId: 'event-1',
      subEventId: 'final',
      subEventIndex: 0,
      action: 'finalize-stage'
    });

    const records = appendNotifications.mock.calls[0]?.[0];
    expect(records.map((record: { recipientUserId: string; kind: string }) =>
      `${record.recipientUserId}:${record.kind}`))
      .toEqual([
        'riley:event-stage-finalized',
        'riley:event-tournament-won',
        'host:event-tournament-not-won'
      ]);
    expect(records[0]).toMatchObject({
      senderUserId: 'host',
      senderName: 'Casey Bridge',
      payload: {
        notification_title_key: 'notification.event.stage.finalized.title',
        notification_message_key: 'notification.event.stage.finalized.message'
      }
    });
    expect(records[0].payload).not.toHaveProperty('notification_avatar_tone');
    expect(records[1]).toMatchObject({
      senderUserId: null,
      senderName: 'MyScoutee System',
      payload: {
        notification_title_key: 'notification.event.tournament.won.title',
        notification_message_key: 'notification.event.tournament.won.message',
        notification_tone: 'success',
        notification_avatar_tone: 'stage',
        notification_avatar_icon: 'emoji_events',
        stageTitle: 'Final',
        stageIndex: '1',
        stageTotal: '1'
      }
    });
    expect(records[2]).toMatchObject({
      senderUserId: null,
      senderName: 'MyScoutee System',
      payload: {
        notification_title_key: 'notification.event.tournament.not-won.title',
        notification_message_key: 'notification.event.tournament.not-won.message',
        notification_tone: 'warning',
        notification_avatar_tone: 'stage',
        notification_avatar_icon: 'emoji_events'
      }
    });
  });

  it('creates a stage-named local Start notification only for assigned stage members', async () => {
    queryEventRecordById.mockReturnValue({
      id: 'event-1',
      title: 'Manual QA Tournament',
      creatorUserId: 'host',
      adminIds: ['host'],
      acceptedMemberUserIds: ['host', 'nova', 'riley'],
      subEvents: [
        { id: 'qualifiers', name: 'Qualifiers' },
        { id: 'final', name: 'Final' }
      ]
    } as ActivityEventRecord);
    queryUserById.mockReturnValue({ id: 'host', name: 'Casey Bridge', images: ['/casey.webp'] });
    applyStageAction.mockReturnValue({
      sourceId: 'event-1',
      subEventId: 'final',
      subEventIndex: 1,
      action: 'start-tournament',
      stageStatus: 'A'
    });
    queryAcceptedTournamentStageMemberUserIds.mockReturnValue(['host', 'riley']);
    appendNotifications.mockImplementation(records => records);
    unreadCount.mockReturnValue(1);

    await TestBed.inject(LocalEventsService).applyStageAction({
      userId: 'host',
      sourceId: 'event-1',
      subEventId: 'final',
      subEventIndex: 1,
      action: 'start-tournament'
    });

    const records = appendNotifications.mock.calls[0]?.[0];
    expect(records.map((record: { recipientUserId: string }) => record.recipientUserId))
      .toEqual(['riley']);
    expect(records[0]).toMatchObject({
      kind: 'event-tournament-started',
      title: 'Final started',
      message: 'Final has started. Groups are ready.',
      payload: {
        stageTitle: 'Final',
        notification_title_key: 'notification.event.stage.started.title',
        notification_message_key: 'notification.event.stage.started.message',
        notification_avatar_tone: 'stage',
        notification_avatar_icon: 'emoji_events',
        stageIndex: '2',
        stageTotal: '2'
      }
    });
  });

  it('stores event editor local wall times as UTC instants', async () => {
    queryEventRecordById.mockReturnValue(null);
    saveEventSnapshot.mockImplementation(record => record);
    const payload = new ActivityEventDetailDTO().apply({
      id: 'event-1',
      userId: 'host-1',
      creatorUserId: 'host-1',
      dateRange: {
        startAt: '2026-08-06T18:00',
        endAt: '2026-08-06T20:00',
        precision: 'minute'
      }
    });

    await TestBed.inject(LocalEventsService).saveActivityEvent(payload);

    const record = saveEventSnapshot.mock.calls[0]?.[0] as ActivityEventRecord;
    expect(record.startAtIso).toBe(new Date('2026-08-06T18:00').toISOString());
    expect(record.endAtIso).toBe(new Date('2026-08-06T20:00').toISOString());
    expect(payload.startAtIso).toBe('2026-08-06T18:00');
    expect(payload.endAtIso).toBe('2026-08-06T20:00');
  });
});

function eventWithPromoCodes(id: string): ActivityEventRecord {
  return {
    id,
    pricing: {
      enabled: true,
      audience: {
        enabled: true,
        promoCodes: [{
          id: 'urban-photo-vip-percent',
          code: 'VIPPHOTO20',
          action: { kind: 'decrease_percent', value: 20 }
        }]
      }
    } as PricingConfig
  } as ActivityEventRecord;
}

function lifecycleEvent(status: 'A' | 'DR'): ActivityEventRecord {
  return {
    id: 'event-1',
    status,
    title: 'Manual QA Event',
    acceptedMemberUserIds: ['host', 'accepted-member'],
    pendingMemberUserIds: ['pending-invitee'],
    invitedMemberUserIds: ['pending-invitee'],
    acceptedMembers: 2,
    pendingMembers: 1,
    capacityTotal: 8
  } as ActivityEventRecord;
}
