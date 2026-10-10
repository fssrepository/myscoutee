import {
  UiDateUtils,
  PopupComponent,
  type PopupModel,
  SmartListComponent,
  SingleRowComponent,
  type SingleRowData,
  type SmartListConfig,
  type SmartListLoadPage,
  I18nPipe,
  ExplanationGuideService,
  type UiBranding as DeploymentBrandingDto,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette
} from '@myscoutee/components';
import { Component, Input, ViewChild, effect, inject, untracked, computed, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { defer, map } from 'rxjs';
import { CommunityAnnouncementsStore } from '../../context/stores/community-announcements.store';

import { HomeHeaderComponent } from '../../../../home/components/home-header/home-header.component';
import { I18nService } from '../../../core/base/services/i18n.service';

import { CommunityAnnouncementEditorComponent } from './community-announcement-editor.component';

import type { CommunityAnnouncement, AnnouncementFilters, AnnouncementStatus, AnnouncementAction } from '../../../core/contracts/community-announcement.interface';

const ANNOUNCEMENT_STATUS_STYLE:Record<AnnouncementStatus,{icon:string;palette:AppMenuPalette}>={published:{icon:'public',palette:'green'},draft:{icon:'edit_note',palette:'gold'},trash:{icon:'delete',palette:'danger'}};
@Component({ selector: 'app-community-announcements', standalone: true,
  imports: [NgTemplateOutlet, PopupComponent, SmartListComponent, SingleRowComponent, HomeHeaderComponent, I18nPipe, CommunityAnnouncementEditorComponent],
  template: `@if (inline && branding) {
    <div class="community-home" data-guide-surface="community.home">
      <app-home-header [branding]="branding" [items]="headerItems()" (itemSelect)="headerAction($event)"></app-home-header>
      @if(store.error() && !store.editor()) {<single-row [row]="{id:'error',title:store.error()|i18n,icon:'error',surfaceTone:'danger'}"></single-row>}
      <ng-container *ngTemplateOutlet="list"></ng-container>
    </div>
  } @else {
    <app-popup [model]="popupModel()" [zIndex]="14000" data-guide-context="community-announcements"><ng-container *ngTemplateOutlet="list"></ng-container></app-popup>
  }
  <ng-template #list>

    <app-smart-list data-guide-field="announcements" #smartList [config]="config" [query]="query()" [loadPage]="loadPage" [itemTemplate]="rowTemplate" (menuItemSelect)="action($event)"></app-smart-list>
  </ng-template>
  <ng-template #rowTemplate let-row let-openMenu="openMenu"><single-row [row]="row" [useSharedMenu]="true" (menuRequest)="openMenu($event)"></single-row></ng-template>
  @if (!inline || !store.popup()) {
    @if (store.editor(); as editor) { <app-community-announcement-editor [editor]="editor"></app-community-announcement-editor> }
  }`, styles: [`.community-home { height:100%; display:flex; flex-direction:column; padding:1rem; gap:1rem; } app-smart-list { display:block; min-height:0; flex:1; }`]
})
export class CommunityAnnouncementsComponent {
  @Input() inline = false;
  @Input() branding: DeploymentBrandingDto | null = null;
  @ViewChild('smartList') private list?: SmartListComponent<SingleRowData<CommunityAnnouncement>, AnnouncementFilters>;
  protected readonly store = inject(CommunityAnnouncementsStore);
  private readonly i18n = inject(I18nService);
  private readonly guide = inject(ExplanationGuideService);
  protected readonly status = signal<AnnouncementStatus>('published');
  protected readonly query = computed(() => { return { filters: { communityId: this.store.groupId(), status: this.store.canManage() ? this.status() : 'published' as AnnouncementStatus, ...(!this.inline?{voting:true}:{}) }, userId: this.store.userId() }; });
  protected readonly config: SmartListConfig<SingleRowData<CommunityAnnouncement>, AnnouncementFilters> = {
    pageSize:20, trackBy: (_,row) => row.id, cacheable: { identity: row => row.id }, headerProgress: { enabled:true, placement:'inline' },
    sortable: { sortKey: row => [-Date.parse(row.eagerDetail?.publishedAtIso ?? row.eagerDetail?.createdAtIso ?? ''), row.id] },
    groupBy: row => UiDateUtils.smartListDayLabel(new Date(row.eagerDetail!.publishedAtIso ?? row.eagerDetail!.createdAtIso)),
    showFirstGroupMarker: false,
    emptyLabel: 'announcement.empty', menuItems: context => context.item?.eagerDetail ? this.menu(context.item.eagerDetail) : []
  };
  protected readonly loadPage: SmartListLoadPage<SingleRowData<CommunityAnnouncement>, AnnouncementFilters> = (q,c) =>
    defer(() => this.store.page(q,c?.signal)).pipe(map(p => ({ ...p, items:p.items.map(a => this.row(a)) })));
  constructor() {
    effect(onCleanup => { if (this.store.groupId()) onCleanup(untracked(() => this.guide.registerContext(this.inline?'community.home':'community.voting'))); });
    effect(() => { const a=this.store.changed(); if(!a || a.communityId!==this.store.groupId())return;
      if(a.status!==this.query().filters.status||(!this.inline&&!a.voting))untracked(() => this.list?.removeVisibleItemByIdentity(a.id));
      else if(!untracked(() => this.list?.patchVisibleItem(r=>r.id===a.id,()=>this.row(a))))untracked(() => this.list?.reinsertVisibleItem(this.row(a),{loadedRange:'before-or-within'})); });
  }
  private row(a:CommunityAnnouncement):SingleRowData<CommunityAnnouncement> {
    return {id:a.id,title:a.title,subtitle:a.body,detail:new Date(a.publishedAtIso??a.createdAtIso).toLocaleString(this.i18n.currentLanguage(),{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}),icon:a.voting?'how_to_vote':'campaign',eagerDetail:a,menuActions:this.menu(a).map(item=>item.id),
      badges:[{label:this.i18n.translate(a.voting?(a.closed?'announcement.closed':'announcement.voting'):'announcement.notice'),tone:a.voting?(a.closed?'muted':'info'):'success',position:'top-right'},
        ...(a.voting?[{label:`${a.castVotes}/${a.eligibleMembers}`,icon:'how_to_vote',tone:'muted' as const,position:'inline' as const}]:[])]};
  }
  private menu(a:CommunityAnnouncement):AppMenuItem[] {
    const items:[string,string][]=[['view','article']];
    if(a.status==='published'&&!this.store.canManage())items.push(['feedback','chat']);
    if(a.voting)items.push(a.closed?['results','poll']:['vote','how_to_vote']);
    if(a.canManage){ if(a.status!=='trash')items.push(['edit','edit']); if(a.status==='draft')items.push(['publish','publish']);
      if(a.status==='published')items.push(['unpublish','unpublished']); if(a.status==='trash')items.push(['restore','restore']);else items.push(['trash','delete']);
      if(a.voting&&a.status==='published'&&!a.closed)items.push(['close','lock']); }
    const palettes:Record<string,AppMenuPalette>={view:'blue',feedback:'teal',results:'violet',vote:'gold',edit:'blue',publish:'green',unpublish:'gold',restore:'green',trash:'danger',close:'red'};
    return items.map(([id,icon])=>({id,icon,label:`announcement.action.${id}`,palette:palettes[id],surface:'tinted',context:a}));
  }
  protected action(e:AppMenuItemSelectEvent):void {const a=e.context as CommunityAnnouncement;
    if(e.id==='feedback')void this.store.feedback(a);else if(e.id==='vote'||e.id==='results')this.store.viewVoting(a);else if(['view','edit'].includes(e.id))this.store.edit(a,e.id!=='edit');else void this.store.command(a,e.id as AnnouncementAction,undefined,this.menu(a).find(item=>item.id===e.id)?.palette);}
  protected readonly headerItems = computed<AppMenuItem[]>(() => {if(!this.store.canManage())return [];return [
    {id:'status',label:`announcement.status.${this.status()}`,...ANNOUNCEMENT_STATUS_STYLE[this.status()],kind:'select-trigger',layout:'pill',items:((this.store.canManage()?['published','draft','trash']:['published']) as AnnouncementStatus[]).map(id=>({id,label:`announcement.status.${id}`,...ANNOUNCEMENT_STATUS_STYLE[id],surface:'tinted',kind:'radio',active:id===this.status(),checked:id===this.status()}))},
    ...(this.store.canManage()?[{id:'create',icon:'add',label:'announcement.create',kind:'action' as const,layout:'pill' as const,palette:'green' as const}]:[])]; });
  protected headerAction(e:AppMenuItemSelectEvent):void { if(['published','draft','trash'].includes(e.id))this.status.set(e.id as AnnouncementStatus);else if(e.id==='create')this.store.edit(null,false,!this.inline); }
  protected readonly popupModel = computed<PopupModel>(() => { return {errorMessage:this.store.editor()?null:this.store.error(),title:'announcement.title',size:'wide',height:'full',bodyLayout:'fill',onClose:()=>this.store.close(),showToolbar:this.store.canManage(),
    toolbarControls:this.store.canManage()?[{id:'menu',kind:'menu',menuKind:'inline',items:this.headerItems()}]:[],onMenuSelect:e=>this.headerAction(e.itemSelect)}; });
}
