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
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import {
  AssetCardBuilder,
  AssetDefaultsBuilder,
  PricingBuilder
} from '../../../shared/core/base/builders';
import {
  AssetsService
} from '../../../shared/core';
import {
  AssetStore,
  type AssetFormState
} from '../../../shared/ui/context/stores/asset.store';
import {
  type EventPoliciesInputConfig,
  type LocationInputConfig,
  IndicatorComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type AppMenuPalette,
  type AppMenuTrigger,
  FormFlowComponent,
  type FormFlowModel,
  type FormFlowTone,
  type PricingEditorConfig,
  PopupComponent,
  type PopupControl,
  type PopupModel,
  type RouteInputConfig
} from '../../../shared/ui';

import type * as AppConstants from '../../../shared/core/common/constants';
import type * as AppDTOs from '../../../shared/core/contracts';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';
type AssetEditorMenuContext =
  | { menu: 'visibility'; visibility: AppConstants.EventVisibility }
  | { menu: 'category'; category: AppConstants.AssetCategory }
  | { menu: 'save' };
type AssetEditorFlowValue = AssetFormState & {
  imageUrls: string[];
  routeLocation: string;
  runtimeRoutes: string[];
};

@Component({
  selector: 'app-asset-editor-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IndicatorComponent,
    FormFlowComponent,
    PopupComponent
  ],
  templateUrl: './asset-editor-popup.component.html',
  styleUrl: './asset-editor-popup.component.scss'
})
export class AssetEditorPopupComponent {
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly assetsService = inject(AssetsService);
  protected readonly assetStore = inject(AssetStore);
  protected readonly assetVisibilityOptions = APP_STATIC_DATA.eventVisibilityOptions;
  private assetImageUrlsCacheKey = '';
  private assetImageUrlsCache: string[] = [];
  private assetEditorFlowValueCacheKey = '';
  private assetEditorFlowValueCache: AssetEditorFlowValue | null = null;
  private assetEditorFlowModelCacheKey = '';
  private assetEditorFlowModelCache: FormFlowModel | null = null;
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
    toggleable: true,
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
    const mode = this.assetEditorReadOnly()
      ? 'View'
      : this.assetStore.editingAssetId()
        ? 'Edit'
        : 'Add';
    return `${mode} ${AssetDefaultsBuilder.assetTypeLabel(this.assetForm.type)}`;
  }

  protected assetEditorPopupModel(): PopupModel<AssetEditorMenuContext> {
    return {
      title: this.title,
      ariaLabel: this.title,
      closeAriaLabel: 'Close asset editor',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      headerControls: this.assetEditorPopupHeaderControls(),
      onClose: () => this.requestClose(),
      onMenuSelect: event => this.onAssetEditorMenuSelect(event.itemSelect)
    };
  }

  protected assetEditorPopupZIndex(): number {
    const parentZIndex = this.assetStore.assetFormParentZIndex();
    return parentZIndex ? parentZIndex + 100 : 4200;
  }

  protected assetEditorFlowModel(): FormFlowModel {
    const disabled = this.assetEditorReadOnly() || this.isLoading;
    const runtimeRoute = this.assetStore.assetFormRuntimeRoute();
    const assetDefinitionDisabled = disabled || runtimeRoute !== null;
    const cacheKey = [
      this.title,
      this.assetForm.type,
      this.assetForm.category ?? '',
      this.assetFormVisibility,
      this.assetImageUploadOwnerId,
      this.assetImageUploadEntity(),
      runtimeRoute ? `${runtimeRoute.editable}:${runtimeRoute.routeEnabled}:${runtimeRoute.routes.join('>')}` : 'no-runtime-route',
      assetDefinitionDisabled ? 'definition-disabled' : 'definition-enabled',
      disabled ? 'disabled' : 'enabled'
    ].join('|');
    if (this.assetEditorFlowModelCacheKey === cacheKey && this.assetEditorFlowModelCache) {
      return this.assetEditorFlowModelCache;
    }
    const steps: FormFlowModel['steps'] = [
      {
        id: 'basics',
        title: 'Basics',
        icon: this.assetCategoryIcon(this.assetForm.category),
        palette: this.assetCategoryPalette(this.assetForm.category),
        presentation: 'media',
        controls: [
          {
            id: 'imageUrls',
            bind: 'imageUrls',
            kind: 'image-carousel',
            layout: 'wide',
            rowSpan: 3,
            disabled,
            config: {
              slotCount: 1,
              compact: true,
              autoSize: true,
              ariaLabel: 'Asset image',
              uploadOwnerId: this.assetImageUploadOwnerId,
              uploadEntityId: this.assetImageUploadEntity()
            },
            summary: {
              hidden: true
            }
          },
          {
            id: 'title',
            bind: 'title',
            kind: 'text',
            label: 'Title',
            required: true,
            disabled
          },
          {
            id: 'subtitle',
            bind: 'subtitle',
            kind: 'text',
            label: 'Subtitle',
            disabled
          },
          {
            id: 'capacityTotal',
            bind: 'capacityTotal',
            kind: 'number',
            label: 'Total capacity',
            required: true,
            min: 1,
            step: 1,
            layout: 'half',
            disabled
          },
          {
            id: 'quantity',
            bind: 'quantity',
            kind: 'number',
            label: 'Quantity',
            required: true,
            min: 1,
            step: 1,
            layout: 'half',
            disabled
          }
        ]
      },
      {
        id: 'details',
        title: 'Details',
        icon: 'notes',
        controls: [
          {
            id: 'sourceLink',
            bind: 'sourceLink',
            kind: 'link',
            label: 'Source link',
            placeholder: 'https://...',
            disabled
          },
          {
            id: 'category',
            bind: 'category',
            kind: 'menu',
            label: 'Category',
            disabled,
            config: {
              kind: 'select',
              trigger: this.assetCategoryMenuTrigger(),
              items: this.assetCategoryMenuItems(),
              closeOnSelect: true
            }
          },
          {
            id: 'details',
            bind: 'details',
            kind: 'textarea',
            label: 'Details',
            rows: 4,
            layout: 'wide',
            disabled
          },
          ...this.assetLocationFlowControls(disabled)
        ]
      },
      ...this.assetRuntimeRouteFlowSteps(),
      {
        id: 'pricing',
        title: '',
        chrome: 'none',
        controls: [
          {
            id: 'pricing',
            bind: 'pricing',
            kind: 'pricing',
            layout: 'wide',
            disabled: assetDefinitionDisabled,
            config: {
              model: this.assetPricingEditorConfig
            }
          }
        ]
      },
      {
        id: 'policies',
        title: '',
        chrome: 'none',
        controls: [
          {
            id: 'policies',
            bind: 'policies',
            kind: 'policies',
            layout: 'wide',
            enabledBind: 'policiesEnabled',
            disabled: assetDefinitionDisabled,
            config: {
              model: this.assetPoliciesInputConfig
            }
          }
        ]
      }
    ];
    const model: FormFlowModel = {
      title: this.title,
      layout: 'grouped',
      tone: this.assetEditorFlowTone(),
      header: false,
      completion: {
        controls: 'required'
      },
      steps
    };
    this.assetEditorFlowModelCacheKey = cacheKey;
    this.assetEditorFlowModelCache = model;
    return model;
  }

  private assetLocationFlowControls(disabled: boolean): FormFlowModel['steps'][number]['controls'] {
    if (!this.isPropertyAssetForm()) {
      return [];
    }
    return [{
      id: 'routeLocation',
      bind: 'routeLocation',
      kind: 'location',
      label: 'Location',
      required: true,
      layout: 'wide',
      disabled,
      config: {
        model: this.assetLocationInputConfig
      }
    }];
  }

  private assetRuntimeRouteFlowSteps(): FormFlowModel['steps'] {
    const runtimeRoute = this.assetStore.assetFormRuntimeRoute();
    if (!runtimeRoute || this.assetForm.type !== 'Car') {
      return [];
    }
    return [{
      id: 'runtime-route',
      title: '',
      chrome: 'none',
      controls: [
        {
          id: 'runtimeRoutes',
          bind: 'runtimeRoutes',
          kind: 'route',
          layout: 'wide',
          disabled: this.assetRuntimeRouteControlDisabled(),
          config: {
            model: this.assetRuntimeRouteInputConfig()
          }
        }
      ]
    }];
  }

  private assetRuntimeRouteInputConfig(): RouteInputConfig {
    const runtimeRoute = this.assetStore.assetFormRuntimeRoute();
    return {
      title: runtimeRoute?.title ?? 'Route',
      subtitle: runtimeRoute?.subtitle ?? 'Runtime route for this event asset.',
      openLabel: runtimeRoute?.openLabel ?? 'Open Route Setup',
      emptyLabel: runtimeRoute?.emptyLabel ?? 'No route is set for this event asset.',
      readOnlyEmptyLabel: runtimeRoute?.readOnlyEmptyLabel ?? 'No route is set for this event asset.',
      popupTitle: runtimeRoute?.popupTitle ?? 'Route Setup',
      popupSubtitle: runtimeRoute?.popupSubtitle ?? 'Set the runtime route for this event asset.',
      enabled: () => this.assetStore.assetFormRuntimeRoute()?.routeEnabled === true,
      editable: () => runtimeRoute?.editable === true,
      parentZIndex: () => this.assetEditorPopupZIndex(),
      onEnabledChange: enabled => this.assetStore.setAssetEditorRuntimeRouteState({ routeEnabled: enabled })
    };
  }

  private assetRuntimeRouteControlDisabled(): boolean {
    const runtimeRoute = this.assetStore.assetFormRuntimeRoute();
    return this.isLoading || this.isSavePending || runtimeRoute?.editable !== true;
  }

  protected assetEditorFlowValue(): AssetEditorFlowValue {
    const cacheKey = `${this.assetStore.uiRevision()}:${this.assetStore.assetFormLoadGeneration()}`;
    if (this.assetEditorFlowValueCacheKey === cacheKey && this.assetEditorFlowValueCache) {
      return this.assetEditorFlowValueCache;
    }
    const value: AssetEditorFlowValue = {
      ...this.cloneAssetFormForFlow(this.assetForm),
      imageUrls: this.assetImageUrls(),
      routeLocation: this.assetFormRouteStops()[0] ?? '',
      runtimeRoutes: [...(this.assetStore.assetFormRuntimeRoute()?.routes ?? [])]
    };
    this.assetEditorFlowValueCacheKey = cacheKey;
    this.assetEditorFlowValueCache = value;
    return value;
  }

  protected onAssetEditorFlowValueChange(value: unknown): void {
    if (this.isLoading) {
      return;
    }
    this.applyRuntimeRouteValueFromFlow(value);
    if (this.assetEditorReadOnly()) {
      return;
    }
    this.assetStore.setAssetEditorForm(this.assetFormFromFlowValue(value));
    this.assetEditorFlowValueCacheKey = '';
  }

  protected get assetEditorFlowBinding(): AssetEditorFlowValue {
    return this.assetEditorFlowValue();
  }

  protected set assetEditorFlowBinding(value: unknown) {
    this.onAssetEditorFlowValueChange(value);
  }

  private assetEditorPopupHeaderControls(): readonly PopupControl<AssetEditorMenuContext>[] {
    if (this.assetEditorReadOnly()) {
      return [];
    }
    return [
      {
        kind: 'menu',
        id: 'asset-editor-visibility',
        menuKind: 'select',
        trigger: this.visibilityMenuTrigger(),
        items: this.visibilityMenuItems(),
        mobileBreakpointPx: 900
      },
      {
        kind: 'menu',
        id: 'asset-editor-save',
        menuKind: 'inline',
        items: this.assetEditorSaveMenuItems(),
        closeOnSelect: false
      }
    ];
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
      id: option,
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

  private assetFormFromFlowValue(value: unknown): AssetFormState {
    const current = this.assetForm;
    const source = this.isRecord(value) ? value as Partial<AssetEditorFlowValue> : {};
    const type = current.type;
    const category = AssetDefaultsBuilder.normalizeCategory(
      type,
      (source.category ?? current.category) as AppConstants.AssetCategory | undefined
    );
    const sourceImageUrls = source.imageUrls;
    const hasImageUrlsInput = Array.isArray(sourceImageUrls);
    const imageUrls = hasImageUrlsInput
      ? sourceImageUrls.map(item => `${item ?? ''}`.trim()).filter(Boolean)
      : this.assetImageUrls();
    const imageUrl = hasImageUrlsInput
      ? imageUrls[0] ?? ''
      : `${source.imageUrl ?? current.imageUrl ?? ''}`.trim();
    const routeLocation = `${source.routeLocation ?? this.assetFormRouteStops()[0] ?? ''}`.trim();
    const routes = type === 'Accommodation'
      ? AssetCardBuilder.normalizeAssetRoutes(type, [routeLocation])
      : AssetCardBuilder.normalizeAssetRoutes(type, source.routes ?? current.routes);
    return {
      type,
      title: `${source.title ?? current.title ?? ''}`,
      subtitle: `${source.subtitle ?? current.subtitle ?? ''}`,
      category,
      city: `${source.city ?? current.city ?? ''}`,
      capacityTotal: Math.max(0, Math.trunc(Number(source.capacityTotal ?? current.capacityTotal) || 0)),
      quantity: Math.max(0, Math.trunc(Number(source.quantity ?? current.quantity) || 0)),
      details: `${source.details ?? current.details ?? ''}`,
      imageUrl,
      sourceLink: `${source.sourceLink ?? current.sourceLink ?? ''}`,
      routes,
      topics: this.cloneStringList(source.topics ?? current.topics),
      policiesEnabled: source.policiesEnabled === true,
      policies: this.cloneAssetPolicies(source.policies ?? current.policies),
      pricing: PricingBuilder.clonePricingConfig(
        source.pricing ?? current.pricing ?? PricingBuilder.createDefaultPricingConfig('asset')
      )
    };
  }

  private cloneAssetFormForFlow(form: AssetFormState): AssetFormState {
    return {
      ...form,
      routes: [...(form.routes ?? [])],
      topics: this.cloneStringList(form.topics),
      policiesEnabled: form.policiesEnabled === true,
      policies: this.cloneAssetPolicies(form.policies),
      pricing: PricingBuilder.clonePricingConfig(form.pricing ?? null)
    };
  }

  private cloneStringList(items: readonly string[] | null | undefined): string[] {
    return (items ?? []).map(item => `${item ?? ''}`);
  }

  private cloneAssetPolicies(items: readonly AppDTOs.EventPolicyItemDTO[] | null | undefined): AppDTOs.EventPolicyItemDTO[] {
    return (items ?? []).map(item => ({ ...item }));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
      const payload = AssetCardBuilder.buildAssetSavePayload(assetForm, assetForm.imageUrl);
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
    return this.assetStore.assetFormReadOnly() || this.isSavePending;
  }

  private applyRuntimeRouteValueFromFlow(value: unknown): void {
    const runtimeRoute = this.assetStore.assetFormRuntimeRoute();
    if (!runtimeRoute || !this.isRecord(value)) {
      return;
    }
    const sourceRoutes = (value as Partial<AssetEditorFlowValue>).runtimeRoutes;
    if (!Array.isArray(sourceRoutes)) {
      return;
    }
    const nextRoutes = sourceRoutes.map(route => `${route ?? ''}`.trim()).filter(Boolean);
    if (this.stringListsEqual(nextRoutes, runtimeRoute.routes)) {
      return;
    }
    this.assetStore.setAssetEditorRuntimeRouteState({ routes: nextRoutes });
    this.assetEditorFlowValueCacheKey = '';
    this.assetEditorFlowModelCacheKey = '';
  }

  private stringListsEqual(left: readonly string[], right: readonly string[] | null | undefined): boolean {
    const normalizedRight = (right ?? []).map(item => `${item ?? ''}`.trim()).filter(Boolean);
    return left.length === normalizedRight.length && left.every((item, index) => item === normalizedRight[index]);
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

  private assetEditorFlowTone(): FormFlowTone {
    if (this.assetFormVisibility === 'Public') {
      return 'green';
    }
    if (this.assetFormVisibility === 'Friends only') {
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
