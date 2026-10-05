import { AppUtils } from '../../../app-utils';
import { ExplanationGuideService } from '../../../core/base/services/explanation-guide.service';
import { Component, OnChanges, OnDestroy, ViewChild, inject, computed, signal, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PopupComponent, type PopupModel } from '../core/popup';
import { FormFlowComponent, type FormFlowModel, type FormFlowActionEvent } from '../core/form/flow';
import { CommunityCasesStore, type CaseEditorState } from '../../context/stores/community-cases.store';
import { CommunityCaseConverter } from '../../converters/community-case.converter';
import { I18nService } from '../../../core/base/services/i18n.service';
import { SlotsInputComponent, type SlotsInputConfig } from '../core/form/inputs/slots-input/slots-input.component';
import { CASE_TYPES, type SaveCommunityScheduledTask, type CommunityCase, type TaskFrequency } from '../../../core/contracts/community-case.interface';

@Component({ selector: 'app-community-case-editor', standalone: true,
  imports: [FormsModule, PopupComponent, FormFlowComponent, SlotsInputComponent],
  template: `<app-popup [model]="popupModel()" [zIndex]="15000" data-guide-context="community-case-editor">
    <app-form-flow data-guide-field="case-details" [model]="flowModel()" [ngModel]="form()" (ngModelChange)="form.set($event)" (action)="audienceAction($event)" [saving]="store.busy()"></app-form-flow>
    @if (editor().kind === 'task') {
      <app-slots-input #scheduleInput [config]="scheduleConfig" [popupZIndex]="15300" [readOnly]="editor().readOnly"></app-slots-input>
    }
  </app-popup>`
})
export class CommunityCaseEditorComponent implements OnChanges, OnDestroy {
   readonly editor = input.required<CaseEditorState>();
  protected readonly store = inject(CommunityCasesStore);
  private readonly i18n = inject(I18nService);
  protected readonly form = signal<SaveCommunityScheduledTask>(null!);
  private readonly guide = inject(ExplanationGuideService);
  private unregisterGuide: (() => void) | null = null;
  ngOnDestroy(): void { this.unregisterGuide?.(); }
  ngOnChanges(): void {
    this.unregisterGuide ??= this.guide.registerContext(this.editor().kind === 'task' ? 'community.task.editor' : 'community.case.editor');
    const editor = this.editor();
    const v = editor.value;
    const groupId = v ? v.communityId : editor.kind === 'task' ? this.store.newTaskGroupId() : this.store.activeGroup()?.groupId ?? null;
    const scheduled = editor.kind === 'task' ? editor.value : null;
    this.form.set({ userId: this.store.session()?.userId ?? '', id: v?.id, version: v?.version, communityId: groupId,
      title: v?.title ?? '', description: v?.description ?? '', caseType: v?.caseType ?? 'maintenance',
      audienceAll: v?.audienceAll ?? (editor.kind === 'task' && this.store.managedGroups().some(g => g.groupId === groupId)),
      audienceAccountIds: [...(v?.audienceAccountIds ?? [])],
      startAtIso: scheduled?.startAtIso ?? scheduled?.nextDueAtIso ?? new Date().toISOString(), nextDueAtIso: scheduled?.nextDueAtIso ?? new Date().toISOString(),
      frequency: scheduled?.frequency ?? 'once', enabled: scheduled?.enabled ?? true });
  }
  @ViewChild('scheduleInput') private scheduleInput?: SlotsInputComponent;
  protected readonly scheduleConfig: SlotsInputConfig = {
    scheduleOnly:true,title:'case.schedule',startAtIso:()=>this.form().startAtIso,frequency:()=>this.form().frequency,
    frequencyOptions:['One-time','Monthly','Quarterly','Yearly'],
    scheduleChange:value=>this.form.update(form=>({...form,startAtIso:value.startAtIso,frequency:(value.frequency==='One-time'?'once':value.frequency.toLowerCase()) as TaskFrequency}))
  };
  protected readonly caseValue = computed<CommunityCase | null>(() => { const editor = this.editor(); return editor.kind === 'case' ? editor.value : null; });
  protected readonly canSelectMembers = computed(() => !this.editor().readOnly
    && (this.caseValue()?.canManage ?? this.store.managedGroups().some(g => g.groupId === this.form().communityId)));
  protected audienceAction(event: FormFlowActionEvent): void {
    if (event.control.id === 'schedule-frequency') { this.scheduleInput?.openScheduleEditor(); return; }
    if (event.control.id === 'audience-list') { this.store.openMemberProfile(event.sourceEvent.id); return; }
    if (event.control.id !== 'audience' || !this.canSelectMembers()) return;
    const form = this.form();
    if (form.communityId) void this.store.chooseMembers(form.communityId,
      form.audienceAll ? this.store.audienceMembers().map(m => m.userId) : form.audienceAccountIds,
      selected => this.form.update(value => ({ ...value, audienceAll: false, audienceAccountIds: selected })));
  }
  protected readonly popupModel = computed<PopupModel>(() => {
    return { errorMessage: this.store.error(), title: this.editor().kind === 'task' ? 'case.task.edit' : this.editor().readOnly ? 'case.view' : 'case.edit',
      subtitle: this.editor().value?.title, size: 'wide', height: 'full', onClose: () => this.store.closeEditor(),
      headerControls: this.editor().readOnly ? [] : [{id:'save',icon:'done',ariaLabel:'save',palette:'success',
        disabled:this.store.busy() || !this.form().title.trim() || this.editor().kind === 'case' && !this.form().communityId && !this.caseValue()?.scheduledTaskId
          || this.editor().kind === 'task' && (!Number.isFinite(Date.parse(this.form().startAtIso)) || !!this.form().communityId && !this.form().audienceAll && !this.form().audienceAccountIds.length)}],
      onAction: () => { void this.store.save({...this.form(),startAtIso:new Date(this.form().startAtIso).toISOString()}); } };
  });
  protected readonly flowModel = computed<FormFlowModel>(() => {
    const t = (key: string) => this.i18n.translate(key), form = this.form();
    const selected = this.store.audienceMembers().filter(m => form.audienceAll || form.audienceAccountIds.includes(m.userId));
    const model: FormFlowModel = { title: '', layout: 'grouped', header: false, save: null, summary: { enabled: false }, allowMenuOverflow: true,
      steps: [
        ...(form.communityId && !(this.editor().kind==='task'&&this.editor().readOnly) ? [{ id: 'audience', title: t('case.audience'), icon: 'groups', palette: 'teal' as const,
        headerControl: this.canSelectMembers() ? {id:'audience',kind:'menu' as const,config:{kind:'inline' as const,items:[
          {id:'members',icon:'add',ariaLabel:'case.select.members',palette:'green' as const,disabled:this.store.busy()}]}} : null,
        controls: selected.length ? [{id:'audience-list',guideFieldId:'audience',kind:'menu' as const,layout:'wide' as const,config:{kind:'inline' as const,items:selected.map(m=>({id:m.userId,label:m.name,imageUrl:m.avatarUrl,imageFallback:m.initials||AppUtils.initialsFromText(m.name),imageAlt:m.name,imageShape:"circle" as const,trailingIcon:'chevron_right',layout:'pill' as const,kind:'action' as const,palette:'teal' as const}))}}]
          : [{id:'audience-empty',guideFieldId:'audience',kind:'static' as const,summary:{value:()=>t(this.store.audienceLoading() ? 'loading' : 'case.audience.empty')}}]
      }] : []), { id: 'case', title: '', controls: [
        { id: 'title', guideFieldId:'title',bind: 'title', kind: 'text', label: t('name'), required: true, maxLength: 120 },
        { id: 'type', guideFieldId:'type',bind: 'caseType', kind: 'menu', label: t('case.type.all'), config: { kind: 'select',
          trigger: CommunityCaseConverter.trigger(CommunityCaseConverter.typeOption(this.form().caseType,{caseType:this.form().caseType},{total:0})),
          items: CASE_TYPES.map(id => ({...CommunityCaseConverter.typeOption(id,{caseType:this.form().caseType},{total:0}),value:id})) } },
        { id: 'description', guideFieldId:'description',bind: 'description', kind: 'textarea', label: t('description'), rows: 2, maxLength: 120, layout:'wide' }
      ] }, ...(this.editor().kind === 'task' ? [{ id:'schedule',title:t('case.schedule'),icon:'event_repeat',controls:[
        {id:'startAtIso',guideFieldId:'startAtIso',bind:'startAtIso',kind:'date' as const,label:t('case.task.start.from'),required:true,
          config:{model:{mode:'single' as const,precision:'minute' as const,valueFormat:'iso-date-time' as const,field:{label:'case.task.start.from',required:true}}}},
        {id:'schedule-frequency',guideFieldId:'schedule-frequency',kind:'menu' as const,label:t('frequency'),config:{kind:'inline' as const,items:[{id:'schedule',label:`case.frequency.${form.frequency}`,icon:'event_repeat',trailingIcon:'chevron_right',layout:'pill' as const,kind:'action' as const,palette:'violet' as const}]}}
      ]}] : [])] };

    return { ...model, steps: model.steps.map(step => ({ ...step, controls: step.controls.map(c => ({ ...c, disabled: c.disabled || this.editor().readOnly && c.id !== 'audience-list' })) })) };
  });
}
