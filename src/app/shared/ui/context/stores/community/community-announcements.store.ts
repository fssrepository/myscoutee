import { ChatsService } from '../../../../core/base/services/chats.service';
import { ActivitiesPopupStore, eventChatPopupRequestFromChat, eventChatHeaderStateFromChat } from '../activity/activities-popup.store';
import { Injectable, Type, computed, effect, inject, signal } from '@angular/core';
import { CommunityAnnouncementsService } from '../../../../core/base/services/community-announcements.service';
import { GroupWorkspaceContextService } from '../../../../core/base/services/group-workspace-context.service';
import { UserProfileStore } from '../profile/user-profile.store';
import { DialogStore, type AppMenuPalette, type ListQuery } from '@myscoutee/components';

import { COMMUNITY_BASE_GROUP_ID } from '../../../../core/contracts/group-type';
import type { CommunityAnnouncement, AnnouncementAction, AnnouncementFilters, SaveAnnouncement, VoteChoice } from '../../../../core/contracts/community-announcement.interface';

export type AnnouncementEditor = { value: CommunityAnnouncement | null; readOnly: boolean; defaultVoting?: boolean; view?: 'details' | 'voting' };
@Injectable({ providedIn: 'root' })
export class CommunityAnnouncementsStore {
  private readonly chats = inject(ChatsService);
  private readonly activities = inject(ActivitiesPopupStore);
  private readonly service = inject(CommunityAnnouncementsService);
  private readonly profile = inject(UserProfileStore);
  private readonly workspace = inject(GroupWorkspaceContextService);
  private readonly dialogs = inject(DialogStore);
  readonly groupId = computed(() => this.workspace.isCommunity() && this.workspace.active()?.groupId !== COMMUNITY_BASE_GROUP_ID ? this.workspace.active()?.groupId ?? '' : '');
  readonly userId = computed(() => this.profile.activeUserId());
  readonly canManage = computed(() => !!this.groupId() && this.workspace.active()?.role === 'Admin');
  readonly popup = signal(false);
  readonly component = signal<Type<unknown> | null>(null);
  readonly editor = signal<AnnouncementEditor | null>(null);
  readonly changed = signal<CommunityAnnouncement | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  private generation = 0;
  private previousIdentity = '';
  private get identity(): string { return `${this.userId()}:${this.groupId()}`; }
  constructor() { effect(() => { const key = this.identity; if (key !== this.previousIdentity) { this.previousIdentity = key; this.close(); this.changed.set(null); } }); }
  async open(): Promise<void> {
    if (!this.groupId()) return; const key = this.identity;
    if (!this.component()) this.component.set((await import('../../../components/community-announcements/community-announcements.component')).CommunityAnnouncementsComponent);
    if (key === this.identity) this.popup.set(true);
  }
  async openReference(id: string): Promise<void> {
    await this.open(); if (!this.groupId()) return;
    await this.mutate(async () => { const item = await this.service.detail(this.userId(), id); return () => this.editor.set({ value: item, readOnly: true }); });
  }
  close(): void { this.generation++; this.popup.set(false); this.editor.set(null); this.busy.set(false); this.error.set(''); }
  closeEditor(): void { this.generation++; this.editor.set(null); this.busy.set(false); this.error.set(''); }
  async page(query: ListQuery<AnnouncementFilters>, signal?: AbortSignal) {
    const key = this.identity; if (!this.groupId()) throw new DOMException('No community', 'AbortError');
    const result = await this.service.page(this.userId(), { ...query, filters: { ...query.filters!, communityId: this.groupId() } }, signal);
    if (key !== this.identity) throw new DOMException('Changed', 'AbortError'); return result;
  }
  edit(value: CommunityAnnouncement | null = null, readOnly = false, defaultVoting = false): void { this.error.set(''); this.editor.set({ value, readOnly, defaultVoting }); }
  viewVoting(value: CommunityAnnouncement): void { this.error.set(''); this.editor.set({ value, readOnly: true, view: 'voting' }); }
  async save(value: SaveAnnouncement): Promise<void> {
    await this.mutate(async () => { const result = await this.service.save({ ...value, userId: this.userId(), communityId: this.groupId() });
      return () => { this.changed.set(result); this.editor.set(null); }; });
  }
  async command(item: CommunityAnnouncement, action: AnnouncementAction, choice?: VoteChoice, palette?: AppMenuPalette): Promise<void> {
    const identity = this.identity; let generation = this.generation;
    const apply = async () => {
      if (identity !== this.identity || generation !== this.generation || this.busy()) throw new Error('announcement.changed');
      generation++;
      await this.mutate(async () => {
        const result = await this.service.action(item.id, { userId: this.userId(), version: item.version, action, choice });
        return () => { this.changed.set(result); this.editor.update(editor => editor?.value?.id === item.id ? { ...editor, value: result } : editor); };
      }, true);
    };
    this.dialogs.open({ title: `announcement.confirm.${action}`, message: item.title,
        warningMessage: action === 'vote' ? 'announcement.vote.final' : null,
        confirmLabel: action === 'vote' ? `announcement.choice.${choice}` : `announcement.action.${action}`,
        confirmPalette: palette, cancelLabel: 'Cancel', failureMessage: 'announcement.failed', onConfirm: apply });
  }
  async feedback(item: CommunityAnnouncement): Promise<void> {
    const key = this.identity, generation = this.generation;
    this.error.set('');
    try { const chat = await this.chats.ensureServiceChat({ serviceContext: 'groupSupport', announcementId: item.id, targetUserId: '', title: '', lastMessage: '' });
      if (key !== this.identity || generation !== this.generation) return;
      if (!chat) { this.error.set('announcement.feedback.failed'); return; }
      this.activities.openEventChat({ ...eventChatPopupRequestFromChat(chat), parentZIndex: this.popup() ? 14000 : null }, eventChatHeaderStateFromChat(chat));
    } catch { if (key === this.identity && generation === this.generation) this.error.set('announcement.feedback.failed'); }
  }
  private async mutate(work: () => Promise<() => void>, rethrow = false): Promise<void> {
    if (this.busy()) return; const gen = ++this.generation; this.busy.set(true); this.error.set('');
    try { const apply = await work(); if (gen === this.generation) apply(); }
    catch (e) { if (gen === this.generation) this.error.set(e instanceof Error && e.message === 'announcement.changed' ? e.message : 'announcement.failed'); if(rethrow)throw e; }
    finally { if (gen === this.generation) this.busy.set(false); }
  }
}
