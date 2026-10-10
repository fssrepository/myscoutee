import { ChatsService } from '../../../../core/base/services/chats.service';
import { ActivitiesPopupStore, eventChatHeaderStateFromChat, eventChatPopupRequestFromChat } from './activities-popup.store';
import { Injectable, Type, computed, effect, inject, signal } from '@angular/core';
import { CampaignsService } from '../../../../core/base/services/campaigns.service';
import { GroupWorkspaceContextService } from '../../../../core/base/services/group-workspace-context.service';
import type { Campaign, CampaignAction, CampaignFilters, SaveCampaign } from '../../../../core/contracts/campaign.interface';
import type { ListQuery } from '@myscoutee/components';
import { UserProfileStore } from '../profile/user-profile.store';

interface CampaignSession { userId: string; scope: 'own' | 'all'; selectedId?: string | null; select?: (campaign: Campaign | null) => void; }
interface CampaignHistorySession { userId: string; targetUserId: string; label?: string | null; }
@Injectable({ providedIn: 'root' })
export class CampaignsStore {
  private readonly service = inject(CampaignsService);
  private readonly chats = inject(ChatsService);
  private readonly activities = inject(ActivitiesPopupStore);
  private readonly profile = inject(UserProfileStore);
  private readonly workspace = inject(GroupWorkspaceContextService);
  readonly activityCampaign = signal<Campaign | null>(null);
  readonly feedbackCampaign = signal<Campaign | null>(null);
  readonly known = signal<Record<string, Campaign>>({});
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.known()[this.selectedId() ?? ''] ?? null);
  private contextUserId = '';
  readonly session = signal<CampaignSession | null>(null);
  readonly component = signal<Type<unknown> | null>(null);
  readonly editor = signal<{ userId: string; campaign: Campaign | null; readOnly: boolean } | null>(null);
  readonly historyTarget = signal<CampaignHistorySession | null>(null);
  readonly changed = signal<Campaign | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  private generation = 0;
  constructor() {
    effect(() => {
      const current = this.profile.activeUserId();
      if (current !== this.contextUserId) {
        this.contextUserId = current; this.activityCampaign.set(null); this.feedbackCampaign.set(null); this.known.set({});
      }
      const userId = this.session()?.userId ?? this.editor()?.userId ?? this.historyTarget()?.userId;
      if (userId && (userId !== this.profile.activeUserId() || !this.workspace.isWork())) this.close();
    });
  }
  private async load(): Promise<void> {
    if (!this.component()) this.component.set((await import('../../../components/campaigns-popup/campaigns-popup.component')).CampaignsPopupComponent);
  }
  async open(select?: CampaignSession['select'], selectedId?: string | null, scope: 'own' | 'all' = 'all'): Promise<void> {
    if (!this.workspace.isWork()) return;
    this.close(); this.selectedId.set(selectedId ?? null);
    this.session.set({ userId: this.profile.activeUserId(), select, selectedId, scope }); await this.load();
    if (select && selectedId) await this.loadReference(selectedId);
  }
  close(): void { this.generation++; this.session.set(null); this.selectedId.set(null); this.editor.set(null); this.historyTarget.set(null); this.error.set(''); this.busy.set(false); }
  closeEditor(): void { this.generation++; this.editor.set(null); this.error.set(''); this.busy.set(false); }
  closeHistory(): void { this.generation++; this.historyTarget.set(null); this.error.set(''); this.busy.set(false); }
  async openHistory(target: { userId: string; label?: string | null }): Promise<void> {
    if (!this.workspace.isWork()) return;
    const userId = this.profile.activeUserId(); const generation = ++this.generation;
    await this.load();
    if (generation === this.generation && userId === this.profile.activeUserId())
      this.historyTarget.set({ userId, targetUserId: target.userId, label: target.label });
  }
  async historyPage(query: ListQuery, signal?: AbortSignal) {
    const target = this.historyTarget();
    if (!target) throw new DOMException('Campaign history closed', 'AbortError');
    const result = await this.service.history(target.userId, target.targetUserId, query, signal);
    signal?.throwIfAborted();
    if (target !== this.historyTarget()) throw new DOMException('Campaign history changed', 'AbortError');
    return result;
  }
  select(campaign: Campaign | null): void {
    if (campaign && campaign.status !== 'published') return;
    const select = this.session()?.select; this.close(); select?.(campaign);
  }
  toggleSelection(campaign: Campaign): void {
    if (!this.session()?.select || campaign.status !== 'published') return;
    this.known.update(known => ({ ...known, [campaign.id]: campaign }));
    this.selectedId.update(id => id === campaign.id ? null : campaign.id);
  }
  confirmSelection(): void {
    if (this.selectedId() && !this.selected()) return;
    this.select(this.selected());
  }
  async page(query: ListQuery<CampaignFilters>, signal?: AbortSignal) {
    const session = this.session();
    if (!session) throw new DOMException('Campaign list closed', 'AbortError');
    const result = await this.service.page(session.userId, query, signal);
    signal?.throwIfAborted();
    if (session !== this.session()) throw new DOMException('Workspace changed', 'AbortError');
    this.known.update(known => ({ ...known, ...Object.fromEntries(result.items.map(c => [c.id, c])) }));
    return result;
  }
  async loadReference(id: string): Promise<void> {
    const userId = this.profile.activeUserId();
    if (this.known()[id]) return;
    try { const campaign = await this.service.detail(userId, id);
      if (userId === this.profile.activeUserId()) this.known.update(known => ({ ...known, [id]: campaign }));
    } catch { /* A removed campaign must not prevent opening its event. */ }
  }
  async ask(campaign: Campaign): Promise<void> {
    const userId = this.profile.activeUserId();
    if (!this.workspace.isWork() || campaign.ownerUserId === userId || this.busy()) return;
    const generation = this.generation;
    this.busy.set(true); this.error.set('');
    try {
      const chat = await this.chats.ensureServiceChat({ serviceContext: 'campaign', campaignId: campaign.id,
        targetUserId: campaign.ownerUserId, title: campaign.title, lastMessage: '' });
      if (generation !== this.generation || userId !== this.profile.activeUserId()) return;
      if (!chat) throw new Error('Chat unavailable');
      this.close();
      this.activities.openEventChat(eventChatPopupRequestFromChat(chat), eventChatHeaderStateFromChat(chat));
    } catch { if (generation === this.generation && userId === this.profile.activeUserId()) this.error.set('campaign.ask.failed'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  async edit(campaign?: Campaign, readOnly = false): Promise<void> {
    if (!this.workspace.isWork() || this.busy()) return;
    const userId = this.profile.activeUserId(); const generation = ++this.generation;
    this.busy.set(true); this.error.set('');
    try {
      const detail = campaign ? await this.service.detail(userId, campaign.id) : null;
      await this.load();
      if (generation === this.generation && userId === this.profile.activeUserId()) this.editor.set({ userId, campaign: detail, readOnly });
    } catch { if (generation === this.generation) this.error.set('campaign.load.failed'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  async save(value: SaveCampaign): Promise<void> {
    const editor = this.editor(); if (!editor || editor.readOnly || this.busy()) return;
    const generation = ++this.generation; this.busy.set(true); this.error.set('');
    try {
      const campaign = await this.service.save({ ...value, userId: editor.userId });
      if (generation === this.generation && editor.userId === this.profile.activeUserId()) { this.changed.set(campaign); this.editor.set(null); }
    } catch { if (generation === this.generation) this.error.set('campaign.save.failed'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  async action(action: string, campaign: Campaign): Promise<void> {
    if (action === 'ratings' && campaign.ownerUserId === this.profile.activeUserId()) {
      this.close();
      const generation = this.generation, userId = this.profile.activeUserId();
      this.activityCampaign.set(campaign);
      await this.activities.ensureActivitiesPopupLoaded();
      if (generation === this.generation && userId === this.profile.activeUserId()) this.activities.openActivities('rates');
      return;
    }
    if (action === 'ask') return this.ask(campaign);
    if (action === 'view' || action === 'edit') return this.edit(campaign, action === 'view');
    if (this.busy() || !['publish', 'unpublish', 'trash', 'restore'].includes(action)) return;
    const userId = this.profile.activeUserId(); const generation = ++this.generation;
    this.busy.set(true); this.error.set('');
    try {
      const result = await this.service.action(userId, campaign.id, action as CampaignAction, campaign.version);
      if (generation === this.generation && userId === this.profile.activeUserId()) this.changed.set(result);
    } catch { if (generation === this.generation) this.error.set('campaign.save.failed'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
}
