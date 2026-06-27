import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { APP_STATIC_DATA } from '../../../shared/app-static-data';
import { AppUtils } from '../../../shared/app-utils';
import { AssetCardBuilder, AssetDefaultsBuilder } from '../../../shared/core/base/builders';
import { OwnedAssetsPopupFacadeService } from '../../owned-assets-popup-facade.service';
import { OwnedAssetsStore, type OwnedAssetFormState } from '../../../shared/ui/context/stores/owned-assets.store';
import {
  AppContext,
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

import type * as AppConstants from '../../../shared/core/common/constants';
type AssetEditorMenuContext =
  | { menu: 'visibility'; visibility: AppConstants.EventVisibility }
  | { menu: 'category'; category: AppConstants.AssetCategory }
  | { menu: 'save' };

@Component({
  selector: 'app-asset-editor-popup',
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
  templateUrl: './asset-editor-popup.component.html',
  styleUrl: './asset-editor-popup.component.scss'
})
export class AssetEditorPopupComponent {
  private readonly appCtx = inject(AppContext);
  private readonly ownedAssets = inject(OwnedAssetsPopupFacadeService);
  protected readonly ownedAssetsStore = inject(OwnedAssetsStore);
  protected readonly assetVisibilityOptions = APP_STATIC_DATA.eventVisibilityOptions;
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
    routeStops: () => this.assetFormRouteStops(),
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

  protected get assetForm(): OwnedAssetFormState {
    return this.ownedAssetsStore.assetForm();
  }

  protected get title(): string {
    const mode = this.ownedAssetsStore.editingAssetId() ? 'Edit' : 'Add';
    return `${mode} ${AssetDefaultsBuilder.assetTypeLabel(this.assetForm.type)}`;
  }

  protected get isLoading(): boolean {
    return this.ownedAssetsStore.assetFormLoading();
  }

  protected get isSavePending(): boolean {
    return this.ownedAssetsStore.assetFormSavePending();
  }

  protected get assetFormVisibility(): AppConstants.EventVisibility {
    return this.ownedAssetsStore.assetFormVisibility();
  }

  protected get sourceRefreshEnabled(): boolean {
    return this.ownedAssets.assetSourcePreviewAvailable
      && !this.ownedAssetsStore.assetFormLoading()
      && Boolean(AppUtils.normalizeHttpUrl(this.assetForm.sourceLink));
  }

  protected get assetImageUploadOwnerId(): string {
    return this.ownedAssetsStore.activeOwnerUserId().trim() || this.appCtx.userProfileStore.getActiveUserId().trim();
  }

  protected requestClose(): void {
    if (this.isSavePending) {
      return;
    }
    this.ownedAssetsStore.closeAssetEditor();
  }

  protected submitForm(): void {
    if (this.isLoading || !this.ownedAssetsStore.canSubmitAssetEditor() || this.assetEditorReadOnly()) {
      return;
    }
    void this.ownedAssets.saveAssetCard();
  }

  protected assetEditorSaveMenuItems(): readonly AppMenuItem<string, AssetEditorMenuContext>[] {
    const canSave = this.ownedAssetsStore.canSubmitAssetEditor();
    return [{
      id: 'asset-editor-save',
      icon: 'done',
      layout: 'action',
      palette: canSave || this.isSavePending ? 'success' : 'danger',
      disabled: !canSave || this.assetEditorReadOnly() || this.isLoading,
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
      disabled: () => this.assetEditorReadOnly() || this.isLoading,
      layout: 'pill',
      ariaLabel: 'Open asset visibility selector'
    };
  }

  protected visibilityMenuItems(): readonly AppMenuItem<string, AssetEditorMenuContext>[] {
    return this.assetVisibilityOptions.map(option => ({
      id: `visibility-${option}`,
      label: option,
      icon: this.visibilityIcon(option),
      kind: 'radio',
      active: option === this.assetFormVisibility,
      palette: this.visibilityPalette(option),
      surface: 'tinted',
      disabled: () => this.assetEditorReadOnly() || this.isLoading,
      context: { menu: 'visibility', visibility: option }
    }));
  }

  protected assetCategoryMenuTrigger(): AppMenuTrigger {
    return {
      label: this.assetCategoryLabel(this.assetForm.category),
      icon: this.assetCategoryIcon(this.assetForm.category),
      palette: this.assetCategoryPalette(this.assetForm.category),
      layout: 'field',
      disabled: () => this.assetEditorReadOnly() || this.isLoading,
      ariaLabel: 'Open asset category'
    };
  }

  protected assetCategoryMenuItems(): readonly AppMenuItem<string, AssetEditorMenuContext>[] {
    return this.assetCategoryOptions().map(option => ({
      id: `asset-category-${option}`,
      label: this.assetCategoryLabel(option),
      icon: this.assetCategoryIcon(option),
      kind: 'radio',
      active: option === this.assetForm.category,
      palette: this.assetCategoryPalette(option),
      surface: 'tinted',
      disabled: () => this.assetEditorReadOnly() || this.isLoading,
      context: { menu: 'category', category: option }
    }));
  }

  protected onAssetEditorMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (this.isLoading || this.assetEditorReadOnly()) {
      return;
    }
    const context = event.context as AssetEditorMenuContext | undefined;
    if (!context) {
      return;
    }
    if (context.menu === 'visibility') {
      this.ownedAssetsStore.setAssetEditorVisibility(context.visibility);
      return;
    }
    if (context.menu === 'save') {
      this.submitForm();
      return;
    }
    this.ownedAssetsStore.setAssetEditorCategory(context.category);
  }

  protected assetFormRouteStops(): string[] {
    return AssetCardBuilder.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes);
  }

  protected setAssetEditorRouteStop(index: number, value: string): void {
    this.ownedAssetsStore.setAssetEditorRouteStop(index, value);
  }

  protected refreshAssetFromSourceLink(): void {
    void this.ownedAssets.refreshAssetFromSourceLink();
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
    this.ownedAssetsStore.setAssetEditorImageUrl(imageUrl);
    this.assetImageUrlsCacheKey = imageUrl;
    this.assetImageUrlsCache = imageUrl ? [imageUrl] : [];
  }

  protected assetImageUploadEntity(): string {
    return this.ownedAssetsStore.editingAssetId()?.trim() || this.ownedAssetsStore.assetFormDraftId().trim() || 'asset-draft';
  }

  protected assetEditorReadOnly(): boolean {
    return this.isSavePending;
  }

  protected isPropertyAssetForm(): boolean {
    return this.assetForm?.type === 'Accommodation';
  }

  protected eventVisibilityClass(option: AppConstants.EventVisibility): string {
    return AssetDefaultsBuilder.eventVisibilityClass(option);
  }

  protected visibilityIcon(option: AppConstants.EventVisibility): string {
    return AssetDefaultsBuilder.visibilityIcon(option);
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
