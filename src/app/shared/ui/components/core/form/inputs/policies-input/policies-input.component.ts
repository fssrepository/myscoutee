import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  Type,
  computed,
  effect,
  forwardRef,
  inject,
  untracked
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import type * as EventContracts from '../../../../../../core/contracts/event.interface';
import {
  EventPolicySingleRowConverter
} from '../../../../../converters';
import {
  SingleRowComponent,
  type CardMenuActionEvent,
  type SingleRowData
} from '../../../smart-list/card';
import {
  FormFlowPopupStore,
  type FormFlowPolicyEditorPopupActionRequest,
  type FormFlowPolicyEditorPopupState
} from '../../flow/form-flow-popup.store';
import {
  PopupComponent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../../../popup';

type PolicyInputModel = EventContracts.EventPolicyDTO;
type PolicyPopupMenuContext = {
  menu: 'policy-setup';
  action: 'add';
};
export type PoliciesInputConfigValue<TValue> = TValue | (() => TValue);

export interface PoliciesInputConfig {
  title?: PoliciesInputConfigValue<string>;
  subtitle?: PoliciesInputConfigValue<string>;
  toggleable?: PoliciesInputConfigValue<boolean>;
  openLabel?: PoliciesInputConfigValue<string>;
  viewLabel?: PoliciesInputConfigValue<string>;
  emptyLabel?: PoliciesInputConfigValue<string>;
  readOnlyEmptyLabel?: PoliciesInputConfigValue<string>;
  popupSubtitle?: PoliciesInputConfigValue<string>;
  editorSubtitle?: PoliciesInputConfigValue<string>;
  requiredApprovalLabel?: PoliciesInputConfigValue<string>;
  optionalPolicyLabel?: PoliciesInputConfigValue<string>;
  requiredPreview?: PoliciesInputConfigValue<string>;
  optionalPreview?: PoliciesInputConfigValue<string>;
  requiredCheckboxLabel?: PoliciesInputConfigValue<string>;
}

@Component({
  selector: 'app-policies-input',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    PopupComponent,
    SingleRowComponent
  ],
  templateUrl: './policies-input.component.html',
  styleUrl: './policies-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PoliciesInputComponent),
      multi: true
    }
  ]
})
export class PoliciesInputComponent implements ControlValueAccessor, OnDestroy {
  private static ownerSequence = 0;

  @Input() readOnly = false;
  @Input() disabled = false;
  @Input() config: PoliciesInputConfig = {};
  @Input() enabled = false;
  @Output() readonly enabledChange = new EventEmitter<boolean>();

  protected policies: PolicyInputModel[] = [];
  protected workingPolicies: PolicyInputModel[] = [];
  protected workingPolicyDraft: PolicyInputModel = this.createEmptyPolicyDraft();
  protected editingPolicyDraftIndex: number | null = null;
  protected showPoliciesPopup = false;

  private readonly formFlowPopupStore = inject(FormFlowPopupStore);
  private readonly ownerId = this.nextOwnerId();
  protected readonly policyEditorPopupOutletInputs = computed(() => {
    const popup = this.formFlowPopupStore.policyEditorPopupRef();
    return {
      popup: popup?.ownerId === this.ownerId ? popup : null
    };
  });

  private idSequence = 0;
  private onModelChange: (value: PolicyInputModel[]) => void = () => {};
  private onModelTouched: () => void = () => {};
  private lastPolicyEditorActionRequestId = 0;
  private readonly destroyEffects: Array<{ destroy: () => void }> = [];

  constructor(private readonly cdr: ChangeDetectorRef) {
    this.destroyEffects.push(
      effect(() => {
        if (this.policyEditorIsOpen()) {
          void this.formFlowPopupStore.ensurePolicyEditorPopupLoaded();
        }
      }),
      effect(() => {
        const request = this.formFlowPopupStore.policyEditorPopupActionRequest();
        if (!request || request.requestId <= this.lastPolicyEditorActionRequestId) {
          return;
        }
        this.lastPolicyEditorActionRequestId = request.requestId;
        untracked(() => this.handlePolicyEditorActionRequest(request));
      })
    );
  }

  ngOnDestroy(): void {
    this.destroyEffects.forEach(item => item.destroy());
    if (this.policyEditorIsOpen()) {
      this.formFlowPopupStore.closePolicyEditorPopup(this.ownerId);
    }
  }

  writeValue(value: readonly PolicyInputModel[] | null | undefined): void {
    this.policies = this.normalizePolicies(value ?? []);
    if (this.showPoliciesPopup) {
      this.workingPolicies = this.clonePolicies(this.policies);
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: PolicyInputModel[]) => void): void {
    this.onModelChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onModelTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected handleEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (this.policyEditorIsOpen()) {
      keyboardEvent.preventDefault();
      this.closePolicyEditor();
      return;
    }
    if (this.showPoliciesPopup) {
      keyboardEvent.preventDefault();
      this.closePoliciesPopup();
    }
  }

  protected shouldShowPanel(): boolean {
    return !this.locked() || this.effectivePanelEnabled();
  }

  protected locked(): boolean {
    return this.readOnly || this.disabled;
  }

  protected panelTitle(): string {
    return this.resolveConfigValue(this.config.title, 'Event Policies');
  }

  protected panelSubtitle(): string {
    const enabled = this.effectivePanelEnabled();
    return this.resolveConfigValue(
      this.config.subtitle,
      enabled
        ? 'Add the rules attendees need to read and approve before joining.'
        : 'Attendees can join without approving event policies.'
    );
  }

  protected effectivePanelEnabled(): boolean {
    if (!this.policiesToggleable()) {
      return true;
    }
    return this.locked() ? this.enabled && this.policies.length > 0 : this.enabled;
  }

  protected togglePoliciesEnabled(event?: Event): void {
    event?.preventDefault();
    if (this.locked() || !this.policiesToggleable()) {
      return;
    }
    const nextEnabled = !this.enabled;
    this.enabled = nextEnabled;
    this.enabledChange.emit(nextEnabled);
    this.onModelTouched();
    if (!nextEnabled) {
      this.showPoliciesPopup = false;
      this.formFlowPopupStore.closePolicyEditorPopup(this.ownerId);
      this.workingPolicies = [];
      this.workingPolicyDraft = this.createEmptyPolicyDraft();
      this.editingPolicyDraftIndex = null;
    }
    this.cdr.markForCheck();
  }

  protected openPoliciesPopup(event?: Event): void {
    event?.preventDefault();
    this.workingPolicies = this.clonePolicies(this.policies);
    this.showPoliciesPopup = true;
    this.formFlowPopupStore.closePolicyEditorPopup(this.ownerId);
    this.onModelTouched();
    this.cdr.markForCheck();
  }

  protected closePoliciesPopup(): void {
    if (this.showPoliciesPopup || this.policyEditorIsOpen()) {
      this.syncPoliciesFromWorkingPolicies();
    }
    this.showPoliciesPopup = false;
    this.formFlowPopupStore.closePolicyEditorPopup(this.ownerId);
    this.workingPolicies = [];
    this.workingPolicyDraft = this.createEmptyPolicyDraft();
    this.editingPolicyDraftIndex = null;
    this.cdr.markForCheck();
  }

  protected openPolicyEditor(index?: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.showPoliciesPopup) {
      return;
    }
    const existing = Number.isInteger(index) && index !== undefined
      ? this.workingPolicies[index] ?? null
      : null;
    this.editingPolicyDraftIndex = existing ? (index ?? null) : null;
    this.workingPolicyDraft = existing
      ? { ...existing }
      : this.createEmptyPolicyDraft();
    this.formFlowPopupStore.openPolicyEditorPopup(this.buildPolicyEditorPopupState());
    this.cdr.markForCheck();
  }

  protected closePolicyEditor(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.formFlowPopupStore.closePolicyEditorPopup(this.ownerId);
    this.workingPolicyDraft = this.createEmptyPolicyDraft();
    this.editingPolicyDraftIndex = null;
    this.cdr.markForCheck();
  }

  protected removePolicyDraft(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.locked() || index < 0 || index >= this.workingPolicies.length) {
      return;
    }
    this.workingPolicies = this.workingPolicies.filter((_, itemIndex) => itemIndex !== index);
    if (this.editingPolicyDraftIndex === index) {
      this.closePolicyEditor();
    }
    this.syncPoliciesFromWorkingPolicies();
  }

  protected savePolicyDraft(value: unknown, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.workingPolicyDraft = this.policyDraftFromValue(value);
    if (this.locked() || !this.canSavePolicyDraft()) {
      return;
    }
    const nextItem = this.normalizedWorkingPolicyDraft();
    if (this.editingPolicyDraftIndex !== null && this.editingPolicyDraftIndex >= 0 && this.editingPolicyDraftIndex < this.workingPolicies.length) {
      this.workingPolicies = this.workingPolicies.map((item, index) => (
        index === this.editingPolicyDraftIndex ? nextItem : item
      ));
    } else {
      this.workingPolicies = [...this.workingPolicies, nextItem];
    }
    this.syncPoliciesFromWorkingPolicies();
    this.closePolicyEditor();
  }

  protected policyPopupTitle(): string {
    return this.editingPolicyDraftIndex === null ? 'Create Policy' : 'Edit Policy';
  }

  protected policySetupPopupModel(): PopupModel<PolicyPopupMenuContext> {
    return {
      title: 'Policy Setup',
      subtitle: this.popupSubtitle(),
      ariaLabel: 'Policy setup',
      closeAriaLabel: 'Close policy setup',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      headerControls: this.policySetupHeaderControls(),
      onClose: () => this.closePoliciesPopup(),
      onMenuSelect: event => this.onPolicyPopupMenuSelect(event)
    };
  }

  protected policySetupPopupZIndex(): number {
    return 12600;
  }

  private policyEditorPopupZIndex(): number {
    return 12700;
  }

  private buildPolicyEditorPopupState(): FormFlowPolicyEditorPopupState {
    return {
      ownerId: this.ownerId,
      title: this.policyPopupTitle(),
      subtitle: this.editorSubtitle(),
      zIndex: this.policyEditorPopupZIndex(),
      value: { ...this.workingPolicyDraft },
      requiredCheckboxLabel: this.requiredCheckboxLabel(),
      readOnly: this.locked()
    };
  }

  protected policyEditorPopupComponent(): Type<unknown> | null {
    return this.policyEditorIsOpen()
      ? this.formFlowPopupStore.policyEditorPopupComponent()
      : null;
  }

  private policyEditorIsOpen(): boolean {
    return this.formFlowPopupStore.policyEditorPopupRef()?.ownerId === this.ownerId;
  }

  protected policySingleRow(policy: PolicyInputModel, index: number): SingleRowData<PolicyInputModel> {
    return EventPolicySingleRowConverter.convert(policy, {
      index,
      locked: this.locked(),
      requiredApprovalLabel: this.resolveConfigValue(this.config.requiredApprovalLabel, 'Required approval'),
      optionalPolicyLabel: this.resolveConfigValue(this.config.optionalPolicyLabel, 'Optional policy'),
      requiredPreview: this.resolveConfigValue(this.config.requiredPreview, 'Attendees must approve this policy before joining.'),
      optionalPreview: this.resolveConfigValue(this.config.optionalPreview, 'Optional policy shown during join or checkout.')
    });
  }

  private policySetupHeaderControls(): readonly PopupControl<PolicyPopupMenuContext>[] {
    if (this.locked()) {
      return [];
    }
    return [{
      kind: 'menu',
      id: 'policy-setup-actions',
      menuKind: 'inline',
      items: [{
        id: 'policy-add',
        icon: 'add',
        kind: 'action',
        palette: 'blue',
        ariaLabel: 'Add policy',
        context: {
          menu: 'policy-setup',
          action: 'add'
        }
      }],
      panelAlign: 'end',
      mobileBreakpointPx: 900
    }];
  }

  private onPolicyPopupMenuSelect(event: PopupMenuSelectEvent<PolicyPopupMenuContext>): void {
    const context = event.itemSelect.context;
    if (context?.menu === 'policy-setup' && context.action === 'add') {
      this.openPolicyEditor(undefined, event.itemSelect.sourceEvent);
    }
  }

  protected onPolicyRowMenuAction(index: number, event: CardMenuActionEvent<SingleRowData>): void {
    if (event.actionId !== 'delete') {
      return;
    }
    this.removePolicyDraft(index);
  }

  protected policiesToggleable(): boolean {
    return this.resolveConfigValue(this.config.toggleable, true);
  }

  protected openPoliciesLabel(): string {
    return this.locked()
      ? this.resolveConfigValue(this.config.viewLabel, 'View Policies')
      : this.resolveConfigValue(this.config.openLabel, 'Open Policy Setup');
  }

  protected emptyPoliciesLabel(): string {
    return this.locked()
      ? this.resolveConfigValue(this.config.readOnlyEmptyLabel, 'No policies are configured for this event.')
      : this.resolveConfigValue(
          this.config.emptyLabel,
          'No policies yet. Add policies if attendees must review terms before joining or booking.'
        );
  }

  protected popupSubtitle(): string {
    return this.resolveConfigValue(
      this.config.popupSubtitle,
      'Keep the list compact here. Open a policy to edit the details attendees need to read and approve.'
    );
  }

  protected editorSubtitle(): string {
    return this.resolveConfigValue(
      this.config.editorSubtitle,
      'Write the policy clearly and choose whether attendees must approve it before joining.'
    );
  }

  protected requiredCheckboxLabel(): string {
    return this.resolveConfigValue(this.config.requiredCheckboxLabel, 'Attendees must approve this policy');
  }

  protected canSavePolicyDraft(): boolean {
    return `${this.workingPolicyDraft.title ?? ''}`.trim().length > 0
      && `${this.workingPolicyDraft.description ?? ''}`.trim().length > 0;
  }

  protected policiesCountLabel(): string {
    const count = this.policies.length;
    return count === 1 ? '1 policy' : `${count} policies`;
  }

  protected requiredPoliciesCount(): number {
    return this.policies.filter(item => item.required !== false).length;
  }

  protected trackPolicy(index: number, policy: PolicyInputModel): string {
    return `${policy.id ?? ''}`.trim() || `policy-${index}`;
  }

  protected policyRequirementLabel(policy: PolicyInputModel): string {
    return this.policyRequired(policy)
      ? this.resolveConfigValue(this.config.requiredApprovalLabel, 'Required approval')
      : this.resolveConfigValue(this.config.optionalPolicyLabel, 'Optional policy');
  }

  protected policySummaryDescription(policy: PolicyInputModel): string {
    const description = `${policy.description ?? ''}`.trim();
    if (description) {
      return description;
    }
    return policy.required !== false
      ? this.resolveConfigValue(this.config.requiredPreview, 'Attendees must approve this policy before joining.')
      : this.resolveConfigValue(this.config.optionalPreview, 'Optional policy shown during join or checkout.');
  }

  protected policyRequired(policy: PolicyInputModel): boolean {
    return policy.required !== false;
  }

  private syncPoliciesFromWorkingPolicies(): void {
    this.policies = this.normalizePolicies(this.workingPolicies);
    this.emitPolicies();
  }

  private emitPolicies(): void {
    const nextPolicies = this.clonePolicies(this.policies);
    this.onModelChange(nextPolicies);
    this.onModelTouched();
    this.cdr.markForCheck();
  }

  private normalizedWorkingPolicyDraft(): PolicyInputModel {
    return {
      id: `${this.workingPolicyDraft.id ?? ''}`.trim() || this.createPolicyId(),
      title: `${this.workingPolicyDraft.title ?? ''}`.trim(),
      description: `${this.workingPolicyDraft.description ?? ''}`.trim(),
      required: this.workingPolicyDraft.required !== false
    };
  }

  private normalizePolicies(items: readonly PolicyInputModel[]): PolicyInputModel[] {
    return items
      .map((item, index) => ({
        id: `${item.id ?? `policy-${index + 1}`}`.trim() || `policy-${index + 1}`,
        title: `${item.title ?? ''}`.trim() || `Policy ${index + 1}`,
        description: `${item.description ?? ''}`.trim(),
        required: item.required !== false
      }))
      .filter(item => item.id || item.title || item.description);
  }

  private clonePolicies(items: readonly PolicyInputModel[]): PolicyInputModel[] {
    return items.map(item => ({ ...item }));
  }

  private createEmptyPolicyDraft(): PolicyInputModel {
    return {
      id: this.createPolicyId(),
      title: '',
      description: '',
      required: true
    };
  }

  private createPolicyId(): string {
    this.idSequence += 1;
    return `policy-${Date.now()}-${this.idSequence}`;
  }

  private policyDraftFromValue(value: unknown): PolicyInputModel {
    const record = value && typeof value === 'object'
      ? value as Record<string, unknown>
      : {};
    return {
      id: `${record['id'] ?? this.workingPolicyDraft.id ?? ''}`.trim() || this.createPolicyId(),
      title: `${record['title'] ?? ''}`,
      description: `${record['description'] ?? ''}`,
      required: record['required'] !== false
    };
  }

  private handlePolicyEditorActionRequest(request: FormFlowPolicyEditorPopupActionRequest): void {
    if (request.ownerId !== this.ownerId) {
      return;
    }
    switch (request.kind) {
      case 'close':
        this.closePolicyEditor(request.event);
        return;
      case 'save':
        this.savePolicyDraft(request.value, request.event);
        return;
    }
  }

  private nextOwnerId(): string {
    PoliciesInputComponent.ownerSequence += 1;
    return `policies-input-${Date.now()}-${PoliciesInputComponent.ownerSequence}`;
  }

  private resolveConfigValue<TValue>(
    value: PoliciesInputConfigValue<TValue> | null | undefined,
    fallback: TValue
  ): TValue {
    if (typeof value === 'function') {
      return (value as () => TValue)() ?? fallback;
    }
    return value ?? fallback;
  }
}
