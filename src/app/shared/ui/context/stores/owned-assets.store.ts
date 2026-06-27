import { Injectable, computed, signal } from '@angular/core';

import { AssetDto } from '../../../core/contracts';
import type * as AppConstants from '../../../core/common/constants';
import type * as AppDTOs from '../../../core/contracts';

export interface OwnedAssetsVisibleListState {
  items: readonly AppDTOs.AssetDTO[];
  total: number;
  initialLoading: boolean;
}

export interface OwnedAssetsVisibleListPatch {
  items: AppDTOs.AssetDTO[];
  total: number;
}

export interface OwnedAssetDeletedEvent {
  cardId: string;
  revision: number;
}

export type OwnedAssetFormState = Omit<AppDTOs.AssetDetailDTO, 'id' | 'requests'>;

@Injectable({
  providedIn: 'root'
})
export class OwnedAssetsStore {
  private readonly assetCardsRef = signal<AppDTOs.AssetDTO[]>([]);
  private assetMutationVersion = 0;
  private visibleListContextKey = '';
  private visibleListSignature = '';
  private visibleListCardCount = 0;
  private visibleListReady = false;
  private visibleListRenderedCount = 0;

  readonly assetFilterRef = signal<AppConstants.AssetFilterType>('Car');
  readonly activePopupFilterRef = signal<AppConstants.AssetFilterType | null>(null);
  readonly activeOwnerUserIdRef = signal('');
  readonly showAssetFormRef = signal(false);
  readonly editingAssetIdRef = signal<string | null>(null);
  readonly assetFormLoadingRef = signal(false);
  readonly assetFormSavePendingRef = signal(false);
  readonly pendingAssetDeleteCardIdRef = signal<string | null>(null);
  readonly assetDeletePendingRef = signal(false);
  readonly pendingAssetDeleteLabelRef = signal('');
  readonly pendingAssetDeleteErrorRef = signal('');
  readonly assetFormRef = signal<OwnedAssetFormState>({
    type: 'Car',
    title: '',
    subtitle: '',
    city: '',
    capacityTotal: 4,
    quantity: 1,
    details: '',
    imageUrl: '',
    sourceLink: ''
  });
  readonly assetFormVisibilityRef = signal<AppConstants.EventVisibility>('Public');
  readonly assetFormDraftIdRef = signal('');
  readonly assetFormLoadGenerationRef = signal(0);
  readonly pendingAssetSourceImageUrlRef = signal('');
  readonly assetListRevisionRef = signal(0);
  readonly assetListReloadRevisionRef = signal(0);
  readonly assetListLoadingRef = signal(false);
  readonly uiRevisionRef = signal(0);
  readonly deletedAssetEventRef = signal<OwnedAssetDeletedEvent | null>(null);

  readonly assetCards = this.assetCardsRef.asReadonly();
  readonly assetCount = computed(() => this.assetCardsRef().length);
  readonly assetFilter = this.assetFilterRef.asReadonly();
  readonly activePopupFilter = this.activePopupFilterRef.asReadonly();
  readonly activeOwnerUserId = this.activeOwnerUserIdRef.asReadonly();
  readonly showAssetForm = this.showAssetFormRef.asReadonly();
  readonly editingAssetId = this.editingAssetIdRef.asReadonly();
  readonly assetFormLoading = this.assetFormLoadingRef.asReadonly();
  readonly assetFormSavePending = this.assetFormSavePendingRef.asReadonly();
  readonly pendingAssetDeleteCardId = this.pendingAssetDeleteCardIdRef.asReadonly();
  readonly assetDeletePending = this.assetDeletePendingRef.asReadonly();
  readonly pendingAssetDeleteLabel = this.pendingAssetDeleteLabelRef.asReadonly();
  readonly pendingAssetDeleteError = this.pendingAssetDeleteErrorRef.asReadonly();
  readonly assetForm = this.assetFormRef.asReadonly();
  readonly assetFormVisibility = this.assetFormVisibilityRef.asReadonly();
  readonly assetFormDraftId = this.assetFormDraftIdRef.asReadonly();
  readonly assetFormLoadGeneration = this.assetFormLoadGenerationRef.asReadonly();
  readonly pendingAssetSourceImageUrl = this.pendingAssetSourceImageUrlRef.asReadonly();
  readonly assetListRevision = this.assetListRevisionRef.asReadonly();
  readonly assetListReloadRevision = this.assetListReloadRevisionRef.asReadonly();
  readonly assetListLoading = this.assetListLoadingRef.asReadonly();
  readonly uiRevision = this.uiRevisionRef.asReadonly();
  readonly deletedAssetEvent = this.deletedAssetEventRef.asReadonly();
  readonly popupOpen = computed(() => this.activePopupFilterRef() !== null);
  readonly ticketPopup = computed(() => this.popupOpen() && this.assetFilterRef() === 'Ticket');

  setAssetCards(cards: readonly AppDTOs.AssetDTO[]): void {
    this.assetCardsRef.set(AssetDto.cloneList(cards));
  }

  applyAssetCards(
    cards: readonly (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO)[],
    options: { reloadList?: boolean; mutation?: boolean } = {}
  ): boolean {
    const nextCards = AssetDto.cloneList(cards);
    if (AssetDto.listEquals(this.assetCardsRef(), nextCards)) {
      return false;
    }
    if (options.mutation === true) {
      this.markAssetMutation();
    }
    this.assetCardsRef.set(nextCards);
    this.bumpAssetListRevision(options.reloadList !== false);
    return true;
  }

  replaceAssetCard(
    card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO,
    options: { reloadList?: boolean; mutation?: boolean } = {}
  ): boolean {
    const normalizedCard = AssetDto.clone(card);
    const nextCards = this.assetCardsRef().some(item => item.id === normalizedCard.id)
      ? this.assetCardsRef().map(item => item.id === normalizedCard.id ? normalizedCard : item)
      : [normalizedCard, ...this.assetCardsRef()];
    return this.applyAssetCards(nextCards, options);
  }

  removeAssetCard(cardId: string, options: { reloadList?: boolean; mutation?: boolean } = {}): boolean {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return false;
    }
    return this.applyAssetCards(
      this.assetCardsRef().filter(card => card.id !== normalizedCardId),
      options
    );
  }

  markAssetMutation(): number {
    this.assetMutationVersion += 1;
    return this.assetMutationVersion;
  }

  currentAssetMutationVersion(): number {
    return this.assetMutationVersion;
  }

  setActiveOwnerUserId(userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (normalizedUserId === this.activeOwnerUserIdRef()) {
      return false;
    }
    this.activeOwnerUserIdRef.set(normalizedUserId);
    return true;
  }

  isActiveOwnerUser(userId: string): boolean {
    return this.activeOwnerUserIdRef() === userId.trim();
  }

  openAssetPopup(filter: AppConstants.AssetFilterType): void {
    this.assetFilterRef.set(filter);
    this.activePopupFilterRef.set(filter);
    this.closeAssetEditor();
  }

  closeAssetPopup(): void {
    this.activePopupFilterRef.set(null);
    this.closeAssetEditor();
    this.resetAssetDeleteDialog();
  }

  selectAssetFilter(filter: AppConstants.AssetFilterType): void {
    this.assetFilterRef.set(filter);
    this.activePopupFilterRef.set(filter);
    this.touchUiState();
  }

  setAssetListLoading(loading: boolean): void {
    this.assetListLoadingRef.set(loading);
    this.touchUiState();
  }

  touchUiState(): void {
    this.uiRevisionRef.update(value => value + 1);
  }

  bumpAssetListRevision(reloadList = true): void {
    this.assetListRevisionRef.update(value => value + 1);
    if (reloadList) {
      this.assetListReloadRevisionRef.update(value => value + 1);
    }
  }

  recordAssetDeleted(cardId: string): void {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return;
    }
    this.deletedAssetEventRef.update(event => ({
      cardId: normalizedCardId,
      revision: (event?.revision ?? 0) + 1
    }));
  }

  resetAssetDeleteDialog(): void {
    this.pendingAssetDeleteCardIdRef.set(null);
    this.assetDeletePendingRef.set(false);
    this.pendingAssetDeleteLabelRef.set('');
    this.pendingAssetDeleteErrorRef.set('');
    this.touchUiState();
  }

  requestAssetDelete(card: AppDTOs.AssetDTO): void {
    this.pendingAssetDeleteCardIdRef.set(card.id);
    this.pendingAssetDeleteLabelRef.set(`Delete ${card.title}?`);
    this.pendingAssetDeleteErrorRef.set('');
    this.assetDeletePendingRef.set(false);
    this.touchUiState();
  }

  cancelAssetDelete(): void {
    if (this.assetDeletePendingRef()) {
      return;
    }
    this.pendingAssetDeleteCardIdRef.set(null);
    this.pendingAssetDeleteLabelRef.set('');
    this.pendingAssetDeleteErrorRef.set('');
    this.touchUiState();
  }

  beginAssetDelete(): string | null {
    const pendingCardId = this.pendingAssetDeleteCardIdRef();
    if (!pendingCardId || this.assetDeletePendingRef()) {
      return null;
    }
    this.pendingAssetDeleteErrorRef.set('');
    this.assetDeletePendingRef.set(true);
    this.touchUiState();
    return pendingCardId;
  }

  completeAssetDelete(): void {
    this.assetDeletePendingRef.set(false);
    this.pendingAssetDeleteCardIdRef.set(null);
    this.pendingAssetDeleteLabelRef.set('');
    this.touchUiState();
  }

  failAssetDelete(message: string): void {
    this.assetDeletePendingRef.set(false);
    this.pendingAssetDeleteErrorRef.set(message);
    this.touchUiState();
  }

  openAssetEditorCreate(form: OwnedAssetFormState, draftId: string): number {
    const generation = this.bumpAssetEditorGeneration();
    this.showAssetFormRef.set(true);
    this.assetFormLoadingRef.set(false);
    this.assetFormSavePendingRef.set(false);
    this.pendingAssetSourceImageUrlRef.set('');
    this.editingAssetIdRef.set(null);
    this.assetFormDraftIdRef.set(draftId.trim() || `asset-${Date.now()}`);
    this.assetFormVisibilityRef.set('Public');
    this.assetFormRef.set(form);
    this.touchUiState();
    return generation;
  }

  openAssetEditorEdit(options: {
    cardId: string;
    form: OwnedAssetFormState;
    visibility: AppConstants.EventVisibility;
    loading: boolean;
  }): number {
    const generation = this.bumpAssetEditorGeneration();
    this.showAssetFormRef.set(true);
    this.assetFormLoadingRef.set(options.loading);
    this.assetFormSavePendingRef.set(false);
    this.pendingAssetSourceImageUrlRef.set('');
    this.assetFormDraftIdRef.set('');
    this.editingAssetIdRef.set(options.cardId);
    this.assetFormVisibilityRef.set(options.visibility);
    this.assetFormRef.set(options.form);
    this.touchUiState();
    return generation;
  }

  applyAssetEditorForm(
    cardId: string,
    visibility: AppConstants.EventVisibility,
    form: OwnedAssetFormState
  ): void {
    this.editingAssetIdRef.set(cardId);
    this.assetFormVisibilityRef.set(visibility);
    this.assetFormRef.set(form);
    this.touchUiState();
  }

  closeAssetEditor(): number {
    const generation = this.bumpAssetEditorGeneration();
    this.showAssetFormRef.set(false);
    this.editingAssetIdRef.set(null);
    this.assetFormLoadingRef.set(false);
    this.assetFormSavePendingRef.set(false);
    this.pendingAssetSourceImageUrlRef.set('');
    this.assetFormDraftIdRef.set('');
    this.touchUiState();
    return generation;
  }

  isCurrentAssetEditorLoad(generation: number, assetId: string): boolean {
    return this.showAssetFormRef()
      && this.assetFormLoadGenerationRef() === generation
      && this.editingAssetIdRef() === assetId;
  }

  setAssetEditorVisibility(option: AppConstants.EventVisibility): void {
    if (this.assetFormLoadingRef() || this.assetFormSavePendingRef()) {
      return;
    }
    this.assetFormVisibilityRef.set(option);
    this.touchUiState();
  }

  setAssetEditorImageUrl(imageUrl: string): void {
    this.assetFormRef().imageUrl = imageUrl.trim();
    this.touchUiState();
  }

  setAssetEditorSourceLink(sourceLink: string): void {
    this.assetFormRef().sourceLink = sourceLink.trim();
    this.touchUiState();
  }

  clearPendingAssetSourceImage(): void {
    this.pendingAssetSourceImageUrlRef.set('');
    this.touchUiState();
  }

  setPendingAssetSourceImage(imageUrl: string): void {
    this.pendingAssetSourceImageUrlRef.set(imageUrl.trim());
    this.touchUiState();
  }

  applyPersistedAssetImage(imageUrl: string): void {
    const normalizedImageUrl = imageUrl.trim();
    if (!normalizedImageUrl) {
      return;
    }
    this.pendingAssetSourceImageUrlRef.set('');
    this.assetFormRef().imageUrl = normalizedImageUrl;
    this.touchUiState();
  }

  applyAssetSourcePreview(preview: AppDTOs.AssetSourcePreviewDTO, fallbackSourceUrl: string): string | null {
    const assetForm = this.assetFormRef();
    const previousImageUrl = assetForm.imageUrl;
    assetForm.sourceLink = preview.normalizedUrl.trim() || fallbackSourceUrl.trim();
    this.pendingAssetSourceImageUrlRef.set('');

    const previewImageUrl = preview.imageUrl.trim();
    if (previewImageUrl) {
      assetForm.imageUrl = previewImageUrl;
      this.pendingAssetSourceImageUrlRef.set(previewImageUrl);
    }
    if (preview.title.trim()) {
      assetForm.title = preview.title.trim();
    }
    if (preview.subtitle.trim()) {
      assetForm.subtitle = preview.subtitle.trim();
    }
    if (preview.details.trim()) {
      assetForm.details = preview.details.trim();
    }
    this.touchUiState();
    return previousImageUrl !== assetForm.imageUrl ? previousImageUrl : null;
  }

  setAssetEditorLoading(loading: boolean): void {
    this.assetFormLoadingRef.set(loading);
    this.touchUiState();
  }

  beginAssetEditorSave(): boolean {
    if (this.assetFormLoadingRef() || this.assetFormSavePendingRef()) {
      return false;
    }
    this.assetFormSavePendingRef.set(true);
    this.touchUiState();
    return true;
  }

  completeAssetEditorSave(): void {
    this.assetFormSavePendingRef.set(false);
    this.closeAssetEditor();
  }

  failAssetEditorSave(): void {
    this.assetFormSavePendingRef.set(false);
    this.touchUiState();
  }

  private bumpAssetEditorGeneration(): number {
    const nextGeneration = this.assetFormLoadGenerationRef() + 1;
    this.assetFormLoadGenerationRef.set(nextGeneration);
    return nextGeneration;
  }

  cardsByType(type: AppConstants.AssetType): AppDTOs.AssetDTO[] {
    return this.assetCardsRef().filter(card => card.type === type);
  }

  orderedCardsByType(type: AppConstants.AssetType, selectedAssetIds: ReadonlySet<string> | null = null): AppDTOs.AssetDTO[] {
    return this.cardsByType(type).sort((left, right) => {
      if (selectedAssetIds) {
        const selectedDelta = Number(selectedAssetIds.has(right.id)) - Number(selectedAssetIds.has(left.id));
        if (selectedDelta !== 0) {
          return selectedDelta;
        }
      }
      return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    });
  }

  findAsset(assetId: string, type?: AppConstants.AssetType): AppDTOs.AssetDTO | null {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      return null;
    }
    return this.assetCardsRef().find(card => (
      card.id === normalizedAssetId
      && (type === undefined || card.type === type)
    )) ?? null;
  }

  hasAsset(assetId: string, type?: AppConstants.AssetType): boolean {
    return this.findAsset(assetId, type) !== null;
  }

  resetVisibleAssetListSync(): void {
    this.visibleListContextKey = '';
    this.visibleListSignature = '';
    this.visibleListCardCount = 0;
    this.visibleListReady = false;
    this.visibleListRenderedCount = 0;
  }

  trackVisibleAssetListState(
    state: OwnedAssetsVisibleListState,
    cards: readonly AppDTOs.AssetDTO[]
  ): OwnedAssetsVisibleListPatch | null {
    this.visibleListRenderedCount = state.items.length;
    this.visibleListReady = !state.initialLoading;
    if (!this.visibleListReady || state.total === cards.length) {
      return null;
    }
    return this.createVisibleAssetListPatch(cards, state.total, state.items.length);
  }

  syncVisibleAssetList(
    options: {
      active: boolean;
      contextKey: string;
      cards: readonly AppDTOs.AssetDTO[];
      renderedCount: number;
    }
  ): OwnedAssetsVisibleListPatch | null {
    if (!options.active) {
      this.resetVisibleAssetListSync();
      return null;
    }
    const signature = this.visibleAssetListSignature(options.contextKey, options.cards);
    if (options.contextKey !== this.visibleListContextKey) {
      this.visibleListContextKey = options.contextKey;
      this.visibleListSignature = signature;
      this.visibleListCardCount = options.cards.length;
      this.visibleListReady = false;
      this.visibleListRenderedCount = 0;
      return null;
    }
    if (signature === this.visibleListSignature) {
      return null;
    }
    const previousCardCount = this.visibleListCardCount;
    this.visibleListSignature = signature;
    this.visibleListCardCount = options.cards.length;
    return this.createVisibleAssetListPatch(options.cards, previousCardCount, options.renderedCount);
  }

  private createVisibleAssetListPatch(
    cards: readonly AppDTOs.AssetDTO[],
    previousCardCount: number,
    renderedCount: number
  ): OwnedAssetsVisibleListPatch | null {
    if (!this.visibleListReady) {
      return null;
    }
    const visibleCount = Math.max(this.visibleListRenderedCount, renderedCount);
    const allCardsWereVisible = visibleCount >= previousCardCount;
    let nextVisibleCount = Math.min(cards.length, visibleCount);

    if (cards.length > previousCardCount && allCardsWereVisible) {
      nextVisibleCount = Math.min(cards.length, visibleCount + 1);
    }

    return {
      items: cards.slice(0, nextVisibleCount),
      total: cards.length
    };
  }

  private visibleAssetListSignature(contextKey: string, cards: readonly AppDTOs.AssetDTO[]): string {
    return `${contextKey}:${cards.map(card => [
      card.id,
      card.type,
      card.title,
      card.subtitle,
      card.city,
      card.capacityTotal,
      card.quantity,
      card.description,
      card.imageUrl,
      card.locationLabel ?? '',
      card.priceLabel ?? '',
      card.policyCount ?? 0,
      card.visibility ?? '',
      card.status ?? '',
      card.ownerUserId ?? '',
      card.ownerName ?? '',
      (card.menuActions ?? []).join(','),
      card.requests.map(request => [
        request.id,
        request.status,
        request.note,
        request.requestKind ?? '',
        request.booking?.quantity ?? '',
        request.booking?.inventoryApplied ?? '',
        (request.menuActions ?? []).join(',')
      ].join('/')).join(',')
    ].join(':')).join('|')}`;
  }
}
