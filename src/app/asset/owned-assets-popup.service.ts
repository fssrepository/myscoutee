import { Injectable, effect, inject, signal } from '@angular/core';

import { DemoAssetBuilder } from '../shared/core/demo/builders';
import { APP_STATIC_DATA } from '../shared/app-static-data';
import type * as AppTypes from '../shared/core/base/models';
import { AssetPopupService } from './asset-popup.service';
import { AppContext, AssetsService } from '../shared/core';

export interface OwnedAssetsRuntimeHooks {
  onAssetsChanged?(): void;
  onAssetCreated?(card: AppTypes.AssetCard): void;
  onAssetDeleted?(cardId: string): void;
  onAssetFormClosed?(): void;
}

@Injectable({
  providedIn: 'root'
})
export class OwnedAssetsPopupService {
  private readonly assetPopupService = inject(AssetPopupService);
  private readonly assetsService = inject(AssetsService);
  private readonly appCtx = inject(AppContext);
  private readonly assetListRevisionRef = signal(0);

  readonly assetTypeOptions: AppTypes.AssetType[] = APP_STATIC_DATA.assetTypeOptions;
  readonly assetFilterOptions: AppTypes.AssetFilterType[] = APP_STATIC_DATA.assetFilterOptions;

  assetFilter: AppTypes.AssetFilterType = 'Car';
  showAssetForm = false;
  editingAssetId: string | null = null;
  pendingAssetDeleteCardId: string | null = null;
  assetForm: Omit<AppTypes.AssetCard, 'id' | 'requests'> = this.buildEmptyAssetForm('Car');
  assetFormVisibility: AppTypes.EventVisibility = 'Public';

  private assetCardsRef: AppTypes.AssetCard[] = [];
  private activePopupFilter: AppTypes.AssetFilterType | null = null;
  private activeOwnerUserId = '';
  private readonly assetVisibilityById: Record<string, AppTypes.EventVisibility> = {};
  private itemActionMenu: { id: string; title: string; openUp: boolean } | null = null;
  private readonly runtimeHooks: OwnedAssetsRuntimeHooks[] = [];
  private pendingPersistSnapshot: AppTypes.AssetCard[] | null = null;
  private pendingPersistOwnerUserId = '';
  private persistTimerId: ReturnType<typeof setTimeout> | null = null;

  readonly assetListRevision = this.assetListRevisionRef.asReadonly();

  get assetCards(): AppTypes.AssetCard[] {
    return this.assetCardsRef;
  }

  set assetCards(cards: AppTypes.AssetCard[]) {
    this.applyAssetCards(cards, { persist: true });
  }

  constructor() {
    effect(() => {
      this.initializeFromUser(this.appCtx.activeUserId().trim());
    });
  }

  registerRuntimeHooks(hooks: OwnedAssetsRuntimeHooks | null): void {
    if (!hooks) {
      return;
    }
    this.runtimeHooks.push(hooks);
  }

  initialize(cards: AppTypes.AssetCard[]): void {
    this.applyAssetCards(cards, { persist: false });
  }

  assetListRevisionValue(): number {
    return this.assetListRevisionRef();
  }

  initializeFromUser(userId: string): void {
    const normalizedUserId = userId.trim();
    this.activeOwnerUserId = normalizedUserId;
    this.pendingAssetDeleteCardId = null;
    this.itemActionMenu = null;
    this.cancelScheduledPersist();
    if (!normalizedUserId) {
      this.applyAssetCards([], { persist: false });
      return;
    }
    this.applyAssetCards(this.assetsService.peekOwnedAssetsByUser(normalizedUserId), { persist: false });
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
    return `Assets · ${filter}`;
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
    return `${this.editingAssetId ? 'Edit' : 'Add'} ${this.assetForm.type}`;
  }

  assetFormRouteStops(): string[] {
    return this.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes);
  }

  pendingAssetDeleteLabel(): string {
    if (!this.pendingAssetDeleteCardId) {
      return '';
    }
    const card = this.assetCardsRef.find(item => item.id === this.pendingAssetDeleteCardId);
    return card ? `Delete ${card.title}?` : 'Delete this item?';
  }

  assetTypeIcon(type: AppTypes.AssetFilterType): string {
    if (type === 'Car') {
      return 'directions_car';
    }
    if (type === 'Accommodation') {
      return 'apartment';
    }
    if (type === 'Ticket') {
      return 'qr_code_2';
    }
    return 'inventory_2';
  }

  assetTypeClass(type: AppTypes.AssetFilterType): string {
    if (type === 'Car') {
      return 'asset-filter-car';
    }
    if (type === 'Accommodation') {
      return 'asset-filter-accommodation';
    }
    if (type === 'Supplies') {
      return 'asset-filter-supplies';
    }
    if (type === 'Ticket') {
      return 'asset-filter-ticket';
    }
    return 'asset-filter-car';
  }

  eventVisibilityClass(option: AppTypes.EventVisibility): string {
    switch (option) {
      case 'Public':
        return 'event-visibility-public';
      case 'Friends only':
        return 'event-visibility-friends';
      default:
        return 'event-visibility-invitation';
    }
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
      this.assetPopupService.prepareTicketPopupOpen();
    }
    this.assetPopupService.setPrimaryVisible(true);
  }

  closePopup(): void {
    this.activePopupFilter = null;
    this.closeAssetForm();
    this.pendingAssetDeleteCardId = null;
    this.itemActionMenu = null;
    this.assetPopupService.resetTicketState();
    this.assetPopupService.setPrimaryVisible(false);
  }

  selectAssetFilter(filter: AppTypes.AssetFilterType): void {
    this.assetFilter = filter;
    this.activePopupFilter = filter;
    if (filter === 'Ticket') {
      this.assetPopupService.prepareTicketPopupOpen();
    }
    this.assetPopupService.setPrimaryVisible(true);
  }

  openAssetForm(card?: AppTypes.AssetCard): void {
    this.itemActionMenu = null;
    this.showAssetForm = true;
    const forcePrivateVisibility = this.isPopupOpen();
    if (card) {
      const imageUrl = this.normalizeAssetImageLink(card.type, card.imageUrl, card.id || card.title);
      const sourceLink = this.normalizeAssetSourceLink(card.sourceLink, imageUrl);
      this.editingAssetId = card.id;
      this.assetFormVisibility = forcePrivateVisibility
        ? 'Invitation only'
        : (this.assetVisibilityById[card.id] ?? 'Public');
      this.assetForm = {
        type: card.type,
        title: card.title,
        subtitle: card.subtitle,
        city: card.city,
        capacityTotal: card.capacityTotal,
        details: card.details,
        imageUrl,
        sourceLink,
        routes: this.normalizeAssetRoutes(card.type, card.routes)
      };
      return;
    }
    this.editingAssetId = null;
    const type = this.activeAssetType();
    this.assetFormVisibility = forcePrivateVisibility ? 'Invitation only' : 'Public';
    this.assetForm = this.buildEmptyAssetForm(type);
  }

  closeAssetForm(): void {
    this.showAssetForm = false;
    this.editingAssetId = null;
    for (const hooks of this.runtimeHooks) {
      hooks.onAssetFormClosed?.();
    }
  }

  setAssetFormRouteStop(index: number, value: string): void {
    const routes = [...this.assetFormRouteStops()];
    if (index < 0 || index >= routes.length) {
      return;
    }
    routes[index] = value;
    this.assetForm.routes = this.normalizeAssetRoutes(this.assetForm.type, routes);
  }

  openAssetFormRouteStopMap(index: number, event?: Event): void {
    event?.stopPropagation();
    const value = this.assetFormRouteStops()[index] ?? '';
    this.openGoogleMapsSearch(value);
  }

  refreshAssetFromSourceLink(): void {
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
    if (!parsed || this.isGoogleMapsLikeLink(parsed.toString())) {
      return;
    }
    const seed = `${this.assetForm.type.toLowerCase()}-${parsed.hostname.replace(/\./g, '-')}${parsed.pathname.replace(/[^\w-]/g, '-')}`;
    if (!this.assetForm.imageUrl.trim()) {
      this.assetForm.imageUrl = DemoAssetBuilder.defaultAssetImage(this.assetForm.type, seed);
    }
    if (!this.assetForm.title.trim()) {
      this.assetForm.title = `${this.assetForm.type} · ${parsed.hostname.replace(/^www\./, '')}`;
    }
    if (!this.assetForm.subtitle.trim()) {
      this.assetForm.subtitle = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1).replace(/[-_/]+/g, ' ') : 'Imported preview';
    }
    if (!this.assetForm.details.trim()) {
      this.assetForm.details = `Preview imported from ${parsed.hostname}. You can adjust the details before saving.`;
    }
  }

  applyAssetImageFile(file: File): void {
    this.revokeObjectUrl(this.assetForm.imageUrl);
    this.assetForm.imageUrl = URL.createObjectURL(file);
  }

  async saveAssetCard(): Promise<void> {
    const title = this.assetForm.title.trim();
    const city = this.assetForm.city.trim();
    const routes = this.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes);
    const accommodationLocation = routes.find(stop => stop.trim().length > 0)?.trim() || '';
    const resolvedCity = this.assetForm.type === 'Accommodation'
      ? accommodationLocation
      : city;
    if (!title) {
      return;
    }
    if (this.assetForm.type === 'Accommodation' && !accommodationLocation) {
      return;
    }
    const imageUrl = this.normalizeAssetImageLink(this.assetForm.type, this.assetForm.imageUrl, title || this.assetForm.subtitle || city);
    const sourceLink = this.normalizeAssetSourceLink(this.assetForm.sourceLink, imageUrl);
    const payload: Omit<AppTypes.AssetCard, 'id' | 'requests'> = {
      type: this.assetForm.type,
      title,
      subtitle: this.assetForm.subtitle.trim() || DemoAssetBuilder.defaultAssetSubtitle(this.assetForm.type),
      city: resolvedCity,
      capacityTotal: Math.max(1, Number(this.assetForm.capacityTotal) || (this.assetForm.type === 'Supplies' ? 6 : 4)),
      details: this.assetForm.details.trim() || DemoAssetBuilder.defaultAssetDetails(this.assetForm.type),
      imageUrl,
      sourceLink,
      routes
    };
    const resolvedVisibility: AppTypes.EventVisibility = this.isPopupOpen() ? 'Invitation only' : this.assetFormVisibility;
    const ownerUserId = this.resolveOwnerUserId();
    if (this.editingAssetId) {
      const editingAssetId = this.editingAssetId;
      const existing = this.assetCardsRef.find(card => card.id === editingAssetId);
      const nextCard: AppTypes.AssetCard = {
        id: editingAssetId,
        ...payload,
        requests: existing?.requests.map(request => ({ ...request })) ?? []
      };
      this.assetVisibilityById[editingAssetId] = resolvedVisibility;
      this.applyAssetCards(this.assetCardsRef.map(card =>
        card.id === this.editingAssetId
          ? nextCard
          : card
      ), { persist: false });
      for (const hooks of this.runtimeHooks) {
        hooks.onAssetsChanged?.();
      }
      this.closeAssetForm();
      if (ownerUserId) {
        const savedCard = await this.assetsService.saveOwnedAsset(ownerUserId, nextCard);
        if (this.activeOwnerUserId === ownerUserId) {
          this.applyAssetCards(this.assetCardsRef.map(card => card.id === savedCard.id ? savedCard : card), { persist: false });
        }
      }
      return;
    }
    const id = `asset-${Date.now()}`;
    this.assetVisibilityById[id] = resolvedVisibility;
    const nextCard: AppTypes.AssetCard = {
      id,
      ...payload,
      requests: []
    };
    this.applyAssetCards([nextCard, ...this.assetCardsRef], { persist: false });
    for (const hooks of this.runtimeHooks) {
      hooks.onAssetCreated?.(nextCard);
      hooks.onAssetsChanged?.();
    }
    this.closeAssetForm();
    if (ownerUserId) {
      const savedCard = await this.assetsService.saveOwnedAsset(ownerUserId, nextCard);
      if (this.activeOwnerUserId === ownerUserId) {
        this.applyAssetCards(this.assetCardsRef.map(card => card.id === savedCard.id ? savedCard : card), { persist: false });
      }
    }
  }

  canOpenAssetMap(card: AppTypes.AssetCard): boolean {
    if (card.type !== 'Accommodation') {
      return false;
    }
    return this.normalizeAssetRoutes(card.type, card.routes).some(stop => stop.trim().length > 0);
  }

  openAssetMap(card: AppTypes.AssetCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenAssetMap(card)) {
      return;
    }
    const routes = this.normalizeAssetRoutes(card.type, card.routes);
    this.openGoogleMapsSearch(routes[0] ?? card.city);
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
    this.itemActionMenu = null;
  }

  cancelAssetDelete(): void {
    this.pendingAssetDeleteCardId = null;
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
    this.applyAssetCards(this.assetCardsRef.filter(card => card.id !== normalizedCardId), { persist: false });
    for (const hooks of this.runtimeHooks) {
      hooks.onAssetDeleted?.(normalizedCardId);
      hooks.onAssetsChanged?.();
    }
    return true;
  }

  async confirmAssetDelete(): Promise<void> {
    if (!this.pendingAssetDeleteCardId) {
      return;
    }
    const cardId = this.pendingAssetDeleteCardId;
    this.pendingAssetDeleteCardId = null;
    await this.deleteAssetCardById(cardId);
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

  private buildEmptyAssetForm(type: AppTypes.AssetType): Omit<AppTypes.AssetCard, 'id' | 'requests'> {
    return {
      type,
      title: '',
      subtitle: '',
      city: '',
      capacityTotal: type === 'Supplies' ? 6 : 4,
      details: '',
      imageUrl: '',
      sourceLink: '',
      routes: this.normalizeAssetRoutes(type, [])
    };
  }

  private normalizeAssetMediaLinks(): void {
    this.assetCardsRef = this.assetCardsRef.map(card => {
      const imageUrl = this.normalizeAssetImageLink(card.type, card.imageUrl, card.id || card.title);
      const sourceLink = this.normalizeAssetSourceLink(card.sourceLink, imageUrl);
      return {
        ...card,
        imageUrl,
        sourceLink
      };
    });
  }

  private normalizeAssetImageLink(type: AppTypes.AssetType, imageUrl: string | null | undefined, seed: string): string {
    const trimmed = (imageUrl ?? '').trim();
    if (!trimmed || this.isGoogleMapsLikeLink(trimmed) || this.isLegacyGeneratedAssetImage(trimmed)) {
      return DemoAssetBuilder.defaultAssetImage(type, seed || type.toLowerCase());
    }
    return trimmed;
  }

  private normalizeAssetSourceLink(sourceLink: string | null | undefined, fallbackImageUrl: string): string {
    const trimmed = (sourceLink ?? '').trim();
    if (!trimmed || this.isGoogleMapsLikeLink(trimmed) || this.isLegacyGeneratedAssetImage(trimmed)) {
      return fallbackImageUrl;
    }
    return trimmed;
  }

  private isGoogleMapsLikeLink(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.includes('google.com/maps')
      || normalized.includes('maps.google.')
      || normalized.includes('goo.gl/maps');
  }

  private isLegacyGeneratedAssetImage(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }
    return normalized.includes('loremflickr.com/');
  }

  private normalizeAssetRoutes(type: AppTypes.AssetType, routes: string[] | undefined | null): string[] {
    if (type === 'Supplies') {
      return [];
    }
    const cleaned = (routes ?? [])
      .map(value => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
    if (type === 'Accommodation') {
      return cleaned.length > 0 ? [cleaned[0]] : [''];
    }
    return cleaned.length > 0 ? cleaned : [''];
  }

  private applyAssetCards(
    cards: readonly AppTypes.AssetCard[],
    options: { persist?: boolean } = {}
  ): void {
    this.assetCardsRef = cards.map(card => ({
      ...card,
      routes: [...(card.routes ?? [])],
      requests: card.requests.map(request => ({ ...request }))
    }));
    this.normalizeAssetMediaLinks();
    this.assetListRevisionRef.update(value => value + 1);
    if (options.persist) {
      this.schedulePersist();
    }
  }

  private async refreshOwnedAssetsFromRepository(ownerUserId: string): Promise<void> {
    const cards = await this.assetsService.queryOwnedAssetsByUser(ownerUserId);
    if (this.activeOwnerUserId !== ownerUserId) {
      return;
    }
    this.applyAssetCards(cards, { persist: false });
  }

  private resolveOwnerUserId(): string {
    return this.activeOwnerUserId.trim() || this.appCtx.getActiveUserId().trim();
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
      requests: card.requests.map(request => ({ ...request }))
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
}
