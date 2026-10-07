import { CommunityCaseChangesStore } from './community-case-changes.store';
import { CommunityCaseConverter } from '../../converters/community-case.converter';
import { CaseAppointmentsStore } from './case-appointments.store';
import { ServiceOfferingsStore } from './service-offerings.store';
import { ChatsService } from '../../../core/base/services/chats.service';
import { ActivitiesPopupStore, eventChatHeaderStateFromChat, eventChatPopupRequestFromChat } from './activities-popup.store';
import { ActivityStore } from './activity.store';
import { Injectable, Type, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommunityCasesService } from '../../../core/base/services/community-cases.service';
import { ActivityMembersService } from '../../../core/base/services/activity-members.service';
import { GroupWorkspaceContextService } from '../../../core/base/services/group-workspace-context.service';
import { COMMUNITY_BASE_GROUP_ID } from '../../../core/contracts/group-type';
import type { CaseCommand, CaseFilters, CaseListContext, CommunityCase, CommunityScheduledTask, SaveCommunityCase, SaveCommunityScheduledTask, ScheduledTaskFilters, ScheduledTaskCounters, ScheduledTaskAction } from '../../../core/contracts/community-case.interface';
import type { ListQuery } from '../../../core/contracts/list.interface';
import { ProfileStore } from './profile.store';
import { UserProfileStore } from './user-profile.store';
import { GroupWorkspaceStore } from './group-workspace.store';
import { ActivityInvitePopupStore } from './activity-invite-popup.store';
import { MemberMenuStore } from './member-menu.store';
import { DialogStore } from './dialog.store';
import { AppUtils } from '../../../app-utils';
import type { ChatMessageAttachment } from '../../../core/contracts/chat.interface';
import type { ActivityMemberDTO } from '../../../core/contracts/activity.interface';

export type CaseEditorState = { kind: 'case'; value: CommunityCase | null; readOnly: boolean } | { kind: 'task'; value: CommunityScheduledTask | null; readOnly: boolean };
@Injectable({ providedIn: 'root' })
export class CommunityCasesStore {
  private readonly changes = inject(CommunityCaseChangesStore);
  private readonly activity = inject(ActivityStore);
  readonly appointments = inject(CaseAppointmentsStore);
  readonly offerings = inject(ServiceOfferingsStore);
  private readonly service = inject(CommunityCasesService);
  private readonly chats = inject(ChatsService);
  private readonly activities = inject(ActivitiesPopupStore);
  private readonly profile = inject(UserProfileStore);
  private readonly profiles = inject(ProfileStore);
  private readonly workspace = inject(GroupWorkspaceContextService);
  private readonly workspaces = inject(GroupWorkspaceStore);
  private readonly members = inject(ActivityMembersService);
  private readonly dialogs = inject(DialogStore);
  private readonly picker = inject(ActivityInvitePopupStore);
  private readonly memberMenu = inject(MemberMenuStore);
  readonly session = signal<{ userId: string; tasks: boolean; list: boolean } | null>(null);
  readonly component = signal<Type<unknown> | null>(null);
  readonly editor = signal<CaseEditorState | null>(null);
  readonly board = signal<CommunityCase | null>(null);
  readonly quotationFocus = signal<string|null>(null);
  readonly quotations = signal<CommunityCase | null>(null);
  readonly changed = signal<CommunityCase | null>(null);
  readonly chatContext = signal<CommunityCase | null>(null);
  readonly counters = signal<CaseListContext>({ total: 0 });
  readonly taskCounters = signal<ScheduledTaskCounters>({ total: 0, active: 0, paused: 0, trash: 0 });
  private taskRevision = 0;
  readonly taskChanged = signal<CommunityScheduledTask | null>(null);
  readonly count = computed(() => this.activity.getUserCounterOverride(this.profile.activeUserId(), 'cases')
    ?? this.profile.activeUserProfile()?.activities?.cases ?? 0);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly groups = computed(() => this.workspaces.workspaces().filter(g => g.groupType === 'community' && g.groupId !== COMMUNITY_BASE_GROUP_ID && g.membershipStatus === 'accepted'));
  readonly managedGroups = computed(() => this.groups().filter(g => g.role === 'Admin'));
  readonly activeGroup = computed(() => this.groups().find(g => g.groupId === this.workspace.active()?.groupId) ?? null);
  readonly audienceMembers = signal<ActivityMemberDTO[]>([]);
  readonly audienceLoading = signal(false);
  private audienceRequest: { groupId: string; promise: Promise<ActivityMemberDTO[]> } | null = null;
  private generation = 0;
  private chatContextGeneration = 0;
  private knownAccount = '';
  private readonly known = new Map<string, CommunityCase>();
  constructor() {
    effect(() => { const change = this.changes.change(); if (change?.accountId === this.workspace.accountId(this.profile.activeUserId())) untracked(() => this.publish(change.value)); });
    effect(() => {
      const account = this.workspace.accountId(this.profile.activeUserId());
      if (account !== this.knownAccount) { this.knownAccount = account; this.known.clear(); this.counters.set({ total: 0 }); this.taskCounters.set({total:0,active:0,paused:0,trash:0}); }
      if (this.session() && (account !== this.session()?.userId || !this.workspace.isCommunity())) this.close();
    });
  }
  async open(list = true): Promise<void> {
    if (!this.workspace.isCommunity()) return;
    this.close();
    const session = { userId: this.workspace.accountId(this.profile.activeUserId()), tasks: false, list };
    this.session.set(session);
    if (!this.component()) this.component.set((await import('../../components/community-cases-popup/community-cases-popup.component')).CommunityCasesPopupComponent);
    if (list && session === this.session()) void this.tasks({page:0,pageSize:1,filters:{status:'active'}}).catch(()=>{});
  }
  async openReference(id: string, list = true): Promise<void> {
    await this.open(list); const session = this.session(); if (!session) return;
    await this.mutate(async () => {
      const detail = await this.service.read(session.userId, id);
      return () => { this.publish(detail); this.board.set(detail); };
    });
  }
  close(): void { this.generation++; this.session.set(null); this.board.set(null); this.quotations.set(null); this.quotationFocus.set(null); this.editor.set(null); this.clearAudienceMembers(); this.busy.set(false); this.error.set(''); }
  closeBoard(): void { if (this.session()?.list) this.board.set(null); else this.close(); }
  closeEditor(): void { this.generation++; this.editor.set(null); this.clearAudienceMembers(); this.busy.set(false); this.error.set(''); }
  showTasks(value: boolean): void { const s = this.session(); if (s) this.session.set({ ...s, tasks: value }); }
  async page(query: ListQuery<CaseFilters>, signal?: AbortSignal) {
    const s = this.session(); if (!s) throw new DOMException('Closed', 'AbortError');
    const result = await this.service.page(s.userId, query, signal);
    if (s !== this.session()) throw new DOMException('Changed', 'AbortError');
    result.items.forEach(item => this.known.set(item.id, item));
    this.counters.set(result.context ?? { total: 0 });
    this.setCount(result.context?.total ?? 0); return result;
  }
  async tasks(query: ListQuery<ScheduledTaskFilters>, signal?: AbortSignal) {
    const s = this.session(); if (!s) throw new DOMException('Closed', 'AbortError');
    const revision = this.taskRevision;
    let result;
    try { result = await this.service.tasks(s.userId, query, signal); }
    catch(error) {
      if(s.userId===this.session()?.userId && !signal?.aborted && (error as Error)?.name!=='AbortError')this.error.set('case.tasks.load.failed');
      throw error;
    }
    if (s.userId !== this.session()?.userId || revision !== this.taskRevision) throw new DOMException('Changed', 'AbortError');
    if(this.error()==='case.tasks.load.failed')this.error.set('');
    if(result.context)this.taskCounters.set(result.context); return result;
  }
  editTask(value: CommunityScheduledTask | null = null, readOnly = false): void {
    this.showEditor({ kind: 'task', value, readOnly: readOnly || !!value && (!value.canManage || value.status === 'trash') });
  }
  newTaskGroupId(): string | null {
    const group = this.activeGroup();
    return group?.role === 'Admin' ? group.groupId : null;
  }
  async edit(value: CommunityCase | null = null, readOnly = false): Promise<void> {
    if (!value) { if (this.activeGroup()) this.showEditor({ kind: 'case', value: null, readOnly: false }); return; }
    const s = this.session(); if (!s) return;
    await this.mutate(async () => {
      const detail = await this.service.read(s.userId, value.id);
      return () => { this.publish(detail); this.showEditor({ kind: 'case', value: detail, readOnly: readOnly || !detail.canManage }); };
    });
  }
  private showEditor(editor: CaseEditorState): void {
    this.error.set(''); this.clearAudienceMembers(); this.editor.set(editor);
    const groupId = editor.value ? editor.value.communityId : editor.kind === 'case' ? this.activeGroup()?.groupId : this.newTaskGroupId();
    if (editor.kind === 'task' && editor.readOnly) return;
    if (editor.kind === 'case' && editor.readOnly && editor.value) {
      this.audienceMembers.set(CommunityCaseConverter.members(editor.value).filter(m => editor.value!.audienceAccountIds.includes(m.userId)));
    } else if (groupId) {
      void this.loadAudienceMembers(groupId).catch(() => { if (this.editor() === editor) this.error.set('case.save.failed'); });
    }
  }
  private clearAudienceMembers(): void { this.audienceRequest = null; this.audienceMembers.set([]); this.audienceLoading.set(false); }
  private loadAudienceMembers(groupId: string): Promise<ActivityMemberDTO[]> {
    if (this.audienceRequest?.groupId === groupId) return this.audienceRequest.promise;
    this.audienceLoading.set(true);
    const request = this.members.queryMembersByOwner({ ownerType: 'community', ownerId: groupId }).then(members => {
      const rows = members.filter(member => member.status === 'accepted');
      if (this.audienceRequest?.promise === request) this.audienceMembers.set(rows);
      return rows;
    }).catch(error => { if (this.audienceRequest?.promise === request) { this.audienceRequest = null; this.audienceLoading.set(false); } throw error; })
      .finally(() => { if (this.audienceRequest?.promise === request) this.audienceLoading.set(false); });
    this.audienceRequest = { groupId, promise: request };
    return request;
  }
  async save(value: SaveCommunityCase | SaveCommunityScheduledTask): Promise<void> {
    const s = this.session(), editor = this.editor(); if (!s || !editor || editor.readOnly) return;
    await this.mutate(async () => {
      if (editor.kind === 'task') {
        const result = await this.service.saveTask({ ...value as SaveCommunityScheduledTask, userId: s.userId });
        return () => { this.publishTask(result, editor.value); this.editor.set(null); this.clearAudienceMembers(); };
      }
      const result = await this.service.save({ ...value, userId: s.userId });
      return () => { this.publish(result, !value.id); this.editor.set(null); this.clearAudienceMembers(); };
    });
  }
  private publishTask(value: CommunityScheduledTask, old: CommunityScheduledTask | null): void {
    this.taskRevision++;
    this.taskCounters.update(counts=>{
      const next={...counts};
      if(old)next[old.status]=Math.max(0,next[old.status]-1);
      next[value.status]++;next.total=next.active+next.paused;return next;
    });
    this.taskChanged.set(value);
  }
  taskAction(value: CommunityScheduledTask, action: ScheduledTaskAction): void {
    if(!value.canManage)return;
    const apply=()=>this.mutate(async()=>{
      const session=this.session(); if(!session)return()=>{};
      const updated=await this.service.taskAction(session.userId,value.id,action,value.version);
      return()=>this.publishTask(updated,value);
    });
    if(action==='trash'||action==='pause')this.dialogs.open({
      title:action==='trash'?'case.task.delete':'case.task.pause',message:value.title,
      confirmLabel:action==='trash'?'delete':'case.task.pause',confirmTone:action==='trash'?'danger':'warning',
      confirmPalette:action==='trash'?'danger':'amber',onConfirm:apply
    });
    else void apply();
  }
  async command(c: CommunityCase, command: Omit<CaseCommand, 'userId' | 'version'>): Promise<void> {
    const s = this.session(); if (!s) return;
    await this.mutate(async () => {
      const result = await this.service.action(c.id, { ...command, userId: s.userId, version: c.version });
      return () => { this.publish(result); if (this.editor()?.kind === 'case') this.editor.set({ kind: 'case', value: result, readOnly: true }); };
    });
  }
  async openChat(c: CommunityCase, caseOfferId?: string): Promise<void> {
    const account = this.workspace.accountId(this.profile.activeUserId());
    if (!await this.workspaces.select(COMMUNITY_BASE_GROUP_ID) || account !== this.workspace.accountId(this.profile.activeUserId())) return;
    const userId = this.profile.activeUserId();
    try {
      const chat = await this.chats.ensureServiceChat({ serviceContext: 'case', caseId: c.id, caseOfferId, targetUserId: '', title: c.title, lastMessage: '' });
      if (!chat || userId !== this.profile.activeUserId()) return;
      this.activities.openEventChat(eventChatPopupRequestFromChat(chat), eventChatHeaderStateFromChat(chat));
    } catch { this.error.set('case.chat.failed'); }
  }
  async openMembers(c: CommunityCase): Promise<void> {
    const session = this.session(); if (!session) return;
    await this.activities.ensureEventMembersPopupLoaded();
    if (session !== this.session()) return;
    this.memberMenu.requestActivitiesNavigation({ type: 'members', ownerType: 'case', ownerId: c.id, subtitle: c.title,
      canManage: c.canManage, parentZIndex: 15200, members: CommunityCaseConverter.members(c),
      onInvite: c.canManage ? () => { void this.chooseMembers(COMMUNITY_BASE_GROUP_ID, [], ids => {
        void this.command(this.known.get(c.id) ?? c, { action: 'invite-members', memberAccountIds: ids });
      }); } : undefined });
  }
  async view(c: CommunityCase): Promise<void> {
    const s = this.session(); if (!s) return;
    await this.mutate(async () => { const value = await this.service.read(s.userId, c.id); return () => { this.publish(value); this.board.set(value); }; });
  }
  async openQuotations(c: CommunityCase, offerId?:string): Promise<void> {
    const s=this.session(); if(!s)return;
    await this.mutate(async()=>{const value=await this.service.read(s.userId,c.id);return()=>{this.publish(value);this.quotationFocus.set(offerId??null);this.quotations.set(value);};});
  }
  async loadChatContext(id: string): Promise<void> {
    const actor = this.workspace.accountId(this.profile.activeUserId());
    const generation=++this.chatContextGeneration;this.chatContext.set(null);
    try { const value=await this.service.detail(actor,id);
      if(generation===this.chatContextGeneration&&actor===this.workspace.accountId(this.profile.activeUserId()))this.chatContext.set(value);
    } catch { /* The chat access check remains authoritative. */ }
  }
  canInviteRecommendation(attachment: ChatMessageAttachment): boolean {
    const c=this.chatContext(), provider=attachment.ownerUserId ?? '';
    return !!c?.canManage && attachment.type==='service' && !!attachment.entityId && !!provider && c.status!=='trash'
      && !c.support.some(s=>s.accountId===provider&&s.serviceId===attachment.entityId&&s.status!=='declined');
  }
  async inviteRecommendation(attachment: ChatMessageAttachment): Promise<void> {
    const c=this.chatContext();if(!c||!this.canInviteRecommendation(attachment))return;
    const actor=this.workspace.accountId(this.profile.activeUserId());
    if(!this.session())this.session.set({userId:actor,tasks:false,list:true});
    await this.command(c,{action:'invite-provider',providerAccountId:attachment.ownerUserId ?? '',serviceId:attachment.entityId!});
  }
  async fromChat(id: string, action: 'members' | 'recommend', onRecommend?: (attachment: ChatMessageAttachment) => void): Promise<void> {
    const actor = this.workspace.accountId(this.profile.activeUserId());
    if (!this.session()) this.session.set({ userId: actor, tasks: false, list: true });
    try {
      const value = await this.service.detail(actor, id); if (actor !== this.workspace.accountId(this.profile.activeUserId())) return;
      this.publish(value);
      if (action === 'members') await this.openMembers(value); else await this.chooseProvider(value, true, onRecommend);
    } catch { this.error.set('case.save.failed'); }
  }
  async showTaskMembers(c: CommunityCase, selection: readonly string[]): Promise<void> {
    await this.activities.ensureEventMembersPopupLoaded();
    this.memberMenu.requestActivitiesNavigation({type:'members',ownerType:'case',ownerId:c.id,snapshotOnly:true,viewOnly:true,
      subtitle:c.title,parentZIndex:15400,members:CommunityCaseConverter.members(c).filter(m=>selection.includes(m.userId))});
  }
  async showProviders(c: CommunityCase): Promise<void> {
    await this.offerings.openProviders(c.title,c.support.filter(s=>s.status!=='declined').flatMap(s=>s.serviceId?[s.serviceId]:[]));
  }
  openMemberProfile(accountId:string):void {
    const member=this.board()?.members.find(m=>m.accountId===accountId)
      ?? this.audienceMembers().find(m=>m.userId===accountId);
    if(member)void this.profiles.openProfileView({userId:accountId,label:member.name});
  }
  async chooseTaskMembers(c: CommunityCase, selection: readonly string[], apply: (ids: string[]) => void): Promise<void> {
    const session = this.session();
    await this.picker.ensureAssetMemberPickerPopupLoaded();
    if (session !== this.session()) return;
    const candidates = CommunityCaseConverter.members(c).filter(m => m.status === 'accepted');
    this.picker.openActivityInvitePopup({ ownerType: 'community', ownerId: COMMUNITY_BASE_GROUP_ID, headerTitle: 'case.board.members', parentZIndex: 15500,
      initialCandidates: candidates, initialSelection: candidates.filter(m => selection.includes(m.userId)),
      onApply: selected => { if (session === this.session()) apply(selected.map(m => m.userId)); } });
  }

  async chooseMembers(groupId: string, selection: readonly string[], apply: (ids: string[]) => void, one = false): Promise<void> {
    const session = this.session(), generation = this.generation;
    const candidates = this.editor() ? await this.loadAudienceMembers(groupId)
      : (await this.members.queryMembersByOwner({ ownerType: 'community', ownerId: groupId })).filter(m => m.status === 'accepted');
    if (!session || session !== this.session() || generation !== this.generation) return;
    await this.picker.ensureAssetMemberPickerPopupLoaded();
    if (session !== this.session() || generation !== this.generation) return;
    this.picker.openActivityInvitePopup({ ownerType: 'community', ownerId: groupId, headerTitle: 'case.audience', parentZIndex: 15100,
      initialCandidates: candidates, initialSelection: candidates.filter(m => selection.includes(m.userId)), selectionLimit: one ? 1 : undefined,
      allowSelectAll: !one,
      onApply: selected => { if (session === this.session() && generation === this.generation) apply(selected.map(m => m.userId)); } });
  }
  async chooseProvider(c: CommunityCase, recommend = false, onRecommend?: (attachment: ChatMessageAttachment) => void): Promise<void> {
    const session = this.session();
    await this.offerings.open(item => {
      if (session !== this.session()) return;
      const apply = async (providerAccountId: string) => {
        await this.command(this.known.get(c.id) ?? c, { action: recommend ? 'recommend' : 'invite-provider', providerAccountId, serviceId: item.service.id });
        if(recommend&&!this.error()&&session===this.session())onRecommend?.({id:crypto.randomUUID(),type:'service',entityId:item.service.id,
          ownerUserId:providerAccountId,title:item.service.title,subtitle:item.ownerName,
          description:item.service.description,previewUrl:item.service.imageUrls[0]??null,status:'available'});
      };
      if (item.service.staffAccountIds.length === 1) { void apply(item.service.staffAccountIds[0]); return; }
      void this.chooseServiceStaff(item.service.staffAccountIds, id => void apply(id));
    });
  }
  private async chooseServiceStaff(ids: readonly string[], apply: (id: string) => void): Promise<void> {
    const session = this.session(), generation = this.generation;
    const candidates = (await this.members.queryMembersByOwner({ ownerType: 'community', ownerId: COMMUNITY_BASE_GROUP_ID }))
      .filter(member => member.status === 'accepted' && ids.includes(member.userId));
    await this.picker.ensureAssetMemberPickerPopupLoaded();
    if (session !== this.session() || generation !== this.generation) return;
    this.picker.openActivityInvitePopup({ ownerType: 'community', ownerId: COMMUNITY_BASE_GROUP_ID, headerTitle: 'service.staff', parentZIndex: 15100,
      initialCandidates: candidates, initialSelection: [], selectionLimit: 1,
      onApply: selected => { if (session === this.session() && generation === this.generation && selected[0]) apply(selected[0].userId); } });
  }
  private setCount(count: number): void {
    this.activity.patchUserCounterOverrides(this.profile.activeUserId(), { cases: count });
  }
  private publish(c: CommunityCase, created = false): void {
    const old = this.known.get(c.id);
    this.known.set(c.id, c);
    const before = old && old.status !== 'trash' ? 1 : 0, after = c.status !== 'trash' ? 1 : 0;
    if ((old || created) && before !== after) this.setCount(Math.max(0, this.count() + after - before));
    if (old || created) this.counters.update(current => {
      const next: CaseListContext = { ...current, total: Math.max(0, current.total + after - before) };
      for (const [item, delta] of [[old, -1], [c, 1]] as const) {
        if (!item) continue;
        const key = `${item.status}:${item.caseType}`;
        next[key] = Math.max(0, (next[key] ?? 0) + delta);
      }
      return next;
    });
    if (this.board()?.id === c.id) this.board.set(c);
    if (this.chatContext()?.id === c.id) this.chatContext.set(c);
    if (this.quotations()?.id === c.id) this.quotations.set(c);
    this.changed.set(c);
  }
  private async mutate(work: () => Promise<() => void>): Promise<void> {
    if (this.busy()) return; const generation = ++this.generation;
    this.busy.set(true); this.error.set('');
    try { const apply = await work(); if (generation === this.generation) apply(); }
    catch (error) {
      if (generation === this.generation) {
        const status=(error as {status?:number})?.status, message=error instanceof Error?error.message:'';
        this.error.set(status===403||message==='Forbidden'?'case.save.forbidden':status===409||message==='case.changed'?'case.changed':message==='case.task.dependencies.cycle'?message:'case.save.failed');
      }
    }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
}
