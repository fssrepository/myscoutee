import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, forwardRef, HostListener, Input, Output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import type * as EventContracts from '../../../../../core/contracts/event.interface';

type EventPolicyInputModel = EventContracts.EventPolicyDTO;
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
    MatIconModule
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
    return !this.readOnly || this.effectivePanelEnabled();
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
    return this.readOnly ? this.enabled && this.policies.length > 0 : this.enabled;
  }

  protected togglePoliciesEnabled(event?: Event): void {
    event?.preventDefault();
    if (this.readOnly || !this.policiesToggleable()) {
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
    if (this.readOnly || index < 0 || index >= this.workingPolicies.length) {
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
    if (this.readOnly || !this.canSavePolicyDraft()) {
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

  protected policyCardMetaLabel(policy: EventPolicyInputModel): string {
    return policy.required !== false
      ? this.resolveConfigValue(this.config.requiredApprovalLabel, 'Required approval')
      : this.resolveConfigValue(this.config.optionalPolicyLabel, 'Optional policy');
  }

  protected policyCardPreview(policy: EventPolicyInputModel): string {
    const description = `${policy.description ?? ''}`.trim();
    if (description.length > 0) {
      return description;
    }
    return policy.required !== false
      ? this.resolveConfigValue(this.config.requiredPreview, 'Attendees must approve this policy before joining.')
      : this.resolveConfigValue(this.config.optionalPreview, 'Optional policy shown during join or checkout.');
  }

  protected policiesToggleable(): boolean {
    return this.resolveConfigValue(this.config.toggleable, true);
  }

  protected openPoliciesLabel(): string {
    return this.readOnly
      ? this.resolveConfigValue(this.config.viewLabel, 'View Policies')
      : this.resolveConfigValue(this.config.openLabel, 'Open Policy Setup');
  }

  protected emptyPoliciesLabel(): string {
    return this.readOnly
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
