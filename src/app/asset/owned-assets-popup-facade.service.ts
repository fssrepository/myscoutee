import { Injectable, effect, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';

import { DemoAssetBuilder } from '../shared/core/demo/builders';
import { APP_STATIC_DATA } from '../shared/app-static-data';
import { PricingBuilder } from '../shared/core/base/builders';
import type * as AppTypes from '../shared/core/base/models';
import { resolveCurrentDemoDelayMs } from '../shared/core/base/services/route-delay.service';
import { AssetPopupStateService } from './asset-popup-state.service';
import { AppContext, AssetCardBuilder, AssetDefaultsBuilder, AssetsService } from '../shared/core';
import { HttpMediaService } from '../shared/core/http';

export interface OwnedAssetsRuntimeHooks {
  onAssetsChanged?(): void;
  onAssetCreated?(card: AppTypes.AssetCard): void;
  onAssetDeleted?(cardId: string): void;
  onAssetFormClosed?(): void;
}

@Injectable({
  providedIn: 'root'
})
export class OwnedAssetsPopupFacadeService {
  private static readonly DEMO_PENDING_WINDOW_MS = 1500;

  private readonly assetPopupState = inject(AssetPopupStateService);
  private readonly assetsService = inject(AssetsService);
  private readonly appCtx = inject(AppContext);
  private readonly httpMediaService = inject(HttpMediaService);
  private readonly assetListRevisionRef = signal(0);
  private readonly assetListReloadRevisionRef = signal(0);
  private readonly uiRevisionRef = signal(0);

  readonly assetTypeOptions: AppTypes.AssetType[] = APP_STATIC_DATA.assetTypeOptions;
  readonly assetFilterOptions: AppTypes.AssetFilterType[] = APP_STATIC_DATA.assetFilterOptions;
  readonly assetVisibilityOptions: AppTypes.EventVisibility[] = APP_STATIC_DATA.eventVisibilityOptions;

  assetFilter: AppTypes.AssetFilterType = 'Car';
  showAssetForm = false;
  editingAssetId: string | null = null;
  isAssetFormSavePending = false;
  pendingAssetDeleteCardId: string | null = null;
  isAssetDeletePending = false;
  assetForm: Omit<AppTypes.AssetCard, 'id' | 'requests'> = AssetCardBuilder.buildEmptyAssetForm('Car');
  assetFormVisibility: AppTypes.EventVisibility = 'Public';
  readonly assetSourceRefreshEnabled =
    environment.activitiesDataSource === 'http'
    && environment.assetSourceRefreshEnabled !== false;

  private assetCardsRef: AppTypes.AssetCard[] = [];
  private activePopupFilter: AppTypes.AssetFilterType | null = null;
  private activeOwnerUserId = '';
  private itemActionMenu: { id: string; title: string; openUp: boolean } | null = null;
  private readonly runtimeHooks: OwnedAssetsRuntimeHooks[] = [];
  private pendingPersistSnapshot: AppTypes.AssetCard[] | null = null;
  private pendingPersistOwnerUserId = '';
  private persistTimerId: ReturnType<typeof setTimeout> | null = null;
  private pendingAssetImageFile: File | null = null;
  private assetMutationVersion = 0;
  private pendingAssetDeleteLabelValue = '';
  private pendingAssetDeleteErrorValue = '';

  readonly assetListRevision = this.assetListRevisionRef.asReadonly();
  readonly assetListReloadRevision = this.assetListReloadRevisionRef.asReadonly();
  readonly uiRevision = this.uiRevisionRef.asReadonly();

  get assetCards(): AppTypes.AssetCard[] {
    return this.assetCardsRef;
  }

  set assetCards(cards: AppTypes.AssetCard[]) {
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

  initialize(cards: AppTypes.AssetCard[]): void {
    this.applyAssetCards(cards, { persist: false, reloadList: false });
  }

  assetListRevisionValue(): number {
    return this.assetListRevisionRef();
  }

  initializeFromUser(userId: string): void {
    const normalizedUserId = userId.trim();
    this.activeOwnerUserId = normalizedUserId;
    this.pendingAssetDeleteCardId = null;
    this.isAssetDeletePending = false;
    this.pendingAssetDeleteLabelValue = '';
    this.pendingAssetDeleteErrorValue = '';
    this.itemActionMenu = null;
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
    return `Assets · ${this.assetTypeLabel(filter)}`;
  }

  assetFilterPanelWidth(): string {
    return '248px';
  }

  filteredAssetCards(): AppTypes.AssetCard[] {
    if (this.assetFilter === 'Ticket') {
      return [];
    }
    return this.assetCardsRef.filter(card => card.type === this.assetFilter);
  }

  assetFormTitle(): string {
    return `${this.editingAssetId ? 'Edit' : 'Add'} ${this.assetTypeLabel(this.assetForm.type)}`;
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

  assetDeleteRingPerimeter(): number {
    return 100;
  }

  assetFormSaveRingPerimeter(): number {
    return 100;
  }

  async applyAssetRequestAction(
    assetId: string,
    requestId: string,
    action: AppTypes.AssetRequestAction
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

    const nextCard: AppTypes.AssetCard = {
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
    await this.awaitAssetMutationCompletion(persistPromise);
  }

  assetTypeIcon(type: AppTypes.AssetFilterType): string {
    return AssetDefaultsBuilder.assetTypeIcon(type);
  }

  assetTypeClass(type: AppTypes.AssetFilterType): string {
    return AssetDefaultsBuilder.assetTypeClass(type);
  }

  assetTypeLabel(type: AppTypes.AssetFilterType): string {
    return AssetDefaultsBuilder.assetTypeLabel(type);
  }

  eventVisibilityClass(option: AppTypes.EventVisibility): string {
    return AssetDefaultsBuilder.eventVisibilityClass(option);
  }

  visibilityIcon(option: AppTypes.EventVisibility): string {
    return AssetDefaultsBuilder.visibilityIcon(option);
  }

  assetCategoryOptions(type: AppTypes.AssetType = this.assetForm.type): AppTypes.AssetCategory[] {
    return AssetDefaultsBuilder.assetCategoryOptions(type);
  }

  setAssetFormVisibility(option: AppTypes.EventVisibility): void {
    if (this.isAssetFormSavePending) {
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

  openPopup(filter: AppTypes.AssetFilterType): void {
    this.assetFilter = filter;
    this.activePopupFilter = filter;
    this.closeAssetForm();
    if (filter === 'Ticket') {
      this.assetPopupState.prepareTicketPopupOpen();
    }
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
    this.itemActionMenu = null;
    this.assetPopupState.resetTicketState();
    this.assetPopupState.setPrimaryVisible(false);
    this.touchUiState();
  }

  selectAssetFilter(filter: AppTypes.AssetFilterType): void {
    this.assetFilter = filter;
    this.activePopupFilter = filter;
    if (filter === 'Ticket') {
      this.assetPopupState.prepareTicketPopupOpen();
    }
    this.assetPopupState.setPrimaryVisible(true);
    this.touchUiState();
  }

  openAssetForm(card?: AppTypes.AssetCard): void {
    this.itemActionMenu = null;
    this.showAssetForm = true;
    this.isAssetFormSavePending = false;
    this.pendingAssetImageFile = null;
    if (card) {
      const imageUrl = AssetCardBuilder.normalizeAssetImageLink(card.type, card.imageUrl, {
        fallbackImageUrl: DemoAssetBuilder.defaultAssetImage(card.type, card.id || card.title)
      });
      const sourceLink = AssetCardBuilder.normalizeAssetSourceLink(card.sourceLink, imageUrl);
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
      this.touchUiState();
      return;
    }
    this.editingAssetId = null;
    const type = this.activeAssetType();
    this.assetFormVisibility = 'Public';
    this.assetForm = AssetCardBuilder.buildEmptyAssetForm(type);
    this.touchUiState();
  }

  closeAssetForm(): void {
    this.showAssetForm = false;
    this.editingAssetId = null;
    this.isAssetFormSavePending = false;
    for (const hooks of this.runtimeHooks) {
      hooks.onAssetFormClosed?.();
    }
    this.touchUiState();
  }

  canSubmitAssetForm(): boolean {
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

  openAssetFormRouteStopMap(index: number, event?: Event): void {
    event?.stopPropagation();
    const value = this.assetFormRouteStops()[index] ?? '';
    this.openGoogleMapsSearch(value);
  }

  async refreshAssetFromSourceLink(): Promise<void> {
    if (!this.assetSourceRefreshEnabled) {
      return;
    }
    const raw = this.assetForm.sourceLink.trim();
    if (!raw) {
      return;
    }
    let parsed: URL | null = null;
    try {
      parsed = new URL(raw);
    } catch {
      try {
        parsed = new URL(`https://${raw}`);
        this.assetForm.sourceLink = parsed.toString();
      } catch {
        return;
      }
    }
    if (!parsed || AssetCardBuilder.isGoogleMapsLikeLink(parsed.toString())) {
      return;
    }
    const ownerUserId = this.resolveOwnerUserId();
    const preview = await this.assetsService.refreshAssetSourcePreview(ownerUserId, this.assetForm.type, parsed.toString());
    if (!preview || preview.enabled === false) {
      return;
    }
    this.assetForm.sourceLink = preview.normalizedUrl.trim() || parsed.toString();
    if (preview.imageUrl.trim()) {
      if (environment.activitiesDataSource === 'http' && this.assetForm.imageUrl.startsWith('blob:')) {
        this.revokeObjectUrl(this.assetForm.imageUrl);
      }
      this.assetForm.imageUrl = preview.imageUrl.trim();
      this.pendingAssetImageFile = null;
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

  applyAssetImageFile(file: File): void {
    this.revokeObjectUrl(this.assetForm.imageUrl);
    this.pendingAssetImageFile = environment.activitiesDataSource === 'http' ? file : null;
    this.assetForm.imageUrl = URL.createObjectURL(file);
  }

  async saveAssetCard(): Promise<void> {
    if (this.isAssetFormSavePending || !this.canSubmitAssetForm()) {
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
      if (environment.activitiesDataSource === 'http' && this.pendingAssetImageFile && !resolvedImageUrl) {
        throw new Error('Unable to upload asset image.');
      }
      const imageUrl = AssetCardBuilder.normalizeAssetImageLink(this.assetForm.type, resolvedImageUrl || this.assetForm.imageUrl, {
        fallbackImageUrl: DemoAssetBuilder.defaultAssetImage(
          this.assetForm.type,
          title || this.assetForm.subtitle || city || this.assetForm.type.toLowerCase()
        )
      });
      const sourceLink = AssetCardBuilder.normalizeAssetSourceLink(this.assetForm.sourceLink, imageUrl);
      const category = AssetDefaultsBuilder.normalizeCategory(this.assetForm.type, this.assetForm.category);
      const payload: Omit<AppTypes.AssetCard, 'id' | 'requests'> = {
        type: this.assetForm.type,
        title,
        subtitle: this.assetForm.subtitle.trim() || DemoAssetBuilder.defaultAssetSubtitle(this.assetForm.type),
        category,
        city: resolvedCity,
        capacityTotal: Math.max(1, Number(this.assetForm.capacityTotal) || (this.assetForm.type === 'Supplies' ? 6 : 4)),
        quantity: AssetCardBuilder.normalizeQuantity(this.assetForm.type, this.assetForm.quantity, this.assetForm.capacityTotal),
        details: this.assetForm.details.trim() || DemoAssetBuilder.defaultAssetDetails(this.assetForm.type),
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
      const resolvedVisibility: AppTypes.EventVisibility = this.assetFormVisibility;

      if (this.editingAssetId) {
        const editingAssetId = this.editingAssetId;
        const existing = this.assetCardsRef.find(card => card.id === editingAssetId);
        const nextCard: AppTypes.AssetCard = {
          id: editingAssetId,
          ...payload,
          visibility: resolvedVisibility,
          ownerUserId: existing?.ownerUserId,
          ownerName: existing?.ownerName ?? ownerName,
          requests: existing?.requests.map(request => ({ ...request })) ?? []
        };
        this.markAssetMutation();
        this.applyAssetCards(this.assetCardsRef.map(card =>
          card.id === editingAssetId
            ? nextCard
            : card
        ), { persist: false, reloadList: false });
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
        await this.awaitAssetMutationCompletion(persistPromise);
      } else {
        const nextCard: AppTypes.AssetCard = {
          id: assetId,
          ...payload,
          visibility: resolvedVisibility,
          ownerUserId,
          ownerName,
          requests: []
        };
        this.markAssetMutation();
        this.applyAssetCards([nextCard, ...this.assetCardsRef], { persist: false, reloadList: false });
        for (const hooks of this.runtimeHooks) {
          hooks.onAssetCreated?.(nextCard);
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
        await this.awaitAssetMutationCompletion(persistPromise);
      }
      this.isAssetFormSavePending = false;
      this.closeAssetForm();
    } catch {
      this.isAssetFormSavePending = false;
      this.touchUiState();
    }
  }

  private async resolvePersistedAssetImageUrl(ownerUserId: string, assetId: string): Promise<string | null> {
    if (environment.activitiesDataSource !== 'http' || !this.pendingAssetImageFile) {
      return this.assetForm.imageUrl.trim() || null;
    }
    const uploadResult = await this.httpMediaService.uploadImage('asset', ownerUserId, assetId, this.pendingAssetImageFile);
    if (!uploadResult.uploaded || !uploadResult.imageUrl) {
      return null;
    }
    this.revokeObjectUrl(this.assetForm.imageUrl);
    this.pendingAssetImageFile = null;
    this.assetForm.imageUrl = uploadResult.imageUrl;
    return uploadResult.imageUrl;
  }

  canOpenAssetMap(card: AppTypes.AssetCard): boolean {
    return AssetCardBuilder.canOpenMap(card);
  }

  openAssetMap(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenAssetMap(card)) {
      return;
    }
    this.openGoogleMapsSearch(AssetCardBuilder.primaryLocation(card));
  }

  toggleAssetItemActionMenu(card: AppTypes.AssetCard, event: Event): void {
    event.stopPropagation();
    if (this.itemActionMenu?.id === card.id) {
      this.itemActionMenu = null;
      return;
    }
    this.itemActionMenu = {
      id: card.id,
      title: card.title,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    };
  }

  closeAssetItemActionMenu(): void {
    this.itemActionMenu = null;
  }

  isAssetItemActionMenuOpen(card: AppTypes.AssetCard): boolean {
    return this.itemActionMenu?.id === card.id;
  }

  isAssetItemActionMenuOpenUp(card: AppTypes.AssetCard): boolean {
    return this.itemActionMenu?.id === card.id && this.itemActionMenu.openUp;
  }

  runAssetItemEditAction(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    this.openAssetForm(card);
    this.itemActionMenu = null;
  }

  runAssetItemDeleteAction(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    this.pendingAssetDeleteCardId = card.id;
    this.pendingAssetDeleteLabelValue = `Delete ${card.title}?`;
    this.pendingAssetDeleteErrorValue = '';
    this.isAssetDeletePending = false;
    this.itemActionMenu = null;
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
    if (this.demoMutationWindowMs() > 0) {
      this.markAssetMutation();
      this.applyAssetCards(this.assetCardsRef.filter(card => card.id !== normalizedCardId), {
        persist: false,
        reloadList: false
      });
      for (const hooks of this.runtimeHooks) {
        hooks.onAssetDeleted?.(normalizedCardId);
        hooks.onAssetsChanged?.();
      }
      if (ownerUserId) {
        void this.assetsService.deleteOwnedAsset(ownerUserId, normalizedCardId).catch(() => undefined);
      }
      await this.wait(this.demoMutationWindowMs());
      return true;
    }
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

  private activeAssetType(): AppTypes.AssetType {
    if (this.assetFilter === 'Accommodation') {
      return 'Accommodation';
    }
    if (this.assetFilter === 'Supplies') {
      return 'Supplies';
    }
    return 'Car';
  }

  private normalizeAssetMediaLinks(cards: readonly AppTypes.AssetCard[]): AppTypes.AssetCard[] {
    return AssetCardBuilder.normalizeAssetMediaCards(cards, {
      fallbackImageUrl: card => DemoAssetBuilder.defaultAssetImage(card.type, card.id || card.title || card.type.toLowerCase())
    });
  }

  public applyAssetCards(
    cards: readonly AppTypes.AssetCard[],
    options: { persist?: boolean; reloadList?: boolean } = {}
  ): void {
    const nextCards = this.normalizeAssetMediaLinks(cards.map(card => ({
      ...card,
      routes: [...(card.routes ?? [])],
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(item => ({ ...item })),
      pricing: card.pricing ? PricingBuilder.clonePricingConfig(card.pricing) : undefined,
      requests: card.requests.map(request => this.cloneAssetRequest(request))
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

  private async awaitAssetMutationCompletion(persistPromise: Promise<void>): Promise<void> {
    const demoWindowMs = this.demoMutationWindowMs();
    if (demoWindowMs <= 0) {
      await persistPromise;
      return;
    }
    void persistPromise.catch(() => undefined);
    await this.wait(demoWindowMs);
  }

  private demoMutationWindowMs(): number {
    return resolveCurrentDemoDelayMs(OwnedAssetsPopupFacadeService.DEMO_PENDING_WINDOW_MS);
  }

  private async wait(delayMs: number): Promise<void> {
    if (delayMs <= 0) {
      return;
    }
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), delayMs);
    });
  }

  private async refreshOwnedAssetsFromRepository(ownerUserId: string): Promise<void> {
    const requestMutationVersion = this.assetMutationVersion;
    const cards = await this.assetsService.queryOwnedAssetsByUser(ownerUserId);
    if (this.activeOwnerUserId !== ownerUserId || requestMutationVersion !== this.assetMutationVersion) {
      return;
    }
    this.applyAssetCards(cards, { persist: false, reloadList: false });
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
      requests: card.requests.map(request => this.cloneAssetRequest(request))
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

  private shouldOpenInlineItemMenuUp(event: Event): boolean {
    if (this.isMobileView() || typeof window === 'undefined') {
      return false;
    }
    const trigger = event.currentTarget as HTMLElement | null;
    const actionWrap = (trigger?.closest('.experience-item-actions') as HTMLElement | null) ?? trigger;
    if (!actionWrap) {
      return false;
    }
    const rect = actionWrap.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const estimatedMenuHeight = 248;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    return spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
  }

  private areAssetCardListsEqual(
    left: readonly AppTypes.AssetCard[],
    right: readonly AppTypes.AssetCard[]
  ): boolean {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((card, index) => this.assetCardSignature(card) === this.assetCardSignature(right[index]));
  }

  private assetCardSignature(card: AppTypes.AssetCard | null | undefined): string {
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
        .join('|')
    ].join('||');
  }

  private cloneAssetRequest(request: AppTypes.AssetMemberRequest): AppTypes.AssetMemberRequest {
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

  private assetRequestQuantity(request: AppTypes.AssetMemberRequest): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 0));
  }
}
