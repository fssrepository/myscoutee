import { Component, Input, OnChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PopupComponent, PopupModel } from '../core/popup';
import { FormFlowComponent, FormFlowModel, FormFlowActionEvent, FormFlowControlModel, FormFlowMenuControlConfig } from '../core/form/flow';
import { AppMenuPalette } from '../core/menu';
import { I18nService } from '../../../core/base/services/i18n.service';
import { CommunityGroupsStore } from '../../context/stores/community-groups.store';
import { CommunityGroup, GroupVisibility, GROUP_CATEGORIES, SaveCommunityGroup } from '../../../core/contracts/community-group.interface';
import { GROUP_CATEGORY_ICON, GROUP_CATEGORY_PALETTE, GROUP_VISIBILITY_STYLE } from '../../converters/community-group.converter';
import { ProfileFormFlowConverter } from '../../converters/profile-form-flow.converter';
import { APP_STATIC_DATA } from '../../../app-static-data';
interface GroupForm extends SaveCommunityGroup { images: string[]; features: string[]; rules: string[]; }
@Component({ selector: 'app-community-group-editor', standalone: true, imports: [FormsModule, PopupComponent, FormFlowComponent],
  styles: [`
    :host {
      --form-flow-grouped-media-image-height: 100%;
      --form-flow-grouped-media-image-align: stretch;
      --form-flow-grouped-media-image-width: 100%;
      --image-single-slot-content-flex: 1 1 auto;
      --image-single-slot-content-width: 100%;
      --image-single-slot-aspect-ratio: auto;
    }
    .group-policy-fields { --form-flow-group-columns: repeat(2, minmax(0, 1fr)); }
    @media (max-width: 720px) {
      .group-policy-fields { --form-flow-group-columns: minmax(0, 1fr); }
      :host { --form-flow-grouped-media-image-height: clamp(160px, 54vw, 260px); }
    }
  `],
  template: `
    <app-popup [model]="popupModel()" [zIndex]="1300">
      <app-form-flow [model]="flowModel()" [(ngModel)]="form" [disabled]="store.busy()"
        [saving]="store.busy()" (action)="action($event)"></app-form-flow>
      @if (store.error()) { <p role="alert">{{ store.error() }}</p> }
    </app-popup>
    @if (policyDraft) {
      <app-popup [model]="policyPopupModel()" [zIndex]="1340">
        <app-form-flow class="group-policy-fields" [model]="policyFlowModel()" [(ngModel)]="policyDraft" [disabled]="readOnly"></app-form-flow>
      </app-popup>
    }
  `
})
export class CommunityGroupEditorComponent implements OnChanges {
  @Input() group: CommunityGroup | null = null;
  @Input() readOnly = false;
  protected readonly store = inject(CommunityGroupsStore);
  private readonly i18n = inject(I18nService);
  protected form!: GroupForm;
  protected policyDraft: { fields: string[] } | null = null;
  private readonly profileFields = ProfileFormFlowConverter.convert(null, { layout: 'grouped', imageEditor: 'external', showHeader: false, showSave: false })
    .steps.flatMap(step => step.controls);
  ngOnChanges(): void {
    const g = this.group;
    this.form = { userId: this.store.openUserId() ?? '', id: g?.id, version: g?.version,
      name: g?.name ?? '', description: g?.description ?? '', imageUrl: g?.imageUrl ?? null,
      images: g?.imageUrl ? [g.imageUrl] : [], category: g?.category ?? 'friends', visibility: g?.visibility ?? 'private',
      hideMembers: g?.hideMembers ?? false, policy: structuredClone(g?.policy ?? { workspace: true, enabled: false, requiredFields: [] }),
      features: [...(g?.hideMembers ? ['hideMembers'] : []), ...(g?.policy.workspace !== false ? ['workspace'] : [])],
      rules: g?.policy.enabled ? ['enabled'] : [] };
  }
  private t(key: string): string { return this.i18n.translate(key); }
  protected popupModel(): PopupModel {
    const visibility = this.form.visibility;
    return { title: this.group ? 'groups.edit' : 'groups.create', size: 'wide', height: 'auto',
      onClose: () => this.store.editor.set(null),
      headerControls: [{ id: 'visibility', kind: 'menu', menuKind: 'select',
        trigger: { label: `groups.visibility.${visibility}`, ...GROUP_VISIBILITY_STYLE[visibility], layout: 'pill', disabled: this.readOnly },
        items: (['public','private','invitation'] as GroupVisibility[]).map(id => ({ id, label: `groups.visibility.${id}`,
          ...GROUP_VISIBILITY_STYLE[id], kind: 'radio', showCheck: true, active: id === visibility, checked: id === visibility, surface: 'tinted', disabled: this.readOnly })) },
        ...(!this.readOnly ? [{ id: 'save', kind: 'menu' as const, menuKind: 'inline' as const, items: [{ id: 'save', icon: 'done',
          kind: 'action' as const, palette: this.form.name.trim() ? 'success' as const : 'danger' as const,
          disabled: this.store.busy() || !this.form.name.trim(), ariaLabel: 'save',
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
        { id: 'category', bind: 'category', kind: 'menu', config: { kind: 'select',
          trigger: { label: `groups.category.${this.form.category}`, icon: GROUP_CATEGORY_ICON[this.form.category], palette: GROUP_CATEGORY_PALETTE[this.form.category], layout: 'pill' },
          items: GROUP_CATEGORIES.map(id => ({ id, value: id, label: `groups.category.${id}`, icon: GROUP_CATEGORY_ICON[id], kind: 'radio', showCheck: true, active: this.form.category === id, checked: this.form.category === id, palette: GROUP_CATEGORY_PALETTE[id], surface: 'tinted' })) } }
      ] }, { id: 'features', title: this.t('groups.settings'), icon: 'tune', palette: 'green', controls: [
        { id: 'features', bind: 'features', kind: 'menu', layout: 'wide', config: { kind: 'inline', layout: 'row', closeOnSelect: false, items: [
          { id: 'hideMembers', value: 'hideMembers', label: 'groups.hide.members', description: 'groups.hide.members.description', icon: 'visibility_off', kind: 'toggle', layout: 'big', palette: 'teal', active: this.form.features.includes('hideMembers'), checked: this.form.features.includes('hideMembers'), showToggleIndicator: true, disabled: this.readOnly },
          { id: 'workspace', value: 'workspace', label: 'groups.workspace', description: 'groups.workspace.description', icon: 'workspaces', kind: 'toggle', layout: 'big', palette: 'violet', active: this.form.features.includes('workspace'), checked: this.form.features.includes('workspace'), showToggleIndicator: true, disabled: this.readOnly }
        ] } }
      ] }, { id: 'policy', title: this.t('groups.policy'), icon: 'policy', palette: 'violet', headerControl:
        { id: 'rules-enabled', bind: 'policy.enabled', kind: 'toggle', label: 'groups.visibility.rules', disabled: this.readOnly }, controls: [
        { id: 'rules-open', kind: 'menu', layout: 'wide', align: 'end', config: { kind: 'inline', items: [
          { id: 'rules-open', label: 'groups.visibility.rules', icon: 'tune', kind: 'action', layout: 'pill', palette: 'violet' }
        ] } },
        { id: 'rules-table', kind: 'table', layout: 'wide', config: { rows: APP_STATIC_DATA.profileDetailGroupTemplates.flatMap(g => g.rows)
          .filter(row => this.form.policy.enabled && required.includes(row.labelKey))
          .map(row => ({ label: row.labelKey, value: 'groups.required',
            icon: 'check', badgeTone: 'danger' })) } }
      ] }] };
    return { ...model, steps: model.steps.map(step => ({ ...step, controls: step.controls
      .filter(() => step.id !== 'policy' || this.form.policy.enabled)
      .filter(control => control.id !== 'rules-table' || this.form.policy.enabled && required.length > 0)
      .map(control => ({ ...control, disabled: this.readOnly && control.id !== 'rules-open' })) })) };
  }
  protected action(event: FormFlowActionEvent): void {
    if (event.sourceEvent.id === 'rules-open') this.policyDraft = { fields: [...this.form.policy.requiredFields] };
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
    const palettes: AppMenuPalette[] = ['blue','green','violet','orange'];
    return { title: 'groups.visibility.rules', layout: 'grouped', header: false, save: null, summary: { enabled: false },
      steps: APP_STATIC_DATA.profileDetailGroupTemplates.map((group, index) => ({
        id: `policy-${index}`, title: this.t(group.title), palette: palettes[index], controls: [{
          id: `fields-${index}`, bind: 'fields', kind: 'menu', layout: 'wide', config: { kind: 'inline', layout: 'column', closeOnSelect: false,
            items: group.rows.map(row => {
              const control = this.profileFields.find(control => control.label === row.labelKey || (JSON.stringify(control.accessory) ?? '').includes(`"${row.labelKey}"`));
              const trigger = (control?.config as FormFlowMenuControlConfig)?.trigger;
              return { id: row.labelKey, value: row.labelKey, label: row.labelKey, icon: trigger?.icon ?? 'visibility',
                kind: 'toggle' as const, layout: 'pill' as const, palette: trigger?.palette ?? palettes[index],
                checked: this.policyDraft?.fields.includes(row.labelKey) ?? false, disabled: this.readOnly, showCheck: true, showToggleIndicator: true };
            })
          } } as FormFlowControlModel]
      })) };
  }
  private save(): void {
    if (this.readOnly || !this.form.name.trim()) return;
    void this.store.save({ ...this.form, imageUrl: this.form.images[0] ?? null,
      hideMembers: this.form.features.includes('hideMembers'), policy: { ...this.form.policy,
        workspace: this.form.features.includes('workspace'), enabled: this.form.policy.enabled } });
  }
}
