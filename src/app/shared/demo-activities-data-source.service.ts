import { Injectable, inject } from '@angular/core';

import type * as AppTypes from './app-types';
import { AppDemoGenerators } from './app-demo-generators';
import { AppUtils } from './app-utils';
import type { ActivitiesEventSyncPayload, ActivitiesPageRequest, ActivitiesPageResult } from './activities-models';
import type { ActivitiesDataSource } from './activities-data-source';
import { DEMO_USERS, type ChatMenuItem, type DemoUser } from './demo-data';
import { buildActivityRateRows, SessionService } from './core';
import { DemoRatesService } from './core/demo';

@Injectable({
  providedIn: 'root'
})
export class DemoActivitiesDataSourceService implements ActivitiesDataSource {
  readonly mode = 'demo' as const;

  private readonly ratesService = inject(DemoRatesService);
  private readonly sessionService = inject(SessionService);
  private readonly users = AppDemoGenerators.buildExpandedDemoUsers(50);

  async syncEvent(_payload: Omit<ActivitiesEventSyncPayload, 'syncKey'>): Promise<void> {
    // Demo source keeps data in-memory in the UI layer.
  }

  async loadChatMessages(chat: ChatMenuItem): Promise<AppTypes.ChatPopupMessage[]> {
    const me = this.users[0] ?? DEMO_USERS[0];
    const members = this.resolveChatMembers(chat, me);
    const sender = this.resolveSender(chat, members, me);
    const anchor = new Date(this.resolveAnchorIso(chat));

    const at = (minutesBefore: number): Date => new Date(anchor.getTime() - (minutesBefore * 60 * 1000));
    const mk = (
      id: string,
      author: DemoUser,
      text: string,
      sentAt: Date,
      readBy: readonly DemoUser[]
    ): AppTypes.ChatPopupMessage => ({
      id,
      sender: author.name,
      senderAvatar: {
        id: author.id,
        initials: author.initials,
        gender: author.gender
      },
      text,
      time: sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      sentAtIso: AppUtils.toIsoDateTime(sentAt),
      mine: author.id === me.id,
      readBy: readBy.map(user => ({
        id: user.id,
        initials: user.initials,
        gender: user.gender
      }))
    });

    const memberA = members[0] ?? me;
    const memberB = members[1] ?? sender;
    const memberC = members[2] ?? me;
    const chatTopic = chat.title.trim() || 'Event';
    const lastLine = chat.lastMessage.trim() || `Update shared in ${chatTopic}.`;

    const seed = AppDemoGenerators.hashText(`${chat.id}:${chatTopic}`);
    const olderPool = [
      'Shared updated ETA for everyone.',
      'Pinned the checklist in this room.',
      'Confirmed who can bring supplies.',
      'Noted backup plan if weather changes.',
      'Added the new member to transport.',
      'Assigned table and seat groups.',
      'Synced on arrival windows.',
      'Collected final confirmations.'
    ];
    const olderMessages: AppTypes.ChatPopupMessage[] = [];
    const olderCount = 36;
    const olderBaseStart = new Date(anchor.getTime() - ((olderCount + 12) * 40 * 60 * 1000));
    for (let index = olderCount - 1; index >= 0; index -= 1) {
      const senderCycle = index % 3;
      const author = senderCycle === 0 ? memberA : (senderCycle === 1 ? me : memberB);
      const baseText = olderPool[(seed + index) % olderPool.length];
      const sequenceFromOldest = (olderCount - 1) - index;
      const sentAt = new Date(olderBaseStart.getTime() + (sequenceFromOldest * 40 * 60 * 1000));
      const readers = author.id === me.id ? [memberA, memberB] : [me, memberC];
      olderMessages.push(
        mk(`${chat.id}-older-${index}`, author, baseText, sentAt, readers)
      );
    }

    const recentMessages: AppTypes.ChatPopupMessage[] = [
      mk(`${chat.id}-1`, memberA, `Let us align the plan for ${chatTopic}.`, at(180), [memberB, memberC]),
      mk(`${chat.id}-2`, memberB, 'I can bring two more people.', at(140), [memberA, memberC]),
      mk(`${chat.id}-3`, memberC, 'Route and timing look good on my side.', at(95), [memberA, memberB]),
      mk(`${chat.id}-4`, sender, lastLine, at(48), [memberA, memberB, memberC]),
      mk(`${chat.id}-5`, me, 'Perfect, locking this in.', at(12), [memberA, memberB])
    ];

    const timeline: AppTypes.ChatPopupMessage[] = [
      ...olderMessages,
      ...recentMessages
    ];

    return timeline.sort((first, second) => AppUtils.toSortableDate(first.sentAtIso) - AppUtils.toSortableDate(second.sentAtIso));
  }

  async loadActivitiesPage(request: ActivitiesPageRequest): Promise<ActivitiesPageResult | null> {
    if (request.primaryFilter !== 'rates') {
      return null;
    }

    const activeUserId = this.resolveActiveUserId();
    const page = await this.ratesService.queryActivitiesRatePage(activeUserId, request);
    const rows = buildActivityRateRows(page.items, {
      activeUserId,
      users: this.users,
      filter: request.rateFilter,
      secondaryFilter: request.secondaryFilter,
      view: request.view,
      preserveOrder: true
    });

    return {
      rows,
      total: page.total
    };
  }

  private resolveChatMembers(chat: ChatMenuItem, fallback: DemoUser): DemoUser[] {
    const resolved = (chat.memberIds ?? [])
      .map(id => this.users.find(user => user.id === id))
      .filter((entry): entry is DemoUser => Boolean(entry));
    if (resolved.length > 0) {
      return resolved;
    }
    return [fallback, ...this.users.filter(user => user.id !== fallback.id).slice(0, 2)];
  }

  private resolveSender(chat: ChatMenuItem, members: readonly DemoUser[], fallback: DemoUser): DemoUser {
    const explicit = chat.lastSenderId
      ? this.users.find(user => user.id === chat.lastSenderId)
      : null;
    if (explicit) {
      return explicit;
    }
    return members[0] ?? fallback;
  }

  private resolveAnchorIso(chat: ChatMenuItem): string {
    const eventId = (chat.eventId ?? '').trim();
    if (!eventId) {
      return AppUtils.toIsoDateTime(new Date());
    }
    const eventDay = 10 + (AppDemoGenerators.hashText(eventId) % 12);
    const anchor = new Date(Date.UTC(2026, 1, eventDay, 12, 0, 0));
    return AppUtils.toIsoDateTime(anchor);
  }

  private resolveActiveUserId(): string {
    const session = this.sessionService.currentSession();
    if (session?.kind === 'demo' && session.userId.trim().length > 0) {
      return session.userId.trim();
    }
    if (session?.kind === 'firebase' && session.profile.id.trim().length > 0) {
      return session.profile.id.trim();
    }
    return DEMO_USERS[0]?.id ?? 'u1';
  }
}
