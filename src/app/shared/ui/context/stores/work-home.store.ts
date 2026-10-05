import type { RatingSnapshot } from '../../../core/contracts/rating-snapshot';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CampaignsService } from '../../../core/base/services/campaigns.service';
import { GameService } from '../../../core/base/services/game.service';
import { UserProfileStore } from './user-profile.store';
import type { Campaign, CampaignFilters } from '../../../core/contracts/campaign.interface';
import type { ListQuery } from '../../../core/contracts/list.interface';

@Injectable({ providedIn: 'root' })
export class WorkHomeStore {
  private readonly service = inject(CampaignsService);
  private readonly game = inject(GameService);
  private readonly profile = inject(UserProfileStore);
  readonly filters = signal<CampaignFilters>({ kind: 'both', category: null });
  readonly query = computed(() => ({ filters: { ...this.filters(), scope: 'discover' as const, userId: this.profile.activeUserId() }, sort: 'distance' }));
  readonly snapshots = signal<Record<string, RatingSnapshot | undefined>>({});
  snapshot(id: string): RatingSnapshot | undefined { return this.snapshots()[`${this.profile.activeUserId()}:${id}`]; }
  readonly scores = signal<Record<string, number>>({});
  score(id: string): number { return this.scores()[`${this.profile.activeUserId()}:${id}`] ?? 0; }
  async page(query: ListQuery<CampaignFilters & { userId: string }>, signal?: AbortSignal) {
    const userId = query.filters?.userId ?? '';
    const page = await this.service.page(userId, query, signal);
    signal?.throwIfAborted();
    if (userId !== this.profile.activeUserId()) throw new DOMException('Workspace changed', 'AbortError');
    this.scores.update(scores => ({ ...scores, ...Object.fromEntries(page.items.map(c => [`${userId}:${c.id}`, c.viewerRating ?? 0])) }));
    this.snapshots.update(values => ({ ...values, ...Object.fromEntries(page.items.map(c => [`${userId}:${c.id}`, c.viewerRatingSnapshot])) }));
    return page;
  }
  rate(campaign: Campaign, rating: number, snapshot?: RatingSnapshot): void {
    const userId = this.profile.activeUserId();
    if (!userId || campaign.ownerUserId === userId) return;
    this.game.recordUserGameCardRating(userId, campaign.ownerUserId, rating, 'single', undefined, undefined, undefined, snapshot, campaign.id);
    this.scores.update(scores => ({ ...scores, [`${userId}:${campaign.id}`]: rating }));
    this.snapshots.update(values => ({ ...values, [`${userId}:${campaign.id}`]: snapshot }));
  }
}
