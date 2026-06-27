import { Injectable, effect, inject, signal } from '@angular/core';
import { type ActivityCounterKey } from '../shared/ui';
import { environment } from '../../environments/environment';

import { APP_STATIC_DATA } from '../shared/app-static-data';
import { PricingBuilder } from '../shared/core/base/builders';
import type * as AppTypes from '../shared/core/base/models';
import { AssetPopupStateService } from './asset-popup-state.service';
import { AppContext } from '../shared/ui';
import { AssetCardBuilder, AssetDefaultsBuilder, AssetsService, ExplanationGuideService, MediaService } from '../shared/core';

import type * as AppDTOs from '../shared/core/base/dto';
import type * as AppConstants from '../shared/core/common/constants';
export interface OwnedAssetsRuntimeHooks {
  onAssetsChanged?(): void;
  onAssetCreated?(card: AppDTOs.AssetCardDTO): void;
  onAssetDeleted?(cardId: string): void;
  onAssetFormClosed?(): void;
}

@Injectable({
  providedIn: 'root'
})
export class OwnedAssetsPopupFacadeService {
  private readonly assetPopupState = inject(AssetPopupStateService);
  private readonly assetsService = inject(AssetsService);
  private readonly appCtx = inject(AppContext);
  private readonly explanationGuide = inject(ExplanationGuideService);
  private readonly mediaService = inject(MediaService);
  private readonly assetListRevisionRef = signal(0);
  private readonly assetListReloadRevisionRef = signal(0);
  private readonly assetListLoadingRef = signal(false);
  private readonly uiRevisionRef = signal(0);

  readonly assetTypeOptions: AppConstants.AssetType[] = APP_STATIC_DATA.assetTypeOptions;
  readonly assetFilterOptions: AppConstants.AssetFilterType[] = APP_STATIC_DATA.assetFilterOptions;
  readonly assetVisibilityOptions: AppConstants.EventVisibility[] = APP_STATIC_DATA.eventVisibilityOptions;

  assetFilter: AppConstants.AssetFilterType = 'Car';
  showAssetForm = false;
  editingAssetId: string | null = null;
  isAssetFormLoading = false;
  isAssetFormSavePending = false;
  pendingAssetDeleteCardId: string | null = null;
  isAssetDeletePending = false;
  assetForm: Omit<AppDTOs.AssetCardDTO, 'id' | 'requests'> = AssetCardBuilder.buildEmptyAssetForm('Car');
  assetFormVisibility: AppConstants.EventVisibility = 'Public';
  readonly assetSourcePreviewAvailable = environment.activitiesDataSource === 'http';

  private assetCardsRef: AppDTOs.AssetCardDTO[] = [];
  private activePopupFilter: AppConstants.AssetFilterType | null = null;
  private activeOwnerUserId = '';
  private readonly runtimeHooks: OwnedAssetsRuntimeHooks[] = [];
  private pendingPersistSnapshot: AppDTOs.AssetCardDTO[] | null = null;
  private pendingPersistOwnerUserId = '';
  private persistTimerId: ReturnType<typeof setTimeout> | null = null;
  private pendingAssetImageFile: File | null = null;
  private pendingAssetSourceImageUrl = '';
  private assetMutationVersion = 0;
  private assetFormLoadGeneration = 0;
  private trackedAssetRefreshToken = 0;
  private trackedAssetRefreshOwnerUserId = '';
  private trackedAssetRefreshPromise: Promise<void> | null = null;
  private pendingAssetDeleteLabelValue = '';
  private pendingAssetDeleteErrorValue = '';
  private assetsExplanationContextKey: string | null = null;
  private unregisterAssetsExplanationContext: (() => void) | null = null;

  readonly assetListRevision = this.assetListRevisionRef.asReadonly();
  readonly assetListReloadRevision = this.assetListReloadRevisionRef.asReadonly();
  readonly assetListLoading = this.assetListLoadingRef.asReadonly();
  readonly uiRevision = this.uiRevisionRef.asReadonly();

  get assetCards(): AppDTOs.AssetCardDTO[] {
    return this.assetCardsRef;
  }

  set assetCards(cards: AppDTOs.AssetCardDTO[]) {
    this.applyAssetCards(cards, { persist: true, reloadList: false });
  }

  constructor() {
    effect(() => {
      this.initializeFromUser(this.resolveContextOwnerUserId());
    });
  }

  registerRuntimeHooks(hooks: OwnedAssetsRuntimeHooks | null): void {
    if (!hooks) {
      return;
    }
    this.runtimeHooks.push(hooks);
  }

  initialize(cards: AppDTOs.AssetCardDTO[]): void {
    this.applyAssetCards(cards, { persist: false, reloadList: false });
  }

  assetListRevisionValue(): number {
    return this.assetListRevisionRef();
  }

  async waitForAssetListLoad(ownerUserId: string): Promise<void> {
    const normalizedOwnerUserId = ownerUserId.trim();
    const refreshPromise = normalizedOwnerUserId
      && normalizedOwnerUserId === this.trackedAssetRefreshOwnerUserId
      ? this.trackedAssetRefreshPromise
      : null;
    if (!refreshPromise) {
      return;
    }
    await refreshPromise;
  }

  initializeFromUser(userId: string): void {
    const normalizedUserId = userId.trim();
    if (normalizedUserId === this.activeOwnerUserId) {
      return;
    }
    this.activeOwnerUserId = normalizedUserId;
    this.pendingAssetDeleteCardId = null;
    this.isAssetDeletePending = false;
    this.pendingAssetDeleteLabelValue = '';
    this.pendingAssetDeleteErrorValue = '';
    this.cancelScheduledPersist();
    this.touchUiState();
    if (!normalizedUserId) {
      this.applyAssetCards([], { persist: false, reloadList: false });
      return;
    }
    this.applyAssetCards(this.assetsService.peekOwnedAssetsByUser(normalizedUserId), { persist: false, reloadList: false });
    void this.refreshOwnedAssetsFromRepository(normalizedUserId);
  }

  isPopupOpen(): boolean {
    return this.activePopupFilter !== null;
  }

  isTicketPopup(): boolean {
    return this.isPopupOpen() && this.assetFilter === 'Ticket';
  }

  popupTitle(): string {
    const filter = this.activePopupFilter ?? this.assetFilter;
    return `Assets · ${AssetDefaultsBuilder.assetTypeLabel(filter)}`;
  }

  assetFilterPanelWidth(): string {
    return '248px';
  }

  filteredAssetCards(): AppDTOs.AssetCardDTO[] {
    if (this.assetFilter === 'Ticket') {
      return [];
    }
    return this.assetCardsRef.filter(card => card.type === this.assetFilter);
  }

  assetFormTitle(): string {
    return `${this.editingAssetId ? 'Edit' : 'Add'} ${AssetDefaultsBuilder.assetTypeLabel(this.assetForm.type)}`;
  }

  assetFormRouteStops(): string[] {
    return AssetCardBuilder.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes);
  }

  pendingAssetDeleteLabel(): string {
    if (this.pendingAssetDeleteLabelValue) {
      return this.pendingAssetDeleteLabelValue;
    }
    if (!this.pendingAssetDeleteCardId) {
      return '';
    }
    const card = this.assetCardsRef.find(item => item.id === this.pendingAssetDeleteCardId);
    return card ? `Delete ${card.title}?` : 'Delete this item?';
  }

  assetDeleteBusyLabel(): string {
    return 'Deleting...';
  }

  assetDeleteErrorMessage(): string {
    return this.pendingAssetDeleteErrorValue;
  }

  async applyAssetRequestAction(
    assetId: string,
    requestId: string,
    action: AppConstants.AssetRequestAction
  ): Promise<void> {
    const normalizedAssetId = assetId.trim();
    const normalizedRequestId = requestId.trim();
    if (!normalizedAssetId || !normalizedRequestId || (action !== 'accept' && action !== 'remove')) {
      return;
    }
    const existing = this.assetCardsRef.find(card => card.id === normalizedAssetId) ?? null;
    if (!existing) {
      return;
    }

    let nextQuantity = AssetCardBuilder.storedQuantityValue(existing);
    const nextRequests = existing.requests
      .map(request => this.cloneAssetRequest(request))
      .filter(request => {
        if (request.id !== normalizedRequestId) {
          return true;
        }
        if (action === 'remove') {
          return false;
        }
        request.status = 'accepted';
        request.note = request.requestKind === 'manual'
          ? 'Reserved and assigned by the owner.'
          : 'Borrow request approved by the owner.';
        if (request.requestKind !== 'manual' && request.booking?.inventoryApplied !== true) {
          nextQuantity = Math.max(0, nextQuantity - this.assetRequestQuantity(request));
          request.booking = request.booking
            ? {
                ...request.booking,
                inventoryApplied: true
              }
            : null;
        }
        return true;
      });

    const nextCard: AppDTOs.AssetCardDTO = {
      ...existing,
      quantity: nextQuantity,
      routes: [...(existing.routes ?? [])],
      topics: [...(existing.topics ?? [])],
      policies: (existing.policies ?? []).map(item => ({ ...item })),
      pricing: existing.pricing ? PricingBuilder.clonePricingConfig(existing.pricing) : undefined,
      requests: nextRequests
    };

    const ownerUserId = this.resolveOwnerUserId();
    this.markAssetMutation();
    this.applyAssetCards(this.assetCardsRef.map(card => (
      card.id === normalizedAssetId ? nextCard : card
    )), { persist: false, reloadList: false });
    for (const hooks of this.runtimeHooks) {
      hooks.onAssetsChanged?.();
    }

    const persistPromise = ownerUserId
      ? this.assetsService.saveOwnedAsset(ownerUserId, nextCard).then(savedCard => {
          if (this.activeOwnerUserId === ownerUserId) {
            this.applyAssetCards(this.assetCardsRef.map(card => card.id === savedCard.id ? savedCard : card), {
              persist: false,
              reloadList: false
            });
          }
        })
      : Promise.resolve();
    await persistPromise;
  }

  async promoteAssetRequestToManager(assetId: string, requestId: string): Promise<void> {
    const normalizedAssetId = assetId.trim();
    const normalizedRequestId = requestId.trim();
    if (!normalizedAssetId || !normalizedRequestId) {
      return;
    }
    const existing = this.assetCardsRef.find(card => card.id === normalizedAssetId) ?? null;
    const request = existing?.requests.find(item => item.id === normalizedRequestId) ?? null;
    const targetUserId = `${request?.userId ?? ''}`.trim();
    const ownerUserId = this.resolveOwnerUserId();
    if (!existing || !request || !targetUserId || !ownerUserId) {
      return;
    }
    const savedCard = await this.assetsService.makeAssetManager(ownerUserId, normalizedAssetId, targetUserId);
    if (!savedCard) {
      return;
    }
    this.markAssetMutation();
    this.applyAssetCards(this.assetCardsRef.map(card => card.id === savedCard.id ? savedCard : card), {
      persist: false,
      reloadList: false
    });
    for (const hooks of this.runtimeHooks) {
      hooks.onAssetsChanged?.();
    }
    this.touchUiState();
  }

  assetFilterCount(type: AppConstants.AssetFilterType): number {
    const ownerUserId = this.resolveContextOwnerUserId();
    const source = this.appCtx.getUserProfile(ownerUserId);
    const activeUser = source ?? this.appCtx.activeUserProfile();
    const overrides = ownerUserId ? this.appCtx.getUserCounterOverrides(ownerUserId) : {};
    const grouped = overrides.asset ?? activeUser?.activities?.asset;
    const key = this.assetFilterCounterKey(type);
    switch (key) {
      case 'cars':
        return this.normalizeAssetFilterCount(grouped?.cars ?? overrides.cars ?? activeUser?.activities?.cars);
      case 'accommodation':
        return this.normalizeAssetFilterCount(grouped?.accommodation ?? overrides.accommodation ?? activeUser?.activities?.accommodation);
      case 'supplies':
        return this.normalizeAssetFilterCount(grouped?.supplies ?? overrides.supplies ?? activeUser?.activities?.supplies);
      case 'tickets':
        return this.normalizeAssetFilterCount(grouped?.tickets ?? overrides.tickets ?? activeUser?.activities?.tickets);
      default:
        return key ? this.normalizeAssetFilterCount(overrides[key] ?? activeUser?.activities?.[key]) : 0;
    }
  }

  private normalizeAssetFilterCount(value: unknown): number {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }
    return Math.max(0, Math.trunc(numericValue));
  }

  eventVisibilityClass(option: AppConstants.EventVisibility): string {
    return AssetDefaultsBuilder.eventVisibilityClass(option);
  }

  visibilityIcon(option: AppConstants.EventVisibility): string {
    return AssetDefaultsBuilder.visibilityIcon(option);
  }

  assetCategoryOptions(type: AppConstants.AssetType = this.assetForm.type): AppConstants.AssetCategory[] {
    return AssetDefaultsBuilder.assetCategoryOptions(type);
  }

  setAssetFormVisibility(option: AppConstants.EventVisibility): void {
    if (this.isAssetFormLoading || this.isAssetFormSavePending) {
      return;
    }
    this.assetFormVisibility = option;
    this.touchUiState();
  }

  isMobileView(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const isNarrowViewport = window.matchMedia('(max-width: 760px)').matches;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    return isNarrowViewport && hasCoarsePointer;
  }

  openPopup(filter: AppConstants.AssetFilterType): void {
    this.assetFilter = filter;
    this.activePopupFilter = filter;
    this.closeAssetForm();
    if (filter === 'Ticket') {
      this.assetPopupState.prepareTicketPopupOpen();
    } else {
      void this.refreshOwnedAssetsFromRepository(this.resolveOwnerUserId(), { trackLoading: true });
    }
    this.setAssetsExplanationContext(this.assetExplanationContextForFilter(filter));
    this.assetPopupState.setPrimaryVisible(true);
    this.touchUiState();
  }

  closePopup(): void {
    this.activePopupFilter = null;
    this.closeAssetForm();
    this.isAssetFormSavePending = false;
    this.pendingAssetDeleteCardId = null;
    this.isAssetDeletePending = false;
    this.pendingAssetDeleteLabelValue = '';
    this.pendingAssetDeleteErrorValue = '';
    this.assetPopupState.resetTicketState();
    this.clearAssetsExplanationContext();
    this.assetPopupState.setPrimaryVisible(false);
    this.touchUiState();
  }

  selectAssetFilter(filter: AppConstants.AssetFilterType): void {
    this.assetFilter = filter;
    this.activePopupFilter = filter;
    if (filter === 'Ticket') {
      this.assetPopupState.prepareTicketPopupOpen();
    } else {
      void this.refreshOwnedAssetsFromRepository(this.resolveOwnerUserId(), { trackLoading: true });
    }
    this.setAssetsExplanationContext(this.assetExplanationContextForFilter(filter));
    this.assetPopupState.setPrimaryVisible(true);
    this.touchUiState();
  }

  openAssetForm(card?: AppDTOs.AssetCardDTO): void {
    if (card) {
      void this.openAssetFormForEdit(card);
      return;
    }
    this.assetFormLoadGeneration += 1;
    this.showAssetForm = true;
    this.isAssetFormLoading = false;
    this.isAssetFormSavePending = false;
    this.pendingAssetImageFile = null;
    this.pendingAssetSourceImageUrl = '';
    this.editingAssetId = null;
    const type = this.activeAssetType();
    this.assetFormVisibility = 'Public';
    this.assetForm = AssetCardBuilder.buildEmptyAssetForm(type);
    this.touchUiState();
  }

  private async openAssetFormForEdit(card: AppDTOs.AssetCardDTO): Promise<void> {
    const generation = ++this.assetFormLoadGeneration;
    const ownerUserId = this.resolveOwnerUserId();
    this.showAssetForm = true;
    this.isAssetFormLoading = Boolean(ownerUserId);
    this.isAssetFormSavePending = false;
    this.pendingAssetImageFile = null;
    this.pendingAssetSourceImageUrl = '';
    this.applyAssetFormFromCard(card);
    this.touchUiState();

    if (!ownerUserId) {
      this.isAssetFormLoading = false;
      this.touchUiState();
      return;
    }

    try {
      const loadedCard = await this.assetsService.loadFullOwnedAssetById(ownerUserId, card.id);
      if (!this.isCurrentAssetFormLoad(generation, card.id)) {
        return;
      }
      if (loadedCard) {
        this.applyAssetCards(this.assetCardsRef.map(item => (
          item.id === loadedCard.id ? loadedCard : item
        )), { persist: false, reloadList: false });
        this.applyAssetFormFromCard(loadedCard);
      }
      this.isAssetFormLoading = false;
      this.touchUiState();
    } catch {
      if (this.isCurrentAssetFormLoad(generation, card.id)) {
        this.isAssetFormLoading = false;
        this.touchUiState();
      }
    }
  }

  closeAssetForm(): void {
    this.assetFormLoadGeneration += 1;
    this.showAssetForm = false;
    this.editingAssetId = null;
    this.isAssetFormLoading = false;
    this.isAssetFormSavePending = false;
    this.pendingAssetImageFile = null;
    this.pendingAssetSourceImageUrl = '';
    for (const hooks of this.runtimeHooks) {
      hooks.onAssetFormClosed?.();
    }
    this.touchUiState();
  }

  private applyAssetFormFromCard(card: AppDTOs.AssetCardDTO): void {
    const imageUrl = AssetCardBuilder.normalizeAssetLink(card.imageUrl);
    const sourceLink = AssetCardBuilder.normalizeAssetLink(card.sourceLink, imageUrl);
    this.editingAssetId = card.id;
    this.assetFormVisibility = card.visibility === 'Friends only'
      ? 'Friends only'
      : card.visibility === 'Invitation only'
        ? 'Invitation only'
        : 'Public';
    this.assetForm = {
      type: card.type,
      title: card.title,
      subtitle: card.subtitle,
      category: AssetDefaultsBuilder.normalizeCategory(card.type, card.category),
      city: card.city,
      capacityTotal: card.capacityTotal,
      quantity: card.quantity,
      details: card.details,
      imageUrl,
      sourceLink,
      routes: AssetCardBuilder.normalizeAssetRoutes(card.type, card.routes),
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(item => ({ ...item })),
      pricing: PricingBuilder.clonePricingConfig(card.pricing ?? PricingBuilder.createDefaultPricingConfig('asset'))
    };
  }

  private isCurrentAssetFormLoad(generation: number, assetId: string): boolean {
    return this.showAssetForm
      && this.assetFormLoadGeneration === generation
      && this.editingAssetId === assetId;
  }

  canSubmitAssetForm(): boolean {
    if (this.isAssetFormLoading) {
      return false;
    }
    const title = this.assetForm.title.trim();
    const capacityTotal = Math.max(0, Math.trunc(Number(this.assetForm.capacityTotal) || 0));
    const quantity = Math.max(0, Math.trunc(Number(this.assetForm.quantity) || 0));
    if (!title || capacityTotal < 1 || quantity < 1) {
      return false;
    }
    if (this.assetForm.type !== 'Accommodation') {
      return true;
    }
    const routes = AssetCardBuilder.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes);
    return routes.some(stop => stop.trim().length > 0);
  }

  setAssetFormRouteStop(index: number, value: string): void {
    const routes = [...this.assetFormRouteStops()];
    if (index < 0 || index >= routes.length) {
      return;
    }
    routes[index] = value;
    this.assetForm.routes = AssetCardBuilder.normalizeAssetRoutes(this.assetForm.type, routes);
  }

  async refreshAssetFromSourceLink(): Promise<void> {
    if (this.isAssetFormLoading) {
      return;
    }
    const sourceUrl = this.normalizedAssetSourcePreviewUrl(true);
    if (!sourceUrl) {
      return;
    }
    const ownerUserId = this.resolveOwnerUserId();
    const preview = await this.assetsService.refreshAssetSourcePreview(ownerUserId, this.assetForm.type, sourceUrl);
    if (!preview || preview.enabled === false) {
      return;
    }
    this.assetForm.sourceLink = preview.normalizedUrl.trim() || sourceUrl;
    this.pendingAssetSourceImageUrl = '';
    const previewImageUrl = preview.imageUrl.trim();
    if (previewImageUrl) {
      if (environment.activitiesDataSource === 'http' && this.assetForm.imageUrl.startsWith('blob:')) {
        this.revokeObjectUrl(this.assetForm.imageUrl);
      }
      this.assetForm.imageUrl = previewImageUrl;
      this.pendingAssetImageFile = null;
      this.pendingAssetSourceImageUrl = previewImageUrl;
    }
    if (preview.title.trim()) {
      this.assetForm.title = preview.title.trim();
    }
    if (preview.subtitle.trim()) {
      this.assetForm.subtitle = preview.subtitle.trim();
    }
    if (preview.details.trim()) {
      this.assetForm.details = preview.details.trim();
    }
  }

  canRefreshAssetFromSourceLink(): boolean {
    if (this.isAssetFormLoading) {
      return false;
    }
    return Boolean(this.normalizedAssetSourcePreviewUrl(false));
  }

  applyAssetImageFile(file: File): void {
    if (this.isAssetFormLoading) {
      return;
    }
    this.revokeObjectUrl(this.assetForm.imageUrl);
    this.pendingAssetImageFile = file;
    this.pendingAssetSourceImageUrl = '';
    this.assetForm.imageUrl = URL.createObjectURL(file);
  }

  async saveAssetCard(): Promise<void> {
    if (this.isAssetFormLoading || this.isAssetFormSavePending || !this.canSubmitAssetForm()) {
      return;
    }
    this.isAssetFormSavePending = true;
    this.touchUiState();
    try {
      const title = this.assetForm.title.trim();
      const city = this.assetForm.city.trim();
      const routes = AssetCardBuilder.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes);
      const accommodationLocation = routes.find(stop => stop.trim().length > 0)?.trim() || '';
      const resolvedCity = this.assetForm.type === 'Accommodation'
        ? accommodationLocation
        : city;
      const ownerUserId = this.resolveOwnerUserId();
      const ownerName = this.appCtx.activeUserProfile()?.name?.trim() || undefined;
      const assetId = this.editingAssetId || `asset-${Date.now()}`;
      const resolvedImageUrl = await this.resolvePersistedAssetImageUrl(ownerUserId, assetId);
      if (environment.activitiesDataSource === 'http'
          && (this.pendingAssetImageFile || this.hasPendingAssetSourceImage())
          && !resolvedImageUrl) {
        throw new Error('Unable to upload asset image.');
      }
      const imageUrl = AssetCardBuilder.normalizeAssetLink(resolvedImageUrl || this.assetForm.imageUrl);
      const sourceLink = AssetCardBuilder.normalizeAssetLink(this.assetForm.sourceLink, imageUrl);
      const category = AssetDefaultsBuilder.normalizeCategory(this.assetForm.type, this.assetForm.category);
      const payload: Omit<AppDTOs.AssetCardDTO, 'id' | 'requests'> = {
        type: this.assetForm.type,
        title,
        subtitle: this.assetForm.subtitle.trim(),
        category,
        city: resolvedCity,
        capacityTotal: Math.max(1, Number(this.assetForm.capacityTotal) || (this.assetForm.type === 'Supplies' ? 6 : 4)),
        quantity: AssetCardBuilder.normalizeQuantity(this.assetForm.type, this.assetForm.quantity, this.assetForm.capacityTotal),
        details: this.assetForm.details.trim(),
        imageUrl,
        sourceLink,
        routes,
        topics: [...(this.assetForm.topics ?? [])],
        policies: (this.assetForm.policies ?? [])
          .map(item => ({
            id: `${item.id ?? ''}`.trim(),
            title: `${item.title ?? ''}`.trim(),
            description: `${item.description ?? ''}`.trim(),
            required: item.required !== false
          }))
          .filter(item => item.id || item.title || item.description),
        pricing: PricingBuilder.compactPricingConfig(
          this.assetForm.pricing ?? PricingBuilder.createDefaultPricingConfig('asset'),
          { context: 'asset', allowSlotFeatures: false }
        )
      };
      const resolvedVisibility: AppConstants.EventVisibility = this.assetFormVisibility;

      if (this.editingAssetId) {
        const editingAssetId = this.editingAssetId;
        const existing = this.assetCardsRef.find(card => card.id === editingAssetId);
        const nextCard: AppDTOs.AssetCardDTO = {
          id: editingAssetId,
          ...payload,
          visibility: resolvedVisibility,
          ownerUserId: existing?.ownerUserId,
          ownerName: existing?.ownerName ?? ownerName,
          requests: existing?.requests.map(request => ({ ...request })) ?? [],
          menuActions: [...(existing?.menuActions ?? [])]
        };
        this.markAssetMutation();
        this.applyAssetCards(this.assetCardsRef.map(card =>
          card.id === editingAssetId
            ? nextCard
            : card
        ), { persist: false, reloadList: true });
        for (const hooks of this.runtimeHooks) {
          hooks.onAssetsChanged?.();
        }
        const persistPromise = ownerUserId
          ? this.assetsService.saveOwnedAsset(ownerUserId, nextCard).then(savedCard => {
              if (this.activeOwnerUserId === ownerUserId) {
                this.applyAssetCards(this.assetCardsRef.map(card => card.id === savedCard.id ? savedCard : card), {
                  persist: false,
                  reloadList: true
                });
              }
            })
          : Promise.resolve();
        await persistPromise;
      } else {
        const nextCard: AppDTOs.AssetCardDTO = {
          id: assetId,
          ...payload,
          visibility: resolvedVisibility,
          ownerUserId,
          ownerName,
          requests: [],
          menuActions: ['share', 'edit', 'delete']
        };
        this.markAssetMutation();
        this.applyAssetCards([nextCard, ...this.assetCardsRef], { persist: false, reloadList: true });
        for (const hooks of this.runtimeHooks) {
          hooks.onAssetCreated?.(nextCard);
          hooks.onAssetsChanged?.();
        }
        const persistPromise = ownerUserId
          ? this.assetsService.saveOwnedAsset(ownerUserId, nextCard).then(savedCard => {
              if (this.activeOwnerUserId === ownerUserId) {
                this.applyAssetCards(this.assetCardsRef.map(card => card.id === savedCard.id ? savedCard : card), {
                  persist: false,
                  reloadList: true
                });
              }
            })
          : Promise.resolve();
        await persistPromise;
      }
      this.isAssetFormSavePending = false;
      this.closeAssetForm();
    } catch {
      this.isAssetFormSavePending = false;
      this.touchUiState();
    }
  }

  private async resolvePersistedAssetImageUrl(ownerUserId: string, assetId: string): Promise<string | null> {
    if (this.pendingAssetImageFile) {
      const uploadResult = await this.mediaService.uploadImage(ownerUserId, assetId, this.pendingAssetImageFile);
      if (!uploadResult.uploaded || !uploadResult.imageUrl) {
        return null;
      }
      this.revokeObjectUrl(this.assetForm.imageUrl);
      this.pendingAssetImageFile = null;
      this.pendingAssetSourceImageUrl = '';
      this.assetForm.imageUrl = uploadResult.imageUrl;
      return uploadResult.imageUrl;
    }
    const pendingSourceImageUrl = this.pendingAssetSourceImageUrl.trim();
    if (pendingSourceImageUrl && pendingSourceImageUrl === this.assetForm.imageUrl.trim()) {
      const importResult = await this.mediaService.importImage(ownerUserId, assetId, pendingSourceImageUrl);
      if (importResult.uploaded && importResult.imageUrl) {
        this.pendingAssetSourceImageUrl = '';
        this.assetForm.imageUrl = importResult.imageUrl;
        return importResult.imageUrl;
      }
      return null;
    }
    return this.assetForm.imageUrl.trim() || null;
  }

  private hasPendingAssetSourceImage(): boolean {
    const pendingSourceImageUrl = this.pendingAssetSourceImageUrl.trim();
    return Boolean(pendingSourceImageUrl && pendingSourceImageUrl === this.assetForm.imageUrl.trim());
  }

  private normalizedAssetSourcePreviewUrl(updateForm: boolean): string {
    if (!this.assetSourcePreviewAvailable) {
      return '';
    }
    const raw = this.assetForm.sourceLink.trim();
    if (!raw) {
      return '';
    }
    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `https://${raw}`;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return '';
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    if (!parsed.hostname.trim()) {
      return '';
    }
    const normalizedUrl = parsed.toString();
    if (updateForm && normalizedUrl !== raw) {
      this.assetForm.sourceLink = normalizedUrl;
    }
    return normalizedUrl;
  }

  canOpenAssetMap(card: AppDTOs.AssetCardDTO): boolean {
    return AssetCardBuilder.canOpenMap(card);
  }

  openAssetMap(card: AppDTOs.AssetCardDTO, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenAssetMap(card)) {
      return;
    }
    this.openGoogleMapsSearch(AssetCardBuilder.primaryLocation(card));
  }

  runAssetItemEditAction(card: AppDTOs.AssetCardDTO, event?: Event): void {
    event?.stopPropagation();
    this.openAssetForm(card);
  }

  runAssetItemDeleteAction(card: AppDTOs.AssetCardDTO, event?: Event): void {
    event?.stopPropagation();
    this.pendingAssetDeleteCardId = card.id;
    this.pendingAssetDeleteLabelValue = `Delete ${card.title}?`;
    this.pendingAssetDeleteErrorValue = '';
    this.isAssetDeletePending = false;
    this.touchUiState();
  }

  cancelAssetDelete(): void {
    if (this.isAssetDeletePending) {
      return;
    }
    this.pendingAssetDeleteCardId = null;
    this.pendingAssetDeleteLabelValue = '';
    this.pendingAssetDeleteErrorValue = '';
    this.touchUiState();
  }

  async deleteAssetCardById(cardId: string): Promise<boolean> {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return false;
    }
    const cardExists = this.assetCardsRef.some(card => card.id === normalizedCardId);
    if (!cardExists) {
      return false;
    }
    const ownerUserId = this.resolveOwnerUserId();
    if (ownerUserId) {
      await this.assetsService.deleteOwnedAsset(ownerUserId, normalizedCardId);
    }
    this.markAssetMutation();
    this.applyAssetCards(this.assetCardsRef.filter(card => card.id !== normalizedCardId), {
      persist: false,
      reloadList: false
    });
    for (const hooks of this.runtimeHooks) {
      hooks.onAssetDeleted?.(normalizedCardId);
      hooks.onAssetsChanged?.();
    }
    return true;
  }

  async takeOverAssetCardById(cardId: string): Promise<void> {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return;
    }
    const ownerUserId = this.resolveOwnerUserId();
    if (!ownerUserId) {
      return;
    }
    const current = this.assetCardsRef.find(card => card.id === normalizedCardId);
    if (!current) {
      return;
    }
    const nextStatus = this.restoredAssetStatus(current);
    const ownerName = this.appCtx.activeUserProfile()?.name?.trim() || current.ownerName;
    const nextCard: AppDTOs.AssetCardDTO = {
      ...current,
      ownerUserId,
      ownerName,
      status: nextStatus,
      menuActions: this.restoredTakeOverMenuActions(current, null)
    };
    this.markAssetMutation();
    this.applyAssetCards(this.assetCardsRef.map(card =>
      card.id === normalizedCardId
        ? nextCard
        : card
    ), {
      persist: false,
      reloadList: false
    });
    for (const hooks of this.runtimeHooks) {
      hooks.onAssetsChanged?.();
    }
    this.touchUiState();

    const savedCard = await this.assetsService.takeOverOwnedAsset(ownerUserId, normalizedCardId);
    if (this.resolveOwnerUserId() !== ownerUserId || !savedCard) {
      return;
    }
    const resolvedStatus = this.normalizeAssetStatus(savedCard.status);
    const reconciledCard: AppDTOs.AssetCardDTO = {
      ...nextCard,
      ...savedCard,
      ownerUserId: savedCard.ownerUserId ?? ownerUserId,
      ownerName: savedCard.ownerName ?? ownerName,
      status: resolvedStatus === 'UR' ? nextStatus : resolvedStatus,
      menuActions: this.restoredTakeOverMenuActions(nextCard, savedCard)
    };
    this.applyAssetCards(this.assetCardsRef.map(card =>
      card.id === normalizedCardId ? reconciledCard : card
    ), {
      persist: false,
      reloadList: false
    });
    for (const hooks of this.runtimeHooks) {
      hooks.onAssetsChanged?.();
    }
    this.touchUiState();
  }

  async confirmAssetDelete(): Promise<void> {
    if (!this.pendingAssetDeleteCardId || this.isAssetDeletePending) {
      return;
    }
    const cardId = this.pendingAssetDeleteCardId;
    this.pendingAssetDeleteErrorValue = '';
    this.isAssetDeletePending = true;
    this.touchUiState();
    try {
      await this.deleteAssetCardById(cardId);
      this.isAssetDeletePending = false;
      this.pendingAssetDeleteCardId = null;
      this.pendingAssetDeleteLabelValue = '';
      this.touchUiState();
    } catch (error) {
      this.isAssetDeletePending = false;
      this.pendingAssetDeleteErrorValue = this.resolveAssetDeleteErrorMessage(error);
      this.touchUiState();
    }
  }

  private activeAssetType(): AppConstants.AssetType {
    if (this.assetFilter === 'Accommodation') {
      return 'Accommodation';
    }
    if (this.assetFilter === 'Supplies') {
      return 'Supplies';
    }
    return 'Car';
  }

  private normalizeAssetMediaLinks(cards: readonly AppDTOs.AssetCardDTO[]): AppDTOs.AssetCardDTO[] {
    return AssetCardBuilder.normalizeAssetMediaCards(cards);
  }

  public applyAssetCards(
    cards: readonly AppDTOs.AssetCardDTO[],
    options: { persist?: boolean; reloadList?: boolean } = {}
  ): void {
    const nextCards = this.normalizeAssetMediaLinks(cards.map(card => ({
      ...card,
      routes: [...(card.routes ?? [])],
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(item => ({ ...item })),
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
      requests: card.requests.map(request => this.cloneAssetRequest(request)),
      menuActions: [...(card.menuActions ?? [])]
    })));
    if (this.areAssetCardListsEqual(this.assetCardsRef, nextCards)) {
      return;
    }
    this.assetCardsRef = nextCards;
    this.assetListRevisionRef.update(value => value + 1);
    if (options.reloadList !== false) {
      this.assetListReloadRevisionRef.update(value => value + 1);
    }
    if (options.persist) {
      this.schedulePersist();
    }
  }

  private resolveAssetDeleteErrorMessage(error: unknown): string {
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    if (error && typeof error === 'object' && 'message' in error) {
      const message = `${(error as { message?: unknown }).message ?? ''}`.trim();
      if (message) {
        return message;
      }
    }
    return 'Unable to delete asset right now.';
  }

  private restoredAssetStatus(card: AppDTOs.AssetCardDTO): string {
    return 'A';
  }

  private restoredTakeOverMenuActions(
    current: AppDTOs.AssetCardDTO,
    savedCard: AppDTOs.AssetCardDTO | null | undefined
  ): string[] {
    const savedStatus = this.normalizeAssetStatus(savedCard?.status);
    const savedActions = (savedCard?.menuActions ?? [])
      .map(action => `${action ?? ''}`.trim())
      .filter(action => action.length > 0 && action !== 'takeOver');
    if (savedStatus !== 'UR' && savedActions.length > 0) {
      return savedActions;
    }
    const currentActions = current.menuActions ?? [];
    const shareAction = currentActions.includes('shareAsset') ? 'shareAsset' : 'share';
    const editAction = currentActions.includes('editAsset') ? 'editAsset' : 'edit';
    return [shareAction, editAction, 'delete'];
  }

  private assetFilterCounterKey(
    type: AppConstants.AssetFilterType
  ): Extract<ActivityCounterKey, 'cars' | 'accommodation' | 'supplies' | 'tickets'> | null {
    switch (type) {
      case 'Car':
        return 'cars';
      case 'Accommodation':
        return 'accommodation';
      case 'Supplies':
        return 'supplies';
      case 'Ticket':
        return 'tickets';
      default:
        return null;
    }
  }

  private normalizeAssetStatus(status: string | null | undefined): string {
    const normalized = `${status ?? ''}`.trim();
    switch (normalized) {
      case 'active':
        return 'A';
      case 'under-review':
      case 'under review':
        return 'UR';
      case 'blocked':
        return 'B';
      case 'deleted':
        return 'D';
      case 'inactive':
        return 'I';
      case 'trashed':
      case 'trash':
        return 'T';
      default:
        return normalized || 'A';
    }
  }

  private assetExplanationContextForFilter(filter: AppConstants.AssetFilterType): string {
    switch (filter) {
      case 'Accommodation':
        return 'assets.accommodation';
      case 'Supplies':
        return 'assets.supplies';
      case 'Ticket':
        return 'assets.tickets';
      case 'Car':
      default:
        return 'assets.car';
    }
  }

  private setAssetsExplanationContext(contextKey: string): void {
    if (this.assetsExplanationContextKey === contextKey) {
      return;
    }
    this.clearAssetsExplanationContext();
    this.assetsExplanationContextKey = contextKey;
    this.unregisterAssetsExplanationContext = this.explanationGuide.registerContext(contextKey);
  }

  private clearAssetsExplanationContext(): void {
    this.unregisterAssetsExplanationContext?.();
    this.unregisterAssetsExplanationContext = null;
    this.assetsExplanationContextKey = null;
  }

  private refreshOwnedAssetsFromRepository(
    ownerUserId: string,
    options: { trackLoading?: boolean } = {}
  ): Promise<void> {
    const normalizedOwnerUserId = ownerUserId.trim();
    if (!normalizedOwnerUserId) {
      return Promise.resolve();
    }
    const requestMutationVersion = this.assetMutationVersion;
    const trackLoading = options.trackLoading === true;
    const trackedToken = trackLoading ? ++this.trackedAssetRefreshToken : 0;
    if (trackLoading) {
      this.trackedAssetRefreshOwnerUserId = normalizedOwnerUserId;
      this.assetListLoadingRef.set(true);
      this.touchUiState();
    }
    const refreshPromise = (async () => {
      try {
        const cards = await this.assetsService.queryOwnedAssetsByUser(normalizedOwnerUserId);
        if (
          this.activeOwnerUserId !== normalizedOwnerUserId
          || requestMutationVersion !== this.assetMutationVersion
        ) {
          return;
        }
        this.applyAssetCards(cards, { persist: false, reloadList: false });
      } catch {
        // Keep the popup usable with the already-peeked cache if the refresh fails.
      } finally {
        if (trackLoading && this.trackedAssetRefreshToken === trackedToken) {
          this.trackedAssetRefreshPromise = null;
          this.trackedAssetRefreshOwnerUserId = '';
          this.assetListLoadingRef.set(false);
          this.touchUiState();
        }
      }
    })();
    if (trackLoading) {
      this.trackedAssetRefreshPromise = refreshPromise;
    }
    return refreshPromise;
  }

  private markAssetMutation(): void {
    this.assetMutationVersion += 1;
  }

  private touchUiState(): void {
    this.uiRevisionRef.update(value => value + 1);
  }

  private resolveOwnerUserId(): string {
    return this.activeOwnerUserId.trim() || this.appCtx.getActiveUserId().trim();
  }

  private resolveContextOwnerUserId(): string {
    return this.appCtx.activeUserProfile()?.id?.trim() || this.appCtx.activeUserId().trim();
  }

  private schedulePersist(): void {
    const ownerUserId = this.resolveOwnerUserId();
    if (!ownerUserId) {
      return;
    }
    this.pendingPersistOwnerUserId = ownerUserId;
    this.pendingPersistSnapshot = this.assetCardsRef.map(card => ({
      ...card,
      routes: [...(card.routes ?? [])],
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(item => ({ ...item })),
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
      requests: card.requests.map(request => this.cloneAssetRequest(request)),
      menuActions: [...(card.menuActions ?? [])]
    }));
    if (this.persistTimerId !== null) {
      clearTimeout(this.persistTimerId);
    }
    this.persistTimerId = setTimeout(() => {
      const snapshot = this.pendingPersistSnapshot;
      const persistOwnerUserId = this.pendingPersistOwnerUserId;
      this.persistTimerId = null;
      this.pendingPersistSnapshot = null;
      this.pendingPersistOwnerUserId = '';
      if (!snapshot || !persistOwnerUserId) {
        return;
      }
      void this.assetsService.replaceOwnedAssets(persistOwnerUserId, snapshot);
    }, 60);
  }

  private cancelScheduledPersist(): void {
    if (this.persistTimerId !== null) {
      clearTimeout(this.persistTimerId);
      this.persistTimerId = null;
    }
    this.pendingPersistSnapshot = null;
    this.pendingPersistOwnerUserId = '';
  }

  private openGoogleMapsSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
    this.openExternalUrl(url);
  }

  private openExternalUrl(url: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private revokeObjectUrl(value: string | null): void {
    if (value && value.startsWith('blob:')) {
      URL.revokeObjectURL(value);
    }
  }

  private areAssetCardListsEqual(
    left: readonly AppDTOs.AssetCardDTO[],
    right: readonly AppDTOs.AssetCardDTO[]
  ): boolean {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((card, index) => this.assetCardSignature(card) === this.assetCardSignature(right[index]));
  }

  private assetCardSignature(card: AppDTOs.AssetCardDTO | null | undefined): string {
    if (!card) {
      return '';
    }
    return [
      card.id,
      card.type,
      card.title,
      card.subtitle,
      card.category ?? '',
      card.city,
      String(card.capacityTotal),
      String(card.quantity),
      card.details,
      card.imageUrl,
      card.sourceLink,
      card.visibility ?? '',
      card.status ?? '',
      card.ownerUserId ?? '',
      card.ownerName ?? '',
      (card.routes ?? []).join('|'),
      (card.topics ?? []).join('|'),
      JSON.stringify((card.policies ?? []).map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        required: item.required !== false
      }))),
      JSON.stringify(card.pricing ?? null),
      card.requests
        .map(request => [
          request.id,
          request.userId ?? '',
          request.name,
          request.initials,
          request.gender,
          request.status,
          request.note,
          request.requestKind ?? '',
          request.requestedAtIso ?? '',
          request.booking?.eventId ?? '',
          request.booking?.subEventId ?? '',
          request.booking?.slotKey ?? '',
          request.booking?.quantity ?? '',
          request.booking?.totalAmount ?? '',
          request.booking?.timeframe ?? ''
        ].join(':'))
        .join('|'),
      (card.menuActions ?? []).join('|')
    ].join('||');
  }

  private cloneAssetRequest(request: AppDTOs.AssetMemberRequestDTO): AppDTOs.AssetMemberRequestDTO {
    return {
      ...request,
      booking: request.booking
        ? {
            ...request.booking,
            acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
          }
        : null
    };
  }

  private assetRequestQuantity(request: AppDTOs.AssetMemberRequestDTO): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 0));
  }
}
