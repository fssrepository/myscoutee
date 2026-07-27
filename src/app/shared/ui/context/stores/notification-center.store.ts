import { Injectable, Type, computed, inject, signal } from '@angular/core';

import type {
  NotificationBucket,
  NotificationDto,
  NotificationListFilters,
  NotificationPageResultDto
} from '../../../core/contracts/notification.interface';
import type { ListQuery } from '../../../core/contracts/list.interface';
import { NotificationsService } from '../../../core/base/services/notifications.service';
import type { AppMenuDragPosition } from '../../components/core/menu';
import { ActivityStore } from './activity.store';
import { UserProfileStore } from './user-profile.store';

export interface NotificationUnreadSyncOptions {
  announce?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationCenterStore {
  private readonly notificationsService = inject(NotificationsService);
  private readonly activityStore = inject(ActivityStore);
  private readonly userProfileStore = inject(UserProfileStore);

  private readonly activeUserIdRef = signal('');
  private readonly openRef = signal(false);
  private readonly openingRef = signal(false);
  private readonly loadingRef = signal(false);
  private readonly unreadCountRef = signal(0);
  private readonly mutedRef = signal(false);
  private readonly attentionRequestedRef = signal(false);
  private readonly dragPositionRef = signal<AppMenuDragPosition>({ x: 0, y: 0 });
  private readonly popupComponentRef = signal<Type<unknown> | null>(null);
  private readonly bucketRef = signal<NotificationBucket>('new');

  readonly activeUserId = this.activeUserIdRef.asReadonly();
  readonly isOpen = this.openRef.asReadonly();
  readonly visible = this.isOpen;
  readonly opening = this.openingRef.asReadonly();
  readonly loading = this.loadingRef.asReadonly();
  readonly unreadCount = this.unreadCountRef.asReadonly();
  readonly muted = this.mutedRef.asReadonly();
  readonly dragPosition = this.dragPositionRef.asReadonly();
  readonly popupComponent = this.popupComponentRef.asReadonly();
  readonly bucket = this.bucketRef.asReadonly();
  readonly attentionVisible = computed(() =>
    this.attentionRequestedRef()
    && this.unreadCountRef() > 0
    && !this.mutedRef()
    && !this.openRef()
  );

  private popupLoadPromise: Promise<void> | null = null;
  private pendingLoadingCount = 0;
  private generation = 0;
  private pageContextRevision = 0;
  private pageContextRequestSequence = 0;

  async initialize(userId: string, initialUnreadCount = 0): Promise<void> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) {
      this.reset();
      return;
    }
    if (this.activeUserIdRef() === normalizedUserId) {
      this.syncUnreadCount(initialUnreadCount);
      return;
    }

    this.resetState();
    this.activeUserIdRef.set(normalizedUserId);
    this.syncUnreadCount(initialUnreadCount);
    await this.refreshSummary();
  }

  reset(): void {
    this.resetState();
  }

  async open(): Promise<void> {
    if (!this.activeUserIdRef() || this.openRef() || this.openingRef()) {
      return;
    }
    const generation = this.generation;
    this.openingRef.set(true);
    try {
      await this.ensurePopupLoaded();
      if (generation !== this.generation || !this.activeUserIdRef()) {
        return;
      }
      this.attentionRequestedRef.set(false);
      this.openRef.set(true);
    } finally {
      if (generation === this.generation) {
        this.openingRef.set(false);
      }
    }
  }

  close(): void {
    this.openRef.set(false);
  }

  dismissAttention(): void {
    this.attentionRequestedRef.set(false);
  }

  setDragPosition(position: AppMenuDragPosition): void {
    this.dragPositionRef.set({
      x: this.finiteCoordinate(position?.x),
      y: this.finiteCoordinate(position?.y)
    });
  }

  setBucket(bucket: NotificationBucket): void {
    this.bucketRef.set(bucket === 'new' ? 'new' : 'all');
  }

  syncUnreadCount(count: number, options: NotificationUnreadSyncOptions = {}): void {
    const nextCount = this.nonNegativeInteger(count);
    const previousCount = this.unreadCountRef();
    if (nextCount !== previousCount) {
      this.pageContextRevision += 1;
      this.unreadCountRef.set(nextCount);
      this.syncUserModelCounter(nextCount);
    }
    if (nextCount === 0) {
      this.attentionRequestedRef.set(false);
      return;
    }
    if (
      options.announce === true
      && nextCount > previousCount
      && !this.mutedRef()
      && !this.openRef()
    ) {
      this.attentionRequestedRef.set(true);
    }
  }

  async ensurePopupLoaded(): Promise<void> {
    if (this.popupComponentRef()) {
      return;
    }
    if (!this.popupLoadPromise) {
      this.popupLoadPromise = import('../../components/notification-center-popup/notification-center-popup.component')
        .then(module => {
          this.popupComponentRef.set(module.NotificationCenterPopupComponent);
        })
        .finally(() => {
          this.popupLoadPromise = null;
        });
    }
    await this.popupLoadPromise;
  }

  async queryPage(
    query: ListQuery<NotificationListFilters>,
    signal?: AbortSignal
  ): Promise<NotificationPageResultDto> {
    const userId = this.activeUserIdRef();
    if (!userId) {
      return {
        items: [],
        total: 0,
        nextCursor: null,
        context: { unreadCount: 0, muted: false }
      };
    }
    const generation = this.generation;
    const contextRevision = this.pageContextRevision;
    const contextRequestSequence = ++this.pageContextRequestSequence;
    const page = await this.runLoading(() =>
      this.notificationsService.queryPage(userId, query, signal)
    );
    if (
      generation === this.generation
      && userId === this.activeUserIdRef()
      && contextRevision === this.pageContextRevision
      && contextRequestSequence === this.pageContextRequestSequence
    ) {
      this.applyPageContext(page);
    }
    return page;
  }

  async markRead(notificationId: string, signal?: AbortSignal): Promise<NotificationDto> {
    const userId = this.activeUserIdRef();
    const normalizedNotificationId = notificationId.trim();
    if (!userId || !normalizedNotificationId) {
      throw new Error('Notification could not be marked as read.');
    }
    this.pageContextRevision += 1;
    const generation = this.generation;
    const result = await this.runLoading(() =>
      this.notificationsService.markRead(userId, normalizedNotificationId, signal)
    );
    if (generation === this.generation && userId === this.activeUserIdRef()) {
      this.syncUnreadCount(result.unreadCount);
    }
    return result.notification;
  }

  async setMuted(muted: boolean, signal?: AbortSignal): Promise<boolean> {
    const userId = this.activeUserIdRef();
    if (!userId) {
      throw new Error('Notification preferences could not be updated.');
    }
    this.pageContextRevision += 1;
    const generation = this.generation;
    const result = await this.runLoading(() =>
      this.notificationsService.setMuted(userId, muted === true, signal)
    );
    if (generation === this.generation && userId === this.activeUserIdRef()) {
      const nextMuted = result.muted === true;
      if (nextMuted !== this.mutedRef()) {
        this.pageContextRevision += 1;
        this.mutedRef.set(nextMuted);
      }
      this.attentionRequestedRef.set(false);
    }
    return result.muted === true;
  }

  pollIntervalMs(): number {
    return this.notificationsService.pollIntervalMs();
  }

  private async refreshSummary(): Promise<void> {
    const userId = this.activeUserIdRef();
    if (!userId) {
      return;
    }
    const generation = this.generation;
    const contextRevision = this.pageContextRevision;
    const contextRequestSequence = ++this.pageContextRequestSequence;
    try {
      const page = await this.runLoading(() => this.notificationsService.queryPage(userId, {
        page: 0,
        pageSize: 1,
        cursor: null,
        sort: 'createdAt',
        direction: 'desc',
        filters: { bucket: 'new' }
      }));
      if (
        generation === this.generation
        && userId === this.activeUserIdRef()
        && contextRevision === this.pageContextRevision
        && contextRequestSequence === this.pageContextRequestSequence
      ) {
        this.applyPageContext(page);
      }
    } catch {
      // Keep the realtime/user-model count when the optional summary refresh is unavailable.
    }
  }

  private applyPageContext(page: NotificationPageResultDto): void {
    this.syncUnreadCount(page.context?.unreadCount ?? this.unreadCountRef());
    const nextMuted = page.context?.muted === true;
    if (nextMuted !== this.mutedRef()) {
      this.pageContextRevision += 1;
      this.mutedRef.set(nextMuted);
    }
    if (this.mutedRef()) {
      this.attentionRequestedRef.set(false);
    }
  }

  private async runLoading<T>(task: () => Promise<T>): Promise<T> {
    const generation = this.generation;
    this.pendingLoadingCount += 1;
    this.loadingRef.set(true);
    try {
      return await task();
    } finally {
      if (generation === this.generation) {
        this.pendingLoadingCount = Math.max(0, this.pendingLoadingCount - 1);
        this.loadingRef.set(this.pendingLoadingCount > 0);
      }
    }
  }

  private syncUserModelCounter(count: number): void {
    const userId = this.activeUserIdRef();
    if (!userId) {
      return;
    }
    this.activityStore.setUserCounterOverride(userId, 'notifications', count);
    this.userProfileStore.patchUserActivityCounters(userId, { notifications: count });
  }

  private resetState(): void {
    this.generation += 1;
    this.pageContextRevision = 0;
    this.pageContextRequestSequence = 0;
    this.activeUserIdRef.set('');
    this.openRef.set(false);
    this.openingRef.set(false);
    this.pendingLoadingCount = 0;
    this.loadingRef.set(false);
    this.unreadCountRef.set(0);
    this.mutedRef.set(false);
    this.attentionRequestedRef.set(false);
    this.dragPositionRef.set({ x: 0, y: 0 });
    this.bucketRef.set('new');
  }

  private nonNegativeInteger(value: number): number {
    return Math.max(0, Math.trunc(Number(value) || 0));
  }

  private finiteCoordinate(value: number): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }
}
