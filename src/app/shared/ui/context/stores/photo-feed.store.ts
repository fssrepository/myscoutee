import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { PhotoFeedService } from '../../../core/base/services/photo-feed.service';
import { UserProfileStore } from './user-profile.store';
import { ImageGalleryStore } from './image-gallery.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import type { ListQuery } from '../../../core/contracts/list.interface';
import type { PhotoFeedPost, PhotoFeedFilters, PhotoFeedCounters } from '../../../core/contracts/photo-feed.interface';
import type { ImageEventReference } from '../../../core/contracts/image-gallery.interface';
import { FeedSeenOutboxRepository } from '../../../core/base/repositories/feed-seen-outbox.repository';
import { UiTaskScheduler } from '../../scheduler/ui-task-scheduler';

@Injectable({ providedIn: 'root' })
export class PhotoFeedStore {
  private readonly service = inject(PhotoFeedService);
  private readonly profile = inject(UserProfileStore);
  private readonly gallery = inject(ImageGalleryStore);
  private readonly i18n = inject(I18nService);
  private readonly seenOutbox = inject(FeedSeenOutboxRepository);
  private readonly viewedPosts = new Map<string, Map<string, PhotoFeedPost>>();
  private persistScheduled = false;
  private readonly seenScheduler = new UiTaskScheduler({
    intervalMs: () => this.profile.activeUserId() ? 5000 : 0,
    state: () => this.profile.activeUserId(),
    task: async ({ state: userId }) => {
      if (!userId) return;
      await this.seenOutbox.persist(userId);
      const ids = (await this.seenOutbox.pending(userId)).slice(0, 50);
      if (!ids.length || userId !== this.profile.activeUserId()) return;
      const acknowledged = await this.service.seen(userId, ids);
      await this.seenOutbox.acknowledge(userId, acknowledged);
    }
  });
  readonly userId = signal<string | null>(null);
  readonly created = signal<PhotoFeedPost | null>(null);
  readonly counters = signal<PhotoFeedCounters>({ revision: 0, counts: {} });
  readonly count = computed(() => Object.values(this.counters().counts).reduce((sum, count) => sum + (count ?? 0), 0));
  private countersUserId = '';
  readonly eventPicker = signal<{ initial?: ImageEventReference | null; resolve: (event: ImageEventReference | null) => void } | null>(null);
  private galleryToken?: object;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.seenScheduler.destroy());
    effect(() => {
      const userId = this.profile.activeUserId();
      if (userId) this.seenOutbox.preload(userId);
      this.seenScheduler.restart();
    });
    effect(() => {
      const active = this.profile.activeUserId();
      if (this.countersUserId !== active) {
        this.countersUserId = active;
        this.counters.set({ revision: 0, counts: {} });
      }
      if (this.userId() && this.userId() !== this.profile.activeUserId()) this.close();
    });
  }
  open(): void { this.created.set(null); this.userId.set(this.profile.activeUserId() || null); }
  close(): void {
    const owner = this.userId();
    if (owner) void this.seenOutbox.persist(owner).catch(() => {});
    this.pickEvent(null);
    this.userId.set(null);
    if (this.galleryToken) this.gallery.close(this.galleryToken);
    this.galleryToken = undefined;
  }
  applyCounters(userId: string, counters?: PhotoFeedCounters): void {
    if (!counters || userId !== this.profile.activeUserId()) return;
    if (this.countersUserId !== userId || counters.revision >= this.counters().revision) {
      this.countersUserId = userId;
      this.counters.set(counters);
    }
  }
  async page(query: ListQuery<PhotoFeedFilters>, signal?: AbortSignal) {
    const userId = this.userId() ?? '';
    const pendingAtStart = this.seenOutbox.pendingNow(userId);
    const page = await this.service.page(userId, query, signal);
    this.applyCounters(userId, page.context);
    const pending = new Set(this.seenOutbox.pendingNow(userId));
    if (query.filters?.status === 'public') {
      const excluded = new Set([...pendingAtStart, ...pending, ...(this.viewedPosts.get(userId)?.keys() ?? [])]);
      return { ...page, items: page.items.filter(post => !excluded.has(post.id)) };
    }
    return page;
  }
  seen(post: PhotoFeedPost): void {
    const userId = this.userId();
    if (!userId || post.creatorUserId === userId || post.moderationStatus !== 'accepted') return;
    let posts = this.viewedPosts.get(userId);
    if (!posts) { posts = new Map(); this.viewedPosts.set(userId, posts); }
    if (posts.has(post.id)) return;
    posts.set(post.id, post);
    this.seenOutbox.enqueue(userId, post.id);
    if (this.persistScheduled) return;
    this.persistScheduled = true;
    const persist = () => {
      this.persistScheduled = false;
      void this.seenOutbox.persist(userId).catch(() => {});
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(persist, { timeout: 2000 });
    else setTimeout(persist, 250);
  }
  async remove(id: string): Promise<void> {
    const userId = this.userId();
    if (!userId) throw new Error('feed.removeFailed');
    this.applyCounters(userId, await this.service.remove(userId, id));
  }
  add(): void {
    const userId = this.userId();
    if (!userId) return;
    const id = crypto.randomUUID();
    this.galleryToken = this.gallery.open({ images: [], imageDetails: {}, slotCount: 5, readOnly: false,
      detailsConfig: { eventRequired: true, selectEvent: current => new Promise(resolve => {
        this.pickEvent(null);
        this.eventPicker.set({ initial: current, resolve });
      }) },
      title: this.i18n.translate('feed.create'), uploadOwnerId: userId, uploadEntityId: id,
      onSave: async (imageUrls, imageDetails) => {
        const post = await this.service.create({ userId, id, imageUrls, imageDetails });
        this.applyCounters(userId, post.feedCounters);
        if (this.userId() === userId) this.created.set(post);
      } });
  }
  pickEvent(event: ImageEventReference | null): void {
    const picker = this.eventPicker();
    this.eventPicker.set(null);
    picker?.resolve(event);
  }
  view(post: PhotoFeedPost): void {
    this.galleryToken = this.gallery.open({ images: post.imageUrls, imageDetails: post.imageDetails,
      slotCount: 5, readOnly: true, title: post.creatorName, uploadOwnerId: post.creatorUserId, uploadEntityId: post.id });
  }
}
