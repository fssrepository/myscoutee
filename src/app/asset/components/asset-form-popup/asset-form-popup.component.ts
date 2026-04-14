import { CommonModule } from '@angular/common';
import { Component, HostListener, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import type * as AppTypes from '../../../shared/core/base/models';
import { AssetCardBuilder, AssetDefaultsBuilder } from '../../../shared/core/base/builders';
import { PricingEditorComponent } from '../../../shared/ui';

@Component({
  selector: 'app-asset-form-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule,
    PricingEditorComponent
  ],
  templateUrl: './asset-form-popup.component.html',
  styleUrl: './asset-form-popup.component.scss'
})
export class AssetFormPopupComponent implements OnChanges, OnInit, OnDestroy {
  @Input() visible = false;
  @Input() title = '';
  @Input({ required: true }) assetForm!: Omit<AppTypes.AssetCard, 'id' | 'requests'>;
  @Input() canSave = false;
  @Input() isSavePending = false;
  @Input() saveRingPerimeter = 100;
  @Input() sourceRefreshEnabled = false;
  @Input() assetFormVisibility: AppTypes.EventVisibility = 'Invitation only';
  @Input() assetTypeOptions: readonly AppTypes.AssetType[] = [];
  @Input() assetVisibilityOptions: readonly AppTypes.EventVisibility[] = [];
  @Input() assetFormRouteStops: string[] = [];
  @Input() isEventEditorReadOnly = false;
  @Input({ required: true }) assetTypeClass!: (type: AppTypes.AssetFilterType) => string;
  @Input({ required: true }) assetTypeIcon!: (type: AppTypes.AssetFilterType) => string;
  @Input({ required: true }) assetTypeLabel!: (type: AppTypes.AssetFilterType) => string;
  @Input({ required: true }) eventVisibilityClass!: (option: AppTypes.EventVisibility) => string;
  @Input({ required: true }) visibilityIcon!: (option: AppTypes.EventVisibility) => string;
  @Input({ required: true }) close!: () => void;
  @Input({ required: true }) save!: () => void | Promise<void>;
  @Input({ required: true }) setAssetFormVisibility!: (option: AppTypes.EventVisibility) => void;
  @Input({ required: true }) setAssetFormRouteStop!: (index: number, value: string) => void;
  @Input({ required: true }) openAssetFormRouteStopMap!: (index: number, event?: Event) => void;
  @Input({ required: true }) refreshAssetFromSourceLink!: () => void | Promise<void>;
  @Input({ required: true }) onAssetImageFileSelected!: (file: File) => void;
  protected showMobileAssetTypePicker = false;
  protected showMobileAssetCategoryPicker = false;
  protected showVisibilityPicker = false;
  protected showPoliciesPopup = false;
  protected showPolicyEditorPopup = false;
  protected workingPolicies: AppTypes.EventPolicyItem[] = [];
  protected workingPolicyDraft: AppTypes.EventPolicyItem = this.createEmptyPolicyDraft();
  protected editingPolicyDraftIndex: number | null = null;

  // Add to your class properties:
  protected isMobileViewport = false;
  private mediaQueryList: MediaQueryList | null = null;
  private mediaListener = () => { this.isMobileViewport = this.mediaQueryList?.matches ?? false; };

  // Implement OnInit and OnDestroy:
  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.mediaQueryList = window.matchMedia('(max-width: 900px)');
      this.isMobileViewport = this.mediaQueryList.matches;
      this.mediaQueryList.addEventListener('change', this.mediaListener);
    }
  }

  ngOnDestroy(): void {
    this.mediaQueryList?.removeEventListener('change', this.mediaListener);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && changes['visible'].currentValue === true) {
      this.showMobileAssetTypePicker = false;
      this.showMobileAssetCategoryPicker = false;
      this.showVisibilityPicker = false;
    }
  }

  protected requestClose(): void {
    if (this.isSavePending) {
      return;
    }
    this.close();
  }

  protected submitForm(): void {
    if (!this.canSave || this.isSavePending) {
      return;
    }
    void this.save();
  }

  protected toggleVisibilityPicker(event?: Event): void {
    event?.stopPropagation();
    if (this.isSavePending) {
      return;
    }
    this.showMobileAssetTypePicker = false;
    this.showMobileAssetCategoryPicker = false;
    this.showVisibilityPicker = !this.showVisibilityPicker;
  }

  protected selectVisibility(option: AppTypes.EventVisibility, event?: Event): void {
    event?.stopPropagation();
    if (this.isSavePending) {
      return;
    }
    this.setAssetFormVisibility(option);
    this.showVisibilityPicker = false;
  }

  protected assetCategoryOptions(): AppTypes.AssetCategory[] {
    return AssetDefaultsBuilder.assetCategoryOptions(this.assetForm.type);
  }

  protected assetCategoryClass(category: AppTypes.AssetCategory | null | undefined): string {
    return AssetDefaultsBuilder.assetCategoryClass(category, this.assetForm.type);
  }

  protected assetCategoryIcon(category: AppTypes.AssetCategory | null | undefined): string {
    return AssetDefaultsBuilder.assetCategoryIcon(category, this.assetForm.type);
  }

  protected assetCategoryLabel(category: AppTypes.AssetCategory | null | undefined): string {
    return AssetDefaultsBuilder.assetCategoryLabel(category);
  }

  protected onAssetTypeChange(type: AppTypes.AssetType): void {
    this.assetForm.type = type;
    this.assetForm.category = AssetDefaultsBuilder.normalizeCategory(type, this.assetForm.category);
    this.assetForm.routes = AssetCardBuilder.normalizeAssetRoutes(type, this.assetForm.routes);
  }

  protected openPoliciesPopup(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.isSavePending) {
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
    if (this.isSavePending) {
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
    if (!this.canSavePolicyDraft() || this.isSavePending) {
      return;
    }
    const nextItem: AppTypes.EventPolicyItem = {
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
    if (this.isSavePending || index < 0 || index >= this.workingPolicies.length) {
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

  protected policyCardMetaLabel(policy: AppTypes.EventPolicyItem): string {
    return policy.required !== false ? 'Required approval' : 'Optional policy';
  }

  protected policyCardPreview(policy: AppTypes.EventPolicyItem): string {
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

  protected openMobileAssetTypeSelector(event: Event): void {
    if (!this.isMobileAssetTypeSheetViewport() || this.isSavePending) {
      return;
    }
    event.stopPropagation();
    this.showMobileAssetCategoryPicker = false;
    this.showVisibilityPicker = false;
    this.showMobileAssetTypePicker = !this.showMobileAssetTypePicker;
  }

  protected selectMobileAssetType(type: AppTypes.AssetType, event?: Event): void {
    if (this.isSavePending) {
      return;
    }
    event?.stopPropagation();
    this.onAssetTypeChange(type);
    this.showMobileAssetTypePicker = false;
  }

  protected openMobileAssetCategorySelector(event: Event): void {
    if (!this.isMobileAssetTypeSheetViewport() || this.isSavePending) {
      return;
    }
    event.stopPropagation();
    this.showMobileAssetTypePicker = false;
    this.showVisibilityPicker = false;
    this.showMobileAssetCategoryPicker = !this.showMobileAssetCategoryPicker;
  }

  protected selectMobileAssetCategory(category: AppTypes.AssetCategory, event?: Event): void {
    if (this.isSavePending) {
      return;
    }
    event?.stopPropagation();
    this.assetForm.category = category;
    this.showMobileAssetCategoryPicker = false;
  }

  protected isMobileAssetTypeSheetViewport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 900px)').matches;
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    if (!this.showMobileAssetTypePicker && !this.showMobileAssetCategoryPicker) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    this.showMobileAssetTypePicker = false;
    this.showMobileAssetCategoryPicker = false;
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.closest('.asset-form-mobile-type-picker')) {
      this.showMobileAssetTypePicker = false;
    }
    if (!target.closest('.asset-form-mobile-category-picker')) {
      this.showMobileAssetCategoryPicker = false;
    }
    if (!target.closest('.asset-form-visibility-picker')) {
      this.showVisibilityPicker = false;
    }
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

  private createEmptyPolicyDraft(): AppTypes.EventPolicyItem {
    return {
      id: `policy-${Date.now()}`,
      title: '',
      description: '',
      required: true
    };
  }

  private clonePolicies(items: readonly AppTypes.EventPolicyItem[]): AppTypes.EventPolicyItem[] {
    return items.map(item => ({
      id: `${item.id ?? ''}`.trim(),
      title: `${item.title ?? ''}`.trim(),
      description: `${item.description ?? ''}`.trim(),
      required: item.required !== false
    })).filter(item => item.id || item.title || item.description);
  }
}
