import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { AssetDefaultsBuilder } from '../../../shared/core/base/builders';
import {
  AppMenuComponent,
  EditableImageCarouselComponent,
  EventPoliciesInputComponent,
  LocationInputComponent,
  type EventPoliciesInputConfig,
  type LocationInputConfig,
  PricingEditorInputComponent,
  ProgressIndicatorComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  type PricingEditorConfig
} from '../../../shared/ui';

import type * as AppDTOs from '../../../shared/core/contracts';
import type * as AppConstants from '../../../shared/core/common/constants';
type AssetFormMenuContext =
  | { menu: 'visibility'; visibility: AppConstants.EventVisibility }
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
    EditableImageCarouselComponent,
    EventPoliciesInputComponent,
    LocationInputComponent,
    PricingEditorInputComponent,
    ProgressIndicatorComponent
  ],
  templateUrl: './asset-form-popup.component.html',
  styleUrl: './asset-form-popup.component.scss'
})
export class AssetFormPopupComponent {
  @Input() visible = false;
  @Input() title = '';
  @Input({ required: true }) assetForm!: Omit<AppDTOs.AssetCardDTO, 'id' | 'requests'>;
  @Input() canSave = false;
  @Input() isLoading = false;
  @Input() isSavePending = false;
  @Input() sourceRefreshEnabled = false;
  @Input() assetFormVisibility: AppConstants.EventVisibility = 'Invitation only';
  @Input() assetVisibilityOptions: readonly AppConstants.EventVisibility[] = [];
  @Input() assetFormRouteStops: string[] = [];
  @Input() isEventEditorReadOnly = false;
  @Input() assetImageUploadOwnerId = '';
  @Input() assetImageUploadEntityId = 'asset-draft';
  @Input({ required: true }) eventVisibilityClass!: (option: AppConstants.EventVisibility) => string;
  @Input({ required: true }) visibilityIcon!: (option: AppConstants.EventVisibility) => string;
  @Input({ required: true }) close!: () => void;
  @Input({ required: true }) save!: () => void | Promise<void>;
  @Input({ required: true }) setAssetFormVisibility!: (option: AppConstants.EventVisibility) => void;
  @Input({ required: true }) setAssetFormRouteStop!: (index: number, value: string) => void;
  @Input({ required: true }) refreshAssetFromSourceLink!: () => void | Promise<void>;
  private assetImageUrlsCacheKey = '';
  private assetImageUrlsCache: string[] = [];
  protected readonly assetPricingEditorConfig: PricingEditorConfig = {
    context: 'asset',
    presentation: 'popup-summary',
    allowSlotFeatures: false,
    showAudienceSection: false
  };
  protected readonly assetLocationInputConfig: LocationInputConfig = {
    label: 'Location',
    placeholder: 'Property address',
    required: true,
    routeStops: () => this.assetFormRouteStops,
    mapMode: 'search',
    mapAriaLabel: 'Open location on map'
  };
  protected readonly assetPoliciesInputConfig: EventPoliciesInputConfig = {
    title: 'Lending Policies',
    subtitle: 'Add the rules borrowers need to read and approve before borrowing this asset.',
    toggleable: false,
    openLabel: 'Open Policy Setup',
    viewLabel: 'View Policies',
    emptyLabel: 'No lending policies yet. Add policies if borrowers must review terms before sending the request.',
    readOnlyEmptyLabel: 'No lending policies are configured for this asset.',
    popupSubtitle: 'Keep the list compact here. Open a policy to edit the details borrowers need to read and approve.',
    editorSubtitle: 'Write the lending policy clearly and choose whether borrowers must approve it before sending the request.',
    requiredApprovalLabel: 'Required approval',
    optionalPolicyLabel: 'Optional policy',
    requiredPreview: 'Borrowers must approve this lending policy before sending the request.',
    optionalPreview: 'Optional lending policy shown during the request flow.',
    requiredCheckboxLabel: 'Borrowers must approve this policy'
  };

  protected requestClose(): void {
    if (this.isSavePending) {
      return;
    }
    this.close();
  }

  protected submitForm(): void {
    if (this.isLoading || !this.canSave || this.assetFormReadOnly()) {
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
      disabled: !this.canSave || this.assetFormReadOnly() || this.isLoading,
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
      disabled: () => this.assetFormReadOnly() || this.isLoading,
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
      disabled: () => this.assetFormReadOnly() || this.isLoading,
      context: { menu: 'visibility', visibility: option }
    }));
  }

  protected assetCategoryMenuTrigger(): AppMenuTrigger {
    return {
      label: this.assetCategoryLabel(this.assetForm.category),
      icon: this.assetCategoryIcon(this.assetForm.category),
      palette: this.assetCategoryPalette(this.assetForm.category),
      layout: 'field',
      disabled: () => this.assetFormReadOnly() || this.isLoading,
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
      disabled: () => this.assetFormReadOnly() || this.isLoading,
      context: { menu: 'category', category: option }
    }));
  }

  protected onAssetFormMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (this.isLoading || this.assetFormReadOnly()) {
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

  protected assetImageUrls(): string[] {
    const imageUrl = `${this.assetForm?.imageUrl ?? ''}`.trim();
    if (this.assetImageUrlsCacheKey !== imageUrl) {
      this.assetImageUrlsCacheKey = imageUrl;
      this.assetImageUrlsCache = imageUrl ? [imageUrl] : [];
    }
    return this.assetImageUrlsCache;
  }

  protected onAssetImageUrlsChange(imageUrls: readonly string[] | null | undefined): void {
    const imageUrl = `${imageUrls?.[0] ?? ''}`.trim();
    this.assetForm.imageUrl = imageUrl;
    this.assetImageUrlsCacheKey = imageUrl;
    this.assetImageUrlsCache = imageUrl ? [imageUrl] : [];
  }

  protected assetImageUploadEntity(): string {
    return this.assetImageUploadEntityId.trim() || 'asset-draft';
  }

  protected assetFormReadOnly(): boolean {
    return this.isSavePending || this.isEventEditorReadOnly;
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

}
