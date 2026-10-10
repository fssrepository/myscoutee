import { NgTemplateOutlet } from '@angular/common';
import { DocumentAttachments } from '../core/form/flow/document-attachments';
import { MediaService } from '../../../core/base/services/media.service';
import { ProfileViewPopupComponent } from '../../../../profile/components/profile-view-popup/profile-view-popup.component';
import {
  ExplanationGuideService,
  PopupComponent,
  PopupModel,
  PopupMenuControl,
  FormFlowComponent,
  FormFlowModel,
  type FormFlowActionEvent,
  I18nPipe
} from '@fssrepository/myscoutee-components';
import { Component, OnChanges, OnDestroy, inject, computed, signal, input } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { I18nService } from '../../../core/base/services/i18n.service';

import { CampaignsStore } from '../../context/stores/activity/campaigns.store';
import { CAMPAIGN_CATEGORIES, CAMPAIGN_KINDS, type Campaign, type SaveCampaign } from '../../../core/contracts/campaign.interface';
import { CampaignConverter, CAMPAIGN_CATEGORY_STYLE, CAMPAIGN_KIND_STYLE } from '../../converters/activity/campaign.converter';

export type CampaignView = 'details' | 'organizer';
export function campaignViewControl(view: CampaignView): PopupMenuControl {
  return { id: 'view', kind: 'menu', menuKind: 'select',
    trigger: { label: `campaign.${view}`, icon: view === 'details' ? 'article' : 'person', palette: view === 'details' ? 'blue' : 'violet', layout: 'pill' },
    items: (['details', 'organizer'] as const).map(id => ({ id, label: `campaign.${id}`, icon: id === 'details' ? 'article' : 'person',
      palette: id === 'details' ? 'blue' : 'violet', surface: 'tinted', kind: 'radio', checked: id === view, active: id === view, showCheck: true })) };
}

@Component({ selector: 'app-campaign-editor', standalone: true, imports: [NgTemplateOutlet, FormsModule, PopupComponent, FormFlowComponent, I18nPipe, ProfileViewPopupComponent],
  template: `@if (embedded()) {
    <ng-container [ngTemplateOutlet]="body"></ng-container>
    @if (documents.error()) { <p role="alert">{{ documents.error() | i18n }}</p> }
  } @else {
    <app-popup [model]="popupModel()" [zIndex]="14500">
      <ng-container [ngTemplateOutlet]="body"></ng-container>
      @if (store.error()) { <p role="alert">{{ store.error() | i18n }}</p> }
    </app-popup>
  }
  <ng-template #body>
    @if (readOnly() && view() === 'organizer' && campaign(); as c) {
      <app-profile-view-popup [embedded]="true" [profileTarget]="{userId:c.ownerUserId,label:c.ownerName}"></app-profile-view-popup>
    } @else {
      <input #files type="file" hidden multiple accept=".pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.odt,.ods" (change)="documents.upload($event)">
      <app-form-flow data-guide-field="campaign-details" [model]="flowModel()" [ngModel]="formView()" (ngModelChange)="formChanged($event)"
        (action)="formAction($event,files)" [disabled]="store.busy()" [saving]="store.busy()||documents.uploading()"></app-form-flow>
    }
  </ng-template>`,
  styles:[`:host { --form-flow-grouped-media-image-height:100%; --form-flow-grouped-media-image-align:stretch; --form-flow-grouped-media-image-width:100%; }
    @media(max-width:760px){:host{--form-flow-grouped-media-image-height:clamp(160px,54vw,260px);}}`]
})
export class CampaignEditorComponent implements OnChanges, OnDestroy {
   readonly campaign = input<Campaign | null>(null);
   readonly readOnly = input(false);
   readonly embedded = input(false);
  protected readonly store = inject(CampaignsStore);
  private readonly i18n = inject(I18nService);
  private readonly media = inject(MediaService);
  protected readonly view = signal<'details'|'organizer'>('details');
  protected readonly form = signal<SaveCampaign>(null!);
  protected readonly formView = computed(() => ({...this.form(),attachmentNames:this.form().attachments.map(f=>f.name).join(', ')}));
  protected formChanged(value:SaveCampaign & {attachmentNames:string}):void{const {attachmentNames,...form}=value;this.form.set(form);}
  protected formAction(event: FormFlowActionEvent, files: HTMLInputElement): void {
    const campaign = this.campaign();
    if (event.sourceEvent.id === 'ask' && this.readOnly() && campaign) void this.store.ask(campaign);
    else this.documents.action(event, files);
  }
  protected readonly documents = new DocumentAttachments(this.media, {
    files:()=>this.form().attachments,setFiles:attachments=>this.form.update(form=>({...form,attachments})),
    ownerId:()=>this.form().userId,entityId:()=>this.form().id??'campaign-draft',readOnly:()=>this.readOnly(),busy:()=>this.store.busy()
  });
  private readonly guide = inject(ExplanationGuideService);
  private unregisterGuide: (() => void) | null = null;
  ngOnDestroy(): void { this.documents.reset(); this.unregisterGuide?.(); }
  ngOnChanges(): void {
    if (!this.embedded()) this.unregisterGuide ??= this.guide.registerContext('work.campaign.editor');
    const c = this.campaign(); this.documents.reset(); this.view.set('details');
    this.form.set({ userId: this.store.editor()?.userId ?? this.store.historyTarget()?.userId ?? '', id: c?.id, version: c?.version, title: c?.title ?? '',
      description: c?.description ?? '', imageUrls: [...(c?.imageUrls ?? [])], attachments:[...(c?.attachments??[])], kind: c?.kind ?? 'work', category: c?.category ?? 'other' });
  }
  protected readonly popupModel = computed<PopupModel>(() => {
    return { errorMessage:this.documents.error(), title: this.readOnly() ? 'campaign.view' : this.campaign() ? 'campaign.edit' : 'campaign.create',
      size: 'wide', height: 'full', mobilePresentation: 'fullscreen', bodyLayout:this.readOnly()&&this.view()==='organizer'?'fill':undefined,
      onClose: () => this.store.closeEditor(), headerControls: this.readOnly() ? [campaignViewControl(this.view())] : [{ id: 'save', kind: 'menu', menuKind: 'inline', items: [
        { id: 'save', icon: 'done', ariaLabel: 'save', kind: 'action', palette: 'success', disabled: this.store.busy() || this.documents.uploading() || !this.form().title.trim(),
          progress: this.store.busy() ? { state: 'loading', shape: 'circle' } : null }
      ] }], onMenuSelect: event => { if(this.readOnly()){if(event.itemSelect.id==='details'||event.itemSelect.id==='organizer')this.view.set(event.itemSelect.id);}else if(!this.documents.uploading())void this.store.save(this.form()); } };
  });
  protected readonly flowModel = computed<FormFlowModel>(() => {
    const t = (key: string) => this.i18n.translate(key);
    const model: FormFlowModel = { title: 'campaign.title', layout: 'grouped', header: false, save: null, summary: { enabled: false }, allowMenuOverflow: true,
      steps: [{ id: 'campaign', title: '', presentation: 'media', wrapControlsOnMobile: true, palette: 'blue', controls: [
        { id: 'images', guideFieldId:'images',bind: 'imageUrls', kind: 'image-carousel', layout:'wide', rowSpan:4, config: { gallery:true, slotCount:4, uploadOwnerId: this.form().userId, uploadEntityId: this.form().id ?? 'campaign' } },
        { id: 'title', guideFieldId:'title',bind: 'title', kind: 'text', label: t('name'), required: true, maxLength: 120 },
        { id: 'description', guideFieldId:'description',bind: 'description', kind: 'textarea', label: t('description'), rows: 5, maxLength: 4000 },
        { id: 'kind', guideFieldId:'kind',bind: 'kind', kind: 'menu', layout: 'half', config: { kind: 'select',
          trigger: { label: `campaign.kind.${this.form().kind}`, ...CAMPAIGN_KIND_STYLE[this.form().kind], layout: 'pill' },
          items: CAMPAIGN_KINDS.map(id => ({ id, value: id, label: `campaign.kind.${id}`, ...CAMPAIGN_KIND_STYLE[id], kind: 'radio', showCheck: true,
            active: id === this.form().kind, checked: id === this.form().kind, surface: 'tinted' })) } },
        { id: 'category', guideFieldId:'category',bind: 'category', kind: 'menu', layout: 'half', config: { kind: 'select',
          trigger: { label: `campaign.category.${this.form().category}`, ...CAMPAIGN_CATEGORY_STYLE[this.form().category], layout: 'pill' },
          items: CAMPAIGN_CATEGORIES.map(id => ({ id, value: id, label: `campaign.category.${id}`, ...CAMPAIGN_CATEGORY_STYLE[id], kind: 'radio', showCheck: true,
            active: id === this.form().category, checked: id === this.form().category, surface: 'tinted' })) } },
      ] }] };
    const campaign = this.campaign();
    const ask = this.readOnly() && campaign
      ? CampaignConverter.menu(campaign, this.form().userId).find(item => item.id === 'ask') : null;
    return { ...model, steps: [
      ...model.steps.map(step => ({ ...step, controls: step.controls.map(control => ({ ...control, disabled: this.readOnly() })) })),
      ...this.documents.steps(t),
      ...(ask ? [{ id: 'conversation', title: '', chrome: 'none' as const, controls: [
        { id: 'ask', guideFieldId: 'campaign-ask', kind: 'menu' as const, layout: 'wide' as const,
          config: { kind: 'inline' as const, items: [{ ...ask, layout: 'pill' as const, disabled: this.store.busy() }] } }
      ] }] : [])
    ] };
  });
}
