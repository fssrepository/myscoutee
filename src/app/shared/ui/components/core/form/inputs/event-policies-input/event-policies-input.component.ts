import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, forwardRef, HostListener, Input, Output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
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
  PopupComponent,
  type PopupAction,
  type PopupActionEvent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../../../popup';

type EventPolicyInputModel = EventContracts.EventPolicyDTO;
type EventPolicyPopupMenuContext = {
  menu: 'policy-setup';
  action: 'add';
};
export type EventPoliciesInputConfigValue<TValue> = TValue | (() => TValue);

export interface EventPoliciesInputConfig {
  title?: EventPoliciesInputConfigValue<string>;
  subtitle?: EventPoliciesInputConfigValue<string>;
  toggleable?: EventPoliciesInputConfigValue<boolean>;
  openLabel?: EventPoliciesInputConfigValue<string>;
  viewLabel?: EventPoliciesInputConfigValue<string>;
  emptyLabel?: EventPoliciesInputConfigValue<string>;
  readOnlyEmptyLabel?: EventPoliciesInputConfigValue<string>;
  popupSubtitle?: EventPoliciesInputConfigValue<string>;
  editorSubtitle?: EventPoliciesInputConfigValue<string>;
  requiredApprovalLabel?: EventPoliciesInputConfigValue<string>;
  optionalPolicyLabel?: EventPoliciesInputConfigValue<string>;
  requiredPreview?: EventPoliciesInputConfigValue<string>;
  optionalPreview?: EventPoliciesInputConfigValue<string>;
  requiredCheckboxLabel?: EventPoliciesInputConfigValue<string>;
}

@Component({
  selector: 'app-event-policies-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    PopupComponent,
    SingleRowComponent
  ],
  templateUrl: './event-policies-input.component.html',
  styleUrl: './event-policies-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EventPoliciesInputComponent),
      multi: true
    }
  ]
})
export class EventPoliciesInputComponent implements ControlValueAccessor {
  @Input() readOnly = false;
  @Input() disabled = false;
  @Input() config: EventPoliciesInputConfig = {};
  @Input() enabled = false;
  @Output() readonly enabledChange = new EventEmitter<boolean>();

  protected policies: EventPolicyInputModel[] = [];
  protected workingPolicies: EventPolicyInputModel[] = [];
  protected workingPolicyDraft: EventPolicyInputModel = this.createEmptyPolicyDraft();
  protected editingPolicyDraftIndex: number | null = null;
  protected showPoliciesPopup = false;
  protected showPolicyEditorPopup = false;

  private idSequence = 0;
  private onModelChange: (value: EventPolicyInputModel[]) => void = () => {};
  private onModelTouched: () => void = () => {};

  constructor(private readonly cdr: ChangeDetectorRef) {}

  writeValue(value: readonly EventPolicyInputModel[] | null | undefined): void {
    this.policies = this.normalizePolicies(value ?? []);
    if (this.showPoliciesPopup) {
      this.workingPolicies = this.clonePolicies(this.policies);
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: EventPolicyInputModel[]) => void): void {
    this.onModelChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onModelTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.readOnly = isDisabled;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected handleEscape(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (this.showPolicyEditorPopup) {
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
      this.showPolicyEditorPopup = false;
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
    this.showPolicyEditorPopup = false;
    this.onModelTouched();
    this.cdr.markForCheck();
  }

  protected closePoliciesPopup(): void {
    if (this.showPoliciesPopup || this.showPolicyEditorPopup) {
      this.syncPoliciesFromWorkingPolicies();
    }
    this.showPoliciesPopup = false;
    this.showPolicyEditorPopup = false;
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
    this.showPolicyEditorPopup = true;
    this.cdr.markForCheck();
  }

  protected closePolicyEditor(): void {
    this.showPolicyEditorPopup = false;
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
      this.editingPolicyDraftIndex = null;
      this.workingPolicyDraft = this.createEmptyPolicyDraft();
    }
    this.syncPoliciesFromWorkingPolicies();
  }

  protected savePolicyDraft(): void {
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

  protected policySetupPopupModel(): PopupModel<EventPolicyPopupMenuContext> {
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

  protected policyEditorPopupModel(): PopupModel<EventPolicyPopupMenuContext> {
    return {
      title: this.policyPopupTitle(),
      subtitle: this.editorSubtitle(),
      ariaLabel: this.policyPopupTitle(),
      closeAriaLabel: 'Close policy form',
      size: 'default',
      height: 'auto',
      headerTone: 'accent',
      backdropTone: 'dim',
      headerActions: this.policyEditorHeaderActions(),
      onClose: () => this.closePolicyEditor(),
      onAction: event => this.onPolicyPopupAction(event)
    };
  }

  protected policyEditorPopupZIndex(): number {
    return 12700;
  }

  protected policySingleRow(policy: EventPolicyInputModel, index: number): SingleRowData<EventPolicyInputModel> {
    return EventPolicySingleRowConverter.convert(policy, {
      index,
      locked: this.locked(),
      requiredApprovalLabel: this.resolveConfigValue(this.config.requiredApprovalLabel, 'Required approval'),
      optionalPolicyLabel: this.resolveConfigValue(this.config.optionalPolicyLabel, 'Optional policy'),
      requiredPreview: this.resolveConfigValue(this.config.requiredPreview, 'Attendees must approve this policy before joining.'),
      optionalPreview: this.resolveConfigValue(this.config.optionalPreview, 'Optional policy shown during join or checkout.')
    });
  }

  private policySetupHeaderControls(): readonly PopupControl<EventPolicyPopupMenuContext>[] {
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
        palette: 'green',
        layout: 'action',
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

  private policyEditorHeaderActions(): readonly PopupAction[] {
    if (this.locked()) {
      return [];
    }
    return [{
      id: 'policy-save',
      icon: 'done',
      ariaLabel: 'Save policy',
      palette: 'success',
      disabled: !this.canSavePolicyDraft()
    }];
  }

  private onPolicyPopupMenuSelect(event: PopupMenuSelectEvent<EventPolicyPopupMenuContext>): void {
    const context = event.itemSelect.context;
    if (context?.menu !== 'policy-setup' || context.action !== 'add') {
      return;
    }
    this.openPolicyEditor(undefined, event.itemSelect.sourceEvent);
  }

  private onPolicyPopupAction(event: PopupActionEvent): void {
    if (event.action.id !== 'policy-save') {
      return;
    }
    event.sourceEvent.preventDefault();
    this.savePolicyDraft();
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
      || `${this.workingPolicyDraft.description ?? ''}`.trim().length > 0;
  }

  protected policiesCountLabel(): string {
    const count = this.policies.length;
    return count === 1 ? '1 policy' : `${count} policies`;
  }

  protected requiredPoliciesCount(): number {
    return this.policies.filter(item => item.required !== false).length;
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

  private normalizedWorkingPolicyDraft(): EventPolicyInputModel {
    return {
      id: `${this.workingPolicyDraft.id ?? ''}`.trim() || this.createPolicyId(),
      title: `${this.workingPolicyDraft.title ?? ''}`.trim(),
      description: `${this.workingPolicyDraft.description ?? ''}`.trim(),
      required: this.workingPolicyDraft.required !== false
    };
  }

  private normalizePolicies(items: readonly EventPolicyInputModel[]): EventPolicyInputModel[] {
    return items
      .map((item, index) => ({
        id: `${item.id ?? `policy-${index + 1}`}`.trim() || `policy-${index + 1}`,
        title: `${item.title ?? ''}`.trim() || `Policy ${index + 1}`,
        description: `${item.description ?? ''}`.trim(),
        required: item.required !== false
      }))
      .filter(item => item.id || item.title || item.description);
  }

  private clonePolicies(items: readonly EventPolicyInputModel[]): EventPolicyInputModel[] {
    return items.map(item => ({ ...item }));
  }

  private createEmptyPolicyDraft(): EventPolicyInputModel {
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

  private resolveConfigValue<TValue>(
    value: EventPoliciesInputConfigValue<TValue> | null | undefined,
    fallback: TValue
  ): TValue {
    if (typeof value === 'function') {
      return (value as () => TValue)() ?? fallback;
    }
    return value ?? fallback;
  }
}
