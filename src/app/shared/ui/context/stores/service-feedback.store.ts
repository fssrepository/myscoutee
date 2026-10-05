import { Injectable, Type, computed, effect, inject, signal } from '@angular/core';
import { GroupWorkspaceContextService } from '../../../core/base/services/group-workspace-context.service';
import { ServiceFeedbackService } from '../../../core/base/services/service-feedback.service';
import type { EventFeedbackPageQueryDto } from '../../../core/contracts/activity.interface';
import type { ServiceFeedbackBucket, ServiceFeedbackCommand, ServiceFeedbackItem } from '../../../core/contracts/service-feedback.interface';
import { MemberMenuStore } from './member-menu.store';
import { UserProfileStore } from './user-profile.store';

@Injectable({ providedIn: 'root' })
export class ServiceFeedbackStore {
  private readonly workspace = inject(GroupWorkspaceContextService);
  private readonly profile = inject(UserProfileStore);
  private readonly menus = inject(MemberMenuStore);
  private readonly service = inject(ServiceFeedbackService);
  readonly userId = computed(() => this.profile.activeUserId());
  readonly opened = signal(false);
  readonly component = signal<Type<unknown> | null>(null);
  readonly selected = signal<ServiceFeedbackItem | null>(null);
  readonly readOnly = signal(true);
  readonly changed = signal<{ userId: string; id: string; action: ServiceFeedbackCommand['action'] } | null>(null);
  private generation = 0;

  constructor() {
    effect(() => { this.userId(); this.workspace.active(); this.close(); });
  }

  open(): void {
    this.menus.openNavigatorEventFeedbackRequest();
  }

  async openDetail(item: ServiceFeedbackItem, received = false): Promise<void> {
    const generation = ++this.generation;
    const component = (await import('../../components/service-feedback/service-feedback-popup.component')).ServiceFeedbackPopupComponent;
    if (generation !== this.generation) return;
    this.selected.set(item);
    this.readOnly.set(received || item.feedback.status !== 'pending');
    this.component.set(component);
    this.opened.set(true);
  }

  close(): void {
    this.generation++;
    this.opened.set(false);
    this.selected.set(null);
  }

  /** Fill the remaining window of the existing feedback list, after its event rows.
   * Both adapters stay paginated; at most two service pages span a boundary.
   */
  async pageAfterEvents(query: EventFeedbackPageQueryDto, eventTotal: number, eventCount: number, signal?: AbortSignal) {
    if (!this.workspace.isCommunity() || query.campaignId) return { items: [], total: 0, context: {} };
    const bucket: ServiceFeedbackBucket = query.filter === 'own-events' ? 'received' : query.filter;
    const needed = Math.max(0, query.pageSize - eventCount);
    const offset = Math.max(0, query.page * query.pageSize - eventTotal);
    const size = needed ? query.pageSize : 1;
    const pageIndex = needed ? Math.floor(offset / size) : 0;
    const page = await this.service.page(query.userId, { page: pageIndex, pageSize: size, cursor: String(pageIndex), filters: { bucket } }, signal);
    if (!needed) return { ...page, items: [] };
    const items = page.items.slice(offset % size, offset % size + needed);
    if (items.length < needed && page.nextCursor) {
      const next = await this.service.page(query.userId, { page: pageIndex + 1, pageSize: size, cursor: page.nextCursor, filters: { bucket } }, signal);
      items.push(...next.items.slice(0, needed - items.length));
    }
    return { ...page, items };
  }

  async action(item: ServiceFeedbackItem, command: Omit<ServiceFeedbackCommand, 'userId'>): Promise<void> {
    const userId = this.userId();
    await this.service.action(item.feedback.id, { ...command, userId });
    if (this.userId() === userId) this.changed.set({ userId, id: item.feedback.id, action: command.action });
  }
}
