import { CommunityCaseQuotationsComponent } from './community-case-quotations.component';
import { CommunityCaseBoardComponent } from './community-case-board.component';
import { ExplanationGuideService } from '../../../core/base/services/explanation-guide.service';
import { AppUtils } from '../../../app-utils';
import { Component, ViewChild, effect, inject, untracked, computed, signal } from '@angular/core';
import { defer, map } from 'rxjs';
import { PopupComponent, type PopupModel } from '../core/popup';
import { SmartListComponent, InfoCardComponent, SingleRowComponent, type InfoCardData, type SingleRowData, type SmartListConfig, type SmartListLoadPage } from '../core/smart-list';
import { CommunityCasesStore } from '../../context/stores/community-cases.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import { CASE_TYPES, type CommunityCase, type CommunityScheduledTask, type CaseFilters, type CaseType, type CaseAction, type ScheduledTaskFilters, type ScheduledTaskAction, type ScheduledTaskStatus } from '../../../core/contracts/community-case.interface';
import type { AppMenuItem, AppMenuItemSelectEvent } from '../core/menu';
import { CommunityCaseEditorComponent } from './community-case-editor.component';
import { CommunityCaseConverter } from '../../converters/community-case.converter';

@Component({ selector: 'app-community-cases-popup', standalone: true,
  imports: [PopupComponent, SmartListComponent, InfoCardComponent, SingleRowComponent, CommunityCaseEditorComponent, CommunityCaseBoardComponent, CommunityCaseQuotationsComponent],
  template: `@if (store.session(); as session) {
    @if (session.list) {
    <app-popup [model]="model()" [zIndex]="14000" data-guide-context="community-cases">
      <app-smart-list data-guide-field="case-list" #caseList [config]="config" [loadPage]="loadPage" [query]="query()" [itemTemplate]="caseTemplate" (menuItemSelect)="action($event)"></app-smart-list>
      <ng-template #caseTemplate let-card let-openMenu="openMenu">
        <app-info-card [card]="card" [useSharedMenu]="true" (menuRequest)="openMenu($event)"></app-info-card>
      </ng-template>
    </app-popup>
    }
    @if (!session.list && !store.board() && store.error()) {
      <app-popup [model]="referenceErrorModel()" [zIndex]="14500"></app-popup>
    }
    @if (session.tasks) {
      <app-popup [model]="tasksModel()" [zIndex]="14500" data-guide-context="community-tasks">
        <app-smart-list data-guide-field="task-list" #taskList [config]="taskConfig" [loadPage]="loadTasks" [query]="taskQuery()" [itemTemplate]="taskTemplate" (menuItemSelect)="taskAction($event)"></app-smart-list>
        <ng-template #taskTemplate let-row let-openMenu="openMenu">
          <single-row [row]="row" [useSharedMenu]="true" [clickable]="false" (menuRequest)="openMenu($event)"></single-row>
        </ng-template>
      </app-popup>
    }
  }
  @if (store.board()) { <app-community-case-board></app-community-case-board> }
  @if (store.quotations()) { <app-community-case-quotations></app-community-case-quotations> }
  @if (store.editor(); as editor) { <app-community-case-editor [editor]="editor"></app-community-case-editor> }`
})
export class CommunityCasesPopupComponent {
  protected readonly store = inject(CommunityCasesStore);
  private readonly i18n = inject(I18nService);
  @ViewChild('caseList') private list?: SmartListComponent<InfoCardData<CommunityCase>, CaseFilters>;
  @ViewChild('taskList') private taskList?: SmartListComponent<SingleRowData<CommunityScheduledTask>, ScheduledTaskFilters>;
  protected readonly query = signal<{ filters: CaseFilters }>({ filters: { status: 'active' } });
  protected readonly config: SmartListConfig<InfoCardData<CommunityCase>, CaseFilters> = {
    pageSize: 20, listLayout: 'card-grid', trackBy: (_, c) => c.id, cacheable: { identity: c => c.id },
    headerProgress: { enabled: true, placement: 'inline' }, sortable: { sortKey: c => [-Date.parse(c.dateIso ?? ''), c.id] },
    groupBy: card => AppUtils.smartListDayLabel(new Date(card.dateIso!)), showFirstGroupMarker: false,
    menuItems: context => context.item?.eagerDetail ? this.menu(context.item.eagerDetail) : []
  };
  protected readonly taskQuery = signal<{filters:ScheduledTaskFilters}>({filters:{status:'active'}});
  protected readonly taskConfig: SmartListConfig<SingleRowData<CommunityScheduledTask>, ScheduledTaskFilters> = {
    pageSize: 20, trackBy: (_, row) => row.id, cacheable: { identity: row => row.id },
    headerProgress: { enabled: true, placement: 'inline' }, sortable: { sortKey: row => [row.eagerDetail?.nextDueAtIso ?? '', row.id] },
    groupBy: row => AppUtils.smartListDayLabel(new Date(row.eagerDetail!.nextDueAtIso)), showFirstGroupMarker: false,
    menuItems: context => context.item?.eagerDetail ? this.taskMenu(context.item.eagerDetail) : []
  };
  protected readonly loadPage: SmartListLoadPage<InfoCardData<CommunityCase>, CaseFilters> = (query, context) =>
    defer(() => this.store.page(query, context?.signal)).pipe(map(page => ({ ...page, items: page.items.map(c => this.card(c)) })));
  protected readonly loadTasks: SmartListLoadPage<SingleRowData<CommunityScheduledTask>, ScheduledTaskFilters> = (query, context) =>
    defer(() => this.store.tasks(query, context?.signal)).pipe(map(page => ({ ...page, items: page.items.map(t => this.taskRow(t)) })));
  private readonly guide = inject(ExplanationGuideService);
  constructor() {
    effect(onCleanup => {
      const session = this.store.session();
      if (session?.list) onCleanup(untracked(() => this.guide.registerContext(session.tasks ? 'community.tasks' : 'community.cases')));
    });
    effect(() => {
      const c = this.store.changed(); if (!c) return;
      const f = this.query().filters, matches = (!f.caseType || c.caseType === f.caseType)
        && (f.status === 'active' ? ['open', 'in-progress'].includes(c.status) : c.status === f.status);
      if (!matches) untracked(() => this.list?.removeVisibleItemByIdentity(c.id));
      else if (!untracked(() => this.list?.patchVisibleItem(row => row.id === c.id, () => this.card(c)))) untracked(() => this.list?.reinsertVisibleItem(this.card(c), { loadedRange: 'before-or-within' }));
    });
    effect(() => {
      const t=this.store.taskChanged(); if(!t)return;
      if(t.status!==this.taskQuery().filters.status)untracked(()=>this.taskList?.removeVisibleItemByIdentity(t.id));
      else if(!untracked(()=>this.taskList?.patchVisibleItem(row=>row.id===t.id,()=>this.taskRow(t))))
        untracked(()=>this.taskList?.reinsertVisibleItem(this.taskRow(t),{loadedRange:'before-or-within'}));
    });
  }
  private card(c: CommunityCase): InfoCardData<CommunityCase> {
    return CommunityCaseConverter.card(c);
  }
  private taskRow(t: CommunityScheduledTask): SingleRowData<CommunityScheduledTask> {
    return { id:t.id,title:t.title,subtitle:t.communityName || this.i18n.translate('case.task.personal'),
      detail:new Date(t.nextDueAtIso).toLocaleString(this.i18n.currentLanguage(),{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}),
      icon:'event_repeat',eagerDetail:t,clickable:false,menuActions:this.taskMenu(t).map(item=>item.id),
      badges:[...(t.communityId?[{label:`${t.affectedCount}`,icon:'groups',tone:'info' as const,position:'inline' as const}]:[]),
        {label:this.i18n.translate(`case.frequency.${t.frequency}`),tone:t.status==='active'?'success':t.status==='trash'?'danger':'warning',position:'top-right'}] };
  }
  private taskMenu(task: CommunityScheduledTask): AppMenuItem[] {
    const items:AppMenuItem[]=[{id:'view',label:'view',icon:'visibility',palette:'blue',surface:'tinted',context:task}];
    if(!task.canManage)return items;
    if(task.status==='trash')return [...items,{id:'restore',label:'restore',icon:'restore_from_trash',palette:'green',surface:'tinted',context:task}];
    return [...items,{id:'edit',label:'edit',icon:'edit',palette:'blue',surface:'tinted',context:task},
      {id:task.status==='active'?'pause':'resume',label:task.status==='active'?'case.task.pause':'case.task.resume',icon:task.status==='active'?'pause':'play_arrow',palette:task.status==='active'?'amber':'green',surface:'tinted',context:task},
      {id:'trash',label:'delete',icon:'delete',palette:'danger',surface:'tinted',context:task}];
  }

  private menu(c: CommunityCase): AppMenuItem[] {
    return CommunityCaseConverter.actions(c, this.store.session()?.userId ?? '');
  }
  protected action(event: AppMenuItemSelectEvent): void {
    const c = event.context as CommunityCase;
    if (event.id === 'chat') void this.store.openChat(c);
    else if (event.id === 'view') void this.store.view(c);
    else if (event.id === 'offers') void this.store.openQuotations(c);
    else if (event.id === 'members') void this.store.openMembers(c);
    else if (event.id === 'edit') void this.store.edit(c);
    else if (event.id === 'recommend' || event.id === 'invite-provider') void this.store.chooseProvider(c, event.id === 'recommend');
    else void this.store.command(c, { action: event.id as CaseAction });
  }
  protected taskAction(event: AppMenuItemSelectEvent): void {
    const task=event.context as CommunityScheduledTask;
    if(event.id==='view'||event.id==='edit')this.store.editTask(task,event.id==='view');
    else this.store.taskAction(task,event.id as ScheduledTaskAction);
  }
  protected readonly referenceErrorModel = computed<PopupModel>(() => ({
    title: 'case.action.view', errorMessage: this.store.error(), size: 'wide', onClose: () => this.store.close()
  }));
  protected readonly tasksModel = computed<PopupModel>(()=>{
    const selected=this.taskQuery().filters.status??'active';
    const styles={active:{icon:'play_circle',palette:'green' as const},paused:{icon:'pause_circle',palette:'amber' as const},trash:{icon:'delete',palette:'danger' as const}};
    const items=(['active','paused','trash'] as const).map(id=>({id,label:`case.task.status.${id}`,...styles[id],kind:'radio' as const,checked:id===selected,active:id===selected,surface:'tinted' as const,counter:{value:()=>this.store.taskCounters()[id],max:99},counterTone:'alert' as const}));
    return {title:'case.tasks',size:'wide',height:'full',bodyLayout:'fill',showToolbar:true,errorMessage:this.store.editor()?null:this.store.error(),onClose:()=>this.store.showTasks(false),
      toolbarControls:[{id:'status',kind:'menu',menuKind:'select',trigger:CommunityCaseConverter.trigger(items.find(item=>item.id===selected)!),items},
        {id:'create-task',icon:'add',ariaLabel:'case.task.create',palette:'green',align:'end'}],
      onAction:()=>this.store.editTask(),onMenuSelect:e=>this.taskQuery.set({filters:{status:e.itemSelect.id as ScheduledTaskStatus}})};
  });
  protected readonly model = computed<PopupModel>(() => {
    const filters = this.query().filters, counters = this.store.counters;
    const statusItems = (['active', 'completed', 'cancelled', 'trash'] as const).map(id => CommunityCaseConverter.statusOption(id, filters, counters));
    const typeItems = (['', ...CASE_TYPES] as const).map(id => CommunityCaseConverter.typeOption(id, filters, counters));
    return { errorMessage: this.store.board() || this.store.editor() || this.store.quotations() || this.store.session()?.tasks ? null : this.store.error(), title:'case.title', size:'wide', height:'full', bodyLayout:'fill',onClose:()=>this.store.close(),showToolbar:true,
      headerControls:[{id:'tasks',kind:'menu',menuKind:'inline',items:[{id:'tasks',label:'case.tasks',icon:'event_repeat',trailingIcon:'chevron_right',layout:'pill',kind:'action',palette:'teal',counter:{value:()=>this.store.taskCounters().total,max:99},counterTone:'alert'}]}],
      toolbarControls:[
        {id:'status',kind:'menu',menuKind:'select',trigger:CommunityCaseConverter.trigger(statusItems.find(i=>i.active)!),items:statusItems},
        {id:'type',kind:'menu',menuKind:'select',trigger:CommunityCaseConverter.trigger(typeItems.find(i=>i.active)!),items:typeItems},
        ...(this.store.activeGroup()?[{id:'create',icon:'add',ariaLabel:'case.create',palette:'green' as const,align:'end' as const}]:[])
      ],onAction:()=>void this.store.edit(),onMenuSelect:e=>{
        if(e.control.id==='status')this.query.set({filters:{...this.query().filters,status:e.itemSelect.id as CaseFilters['status']}});
        else if(e.control.id==='type')this.query.set({filters:{...this.query().filters,caseType:e.itemSelect.id as CaseType||null}});
        else if(e.itemSelect.id==='tasks')this.store.showTasks(true);
      }};
  });
}
