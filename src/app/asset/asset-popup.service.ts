import { Injectable, NgZone, computed, inject, signal } from '@angular/core';

import type * as AppTypes from '../shared/app-types';
import { AppContext } from '../shared/core';
import type { AssetPopupHost } from './asset-popup.host';

export interface AssetTicketBridge {
  ticketRowsSource(): AppTypes.ActivityListRow[];
  createTicketScanPayload(row: AppTypes.ActivityListRow): AppTypes.TicketScanPayload;
  ticketPayloadAvatarUrl(payload: AppTypes.TicketScanPayload | null): string;
  ticketPayloadInitials(payload: AppTypes.TicketScanPayload): string;
}

@Injectable({ providedIn: 'root' })
export class AssetPopupService {
  private readonly ngZone = inject(NgZone);
  private readonly appCtx = inject(AppContext);

  private readonly hostRef = signal<AssetPopupHost | null>(null);
  private readonly ticketBridgeRef = signal<AssetTicketBridge | null>(null);
  private readonly primaryVisibleRef = signal(false);
  private readonly stackedVisibleRef = signal(false);
  private readonly basketVisibleRef = signal(false);

  private readonly ticketOverlayModeRef = signal<'ticketCode' | 'ticketScanner' | null>(null);
  private readonly ticketStickyValueRef = signal('');
  private readonly ticketDateOrderRef = signal<'upcoming' | 'past'>('upcoming');
  private readonly showTicketOrderPickerRef = signal(false);
  private readonly selectedTicketRowRef = signal<AppTypes.ActivityListRow | null>(null);
  private readonly selectedTicketCodeValueRef = signal('');
  private readonly ticketScannerStateRef = signal<'idle' | 'reading' | 'success'>('idle');
  private readonly ticketScannerResultRef = signal<AppTypes.TicketScanPayload | null>(null);

  readonly host = this.hostRef.asReadonly();
  readonly visible = computed(() =>
    this.primaryVisibleRef()
    || this.stackedVisibleRef()
    || this.basketVisibleRef()
    || this.appCtx.activityInvitePopup() !== null
    || this.ticketOverlayModeRef() !== null
  );

  private ticketScannerTimer: ReturnType<typeof setTimeout> | null = null;
  private ticketScannerMediaStream: MediaStream | null = null;
  private ticketScannerDetectionFrame: number | null = null;
  private ticketScannerDetectBusy = false;
  private ticketScrollElement: HTMLDivElement | null = null;
  private ticketScannerVideoElement: HTMLVideoElement | null = null;
  private ticketListScrollable = true;

  registerHost(host: AssetPopupHost | null): void {
    this.hostRef.set(host);
  }

  registerTicketBridge(bridge: AssetTicketBridge | null): void {
    this.ticketBridgeRef.set(bridge);
  }

  syncVisibility(isPrimaryOpen: boolean, isStackedOpen: boolean, isBasketOpen = false): void {
    this.primaryVisibleRef.set(isPrimaryOpen);
    this.stackedVisibleRef.set(isStackedOpen);
    this.basketVisibleRef.set(isBasketOpen);
  }

  openActivityInvite(request: { ownerId: string; title?: string }): void {
    this.appCtx.openActivityInvitePopup(request);
  }

  closeActivityInvite(): void {
    this.appCtx.closeActivityInvitePopup();
  }

  prepareTicketPopupOpen(): void {
    this.showTicketOrderPickerRef.set(false);
    this.selectedTicketRowRef.set(null);
    this.selectedTicketCodeValueRef.set('');
    this.ticketScannerStateRef.set('idle');
    this.ticketScannerResultRef.set(null);
    this.ticketOverlayModeRef.set(null);
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
    this.seedTicketStickyHeader();
    setTimeout(() => this.syncTicketScrollOnOpen(), 0);
  }

  resetTicketState(): void {
    this.ticketStickyValueRef.set('');
    this.showTicketOrderPickerRef.set(false);
    this.selectedTicketRowRef.set(null);
    this.selectedTicketCodeValueRef.set('');
    this.ticketScannerStateRef.set('idle');
    this.ticketScannerResultRef.set(null);
    this.ticketOverlayModeRef.set(null);
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
  }

  isTicketOverlayOpen(): boolean {
    return this.ticketOverlayModeRef() !== null;
  }

  ticketOverlayMode(): 'ticketCode' | 'ticketScanner' | null {
    return this.ticketOverlayModeRef();
  }

  ticketRows(): AppTypes.ActivityListRow[] {
    const bridge = this.ticketBridgeRef();
    const order = this.ticketDateOrderRef();
    const rows = bridge ? [...bridge.ticketRowsSource()] : [];
    rows.sort((a, b) => this.toSortableDate(a.dateIso) - this.toSortableDate(b.dateIso));
    return order === 'upcoming' ? rows.reverse() : rows;
  }

  groupedTicketRows(): AppTypes.ActivityGroup[] {
    const grouped: AppTypes.ActivityGroup[] = [];
    for (const row of this.ticketRows()) {
      const label = this.ticketGroupLabel(row.dateIso);
      const lastGroup = grouped[grouped.length - 1];
      if (!lastGroup || lastGroup.label !== label) {
        grouped.push({ label, rows: [row] });
        continue;
      }
      lastGroup.rows.push(row);
    }
    return grouped;
  }

  ticketStickyHeader(): string {
    return this.ticketStickyValueRef() || this.groupedTicketRows()[0]?.label || 'No tickets';
  }

  ticketHeaderSummary(): string {
    const count = this.ticketRows().length;
    return count === 1 ? '1 ticketed event' : `${count} ticketed events`;
  }

  showTicketOrderPicker(): boolean {
    return this.showTicketOrderPickerRef();
  }

  closeTicketOrderPicker(): void {
    this.showTicketOrderPickerRef.set(false);
  }

  ticketDateOrderLabel(): string {
    return this.ticketDateOrderRef() === 'upcoming' ? 'Upcoming' : 'Past';
  }

  ticketDateOrderIcon(): string {
    return this.ticketDateOrderRef() === 'upcoming' ? 'schedule' : 'history';
  }

  toggleTicketOrderPicker(event?: Event): void {
    event?.stopPropagation();
    this.showTicketOrderPickerRef.update(value => !value);
  }

  selectTicketDateOrder(order: 'upcoming' | 'past', event?: Event): void {
    event?.stopPropagation();
    if (this.ticketDateOrderRef() === order) {
      this.showTicketOrderPickerRef.set(false);
      return;
    }
    this.ticketDateOrderRef.set(order);
    this.showTicketOrderPickerRef.set(false);
    this.seedTicketStickyHeader();
    setTimeout(() => this.syncTicketScrollOnOpen(), 0);
  }

  onTicketScroll(event: Event): void {
    const target = event.target as HTMLElement | null;
    this.updateTicketStickyHeader(target?.scrollTop || 0);
  }

  selectedTicketRow(): AppTypes.ActivityListRow | null {
    return this.selectedTicketRowRef();
  }

  openTicketCodePopup(row: AppTypes.ActivityListRow, event?: Event): void {
    event?.stopPropagation();
    this.selectedTicketRowRef.set(row);
    this.selectedTicketCodeValueRef.set(this.encodeTicketPayload(this.createTicketScanPayload(row)));
    this.ticketScannerResultRef.set(null);
    this.ticketScannerStateRef.set('idle');
    this.ticketOverlayModeRef.set('ticketCode');
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
  }

  ticketCodeAvatarUrl(): string {
    return this.ticketPayloadAvatarUrl(this.selectedTicketPayload());
  }

  ticketCodeInitials(): string {
    const payload = this.selectedTicketPayload();
    if (!payload) {
      return '';
    }
    return this.ticketPayloadInitials(payload);
  }

  ticketCodePersonLine(): string {
    const payload = this.selectedTicketPayload();
    if (!payload) {
      return '';
    }
    return `${payload.holderName}, ${payload.holderAge} · ${payload.holderCity}`;
  }

  ticketCodeRoleEventLine(): string {
    const payload = this.selectedTicketPayload();
    if (!payload) {
      return '';
    }
    return `${payload.holderRole} · ${payload.eventTitle}`;
  }

  ticketCodeDateLine(): string {
    const payload = this.selectedTicketPayload();
    if (!payload) {
      return '';
    }
    return payload.eventTimeframe || payload.eventDateLabel;
  }

  ticketQrImageUrl(): string {
    const value = this.selectedTicketCodeValueRef();
    if (!value) {
      return '';
    }
    const payload = encodeURIComponent(value);
    return `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&format=png&ecc=Q&margin=0&data=${payload}`;
  }

  openTicketScannerPopup(event?: Event): void {
    event?.stopPropagation();
    const selectedRow = this.selectedTicketRowRef();
    const selectedCode = this.selectedTicketCodeValueRef();
    if (!selectedRow || !selectedCode) {
      const fallbackRow = this.ticketRows()[0] ?? null;
      if (fallbackRow) {
        this.selectedTicketRowRef.set(fallbackRow);
        this.selectedTicketCodeValueRef.set(this.encodeTicketPayload(this.createTicketScanPayload(fallbackRow)));
      } else {
        this.selectedTicketRowRef.set(null);
        this.selectedTicketCodeValueRef.set('');
      }
    }
    this.ticketScannerStateRef.set('reading');
    this.ticketScannerResultRef.set(null);
    this.ticketOverlayModeRef.set('ticketScanner');
    this.startTicketScannerReading();
  }

  closeTicketOverlay(): void {
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
    this.ticketScannerStateRef.set('idle');
    this.ticketScannerResultRef.set(null);
    this.selectedTicketCodeValueRef.set('');
    this.selectedTicketRowRef.set(null);
    this.ticketOverlayModeRef.set(null);
  }

  ticketScannerState(): 'idle' | 'reading' | 'success' {
    return this.ticketScannerStateRef();
  }

  ticketScannerResult(): AppTypes.TicketScanPayload | null {
    return this.ticketScannerResultRef();
  }

  retryTicketScanner(event?: Event): void {
    event?.stopPropagation();
    this.ticketScannerStateRef.set('reading');
    this.ticketScannerResultRef.set(null);
    this.startTicketScannerReading();
  }

  ticketScannerPersonLine(): string {
    const payload = this.ticketScannerResultRef();
    if (!payload) {
      return '';
    }
    return `${payload.holderName}, ${payload.holderAge} · ${payload.holderCity}`;
  }

  ticketScannerRoleEventLine(): string {
    const payload = this.ticketScannerResultRef();
    if (!payload) {
      return '';
    }
    return `${payload.holderRole} · ${payload.eventTitle}`;
  }

  ticketScannerDateLine(): string {
    const payload = this.ticketScannerResultRef();
    if (!payload) {
      return '';
    }
    return payload.eventTimeframe || payload.eventDateLabel;
  }

  ticketScannerResultAvatarUrl(): string {
    return this.ticketPayloadAvatarUrl(this.ticketScannerResultRef());
  }

  ticketScannerResultInitials(): string {
    const payload = this.ticketScannerResultRef();
    if (!payload) {
      return '';
    }
    return this.ticketPayloadInitials(payload);
  }

  shouldShowTicketGroupMarker(groupIndex: number): boolean {
    return groupIndex > 0 || this.isTicketListScrollableNow();
  }

  setTicketScrollElement(element: HTMLDivElement | null): void {
    this.ticketScrollElement = element;
  }

  setTicketScannerVideoElement(element: HTMLVideoElement | null): void {
    this.ticketScannerVideoElement = element;
  }

  private syncTicketScrollOnOpen(): void {
    const scrollElement = this.ticketScrollElement;
    if (!scrollElement) {
      this.seedTicketStickyHeader();
      return;
    }
    scrollElement.scrollTop = 0;
    this.isTicketListScrollableNow();
    this.updateTicketStickyHeader(0);
  }

  private seedTicketStickyHeader(): void {
    this.ticketStickyValueRef.set(this.groupedTicketRows()[0]?.label ?? 'No tickets');
  }

  private updateTicketStickyHeader(scrollTop: number): void {
    const groups = this.groupedTicketRows();
    if (groups.length === 0) {
      this.ticketStickyValueRef.set('No tickets');
      return;
    }
    const scrollElement = this.ticketScrollElement;
    if (!scrollElement) {
      this.ticketStickyValueRef.set(groups[0].label);
      return;
    }
    const stickyHeader = scrollElement.querySelector<HTMLElement>('.activities-sticky-header');
    const stickyHeaderHeight = stickyHeader?.offsetHeight ?? 0;
    const targetTop = scrollTop + stickyHeaderHeight + 1;
    const rows = Array.from(scrollElement.querySelectorAll<HTMLElement>('.ticket-row-item'));
    this.isTicketListScrollableNow();
    if (rows.length === 0) {
      this.ticketStickyValueRef.set(groups[0].label);
      return;
    }
    if (scrollTop <= 1) {
      this.ticketStickyValueRef.set(rows[0].dataset['groupLabel'] ?? groups[0].label);
      return;
    }
    const alignmentTolerancePx = 2;
    const activeRow =
      rows.find(row => row.offsetTop >= targetTop - alignmentTolerancePx)
      ?? rows[rows.length - 1];
    this.ticketStickyValueRef.set(activeRow.dataset['groupLabel'] ?? groups[0].label);
  }

  private ticketGroupLabel(dateIso: string): string {
    const parsed = new Date(dateIso);
    if (Number.isNaN(parsed.getTime())) {
      return 'Date unavailable';
    }
    return parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  private selectedTicketPayload(): AppTypes.TicketScanPayload | null {
    const decoded = this.decodeTicketPayload(this.selectedTicketCodeValueRef());
    if (decoded) {
      return decoded;
    }
    const row = this.selectedTicketRowRef();
    if (!row) {
      return null;
    }
    return {
      ...this.createTicketScanPayload(row),
      code: this.selectedTicketCodeValueRef() || this.createTicketScanPayload(row).code
    };
  }

  private createTicketScanPayload(row: AppTypes.ActivityListRow): AppTypes.TicketScanPayload {
    return this.ticketBridgeRef()?.createTicketScanPayload(row) ?? {
      code: '',
      holderUserId: '',
      holderName: '',
      holderAge: 0,
      holderCity: '',
      holderRole: row.isAdmin ? 'Admin' : 'Member',
      eventId: row.id,
      eventTitle: row.title,
      eventSubtitle: row.subtitle,
      eventTimeframe: row.detail,
      eventDateLabel: row.detail,
      issuedAtIso: new Date().toISOString()
    };
  }

  private ticketPayloadAvatarUrl(payload: AppTypes.TicketScanPayload | null): string {
    return this.ticketBridgeRef()?.ticketPayloadAvatarUrl(payload) ?? '';
  }

  private ticketPayloadInitials(payload: AppTypes.TicketScanPayload): string {
    return this.ticketBridgeRef()?.ticketPayloadInitials(payload) ?? '';
  }

  private encodeTicketPayload(payload: AppTypes.TicketScanPayload): string {
    try {
      const json = JSON.stringify(payload);
      if (typeof TextEncoder === 'undefined' || typeof btoa === 'undefined') {
        return json;
      }
      const bytes = new TextEncoder().encode(json);
      let binary = '';
      bytes.forEach(value => {
        binary += String.fromCharCode(value);
      });
      return btoa(binary);
    } catch {
      return JSON.stringify(payload);
    }
  }

  private decodeTicketPayload(encoded: string): AppTypes.TicketScanPayload | null {
    try {
      if (typeof TextDecoder === 'undefined' || typeof atob === 'undefined') {
        return null;
      }
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(json) as Partial<AppTypes.TicketScanPayload>;
      if (
        typeof parsed.code !== 'string'
        || typeof parsed.holderUserId !== 'string'
        || typeof parsed.holderName !== 'string'
        || typeof parsed.eventId !== 'string'
        || typeof parsed.eventTitle !== 'string'
        || typeof parsed.eventSubtitle !== 'string'
        || typeof parsed.eventTimeframe !== 'string'
        || typeof parsed.issuedAtIso !== 'string'
      ) {
        return null;
      }
      return {
        code: parsed.code,
        holderUserId: parsed.holderUserId,
        holderName: parsed.holderName,
        holderAge: typeof parsed.holderAge === 'number' ? parsed.holderAge : 0,
        holderCity: typeof parsed.holderCity === 'string' ? parsed.holderCity : '',
        holderRole: parsed.holderRole === 'Admin' || parsed.holderRole === 'Manager' ? parsed.holderRole : 'Member',
        eventId: parsed.eventId,
        eventTitle: parsed.eventTitle,
        eventSubtitle: parsed.eventSubtitle,
        eventTimeframe: parsed.eventTimeframe,
        eventDateLabel: typeof parsed.eventDateLabel === 'string' ? parsed.eventDateLabel : parsed.eventTimeframe,
        issuedAtIso: parsed.issuedAtIso
      };
    } catch {
      return null;
    }
  }

  private startTicketScannerReading(): void {
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
    void this.startTicketScannerSession();
  }

  private cancelTicketScannerTimer(): void {
    if (!this.ticketScannerTimer) {
      return;
    }
    clearTimeout(this.ticketScannerTimer);
    this.ticketScannerTimer = null;
  }

  private async startTicketScannerSession(): Promise<void> {
    if (this.ticketOverlayModeRef() !== 'ticketScanner') {
      return;
    }
    const videoElement = await this.waitForTicketScannerVideo();
    if (!videoElement) {
      this.startTicketScannerFallbackTimer();
      return;
    }
    const stream = await this.startTicketScannerMediaStream();
    if (!stream) {
      this.startTicketScannerFallbackTimer();
      return;
    }
    this.ticketScannerMediaStream = stream;
    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.setAttribute('playsinline', 'true');
    try {
      await videoElement.play();
    } catch {
      this.startTicketScannerFallbackTimer();
      return;
    }
    const detector = this.createBrowserBarcodeDetector();
    if (!detector) {
      if (this.selectedTicketCodeValueRef()) {
        this.startTicketScannerFallbackTimer();
      }
      return;
    }
    this.startTicketScannerDetectionLoop(detector, videoElement);
  }

  private startTicketScannerFallbackTimer(): void {
    this.cancelTicketScannerTimer();
    this.ticketScannerTimer = setTimeout(() => {
      this.ticketScannerTimer = null;
      const decoded = this.decodeTicketPayload(this.selectedTicketCodeValueRef());
      if (decoded) {
        this.applyTicketScannerSuccess(decoded);
        return;
      }
      const selectedRow = this.selectedTicketRowRef();
      if (selectedRow) {
        this.applyTicketScannerSuccess(this.createTicketScanPayload(selectedRow));
        return;
      }
      this.ngZone.run(() => {
        this.ticketScannerResultRef.set(null);
        this.ticketScannerStateRef.set('idle');
      });
      this.stopTicketScannerCamera();
    }, 1200);
  }

  private startTicketScannerDetectionLoop(detector: AppTypes.BrowserBarcodeDetector, videoElement: HTMLVideoElement): void {
    this.cancelTicketScannerDetectionLoop();
    this.ticketScannerDetectBusy = false;
    const tick = (): void => {
      if (this.ticketOverlayModeRef() !== 'ticketScanner' || this.ticketScannerStateRef() !== 'reading') {
        this.cancelTicketScannerDetectionLoop();
        return;
      }
      if (!this.ticketScannerDetectBusy && videoElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        this.ticketScannerDetectBusy = true;
        void detector.detect(videoElement)
          .then(results => {
            const payload = this.ticketScannerPayloadFromResults(results);
            if (payload) {
              this.applyTicketScannerSuccess(payload);
            }
          })
          .catch(() => {
            // Ignore intermittent detector read errors and keep scanning.
          })
          .finally(() => {
            this.ticketScannerDetectBusy = false;
          });
      }
      this.ticketScannerDetectionFrame = requestAnimationFrame(tick);
    };
    this.ticketScannerDetectionFrame = requestAnimationFrame(tick);
  }

  private ticketScannerPayloadFromResults(results: AppTypes.BrowserBarcodeDetectorResult[]): AppTypes.TicketScanPayload | null {
    for (const result of results) {
      const raw = `${result.rawValue ?? ''}`.trim();
      if (!raw) {
        continue;
      }
      const decoded = this.decodeTicketPayload(raw);
      if (decoded) {
        return decoded;
      }
    }
    return null;
  }

  private applyTicketScannerSuccess(payload: AppTypes.TicketScanPayload): void {
    this.cancelTicketScannerTimer();
    this.ngZone.run(() => {
      this.ticketScannerResultRef.set(payload);
      this.ticketScannerStateRef.set('success');
    });
    this.stopTicketScannerCamera();
  }

  private cancelTicketScannerDetectionLoop(): void {
    if (this.ticketScannerDetectionFrame !== null) {
      cancelAnimationFrame(this.ticketScannerDetectionFrame);
      this.ticketScannerDetectionFrame = null;
    }
  }

  private stopTicketScannerCamera(): void {
    this.cancelTicketScannerDetectionLoop();
    const videoElement = this.ticketScannerVideoElement;
    if (videoElement) {
      try {
        videoElement.pause();
      } catch {
        // no-op
      }
      videoElement.srcObject = null;
    }
    if (this.ticketScannerMediaStream) {
      this.ticketScannerMediaStream.getTracks().forEach(track => track.stop());
      this.ticketScannerMediaStream = null;
    }
    this.ticketScannerDetectBusy = false;
  }

  private async waitForTicketScannerVideo(): Promise<HTMLVideoElement | null> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const videoElement = this.ticketScannerVideoElement;
      if (videoElement) {
        return videoElement;
      }
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => resolve());
      });
    }
    return null;
  }

  private async startTicketScannerMediaStream(): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return null;
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    } catch {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch {
        return null;
      }
    }
  }

  private createBrowserBarcodeDetector(): AppTypes.BrowserBarcodeDetector | null {
    const maybeCtor = (globalThis as { BarcodeDetector?: AppTypes.BrowserBarcodeDetectorConstructor }).BarcodeDetector;
    if (typeof maybeCtor !== 'function') {
      return null;
    }
    try {
      return new maybeCtor({ formats: ['qr_code'] });
    } catch {
      try {
        return new maybeCtor();
      } catch {
        return null;
      }
    }
  }

  private isTicketListScrollableNow(): boolean {
    const scrollElement = this.ticketScrollElement;
    if (!scrollElement) {
      return this.ticketListScrollable;
    }
    const scrollable = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight) > 1;
    this.ticketListScrollable = scrollable;
    return scrollable;
  }

  private toSortableDate(dateIso: string): number {
    const parsed = new Date(dateIso);
    const time = parsed.getTime();
    return Number.isNaN(time) ? 0 : time;
  }
}
