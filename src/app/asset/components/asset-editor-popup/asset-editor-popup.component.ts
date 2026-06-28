import {
  CommonModule
} from '@angular/common';
import {
  Component,
  inject
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  MatIconModule
} from '@angular/material/icon';

import {
  environment
} from '../../../../environments/environment';
import {
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import {
  AppUtils
} from '../../../shared/app-utils';
import {
  AssetCardBuilder,
  AssetDefaultsBuilder
} from '../../../shared/core/base/builders';
import {
  AssetsService,
  MediaService
} from '../../../shared/core';
import {
  AssetStore,
  type AssetFormState
} from '../../../shared/ui/context/stores/asset.store';
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

import type * as AppConstants from '../../../shared/core/common/constants';
import type * as AppDTOs from '../../../shared/core/contracts';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
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
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly assetsService = inject(AssetsService);
  private readonly mediaService = inject(MediaService);
  protected readonly assetStore = inject(AssetStore);
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

  protected get assetForm(): AssetFormState {
    return this.assetStore.assetForm();
  }

  protected get title(): string {
    const mode = this.assetStore.editingAssetId() ? 'Edit' : 'Add';
    return `${mode} ${AssetDefaultsBuilder.assetTypeLabel(this.assetForm.type)}`;
  }

  protected get isLoading(): boolean {
    return this.assetStore.assetFormLoading();
  }

  protected get isSavePending(): boolean {
    return this.assetStore.assetFormSavePending();
  }

  protected get assetFormVisibility(): AppConstants.EventVisibility {
    return this.assetStore.assetFormVisibility();
  }

  protected get sourceRefreshEnabled(): boolean {
    return environment.activitiesDataSource === 'http'
      && !this.assetStore.assetFormLoading()
      && Boolean(AppUtils.normalizeHttpUrl(this.assetForm.sourceLink));
  }

  protected get assetImageUploadOwnerId(): string {
    return this.assetStore.activeOwnerUserId().trim() || this.userProfileStore.getActiveUserId().trim();
  }

  protected requestClose(): void {
    if (this.isSavePending) {
      return;
    }
    this.assetStore.closeAssetEditor();
  }

  protected submitForm(): void {
    if (this.isLoading || !this.canSubmitAssetEditor() || this.assetEditorReadOnly()) {
      return;
    }
    void this.saveAssetCard();
  }

  protected assetEditorSaveMenuItems(): readonly AppMenuItem<string, AssetEditorMenuContext>[] {
    const canSave = this.canSubmitAssetEditor();
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
      this.assetStore.setAssetEditorVisibility(context.visibility);
      return;
    }
    if (context.menu === 'save') {
      this.submitForm();
      return;
    }
    this.setAssetEditorCategory(context.category);
  }

  protected assetFormRouteStops(): string[] {
    return AssetCardBuilder.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes);
  }

  protected setAssetEditorRouteStop(index: number, value: string): void {
    const assetForm = this.assetStore.assetFormRef();
    const routes = [...AssetCardBuilder.normalizeAssetRoutes(assetForm.type, assetForm.routes)];
    if (index < 0 || index >= routes.length) {
      return;
    }
    routes[index] = value;
    assetForm.routes = AssetCardBuilder.normalizeAssetRoutes(assetForm.type, routes);
    this.assetStore.touchUiState();
  }

  protected refreshAssetFromSourceLink(): void {
    void this.refreshAssetFromSourceLinkAction();
  }

  private async refreshAssetFromSourceLinkAction(): Promise<void> {
    if (this.assetStore.assetFormLoadingRef()) {
      return;
    }
    const sourceUrl = this.normalizedAssetSourcePreviewUrl(true);
    if (!sourceUrl) {
      return;
    }
    const ownerUserId = this.assetStore.activeOwnerUserIdRef().trim()
      || this.userProfileStore.getActiveUserId().trim();
    const assetForm = this.assetStore.assetFormRef();
    const preview = await this.assetsService.refreshAssetSourcePreview(ownerUserId, assetForm.type, sourceUrl);
    if (!preview || preview.enabled === false) {
      return;
    }
    const replacedImageUrl = this.assetStore.applyAssetSourcePreview(preview, sourceUrl);
    if (environment.activitiesDataSource === 'http') {
      AppUtils.revokeObjectUrl(replacedImageUrl);
    }
  }

  private async saveAssetCard(): Promise<void> {
    if (!this.canSubmitAssetEditor() || !this.assetStore.beginAssetEditorSave()) {
      return;
    }
    try {
      const assetForm = this.assetStore.assetFormRef();
      const ownerUserId = this.assetStore.activeOwnerUserIdRef().trim()
        || this.userProfileStore.getActiveUserId().trim();
      const ownerName = this.userProfileStore.activeUserProfile()?.name?.trim() || undefined;
      const editingAssetId = this.assetStore.editingAssetIdRef();
      const assetId = editingAssetId || this.assetStore.assetFormDraftIdRef() || `asset-${Date.now()}`;
      const resolvedImageUrl = await this.resolvePersistedAssetImageUrl(ownerUserId, assetId);
      if (environment.activitiesDataSource === 'http' && this.hasPendingAssetSourceImage() && !resolvedImageUrl) {
        throw new Error('Unable to upload asset image.');
      }
      const payload = AssetCardBuilder.buildAssetSavePayload(assetForm, resolvedImageUrl || assetForm.imageUrl);
      const resolvedVisibility: AppConstants.EventVisibility = this.assetStore.assetFormVisibilityRef();

      if (editingAssetId) {
        const existing = this.assetStore.assetCards().find(card => card.id === editingAssetId);
        const nextCard: AppDTOs.AssetDetailDTO = {
          id: editingAssetId,
          ...payload,
          visibility: resolvedVisibility,
          ownerUserId: existing?.ownerUserId,
          ownerName: existing?.ownerName ?? ownerName,
          requests: existing?.requests.map(request => ({ ...request })) ?? [],
          menuActions: [...(existing?.menuActions ?? [])]
        };
        this.assetStore.applyAssetCards(this.assetStore.assetCards().map(card =>
          card.id === editingAssetId
            ? nextCard
            : card
        ), { reloadList: false, mutation: true });
        const persistPromise = ownerUserId
          ? this.assetsService.saveOwnedAsset(ownerUserId, nextCard).then(savedCard => {
              if (this.assetStore.isActiveOwnerUser(ownerUserId)) {
                this.assetStore.replaceAssetCard(savedCard, { reloadList: false });
              }
            })
          : Promise.resolve();
        await persistPromise;
      } else {
        const nextCard: AppDTOs.AssetDetailDTO = {
          id: assetId,
          ...payload,
          visibility: resolvedVisibility,
          ownerUserId,
          ownerName,
          requests: [],
          menuActions: ['share', 'edit', 'delete']
        };
        this.assetStore.applyAssetCards([nextCard, ...this.assetStore.assetCards()], {
          reloadList: false,
          mutation: true
        });
        const persistPromise = ownerUserId
          ? this.assetsService.saveOwnedAsset(ownerUserId, nextCard).then(savedCard => {
              if (this.assetStore.isActiveOwnerUser(ownerUserId)) {
                this.assetStore.replaceAssetCard(savedCard, { reloadList: false });
              }
            })
          : Promise.resolve();
        await persistPromise;
      }
      this.assetStore.completeAssetEditorSave();
    } catch {
      this.assetStore.failAssetEditorSave();
    }
  }

  private async resolvePersistedAssetImageUrl(ownerUserId: string, assetId: string): Promise<string | null> {
    const assetForm = this.assetStore.assetFormRef();
    const pendingSourceImageUrl = this.assetStore.pendingAssetSourceImageUrlRef().trim();
    if (pendingSourceImageUrl && pendingSourceImageUrl === assetForm.imageUrl.trim()) {
      const importResult = await this.mediaService.importImage(ownerUserId, assetId, pendingSourceImageUrl);
      if (importResult.uploaded && importResult.imageUrl) {
        this.assetStore.applyPersistedAssetImage(importResult.imageUrl);
        return importResult.imageUrl;
      }
      return null;
    }
    return assetForm.imageUrl.trim() || null;
  }

  private hasPendingAssetSourceImage(): boolean {
    const assetForm = this.assetStore.assetFormRef();
    const pendingSourceImageUrl = this.assetStore.pendingAssetSourceImageUrlRef().trim();
    return Boolean(pendingSourceImageUrl && pendingSourceImageUrl === assetForm.imageUrl.trim());
  }

  private normalizedAssetSourcePreviewUrl(updateForm: boolean): string {
    if (environment.activitiesDataSource !== 'http') {
      return '';
    }
    const assetForm = this.assetStore.assetFormRef();
    const raw = assetForm.sourceLink.trim();
    const normalizedUrl = AppUtils.normalizeHttpUrl(raw);
    if (!normalizedUrl) {
      return '';
    }
    if (updateForm && normalizedUrl !== raw) {
      this.assetStore.setAssetEditorSourceLink(normalizedUrl);
    }
    return normalizedUrl;
  }

  private setAssetEditorCategory(category: AppConstants.AssetCategory): void {
    if (this.isLoading || this.isSavePending) {
      return;
    }
    const assetForm = this.assetStore.assetFormRef();
    assetForm.category = AssetDefaultsBuilder.normalizeCategory(assetForm.type, category);
    this.assetStore.touchUiState();
  }

  private canSubmitAssetEditor(): boolean {
    if (this.isLoading) {
      return false;
    }
    const assetForm = this.assetForm;
    const title = assetForm.title.trim();
    const capacityTotal = Math.max(0, Math.trunc(Number(assetForm.capacityTotal) || 0));
    const quantity = Math.max(0, Math.trunc(Number(assetForm.quantity) || 0));
    if (!title || capacityTotal < 1 || quantity < 1) {
      return false;
    }
    if (assetForm.type !== 'Accommodation') {
      return true;
    }
    return AssetCardBuilder.normalizeAssetRoutes(assetForm.type, assetForm.routes)
      .some(stop => stop.trim().length > 0);
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
    this.assetStore.setAssetEditorImageUrl(imageUrl);
    this.assetImageUrlsCacheKey = imageUrl;
    this.assetImageUrlsCache = imageUrl ? [imageUrl] : [];
  }

  protected assetImageUploadEntity(): string {
    return this.assetStore.editingAssetId()?.trim() || this.assetStore.assetFormDraftId().trim() || 'asset-draft';
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
