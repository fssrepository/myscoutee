import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { LazyBgImageDirective } from '../../shared/lazy-bg-image.directive';
import { EventEditorAssetCard, EventEditorAssetFilterType, EventEditorAssetType } from './event-editor-assets-popup.models';

type AssetForm = Omit<EventEditorAssetCard, 'id' | 'requests'>;

@Component({
  selector: 'app-event-editor-assets-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatSelectModule, LazyBgImageDirective],
  templateUrl: './event-editor-assets-popup.component.html'
})
export class EventEditorAssetsPopupComponent implements OnChanges, OnDestroy {
  @Input() cards: EventEditorAssetCard[] = [];
  @Input() filter: EventEditorAssetFilterType = 'Car';
  @Input() isMobileView = false;
  @Input() readOnly = false;

  @Output() filterChange = new EventEmitter<EventEditorAssetFilterType>();
  @Output() upsertCard = new EventEmitter<EventEditorAssetCard>();
  @Output() deleteCard = new EventEmitter<string>();

  @ViewChild('assetImageInput')
  private assetImageInput?: ElementRef<HTMLInputElement>;

  protected readonly assetTypeOptions: EventEditorAssetType[] = ['Car', 'Accommodation', 'Supplies'];
  protected readonly assetFilterOptions: EventEditorAssetFilterType[] = ['Car', 'Accommodation', 'Supplies'];

  protected assetFilter: EventEditorAssetFilterType = 'Car';
  protected localCards: EventEditorAssetCard[] = [];

  protected showAssetForm = false;
  protected editingAssetId: string | null = null;
  protected pendingAssetDeleteCardId: string | null = null;
  protected inlineAssetActionMenu: { id: string; openUp: boolean } | null = null;

  protected assetForm: AssetForm = this.defaultAssetForm('Car');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cards']) {
      this.localCards = this.cards.map(card => this.normalizeCard(card));
    }
    if (changes['filter']) {
      this.assetFilter = this.normalizeFilter(this.filter);
    }
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl(this.assetForm.imageUrl);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.inlineAssetActionMenu) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      this.inlineAssetActionMenu = null;
      return;
    }
    if (!target.closest('.item-action-menu') && !target.closest('.experience-action-menu-trigger')) {
      this.inlineAssetActionMenu = null;
    }
  }

  protected trackByCardId(_: number, card: EventEditorAssetCard): string {
    return card.id;
  }

  protected assetFilterPanelWidth(): string | null {
    return '280px';
  }

  protected assetTypeIcon(type: EventEditorAssetFilterType): string {
    if (type === 'Car') {
      return 'directions_car';
    }
    if (type === 'Accommodation') {
      return 'apartment';
    }
    return 'inventory_2';
  }

  protected assetTypeClass(type: EventEditorAssetFilterType): string {
    if (type === 'Car') {
      return 'asset-filter-car';
    }
    if (type === 'Accommodation') {
      return 'asset-filter-accommodation';
    }
    return 'asset-filter-supplies';
  }

  protected selectAssetFilter(next: EventEditorAssetFilterType): void {
    const normalized = this.normalizeFilter(next);
    this.assetFilter = normalized;
    this.filterChange.emit(normalized);
  }

  protected get filteredAssetCards(): EventEditorAssetCard[] {
    return this.localCards.filter(card => card.type === this.assetFilter);
  }

  protected canOpenAssetMap(card: EventEditorAssetCard): boolean {
    if (card.type !== 'Accommodation') {
      return false;
    }
    return this.normalizeAssetRoutes(card.type, card.routes, card.city).some(stop => stop.trim().length > 0);
  }

  protected openAssetMap(card: EventEditorAssetCard, event?: Event): void {
    event?.stopPropagation();
    if (!this.canOpenAssetMap(card)) {
      return;
    }
    const routes = this.normalizeAssetRoutes(card.type, card.routes, card.city);
    this.openGoogleMapsSearch(routes[0] ?? card.city);
  }

  protected openAssetForm(card?: EventEditorAssetCard): void {
    this.showAssetForm = true;
    if (card) {
      this.editingAssetId = card.id;
      this.assetForm = {
        type: card.type,
        title: card.title,
        subtitle: card.subtitle,
        city: card.city,
        capacityTotal: card.capacityTotal,
        details: card.details,
        imageUrl: this.normalizeAssetImageLink(card.type, card.imageUrl, card.id || card.title),
        sourceLink: this.normalizeAssetSourceLink(card.sourceLink, card.imageUrl),
        routes: this.normalizeAssetRoutes(card.type, card.routes, '')
      };
      return;
    }
    this.editingAssetId = null;
    this.assetForm = this.defaultAssetForm(this.assetFilter);
  }

  protected closeAssetForm(): void {
    this.showAssetForm = false;
    this.editingAssetId = null;
  }

  protected get assetFormTitle(): string {
    return `${this.editingAssetId ? 'Edit' : 'Add'} ${this.assetForm.type}`;
  }

  protected get assetFormRouteStops(): string[] {
    return this.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes, '');
  }

  protected onAssetFormRouteStopChange(index: number, value: string): void {
    const routes = [...this.assetFormRouteStops];
    if (index < 0 || index >= routes.length) {
      return;
    }
    routes[index] = value;
    this.assetForm.routes = this.normalizeAssetRoutes(this.assetForm.type, routes, '');
  }

  protected openAssetFormRouteStopMap(index: number, event?: Event): void {
    event?.stopPropagation();
    const value = this.assetFormRouteStops[index] ?? '';
    this.openGoogleMapsSearch(value);
  }

  protected saveAssetCard(): void {
    const title = this.assetForm.title.trim();
    const city = this.assetForm.city.trim();
    const routes = this.normalizeAssetRoutes(this.assetForm.type, this.assetForm.routes, '');
    const accommodationLocation = routes.find(stop => stop.trim().length > 0)?.trim() || '';
    const resolvedCity = this.assetForm.type === 'Accommodation' ? accommodationLocation : city;
    if (!title) {
      return;
    }
    if (this.assetForm.type === 'Accommodation' && !accommodationLocation) {
      return;
    }

    const imageUrl = this.normalizeAssetImageLink(this.assetForm.type, this.assetForm.imageUrl, title || this.assetForm.subtitle || city);
    const sourceLink = this.normalizeAssetSourceLink(this.assetForm.sourceLink, imageUrl);
    const existing = this.editingAssetId ? this.localCards.find(card => card.id === this.editingAssetId) ?? null : null;
    const resolvedId = existing?.id ?? `asset-${Date.now()}`;
    const upsert: EventEditorAssetCard = {
      id: resolvedId,
      type: this.assetForm.type,
      title,
      subtitle: this.assetForm.subtitle.trim() || this.defaultAssetSubtitle(this.assetForm.type),
      city: resolvedCity,
      capacityTotal: Math.max(1, Number(this.assetForm.capacityTotal) || (this.assetForm.type === 'Supplies' ? 6 : 4)),
      details: this.assetForm.details.trim() || this.defaultAssetDetails(this.assetForm.type),
      imageUrl,
      sourceLink,
      routes,
      requests: existing?.requests ? [...existing.requests] : []
    };

    this.localCards = this.localCards.some(card => card.id === upsert.id)
      ? this.localCards.map(card => (card.id === upsert.id ? upsert : card))
      : [upsert, ...this.localCards];
    this.upsertCard.emit(upsert);
    this.closeAssetForm();
  }

  protected requestAssetDelete(cardId: string): void {
    this.pendingAssetDeleteCardId = cardId;
  }

  protected cancelAssetDelete(): void {
    this.pendingAssetDeleteCardId = null;
  }

  protected pendingAssetDeleteLabel(): string {
    if (!this.pendingAssetDeleteCardId) {
      return '';
    }
    const card = this.localCards.find(item => item.id === this.pendingAssetDeleteCardId);
    return card ? `Delete ${card.title}?` : 'Delete this item?';
  }

  protected confirmAssetDelete(): void {
    if (!this.pendingAssetDeleteCardId) {
      return;
    }
    const id = this.pendingAssetDeleteCardId;
    this.localCards = this.localCards.filter(card => card.id !== id);
    this.deleteCard.emit(id);
    this.pendingAssetDeleteCardId = null;
  }

  protected toggleAssetItemActionMenu(card: EventEditorAssetCard, event: Event): void {
    event.stopPropagation();
    if (this.inlineAssetActionMenu?.id === card.id) {
      this.inlineAssetActionMenu = null;
      return;
    }
    this.inlineAssetActionMenu = {
      id: card.id,
      openUp: this.shouldOpenInlineItemMenuUp(event)
    };
  }

  protected isAssetItemActionMenuOpen(card: EventEditorAssetCard): boolean {
    return this.inlineAssetActionMenu?.id === card.id;
  }

  protected isAssetItemActionMenuOpenUp(card: EventEditorAssetCard): boolean {
    return this.inlineAssetActionMenu?.id === card.id && this.inlineAssetActionMenu.openUp;
  }

  protected runAssetItemEditAction(card: EventEditorAssetCard, event: Event): void {
    event.stopPropagation();
    this.openAssetForm(card);
    this.inlineAssetActionMenu = null;
  }

  protected runAssetItemDeleteAction(card: EventEditorAssetCard, event: Event): void {
    event.stopPropagation();
    this.requestAssetDelete(card.id);
    this.inlineAssetActionMenu = null;
  }

  protected triggerAssetImageUpload(event?: Event): void {
    event?.stopPropagation();
    this.assetImageInput?.nativeElement.click();
  }

  protected onAssetImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    this.revokeObjectUrl(this.assetForm.imageUrl);
    this.assetForm.imageUrl = URL.createObjectURL(file);
    target.value = '';
  }

  protected refreshAssetFromSourceLink(): void {
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
      this.assetForm.imageUrl = this.defaultAssetImage(this.assetForm.type, seed);
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

  private normalizeFilter(filter: EventEditorAssetFilterType): EventEditorAssetFilterType {
    if (filter === 'Accommodation' || filter === 'Supplies') {
      return filter;
    }
    return 'Car';
  }

  private defaultAssetForm(type: EventEditorAssetType): AssetForm {
    return {
      type,
      title: '',
      subtitle: '',
      city: '',
      capacityTotal: type === 'Supplies' ? 6 : 4,
      details: '',
      imageUrl: '',
      sourceLink: '',
      routes: this.normalizeAssetRoutes(type, [], '')
    };
  }

  private normalizeCard(card: EventEditorAssetCard): EventEditorAssetCard {
    const imageUrl = this.normalizeAssetImageLink(card.type, card.imageUrl, card.id || card.title);
    const sourceLink = this.normalizeAssetSourceLink(card.sourceLink, imageUrl);
    return {
      ...card,
      imageUrl,
      sourceLink,
      routes: this.normalizeAssetRoutes(card.type, card.routes, card.city)
    };
  }

  private normalizeAssetImageLink(type: EventEditorAssetType, imageUrl: string | null | undefined, seed: string): string {
    const trimmed = (imageUrl ?? '').trim();
    if (!trimmed || this.isGoogleMapsLikeLink(trimmed) || this.isLegacyGeneratedAssetImage(trimmed)) {
      return this.defaultAssetImage(type, seed || type.toLowerCase());
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

  private normalizeAssetRoutes(type: EventEditorAssetType, routes: string[] | undefined | null, _cityFallback: string): string[] {
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

  private openGoogleMapsSearch(query: string): void {
    const trimmed = query.trim();
    if (!trimmed || typeof window === 'undefined') {
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
    window.open(url, '_blank', 'noopener');
  }

  private shouldOpenInlineItemMenuUp(event: Event): boolean {
    if (this.isMobileView || typeof window === 'undefined') {
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

  private revokeObjectUrl(value: string | null): void {
    if (value && value.startsWith('blob:')) {
      URL.revokeObjectURL(value);
    }
  }

  private defaultAssetImage(type: EventEditorAssetType, seed = type.toLowerCase()): string {
    const flavor = type === 'Car'
      ? 'road'
      : type === 'Accommodation'
        ? 'stay'
        : 'gear';
    const normalizedSeed = encodeURIComponent(`${type.toLowerCase()}-${flavor}-${seed || type.toLowerCase()}`);
    return `https://picsum.photos/seed/${normalizedSeed}/1200/700`;
  }

  private defaultAssetSubtitle(type: EventEditorAssetType): string {
    if (type === 'Car') {
      return 'Shared ride';
    }
    if (type === 'Accommodation') {
      return 'Stay details';
    }
    return 'Supply bundle';
  }

  private defaultAssetDetails(type: EventEditorAssetType): string {
    if (type === 'Car') {
      return 'Coordinate pickup time and luggage details in chat.';
    }
    if (type === 'Accommodation') {
      return 'Share check-in timing and house rules.';
    }
    return 'List what is included and who can pick it up.';
  }
}
