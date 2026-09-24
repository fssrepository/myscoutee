import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PopupComponent, PopupModel } from '../core/popup';
import { FormFlowComponent, FormFlowModel, FormFlowActionEvent, FormFlowControlModel, FormFlowMenuControlConfig } from '../core/form/flow';
import { AppMenuPalette } from '../core/menu';
import { I18nService } from '../../../core/base/services/i18n.service';
import { I18nPipe } from '../../pipes/i18n.pipe';
import { CommunityGroupsStore } from '../../context/stores/community-groups.store';
import { CommunityGroup, GroupVisibility, GROUP_CATEGORIES, SaveCommunityGroup } from '../../../core/contracts/community-group.interface';
import { GROUP_CATEGORY_ICON, GROUP_CATEGORY_PALETTE, GROUP_VISIBILITY_STYLE } from '../../converters/community-group.converter';
import { ProfileFormFlowConverter } from '../../converters/profile-form-flow.converter';
import { APP_STATIC_DATA } from '../../../app-static-data';
interface GroupForm extends SaveCommunityGroup { images: string[]; }
@Component({ selector: 'app-community-group-editor', standalone: true, imports: [FormsModule, PopupComponent, FormFlowComponent, I18nPipe],
  host: { '[class.group-editor--readonly]': 'readOnly' },
  styles: [`
    :host {
      --form-flow-grouped-media-image-height: 100%;
      --form-flow-grouped-media-image-align: stretch;
      --form-flow-grouped-media-image-width: 100%;
      --image-single-slot-content-flex: 1 1 auto;
      --image-single-slot-content-width: 100%;
      --image-single-slot-aspect-ratio: auto;
    }
    :host(.group-editor--readonly) {
      --app-menu-disabled-opacity: 1;
      --app-menu-disabled-filter: none;
      --on-off-toggle-disabled-opacity: 1;
      --on-off-toggle-disabled-filter: none;
      --form-flow-disabled-background: linear-gradient(180deg, #f3f6fa 0%, #e8edf5 100%);
      --form-flow-disabled-color: rgba(58, 76, 103, 0.9);
    }
    .group-policy-fields {
      --app-menu-row-width: 100%;
      --app-menu-row-item-width: 100%;
      --app-menu-row-item-justify: space-between;
    }
    @media (max-width: 720px) {
      :host { --form-flow-grouped-media-image-height: clamp(160px, 54vw, 260px); }
    }
  `],
  template: `
    <app-popup [model]="popupModel()" [zIndex]="zIndex">
      <app-form-flow [model]="flowModel()" [(ngModel)]="form" [disabled]="loading || store.busy()" [loading]="loading"
        [saving]="store.busy()" (action)="action($event)"></app-form-flow>
      @if (store.error()) { <p role="alert">{{ store.error() | i18n }}</p> }
    </app-popup>
    @if (policyDraft) {
      <app-popup [model]="policyPopupModel()" [zIndex]="zIndex + 40">
        <app-form-flow class="group-policy-fields" [model]="policyFlowModel()" [(ngModel)]="policyDraft" [disabled]="readOnly"></app-form-flow>
      </app-popup>
    }
  `
})
export class CommunityGroupEditorComponent implements OnChanges {
  @Input() group: CommunityGroup | null = null;
  @Input() readOnly = false;
  @Input() loading = false;
  @Input() zIndex = 1300;
  protected readonly store = inject(CommunityGroupsStore);
  private readonly i18n = inject(I18nService);
  protected form!: GroupForm;
  protected policyDraft: { fields: string[] } | null = null;
  private readonly profileFields = ProfileFormFlowConverter.convert(null, { layout: 'grouped', imageEditor: 'external', showHeader: false, showSave: false, privacy: { values: {} } })
    .steps.flatMap(step => step.controls);
  private profileControl(labelKey: string): FormFlowControlModel | undefined {
    return this.profileFields.find(control => control.label === labelKey || control.bind === labelKey
      || (JSON.stringify(control.accessory) ?? '').includes(`"${labelKey}"`));
  }
  private optionalPolicyField(labelKey: string): boolean {
    return this.profileControl(labelKey)?.required !== true;
  }
  ngOnChanges(): void {
    const g = this.group;
    this.form = { userId: this.store.openUserId() ?? '', id: g?.id, version: g?.version,
      name: g?.name ?? '', description: g?.description ?? '', imageUrl: g?.imageUrl ?? null,
      images: g?.imageUrl ? [g.imageUrl] : [], category: g?.category ?? 'friends', visibility: g?.visibility ?? 'private',
      hideMembers: g?.hideMembers ?? false, policy: structuredClone(g?.policy ?? { workspace: true, enabled: false, requiredFields: [] }) };
  }
  private t(key: string): string { return this.i18n.translate(key); }
  private validName(): boolean { return !!this.form.name.trim() && Array.from(this.form.name).length <= 20; }
  protected popupModel(): PopupModel {
    const visibility = this.form.visibility;
    return { title: this.group || this.loading ? 'groups.edit' : 'groups.create', size: 'wide', height: 'full', mobilePresentation: 'fullscreen',
      onClose: () => this.store.closeEditor(),
      headerControls: this.loading ? [] : [{ id: 'visibility', kind: 'menu', menuKind: 'select',
        trigger: { label: `groups.visibility.${visibility}`, ...GROUP_VISIBILITY_STYLE[visibility], layout: 'pill', disabled: this.readOnly },
        items: (['public','private','invitation'] as GroupVisibility[]).map(id => ({ id, label: `groups.visibility.${id}`,
          ...GROUP_VISIBILITY_STYLE[id], kind: 'radio', showCheck: true, active: id === visibility, checked: id === visibility, surface: 'tinted', disabled: this.readOnly })) },
        ...(!this.readOnly ? [{ id: 'save', kind: 'menu' as const, menuKind: 'inline' as const, items: [{ id: 'save', icon: 'done',
          kind: 'action' as const, palette: this.validName() ? 'success' as const : 'danger' as const,
          disabled: this.store.busy() || !this.validName(), ariaLabel: 'save',
          progress: this.store.busy() ? { state: 'loading' as const, shape: 'circle' as const } : null }] }] : [])],
      onMenuSelect: event => {
        if (event.control.id === 'visibility' && !this.readOnly) this.form = { ...this.form, visibility: event.itemSelect.id as GroupVisibility };
        if (event.control.id === 'save') this.save();
      } };
  }
  protected flowModel(): FormFlowModel {
    const required = this.form.policy.requiredFields;
    const model: FormFlowModel = { title: 'groups.title', layout: 'grouped', header: false, save: null, summary: { enabled: false }, allowMenuOverflow: true,
      steps: [{ id: 'basics', title: '', presentation: 'media', palette: 'blue', controls: [
        { id: 'image', bind: 'images', kind: 'image-carousel', config: { slotCount: 1, compact: true, autoSize: true, slotImageVariant: 'medium', uploadOwnerId: this.form.userId, uploadEntityId: this.form.id ?? 'group' } },
        { id: 'name', bind: 'name', kind: 'text', label: this.t('name'), required: true, maxLength: 20 },
        { id: 'description', bind: 'description', kind: 'textarea', label: this.t('description'), rows: 3, maxLength: 4000 },
        { id: 'category', bind: 'category', kind: 'menu', layout: 'half', config: { kind: 'select',
          trigger: { label: `groups.category.${this.form.category}`, icon: GROUP_CATEGORY_ICON[this.form.category], palette: GROUP_CATEGORY_PALETTE[this.form.category], layout: 'pill' },
          items: GROUP_CATEGORIES.map(id => ({ id, value: id, label: `groups.category.${id}`, icon: GROUP_CATEGORY_ICON[id], kind: 'radio', showCheck: true, active: this.form.category === id, checked: this.form.category === id, palette: GROUP_CATEGORY_PALETTE[id], surface: 'tinted' })) } },
        { id: 'members-visible', kind: 'menu', layout: 'half', align: 'end', config: { kind: 'inline', layout: 'row', closeOnSelect: false, items: [
          { id: 'hideMembers', label: 'groups.member.list', ariaLabel: this.form.hideMembers ? 'groups.hide.members' : 'groups.show.members',
            icon: this.form.hideMembers ? 'visibility_off' : 'visibility', kind: 'toggle', layout: 'pill', showToggleIndicator: true,
            palette: this.form.hideMembers ? 'red' : 'green', active: !this.form.hideMembers, checked: !this.form.hideMembers,
            closeOnSelect: false, disabled: this.readOnly }
        ] } }
      ] }, { id: 'policy', title: this.t('groups.policy'), icon: 'policy', palette: 'violet', headerControl:
        { id: 'rules-enabled', bind: 'policy.enabled', kind: 'toggle', label: 'groups.visibility.rules', disabled: this.readOnly }, controls: [
        { id: 'rules-open', kind: 'menu', layout: 'wide', config: { kind: 'inline', items: [
          { id: 'rules-open', label: 'groups.visibility.rules', ariaLabel: 'groups.visibility.rules', icon: 'tune',
            kind: 'action', layout: 'pill', compactOnMobile: true, palette: 'violet' }
        ] } },
        { id: 'rules-table', kind: 'table', layout: 'wide', config: { rows: APP_STATIC_DATA.profileDetailGroupTemplates.flatMap(g => g.rows)
          .filter(row => this.form.policy.enabled && this.optionalPolicyField(row.labelKey) && required.includes(row.labelKey))
          .map(row => ({ label: row.labelKey, value: 'groups.required',
            icon: 'check', badgeTone: 'danger' })) } }
      ] }] };
    return { ...model, steps: model.steps.map(step => ({ ...step, controls: step.controls
      .filter(() => step.id !== 'policy' || this.form.policy.enabled)
      .filter(control => control.id !== 'rules-table' || this.form.policy.enabled && required.some(key => this.optionalPolicyField(key)))
      .map(control => ({ ...control, disabled: this.readOnly && control.id !== 'rules-open' })) })) };
  }
  protected action(event: FormFlowActionEvent): void {
    if (event.sourceEvent.id === 'rules-open') this.policyDraft = { fields: this.form.policy.requiredFields.filter(key => this.optionalPolicyField(key)) };
    if (event.sourceEvent.id === 'hideMembers' && !this.readOnly) this.form = { ...this.form, hideMembers: !this.form.hideMembers };
  }
  protected policyPopupModel(): PopupModel {
    return { title: 'groups.visibility.rules', size: 'default', height: 'auto', mobilePresentation: 'compact', backdropTone: 'dim',
      onClose: () => { this.policyDraft = null; }, headerControls: [{ id: 'done', kind: 'menu', menuKind: 'inline', items: [
        { id: 'done', icon: 'done', kind: 'action', palette: 'success', disabled: this.readOnly }
      ] }], onMenuSelect: () => { if (!this.readOnly && this.policyDraft) {
        this.form = { ...this.form, policy: { ...this.form.policy, requiredFields: [...this.policyDraft.fields] } }; this.policyDraft = null;
      } } };
  }
  protected policyFlowModel(): FormFlowModel {
    const palettes: AppMenuPalette[] = ['blue','green','orange','violet'];
    return { title: 'groups.visibility.rules', layout: 'grouped', deferPreparation: false, header: false, save: null, summary: { enabled: false },
      steps: APP_STATIC_DATA.profileDetailGroupTemplates.map((group, index) => ({
        id: `policy-${index}`, title: this.t(group.title), palette: palettes[index], controls: group.rows
          .filter(row => this.optionalPolicyField(row.labelKey))
          .map(row => {
            const trigger = (this.profileControl(row.labelKey)?.config as FormFlowMenuControlConfig)?.trigger;
            return { id: row.labelKey, bind: 'fields', kind: 'menu', layout: 'half', config: {
              kind: 'inline', layout: 'row', closeOnSelect: false,
              items: [{ id: row.labelKey, value: row.labelKey, label: row.labelKey, icon: trigger?.icon ?? 'visibility',
                kind: 'toggle' as const, layout: 'pill' as const, palette: trigger?.palette ?? palettes[index],
                checked: this.policyDraft?.fields.includes(row.labelKey) ?? false, disabled: this.readOnly,
                showCheck: true, showToggleIndicator: true, closeOnSelect: false }]
            } } as FormFlowControlModel;
          })
      })) };
  }
  private save(): void {
    if (this.readOnly || !this.validName()) return;
    void this.store.save({ ...this.form, imageUrl: this.form.images[0] ?? null });
  }
}
