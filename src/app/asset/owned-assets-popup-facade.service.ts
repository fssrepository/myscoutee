import { Injectable, effect, inject } from '@angular/core';

import { OwnedAssetsStore } from '../shared/ui/context/stores/owned-assets.store';
import { AssetPopupStore } from '../shared/ui/context/stores/asset-popup.store';
import { AppContext } from '../shared/ui';
import { AssetCardBuilder, AssetsService, AssetTicketsService, ExplanationGuideService } from '../shared/core';
import { AssetCardDto } from '../shared/core/contracts';

import type * as AppDTOs from '../shared/core/contracts';
import type * as AppConstants from '../shared/core/common/constants';

@Injectable({
  providedIn: 'root'
})
export class OwnedAssetsPopupFacadeService {
  private readonly assetPopupStore = inject(AssetPopupStore);
  private readonly ownedAssetsStore = inject(OwnedAssetsStore);
  private readonly assetsService = inject(AssetsService);
  private readonly assetTicketsService = inject(AssetTicketsService);
  private readonly appCtx = inject(AppContext);
  private readonly explanationGuide = inject(ExplanationGuideService);

  private pendingPersistSnapshot: AppDTOs.AssetDTO[] | null = null;
  private pendingPersistOwnerUserId = '';
  private persistTimerId: ReturnType<typeof setTimeout> | null = null;
  private assetMutationVersion = 0;
  private trackedAssetRefreshToken = 0;
  private trackedAssetRefreshOwnerUserId = '';
  private trackedAssetRefreshPromise: Promise<void> | null = null;
  private assetsExplanationContextKey: string | null = null;
  private unregisterAssetsExplanationContext: (() => void) | null = null;

  constructor() {
    effect(() => {
      this.initializeFromUser(this.resolveContextOwnerUserId());
    });
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
    if (!this.ownedAssetsStore.setActiveOwnerUserId(normalizedUserId)) {
      return;
    }
    this.ownedAssetsStore.resetAssetDeleteDialog();
    this.cancelScheduledPersist();
    this.touchUiState();
    if (!normalizedUserId) {
      this.applyAssetCards([], { persist: false, reloadList: false });
      return;
    }
    this.applyAssetCards(this.assetsService.peekOwnedAssetsByUser(normalizedUserId), { persist: false, reloadList: false });
    void this.refreshOwnedAssetsFromRepository(normalizedUserId);
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
    const existing = this.ownedAssetsStore.assetCards().find(card => card.id === normalizedAssetId) ?? null;
    if (!existing) {
      return;
    }

    let nextQuantity = AssetCardBuilder.storedQuantityValue(existing);
    const nextRequests = existing.requests
      .map(request => AssetCardBuilder.cloneRequest(request))
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

    const nextCard: AppDTOs.AssetDTO = AssetCardBuilder.cloneCard({
      ...existing,
      quantity: nextQuantity,
      requests: nextRequests
    });

    const ownerUserId = this.resolveOwnerUserId();
    this.markAssetMutation();
    this.applyAssetCards(this.ownedAssetsStore.assetCards().map(card => (
      card.id === normalizedAssetId ? nextCard : card
    )), { persist: false, reloadList: false });
    const persistPromise = ownerUserId
      ? this.assetsService.saveOwnedAsset(ownerUserId, nextCard).then(savedCard => {
          if (this.ownedAssetsStore.isActiveOwnerUser(ownerUserId)) {
            this.applyAssetCards(this.ownedAssetsStore.assetCards().map(card => card.id === savedCard.id ? savedCard : card), {
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
    const existing = this.ownedAssetsStore.assetCards().find(card => card.id === normalizedAssetId) ?? null;
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
    this.applyAssetCards(this.ownedAssetsStore.assetCards().map(card => card.id === savedCard.id ? savedCard : card), {
      persist: false,
      reloadList: false
    });
    this.touchUiState();
  }

  openPopup(filter: AppConstants.AssetFilterType): void {
    this.ownedAssetsStore.openAssetPopup(filter);
    if (filter === 'Ticket') {
      this.assetPopupStore.prepareTicketPopupOpen(this.ticketCountForActiveUser());
    } else {
      void this.refreshOwnedAssetsFromRepository(this.resolveOwnerUserId(), { trackLoading: true });
    }
    this.setAssetsExplanationContext(this.assetExplanationContextForFilter(filter));
    this.assetPopupStore.primaryVisibleRef.set(true);
    this.touchUiState();
  }

  closePopup(): void {
    this.ownedAssetsStore.closeAssetPopup();
    this.assetPopupStore.resetTicketState();
    this.clearAssetsExplanationContext();
    this.assetPopupStore.primaryVisibleRef.set(false);
    this.touchUiState();
  }

  selectAssetFilter(filter: AppConstants.AssetFilterType): void {
    this.ownedAssetsStore.selectAssetFilter(filter);
    if (filter === 'Ticket') {
      this.assetPopupStore.prepareTicketPopupOpen(this.ticketCountForActiveUser());
    } else {
      void this.refreshOwnedAssetsFromRepository(this.resolveOwnerUserId(), { trackLoading: true });
    }
    this.setAssetsExplanationContext(this.assetExplanationContextForFilter(filter));
    this.assetPopupStore.primaryVisibleRef.set(true);
    this.touchUiState();
  }

  async deleteAssetCardById(cardId: string): Promise<boolean> {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return false;
    }
    const cardExists = this.ownedAssetsStore.assetCards().some(card => card.id === normalizedCardId);
    if (!cardExists) {
      return false;
    }
    const ownerUserId = this.resolveOwnerUserId();
    if (ownerUserId) {
      await this.assetsService.deleteOwnedAsset(ownerUserId, normalizedCardId);
    }
    this.markAssetMutation();
    this.applyAssetCards(this.ownedAssetsStore.assetCards().filter(card => card.id !== normalizedCardId), {
      persist: false,
      reloadList: false
    });
    this.ownedAssetsStore.recordAssetDeleted(normalizedCardId);
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
    const current = this.ownedAssetsStore.assetCards().find(card => card.id === normalizedCardId);
    if (!current) {
      return;
    }
    const nextStatus = AssetCardBuilder.restoredAssetStatus(current);
    const ownerName = this.appCtx.userProfileStore.activeUserProfile()?.name?.trim() || current.ownerName;
    const nextCard: AppDTOs.AssetDTO = {
      ...current,
      ownerUserId,
      ownerName,
      status: nextStatus,
      menuActions: this.restoredTakeOverMenuActions(current, null)
    };
    this.markAssetMutation();
    this.applyAssetCards(this.ownedAssetsStore.assetCards().map(card =>
      card.id === normalizedCardId
        ? nextCard
        : card
    ), {
      persist: false,
      reloadList: false
    });
    this.touchUiState();

    const savedCard = await this.assetsService.takeOverOwnedAsset(ownerUserId, normalizedCardId);
    if (this.resolveOwnerUserId() !== ownerUserId || !savedCard) {
      return;
    }
    const resolvedStatus = AssetCardBuilder.normalizeAssetStatus(savedCard.status);
    const reconciledCard: AppDTOs.AssetDTO = {
      ...nextCard,
      ...savedCard,
      ownerUserId: savedCard.ownerUserId ?? ownerUserId,
      ownerName: savedCard.ownerName ?? ownerName,
      status: resolvedStatus === 'UR' ? nextStatus : resolvedStatus,
      menuActions: this.restoredTakeOverMenuActions(nextCard, savedCard)
    };
    this.applyAssetCards(this.ownedAssetsStore.assetCards().map(card =>
      card.id === normalizedCardId ? reconciledCard : card
    ), {
      persist: false,
      reloadList: false
    });
    this.touchUiState();
  }

  public applyAssetCards(
    cards: readonly AppDTOs.AssetDTO[],
    options: { persist?: boolean; reloadList?: boolean; mutation?: boolean } = {}
  ): void {
    const nextCards = AssetCardBuilder.normalizeAssetMediaCards(AssetCardBuilder.cloneCards(cards));
    if (AssetCardDto.listEquals(this.ownedAssetsStore.assetCards(), nextCards)) {
      return;
    }
    if (options.mutation === true) {
      this.markAssetMutation();
    }
    this.ownedAssetsStore.setAssetCards(nextCards);
    this.ownedAssetsStore.bumpAssetListRevision(options.reloadList !== false);
    if (options.persist) {
      this.schedulePersist();
    }
  }

  private restoredTakeOverMenuActions(
    current: AppDTOs.AssetDTO,
    savedCard: AppDTOs.AssetDTO | null | undefined
  ): string[] {
    const savedStatus = AssetCardBuilder.normalizeAssetStatus(savedCard?.status);
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
      this.ownedAssetsStore.setAssetListLoading(true);
    }
    const refreshPromise = (async () => {
      try {
        const cards = await this.assetsService.queryOwnedAssetsByUser(normalizedOwnerUserId);
        if (
          !this.ownedAssetsStore.isActiveOwnerUser(normalizedOwnerUserId)
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
          this.ownedAssetsStore.setAssetListLoading(false);
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
    this.ownedAssetsStore.touchUiState();
  }

  private resolveOwnerUserId(): string {
    return this.ownedAssetsStore.activeOwnerUserIdRef().trim() || this.appCtx.userProfileStore.getActiveUserId().trim();
  }

  private resolveContextOwnerUserId(): string {
    return this.appCtx.userProfileStore.activeUserProfile()?.id?.trim() || this.appCtx.userProfileStore.activeUserId().trim();
  }

  private ticketCountForActiveUser(): number {
    return this.assetTicketsService.peekTicketCountByUser(this.appCtx.userProfileStore.activeUserId().trim());
  }

  private schedulePersist(): void {
    const ownerUserId = this.resolveOwnerUserId();
    if (!ownerUserId) {
      return;
    }
    this.pendingPersistOwnerUserId = ownerUserId;
    this.pendingPersistSnapshot = AssetCardBuilder.cloneCards(this.ownedAssetsStore.assetCards());
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

  private assetRequestQuantity(request: AppDTOs.AssetMemberRequestDTO): number {
    return Math.max(1, Math.trunc(Number(request.booking?.quantity) || 0));
  }
}
