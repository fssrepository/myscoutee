import { Component, computed, effect, inject, signal, untracked, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { AppUtils } from '../../../app-utils';
import { PopupComponent, type PopupModel } from '../core/popup';
import type { DateInputRangeValue } from '../core/form/inputs/date-input';
import { FormFlowComponent, type FormFlowModel, type FormFlowActionEvent } from '../core/form/flow';
import { SmartListComponent, TextCardComponent, type SmartListConfig, type SmartListLoadPage } from '../core/smart-list';
import type { AppMenuItem, AppMenuItemSelectEvent } from '../core/menu';
import { CommunityCasesStore } from '../../context/stores/community-cases.store';
import { I18nService } from '../../../core/base/services/i18n.service';
import { I18nPipe } from '../../pipes/i18n.pipe';
import { ExplanationGuideService } from '../../../core/base/services/explanation-guide.service';
import { CommunityCaseConverter } from '../../converters/community-case.converter';
import type { CaseBoardTask, CaseOffer } from '../../../core/contracts/community-case.interface';
import type { TextCardTone } from '../core/smart-list/card/text-card/text-card.component';
const STAGES = [
  { id: 'todo', icon: 'checklist', palette: 'blue', tone: 'blue' },
  { id: 'in-progress', icon: 'play_circle', palette: 'orange', tone: 'orange' },
  { id: 'done', icon: 'check_circle', palette: 'green', tone: 'green' }
] as const;
interface TaskRow { id: string; icon:string; task: CaseBoardTask; title: string; subtitle: string; meta: string; detail: string[]; price: string; tone: TextCardTone; menu: AppMenuItem[]; }
@Component({ selector: 'app-community-case-board', standalone: true,
  imports: [PopupComponent, SmartListComponent, TextCardComponent, FormsModule, FormFlowComponent, I18nPipe],
  template: `@if (store.board(); as value) {
    <app-popup [model]="model()" [zIndex]="14500" data-guide-context="community-case-board">
      <app-smart-list data-guide-field="case-board-tasks" [config]="boardConfig" [loadPage]="loadColumns" [itemTemplate]="columnTemplate"></app-smart-list>
      <ng-template #columnTemplate let-column>
        <section class="case-board-column">
          <header><app-text-card [title]="column.label | i18n" [icon]="column.icon" [tone]="column.tone"></app-text-card></header>
          <app-smart-list #columnList [config]="config" [loadPage]="column.load" [itemTemplate]="taskTemplate" (menuItemSelect)="taskAction($event)"></app-smart-list>
        </section>
      </ng-template>
      <ng-template #taskTemplate let-row>
        <app-text-card [icon]="row.icon" [title]="row.title" [subtitle]="row.subtitle" [meta]="row.meta" [detail]="row.detail" [tone]="row.tone" [badge]="row.price" badgeTone="price" [badgePosition]="row.task.status === 'deleted' ? 'start' : 'end'"
          [statusBadge]="row.task.status === 'deleted' ? ('case.board.deleted' | i18n) : ''" statusBadgeTone="danger" [statusBadgeIcon]="row.task.status === 'deleted' ? 'delete' : ''"
          [menuItems]="row.menu" [menuTitle]="row.title" [menuPalette]="row.tone" [useSharedMenuTrigger]="true" [sharedMenuId]="'task-' + row.id"></app-text-card>
      </ng-template>
    </app-popup>
    @if (task(); as taskValue) {
      <app-popup [model]="editorModel()" [zIndex]="15300" data-guide-context="community-case-board-task">
        <app-form-flow data-guide-field="case-board-task-details" [model]="taskFlow()" [ngModel]="taskForm()" (ngModelChange)="taskFormChanged($event)" (action)="taskFormAction($event)" [saving]="store.busy()"></app-form-flow>
      </app-popup>
    }
    @if (offerSelection(); as selection) {
      <app-popup [model]="offerSelectionModel()" [zIndex]="15400">
        <app-smart-list [config]="offerConfig" [loadPage]="loadOffers" [itemTemplate]="offerTemplate" (menuItemSelect)="offerAction($event)"></app-smart-list>
        <ng-template #offerTemplate let-row>
          <app-text-card [title]="row.subtitle" [detail]="row.detail" icon="request_quote" tone="gold"
            [badge]="row.title" badgeTone="price" badgePosition="end"
            [selectable]="true" [selected]="selection.includes(row.id)" selectPalette="picker" (selectionToggle)="toggleOffer(row.id)"
            [menuItems]="row.menu" [useSharedMenuTrigger]="true" [sharedMenuId]="'offer-' + row.id"></app-text-card>
        </ng-template>
      </app-popup>
    }
    @if (dependencySelection(); as selection) {
      <app-popup [model]="dependencyModel()" [zIndex]="15400">
        <app-smart-list [config]="dependencyConfig" [loadPage]="loadDependencies" [itemTemplate]="dependencyTemplate"></app-smart-list>
        <ng-template #dependencyTemplate let-row>
          <app-text-card [title]="row.title" [subtitle]="row.description" tone="blue" [selectable]="true" [selected]="selection.includes(row.id)" selectPalette="picker" (selectionToggle)="toggleDependency(row.id)"></app-text-card>
        </ng-template>
      </app-popup>
    }
  }`, styles: [`.case-board-column { min-width:0; min-height:0; display:flex; flex-direction:column; gap:.5rem; }`]
})
export class CommunityCaseBoardComponent {
  protected readonly store = inject(CommunityCasesStore);
  private readonly i18n = inject(I18nService);
  private readonly guide = inject(ExplanationGuideService);
  private readonly lists = viewChildren<SmartListComponent<TaskRow>>('columnList');
  protected readonly task = signal<CaseBoardTask | null>(null);
  protected readonly offerSelection = signal<string[]|null>(null);
  protected readonly dependencySelection = signal<string[] | null>(null);
  protected readonly canEditTask = computed(() => {
    const c = this.store.board();
    return !!c && ['open','in-progress'].includes(c.status) && c.canManage;
  });
  protected readonly config: SmartListConfig<TaskRow> = { pageSize: 200, mobilePageSizeCap: null, trackBy: (_, r) => r.id,
    cacheable: { identity: r => r.id }, showStickyHeader: false, showGroupMarker: () => false, emptyLabel: 'case.board.empty', headerProgress: { enabled: true } };
  protected readonly dependencyConfig: SmartListConfig<CaseBoardTask> = { pageSize: 200, mobilePageSizeCap: null, trackBy: (_, r) => r.id,
    showStickyHeader: false, showGroupMarker: () => false, emptyLabel: 'case.board.dependencies.empty' };
  protected readonly columns = STAGES.map(stage => ({ ...stage, label: `case.board.${stage.id}`,
    load: (() => { const items = this.rows().filter(r => (r.task.status === 'deleted' ? 'done' : r.task.status) === stage.id); return of({ items, total: items.length, nextCursor: null }); }) as SmartListLoadPage<TaskRow> }));
  protected readonly boardConfig: SmartListConfig<typeof this.columns[number]> = {
    pageSize:3,mobilePageSizeCap:null,listLayout:'card-grid',orientation:'horizontal',desktopColumns:3,
    snapMode:'none',mobileStepper:true,pagination:{mode:'arrows'},trackBy:(_,column)=>column.id,showStickyHeader:false,showGroupMarker:()=>false
  };
  protected readonly loadColumns:SmartListLoadPage<typeof this.columns[number]>=()=>of({items:this.columns,total:this.columns.length,nextCursor:null});
  protected readonly rows = computed<TaskRow[]>(() => {
    const c = this.store.board(); if (!c) return [];
    const names = new Map(c.members.map(m => [m.accountId, m.name]));
    const tasks = new Map(c.boardTasks.map(t => [t.id, t]));
    const offers = new Map(c.offers.map(offer => [offer.id, offer]));
    const active = ['open','in-progress'].includes(c.status);
    return c.boardTasks.map(task => {
      const editable = active && c.canManage;
      const menu: AppMenuItem[] = [
        { id: 'task-view', label: editable ? 'edit' : 'view', icon: editable ? 'edit' : 'article', palette: 'blue', surface: 'tinted', context: task },
        { id: 'task-members', label: 'case.board.members', icon: 'groups', palette: 'teal', surface: 'tinted', context: task },
        ...(editable ? [{id:'task-progress',label:`case.board.action.${task.status==='todo'?'start':task.status==='in-progress'?'complete':'reopen'}`,icon:task.status==='todo'?'play_arrow':task.status==='in-progress'?'done':'restore',palette:task.status==='in-progress'?'green' as const:'blue' as const,surface:'tinted' as const,context:task}] : []),
        ...(c.canManage && task.status !== 'deleted' ? [{ id: 'task-delete', label: 'delete', icon: 'delete', palette: 'danger' as const, surface: 'tinted' as const, context: task }] : [])
      ];
      const totals=new Map<string,number>();
      for(const id of task.offerIds??[]){const offer=offers.get(id);if(offer)totals.set(offer.currency,(totals.get(offer.currency)??0)+offer.amount);}
      const price=[...totals].map(([currency,amount])=>`${new Intl.NumberFormat(this.i18n.currentLanguage(),{maximumFractionDigits:2}).format(amount)} ${currency}`).join(' · ');
      return { id: task.id, price, icon:task.status==='deleted'?'delete':STAGES.find(s=>s.id===task.status)!.icon, task, title: task.title,
        subtitle: task.startAtIso ? task.endAtIso ? AppUtils.dateTimeRangeLabel(task.startAtIso, task.endAtIso, '')
          : `${AppUtils.shortMonthDayLabel(new Date(task.startAtIso))}, ${AppUtils.clockTimeLabel(new Date(task.startAtIso))}` : '',
        meta: task.assigneeAccountIds.map(id => names.get(id) ?? '').filter(Boolean).join(' · '),
        detail: [task.description, task.dependsOnIds.length ? `${this.i18n.translate('case.board.dependencies')}: ${task.dependsOnIds.map(id => tasks.get(id)?.title ?? '').join(' · ')}` : ''].filter(Boolean),
        tone: task.status==='deleted'?'danger':STAGES.find(s => s.id === task.status)!.tone, menu };
    });
  });
  constructor() {
    effect(onCleanup => onCleanup(untracked(() => this.guide.registerContext('community.case.board'))));
    effect(onCleanup => { if (this.task()) onCleanup(untracked(() => this.guide.registerContext('community.case.board.task'))); });
    effect(() => { const rows = this.rows(), lists = this.lists(); untracked(() => lists.forEach((list, i) => {
      const items = rows.filter(r => (r.task.status === 'deleted' ? 'done' : r.task.status) === STAGES[i].id); list.syncVisibleItems(items, { total: items.length, hasMore: false, nextCursor: null });
    })); });
  }
  protected readonly model = computed<PopupModel>(() => {
    const c = this.store.board()!;
    return { errorMessage: this.task() ? null : this.store.error(), title: c.title, subtitle: 'case.board.title', size: 'wide', height: 'full', bodyLayout: 'fill', onClose: () => { this.store.board.set(null); },
      headerControls: c.canManage && ['open','in-progress'].includes(c.status)
        ? [{id:'create',icon:'add',ariaLabel:'case.board.create',palette:'green'}] : [],
      onAction: () => { if (!c.canManage || !['open','in-progress'].includes(c.status)) return; this.store.error.set(''); this.task.set({ id: crypto.randomUUID(), title: '', description: '', status: 'todo', assigneeAccountIds: [], dependsOnIds: [], startAtIso: null, endAtIso: null }); } };
  });
  protected taskAction(e: AppMenuItemSelectEvent): void {
    const c = this.store.board(), task = e.context as CaseBoardTask; if (!c) return;
    if(e.id==='task-progress' && c.canManage && ['open','in-progress'].includes(c.status)) {
      void this.store.command(c,{action:'save-board-task',task:{...task,status:task.status==='todo'?'in-progress':task.status==='in-progress'?'done':'todo'}});
    } else if (e.id === 'task-delete' && c.canManage) void this.store.command(c, { action: 'delete-board-task', taskId: task.id });
    else if (e.id === 'task-members') {
      if (c.canManage && ['open','in-progress'].includes(c.status)) void this.store.chooseTaskMembers(c, task.assigneeAccountIds, ids => {
        const latest = this.store.board(); if (latest) void this.store.command(latest, { action: 'save-board-task', task: { ...task, assigneeAccountIds: ids } });
      }); else { void this.store.showTaskMembers(c, task.assigneeAccountIds); }
    } else if (e.id === 'task-view') { this.store.error.set(''); this.task.set(structuredClone(task)); }
  }
  protected readonly editorModel = computed<PopupModel>(() => {
    const task = this.task()!, c = this.store.board()!, editable = this.canEditTask();
    return { errorMessage: this.store.error(), title: 'case.board.task', size: 'wide', onClose: () => this.task.set(null),
      headerControls: editable ? [{ id: 'save', icon: 'done', ariaLabel: 'save', palette: 'success', disabled: this.store.busy() || !task.title.trim() }] : [],
      onAction: () => { if (!this.canEditTask()) return; void this.store.command(c, { action: 'save-board-task', task: { ...task, startAtIso: task.startAtIso || null, endAtIso: task.endAtIso || null } }).then(() => { if (!this.store.error()) this.task.set(null); }); } };
  });
  protected taskFormAction(event:FormFlowActionEvent):void {
    const c=this.store.board(),task=this.task();if(!c||!task)return;
    if(event.control.id==='member-list') {this.store.openMemberProfile(event.sourceEvent.id);return;}
    if(event.control.id==='offer-list') {
      const id=String(event.context??'');
      if(event.sourceEvent.id==='view'&&(task.offerIds??[]).includes(id))void this.store.openQuotations(c,id);
      else if(event.sourceEvent.id==='remove'&&this.canEditTask())this.task.update(t=>t&&({...t,offerIds:(t.offerIds??[]).filter(offerId=>offerId!==id)}));
      return;
    }
    if(!this.canEditTask())return;
    if(event.control.id==='members')void this.store.chooseTaskMembers(c,task.assigneeAccountIds,ids=>this.task.update(t=>t&&({...t,assigneeAccountIds:ids})));
    else if(event.control.id==='dependencies')this.dependencySelection.set([...task.dependsOnIds]);
    else if(event.control.id==='offers')this.offerSelection.set([...(task.offerIds??[])]);
  }
  protected readonly taskForm = computed(() => {
    const task=this.task();return task?{...task,dateRange:{startAt:task.startAtIso??'',endAt:task.endAtIso??'',precision:'minute' as const}}:null;
  });
  protected taskFormChanged(value: CaseBoardTask & {dateRange:DateInputRangeValue}): void {
    const {dateRange,...task}=value;
    this.task.set({...task,startAtIso:AppUtils.isoLocalDateTimeToDate(dateRange.startAt)?.toISOString()??null,endAtIso:AppUtils.isoLocalDateTimeToDate(dateRange.endAt)?.toISOString()??null});
  }
  protected readonly taskFlow = computed<FormFlowModel>(() => {
    const t = (key: string) => this.i18n.translate(key), editable = this.canEditTask(), task=this.task()!, c=this.store.board()!;
    const members=new Map(c.members.map(member=>[member.accountId,member])),tasks=new Map(c.boardTasks.map(task=>[task.id,task]));
    return { title: '', header: false, layout: 'grouped', summary: { enabled: false }, save: null, steps: [
      {id:'members',title:t('case.board.members'),icon:'groups',palette:'teal',
        headerControl:editable?{id:'members',kind:'menu',config:{kind:'inline',items:[{id:'members',icon:'add',ariaLabel:'case.board.members',palette:'green',disabled:this.store.busy()}]}}:null,
        controls:task.assigneeAccountIds.length?[{id:'member-list',kind:'menu',layout:'wide',config:{kind:'inline',items:task.assigneeAccountIds.flatMap(id=>{const member=members.get(id);return member?[{id,label:member.name,icon:'person',trailingIcon:'chevron_right',layout:'pill' as const,kind:'action' as const,palette:'teal' as const}]:[];})}}]
          :[{id:'members-empty',kind:'static',summary:{value:()=>t('case.board.members.none')}}]},
      { id: 'task', title: '', controls: [
      { id: 'title', guideFieldId:'title',bind: 'title', kind: 'text', label: t('name'), required: true, maxLength: 120, disabled: !editable },
      { id: 'description', guideFieldId:'description',bind: 'description', kind: 'textarea', label: t('description'), rows: 4, maxLength: 4000, disabled: !editable }
    ] }, {id:'date',title:t('date'),icon:'date_range',controls:[
      {id:'date-range',guideFieldId:'date-range',bind:'dateRange',kind:'date',layout:'wide',disabled:!editable,config:{model:{mode:'range',precision:'minute',
        range:{start:{label:'case.board.start'},end:{label:'case.board.end'}}}}}
    ]},
      {id:'offers',title:t('case.action.offers'),icon:'request_quote',palette:'gold',
        headerControl:editable?{id:'offers',kind:'menu',config:{kind:'inline',items:[{id:'offers',icon:'add',ariaLabel:'case.board.offers.select',palette:'green',disabled:this.store.busy()}]}}:null,
        controls:(task.offerIds?.length??0)>0?[{id:'offer-list',kind:'text-cards',layout:'wide',config:{columns:3,items:(task.offerIds??[]).flatMap(id=>{
          const offer=c.offers.find(o=>o.id===id);return offer?[{id,title:members.get(offer.providerAccountId)?.name??t('case.offer.view'),detail:offer.note,
            icon:'request_quote',tone:'gold' as const,price:`${offer.amount} ${offer.currency}`,menuItems:[
              {id:'view',label:'case.offer.view',icon:'article',palette:'blue' as const,surface:'tinted' as const,context:id},
              ...(editable?[{id:'remove',label:'remove',icon:'link_off',palette:'danger' as const,surface:'tinted' as const,context:id}]:[])
            ]}]:[];})}}]
          :[{id:'offers-empty',kind:'static',summary:{value:()=>t('case.board.offers.none')}}]},
      {id:'dependencies',title:t('case.board.dependencies'),icon:'account_tree',palette:'violet',
        headerControl:editable?{id:'dependencies',kind:'menu',config:{kind:'inline',items:[{id:'dependencies',icon:'add',ariaLabel:'case.board.dependencies',palette:'green',disabled:this.store.busy()}]}}:null,
        controls:task.dependsOnIds.length?[{id:'dependency-list',kind:'table',layout:'wide',config:{rows:task.dependsOnIds.flatMap(id=>{const dependency=tasks.get(id);return dependency?[{label:dependency.title,value:t('case.board.'+dependency.status),icon:dependency.status==='deleted'?'delete':STAGES.find(stage=>stage.id===dependency.status)!.icon}]:[];})}}]
          :[{id:'dependencies-empty',kind:'static',summary:{value:()=>t('case.board.dependencies.none')}}]},
] };
  });
  protected readonly offerRows=computed(()=>{
    const c=this.store.board();return c?.offers.filter(offer=>offer.status==='accepted').map(offer=>{
      const style=CommunityCaseConverter.offerStyle(offer.status);
      return {...CommunityCaseConverter.offerRow(offer,c,k=>this.i18n.translate(k)),statusLabel:this.i18n.translate(`case.offer.${offer.status}`),statusTone:style.tone,statusIcon:style.icon,
        menu:[{id:'view',label:'case.offer.view',icon:'article',palette:'blue' as const,surface:'tinted' as const,context:offer}]};
    })??[];
  });
  protected readonly offerConfig:SmartListConfig<ReturnType<typeof this.offerRows>[number]>={pageSize:20,listLayout:'card-grid',desktopColumns:3,trackBy:(_,row)=>row.id,showStickyHeader:false,showGroupMarker:()=>false,emptyLabel:'case.offers.empty'};
  protected readonly loadOffers:SmartListLoadPage<ReturnType<typeof this.offerRows>[number]>=query=>{
    const rows=this.offerRows(),start=Number(query.cursor??0),items=rows.slice(start,start+query.pageSize);
    return of({items,total:rows.length,nextCursor:start+items.length<rows.length?String(start+items.length):null});
  };
  protected offerAction(event:AppMenuItemSelectEvent):void {const c=this.store.board(),offer=event.context as CaseOffer;if(c&&offer)void this.store.openQuotations(c,offer.id);}
  protected toggleOffer(id:string):void {if(!this.store.board()?.offers.some(o=>o.id===id&&o.status==='accepted'))return;this.offerSelection.update(ids=>ids?.includes(id)?ids.filter(v=>v!==id):[...(ids??[]),id]);}
  protected readonly offerSelectionModel=computed<PopupModel>(()=>{
    const ids=this.offerSelection()??[],offers=this.store.board()?.offers??[];
    return {title:'case.board.offers.select',size:'wide',onClose:()=>this.offerSelection.set(null),
      headerControls:[{id:'selection',kind:'menu',menuKind:'inline',closeOnSelect:false,items:[
        ...(ids.length?[{id:'basket',icon:'shopping_basket',openIcon:'shopping_basket',kind:'branch' as const,palette:'gold' as const,counter:ids.length,items:ids.map(id=>{
          const offer=offers.find(o=>o.id===id);return {id,label:offer?`${offer.note || this.store.board()?.members.find(m=>m.accountId===offer.providerAccountId)?.name || ''} · ${offer.amount} ${offer.currency}`:'',removable:true,removeIcon:'close',closeOnSelect:false,surface:'tinted' as const};})}]:[]),
        {id:'confirm',icon:'done',ariaLabel:'confirm',palette:'success',kind:'action'}]}],
      onMenuSelect:e=>{if(!this.canEditTask())return;if(e.itemSelect.id==='confirm'){this.task.update(t=>t&&({...t,offerIds:[...ids]}));this.offerSelection.set(null);}
        else if(e.itemSelect.action==='remove')this.toggleOffer(e.itemSelect.id);}};
  });
  protected readonly loadDependencies: SmartListLoadPage<CaseBoardTask> = () => {
    const tasks = this.store.board()?.boardTasks.filter(t => t.id !== this.task()?.id) ?? [];
    return of({ items: tasks, total: tasks.length, nextCursor: null });
  };
  protected toggleDependency(id: string): void { this.dependencySelection.update(ids => ids?.includes(id) ? ids.filter(v => v !== id) : [...(ids ?? []), id]); }
  protected readonly dependencyModel = computed<PopupModel>(() => {
    const ids = this.dependencySelection() ?? [], tasks = this.store.board()?.boardTasks ?? [];
    return { title: 'case.board.dependencies', size: 'wide', onClose: () => this.dependencySelection.set(null),
      headerControls: [{ id: 'selection', kind: 'menu', menuKind: 'inline', closeOnSelect: false, items: [
        ...(ids.length ? [{ id: 'basket', icon: 'shopping_basket', openIcon: 'shopping_basket', kind: 'branch' as const, palette: 'blue' as const, counter: ids.length, items: ids.map(id => ({ id, label: tasks.find(t => t.id === id)?.title ?? '', removable: true, removeIcon: 'close', closeOnSelect: false, surface: 'tinted' as const })) }] : []),
        { id: 'confirm', icon: 'done', ariaLabel: 'confirm', palette: 'success', kind: 'action' }] }],
      onMenuSelect: e => { if (e.itemSelect.id === 'confirm') { this.task.update(t => t && ({ ...t, dependsOnIds: [...ids] })); this.dependencySelection.set(null); }
        else if (e.itemSelect.action === 'remove') this.toggleDependency(e.itemSelect.id); } };
  });
}
