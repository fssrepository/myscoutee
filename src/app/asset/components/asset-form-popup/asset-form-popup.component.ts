import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import type * as AppTypes from '../../../shared/core/base/models';
import type * as ContractTypes from '../../../shared/core/contracts';
import { AssetCardBuilder, AssetDefaultsBuilder } from '../../../shared/core/base/builders';
import {
  AppMenuComponent,
  PricingEditorComponent,
  ProgressIndicatorComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger
} from '../../../shared/ui';

import type * as AppDTOs from '../../../shared/core/base/dto';
import type * as AppConstants from '../../../shared/core/common/constants';
type AssetFormMenuContext =
  | { menu: 'visibility'; visibility: AppConstants.EventVisibility }
  | { menu: 'type'; type: AppConstants.AssetType }
  | { menu: 'category'; category: AppConstants.AssetCategory }
  | { menu: 'save' };

@Component({
  selector: 'app-asset-form-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    AppMenuComponent,
    PricingEditorComponent,
    ProgressIndicatorComponent
  ],
  templateUrl: './asset-form-popup.component.html',
  styleUrl: './asset-form-popup.component.scss'
})
export class AssetFormPopupComponent implements OnChanges {
  @Input() visible = false;
  @Input() title = '';
  @Input({ required: true }) assetForm!: Omit<AppDTOs.AssetCardDTO, 'id' | 'requests'>;
  @Input() canSave = false;
  @Input() isLoading = false;
  @Input() isSavePending = false;
  @Input() sourceRefreshEnabled = false;
  @Input() assetFormVisibility: AppConstants.EventVisibility = 'Invitation only';
  @Input() assetTypeOptions: readonly AppConstants.AssetType[] = [];
  @Input() assetVisibilityOptions: readonly AppConstants.EventVisibility[] = [];
  @Input() assetFormRouteStops: string[] = [];
  @Input() isEventEditorReadOnly = false;
  @Input({ required: true }) assetTypeClass!: (type: AppConstants.AssetFilterType) => string;
  @Input({ required: true }) assetTypeIcon!: (type: AppConstants.AssetFilterType) => string;
  @Input({ required: true }) assetTypeLabel!: (type: AppConstants.AssetFilterType) => string;
  @Input({ required: true }) eventVisibilityClass!: (option: AppConstants.EventVisibility) => string;
  @Input({ required: true }) visibilityIcon!: (option: AppConstants.EventVisibility) => string;
  @Input({ required: true }) close!: () => void;
  @Input({ required: true }) save!: () => void | Promise<void>;
  @Input({ required: true }) setAssetFormVisibility!: (option: AppConstants.EventVisibility) => void;
  @Input({ required: true }) setAssetFormRouteStop!: (index: number, value: string) => void;
  @Input({ required: true }) openAssetFormRouteStopMap!: (index: number, event?: Event) => void;
  @Input({ required: true }) refreshAssetFromSourceLink!: () => void | Promise<void>;
  @Input({ required: true }) onAssetImageFileSelected!: (file: File) => void;
  protected showPoliciesPopup = false;
  protected showPolicyEditorPopup = false;
  protected workingPolicies: ContractTypes.EventPolicyItem[] = [];
  protected workingPolicyDraft: ContractTypes.EventPolicyItem = this.createEmptyPolicyDraft();
  protected editingPolicyDraftIndex: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && changes['visible'].currentValue === true) {
      this.showPolicyEditorPopup = false;
    }
  }

  protected requestClose(): void {
    if (this.isSavePending) {
      return;
    }
    this.close();
  }

  protected submitForm(): void {
    if (this.isLoading || !this.canSave || this.isSavePending) {
      return;
    }
    void this.save();
  }

  protected assetFormSaveMenuItems(): readonly AppMenuItem<string, AssetFormMenuContext>[] {
    return [{
      id: 'asset-form-save',
      icon: 'done',
      layout: 'action',
      palette: this.canSave || this.isSavePending ? 'success' : 'danger',
      disabled: !this.canSave || this.isSavePending || this.isLoading,
      ariaLabel: 'Save asset',
      progress: this.isSavePending
        ? {
            state: 'loading',
            shape: 'circle'
          }
        : null,
      context: { menu: 'save' }
    }];
  }

  protected visibilityMenuTrigger(): AppMenuTrigger {
    return {
      label: this.assetFormVisibility,
      icon: this.visibilityIcon(this.assetFormVisibility),
      palette: this.visibilityPalette(this.assetFormVisibility),
      disabled: () => this.isSavePending || this.isLoading,
      layout: 'pill',
      ariaLabel: 'Open asset visibility selector'
    };
  }

  protected visibilityMenuItems(): readonly AppMenuItem<string, AssetFormMenuContext>[] {
    return this.assetVisibilityOptions.map(option => ({
      id: `visibility-${option}`,
      label: option,
      icon: this.visibilityIcon(option),
      kind: 'radio',
      active: option === this.assetFormVisibility,
      palette: this.visibilityPalette(option),
      surface: 'tinted',
      disabled: () => this.isSavePending || this.isLoading,
      context: { menu: 'visibility', visibility: option }
    }));
  }

  protected assetTypeMenuTrigger(): AppMenuTrigger {
    return {
      label: this.assetTypeLabel(this.assetForm.type),
      icon: this.assetTypeIcon(this.assetForm.type),
      palette: this.assetTypePalette(this.assetForm.type),
      layout: 'field',
      disabled: () => this.isSavePending || this.isLoading,
      ariaLabel: 'Open asset type'
    };
  }

  protected assetTypeMenuItems(): readonly AppMenuItem<string, AssetFormMenuContext>[] {
    return this.assetTypeOptions.map(option => ({
      id: `asset-type-${option}`,
      label: this.assetTypeLabel(option),
      icon: this.assetTypeIcon(option),
      kind: 'radio',
      active: option === this.assetForm.type,
      palette: this.assetTypePalette(option),
      surface: 'tinted',
      disabled: () => this.isSavePending || this.isLoading,
      context: { menu: 'type', type: option }
    }));
  }

  protected assetCategoryMenuTrigger(): AppMenuTrigger {
    return {
      label: this.assetCategoryLabel(this.assetForm.category),
      icon: this.assetCategoryIcon(this.assetForm.category),
      palette: this.assetCategoryPalette(this.assetForm.category),
      layout: 'field',
      disabled: () => this.isSavePending || this.isLoading,
      ariaLabel: 'Open asset category'
    };
  }

  protected assetCategoryMenuItems(): readonly AppMenuItem<string, AssetFormMenuContext>[] {
    return this.assetCategoryOptions().map(option => ({
      id: `asset-category-${option}`,
      label: this.assetCategoryLabel(option),
      icon: this.assetCategoryIcon(option),
      kind: 'radio',
      active: option === this.assetForm.category,
      palette: this.assetCategoryPalette(option),
      surface: 'tinted',
      disabled: () => this.isSavePending || this.isLoading,
      context: { menu: 'category', category: option }
    }));
  }

  protected onAssetFormMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (this.isLoading || this.isSavePending) {
      return;
    }
    const context = event.context as AssetFormMenuContext | undefined;
    if (!context) {
      return;
    }
    if (context.menu === 'visibility') {
      this.setAssetFormVisibility(context.visibility);
      return;
    }
    if (context.menu === 'type') {
      this.onAssetTypeChange(context.type);
      return;
    }
    if (context.menu === 'save') {
      this.submitForm();
      return;
    }
    this.assetForm.category = context.category;
  }

  protected assetCategoryOptions(): AppConstants.AssetCategory[] {
    return AssetDefaultsBuilder.assetCategoryOptions(this.assetForm.type);
  }

  protected assetCategoryClass(category: AppConstants.AssetCategory | null | undefined): string {
    return AssetDefaultsBuilder.assetCategoryClass(category, this.assetForm.type);
  }

  protected assetCategoryIcon(category: AppConstants.AssetCategory | null | undefined): string {
    return AssetDefaultsBuilder.assetCategoryIcon(category, this.assetForm.type);
  }

  protected assetCategoryLabel(category: AppConstants.AssetCategory | null | undefined): string {
    return AssetDefaultsBuilder.assetCategoryLabel(category);
  }

  protected onAssetTypeChange(type: AppConstants.AssetType): void {
    this.assetForm.type = type;
    this.assetForm.category = AssetDefaultsBuilder.normalizeCategory(type, this.assetForm.category);
    this.assetForm.routes = AssetCardBuilder.normalizeAssetRoutes(type, this.assetForm.routes);
  }

  protected openPoliciesPopup(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.isLoading || this.isSavePending) {
      return;
    }
    this.showPoliciesPopup = true;
    this.showPolicyEditorPopup = false;
    this.editingPolicyDraftIndex = null;
    this.workingPolicyDraft = this.createEmptyPolicyDraft();
    this.workingPolicies = this.clonePolicies(this.assetForm.policies ?? []);
  }

  protected closePoliciesPopup(): void {
    this.showPoliciesPopup = false;
    this.closePolicyEditor();
    this.workingPolicies = [];
  }

  protected openPolicyEditor(index?: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.isLoading || this.isSavePending) {
      return;
    }
    const source = typeof index === 'number'
      ? this.workingPolicies[index] ?? null
      : null;
    this.editingPolicyDraftIndex = typeof index === 'number' ? index : null;
    this.workingPolicyDraft = source
      ? {
          id: source.id?.trim() || `policy-${Date.now()}`,
          title: source.title ?? '',
          description: source.description ?? '',
          required: source.required !== false
        }
      : this.createEmptyPolicyDraft();
    this.showPolicyEditorPopup = true;
  }

  protected closePolicyEditor(): void {
    this.showPolicyEditorPopup = false;
    this.workingPolicyDraft = this.createEmptyPolicyDraft();
    this.editingPolicyDraftIndex = null;
  }

  protected savePolicyDraft(): void {
    if (this.isLoading || !this.canSavePolicyDraft() || this.isSavePending) {
      return;
    }
    const nextItem: ContractTypes.EventPolicyItem = {
      id: this.workingPolicyDraft.id?.trim() || `policy-${Date.now()}`,
      title: this.workingPolicyDraft.title.trim(),
      description: this.workingPolicyDraft.description.trim(),
      required: this.workingPolicyDraft.required !== false
    };
    if (this.editingPolicyDraftIndex !== null && this.editingPolicyDraftIndex >= 0 && this.editingPolicyDraftIndex < this.workingPolicies.length) {
      this.workingPolicies = this.workingPolicies.map((item, index) => (
        index === this.editingPolicyDraftIndex ? nextItem : item
      ));
    } else {
      this.workingPolicies = [...this.workingPolicies, nextItem];
    }
    this.syncAssetPoliciesFromWorkingPolicies();
    this.closePolicyEditor();
  }

  protected removePolicyDraft(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.isLoading || this.isSavePending || index < 0 || index >= this.workingPolicies.length) {
      return;
    }
    this.workingPolicies = this.workingPolicies.filter((_, itemIndex) => itemIndex !== index);
    if (this.editingPolicyDraftIndex === index) {
      this.closePolicyEditor();
    }
    this.syncAssetPoliciesFromWorkingPolicies();
  }

  protected policyPopupTitle(): string {
    return this.editingPolicyDraftIndex === null ? 'Create Policy' : 'Edit Policy';
  }

  protected policyCardMetaLabel(policy: ContractTypes.EventPolicyItem): string {
    return policy.required !== false ? 'Required approval' : 'Optional policy';
  }

  protected policyCardPreview(policy: ContractTypes.EventPolicyItem): string {
    const description = policy.description.trim();
    if (description.length > 0) {
      return description;
    }
    return policy.required !== false
      ? 'Borrowers must approve this lending policy before sending the request.'
      : 'Optional lending policy shown during the request flow.';
  }

  protected policiesCountLabel(): string {
    const count = this.assetForm.policies?.length ?? 0;
    return count === 1 ? '1 policy' : `${count} policies`;
  }

  protected requiredPoliciesCount(): number {
    return (this.assetForm.policies ?? []).filter(item => item.required !== false).length;
  }

  protected canSavePolicyDraft(): boolean {
    return this.workingPolicyDraft.title.trim().length > 0 || this.workingPolicyDraft.description.trim().length > 0;
  }

  protected isPropertyAssetForm(): boolean {
    return this.assetForm?.type === 'Accommodation';
  }

  private visibilityPalette(option: AppConstants.EventVisibility): AppMenuPalette {
    if (option === 'Public') {
      return 'green';
    }
    if (option === 'Friends only') {
      return 'blue';
    }
    return 'orange';
  }

  private assetTypePalette(type: AppConstants.AssetFilterType): AppMenuPalette {
    if (type === 'Accommodation') {
      return 'green';
    }
    if (type === 'Supplies') {
      return 'brown';
    }
    if (type === 'Ticket') {
      return 'sky';
    }
    return 'blue';
  }

  private assetCategoryPalette(category: AppConstants.AssetCategory | null | undefined): AppMenuPalette {
    const className = this.assetCategoryClass(category);
    if (className.includes('accommodation') || className.includes('property')) {
      return 'green';
    }
    if (className.includes('supply') || className.includes('supplies')) {
      return 'brown';
    }
    if (className.includes('vehicle') || className.includes('car')) {
      return 'blue';
    }
    return this.assetTypePalette(this.assetForm.type);
  }

  protected onImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    this.onAssetImageFileSelected(file);
    target.value = '';
  }

  private syncAssetPoliciesFromWorkingPolicies(): void {
    this.assetForm.policies = this.clonePolicies(this.workingPolicies);
  }

  private createEmptyPolicyDraft(): ContractTypes.EventPolicyItem {
    return {
      id: `policy-${Date.now()}`,
      title: '',
      description: '',
      required: true
    };
  }

  private clonePolicies(items: readonly ContractTypes.EventPolicyItem[]): ContractTypes.EventPolicyItem[] {
    return items.map(item => ({
      id: `${item.id ?? ''}`.trim(),
      title: `${item.title ?? ''}`.trim(),
      description: `${item.description ?? ''}`.trim(),
      required: item.required !== false
    })).filter(item => item.id || item.title || item.description);
  }
}
