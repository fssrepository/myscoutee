import {
  Injectable,
  inject
} from '@angular/core';

import {
  AppUtils
} from '../../../app-utils';
import type * as ContractTypes from '../../contracts';
import type { ActivitiesFeedFilters, EventExploreFeedFilters, ListQuery, PageResult } from '../../contracts';
import type { ChatDTO } from '../../contracts/chat.interface';
import type { UserDto } from '../../contracts/user.interface';
import type { ActivityEventRecord, ActivityRateDTO } from '../../contracts/activity.interface';
import {
  ChatsService
} from './chats.service';
import {
  EventsService
} from './events.service';
import {
  RatesService
} from './rates.service';
import {
  UsersService
} from './users.service';
import {
  BaseRouteModeService
} from './base-route-mode.service';
import { UserProfileStore } from '../../../ui/context/stores/user-profile.store';

@Injectable({
  providedIn: 'root'
})
export class ActivitiesService extends BaseRouteModeService {
  private readonly eventsService = inject(EventsService);
  private readonly chatsService = inject(ChatsService);
  private readonly ratesService = inject(RatesService);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly usersService = inject(UsersService);

  async loadExplore(query: ListQuery<EventExploreFeedFilters>): Promise<PageResult<ActivityEventRecord>> {
    const filters = this.resolveExploreFilters(query.filters);
    const result = await this.eventsService.queryEventExplorePage({
      ...filters,
      limit: this.resolveExplorePageSize(query.pageSize),
      cursor: query.cursor ?? null
    });
    return {
      items: result.records.map(record => this.cloneExploreRecord(record)),
      total: result.total,
      nextCursor: result.nextCursor
    };
  }

  async loadActivityChats(
    query: ListQuery<ActivitiesFeedFilters>,
    options: { chatItems?: readonly ChatDTO[]; signal?: AbortSignal } = {}
  ): Promise<PageResult<ChatDTO>> {
    return this.chatsService.queryActivitiesChatPage(this.resolveActiveUserId(), query, {
      chatItems: options.chatItems
    });
  }

  async loadActivityRates(
    query: ListQuery<ActivitiesFeedFilters>,
    options: { signal?: AbortSignal } = {}
  ): Promise<PageResult<ActivityRateDTO, { users: UserDto[] }>> {
    const activeUserId = this.resolveActiveUserId();
    const page = await this.ratesService.queryActivitiesRatePage(activeUserId, query, options.signal);
    const users = this.resolveActivityUsers(page.users);
    this.cacheActivityUsers(users);
    return {
      items: page.items.map(item => ({ ...item })),
      total: page.total,
      nextCursor: page.nextCursor ?? null,
      context: { users }
    };
  }

  private resolveActiveUserId(): string {
    const activeUserProfileId = this.userProfileStore.activeUserProfile()?.id?.trim();
    if (activeUserProfileId) {
      return activeUserProfileId;
    }
    const activeUserId = this.userProfileStore.getActiveUserId().trim();
    if (activeUserId) {
      return activeUserId;
    }
    const session = this.sessionService.currentSession();
    if (session?.kind === 'demo' && session.userId.trim().length > 0) {
      return session.userId.trim();
    }
    if (session?.kind === 'firebase' && session.profile.id.trim().length > 0) {
      return session.profile.id.trim();
    }
    return this.usersService.peekCachedUsers()[0]?.id ?? '';
  }

  private resolveExploreFilters(
    input: Partial<EventExploreFeedFilters> | null | undefined
  ): EventExploreFeedFilters {
    return {
      userId: input?.userId?.trim() || this.resolveActiveUserId(),
      order: this.normalizeEventExploreOrder(input?.order),
      view: this.normalizeEventExploreView(input?.view),
      friendsOnly: input?.friendsOnly === true,
      openSpotsOnly: input?.openSpotsOnly === true,
      topic: this.normalizeEventExploreTopic(input?.topic ?? ''),
      excludedSourceIds: this.normalizeEventExploreExcludedSourceIds(input?.excludedSourceIds)
    };
  }

  private normalizeEventExploreOrder(value: unknown): ContractTypes.EventExploreOrder {
    return value === 'past-events'
      || value === 'nearby'
      || value === 'most-relevant'
      || value === 'top-rated'
      ? value
      : 'upcoming';
  }

  private normalizeEventExploreView(value: unknown): ContractTypes.EventExploreView {
    return value === 'distance' ? 'distance' : 'day';
  }

  private normalizeEventExploreTopic(value: string | null | undefined): string {
    return AppUtils.normalizeText(`${value ?? ''}`.replace(/^#+\s*/, '').trim());
  }

  private normalizeEventExploreExcludedSourceIds(value: readonly string[] | null | undefined): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return [...new Set(value
      .map(sourceId => `${sourceId ?? ''}`.trim())
      .filter(sourceId => sourceId.length > 0))];
  }

  private resolveExplorePageSize(value: number): number {
    if (!Number.isFinite(value)) {
      return 10;
    }
    return Math.max(1, Math.trunc(Number(value)));
  }

  private cloneExploreRecord(record: ActivityEventRecord): ActivityEventRecord {
    return {
      ...record,
      topics: [...record.topics]
    };
  }

  private cacheActivityUsers(users: readonly UserDto[] | null | undefined): void {
    for (const user of users ?? []) {
      if (!user?.id?.trim()) {
        continue;
      }
      this.userProfileStore.setUserProfile(user);
    }
  }

  private resolveActivityUsers(preferredUsers?: readonly UserDto[] | null): UserDto[] {
    if (preferredUsers && preferredUsers.length > 0) {
      return preferredUsers.map(user => ({ ...user, images: [...(user.images ?? [])] }));
    }
    return this.usersService.peekCachedUsers();
  }

}
