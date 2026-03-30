import { Injectable, NgZone, computed, inject, signal } from '@angular/core';

import type * as AppTypes from '../shared/core/base/models';
import { AppContext, AppPopupContext, AssetTicketsService } from '../shared/core';
import type { SmartListStateChange } from '../shared/ui';
import { AssetFacadeService } from './asset-facade.service';
import type { AssetPopupHost } from './asset-popup.host';

@Injectable({ providedIn: 'root' })
export class AssetPopupStateService {
  private readonly ngZone = inject(NgZone);
  private readonly appCtx = inject(AppContext);
  private readonly popupCtx = inject(AppPopupContext);
  private readonly assetTicketsService = inject(AssetTicketsService);
  private readonly assetFacade = inject(AssetFacadeService);

  private readonly hostRef = signal<AssetPopupHost | null>(null);
  private readonly primaryVisibleRef = signal(false);
  private readonly stackedVisibleRef = signal(false);
  private readonly basketVisibleRef = signal(false);

  private readonly ticketOverlayModeRef = signal<'ticketCode' | 'ticketScanner' | null>(null);
  private readonly ticketRowsRef = signal<AppTypes.ActivityListRow[]>([]);
  private readonly ticketTotalCountRef = signal(0);
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
    || this.popupCtx.activityInvitePopup() !== null
    || this.ticketOverlayModeRef() !== null
  );

  private ticketScannerTimer: ReturnType<typeof setTimeout> | null = null;
  private ticketScannerMediaStream: MediaStream | null = null;
  private ticketScannerDetectionFrame: number | null = null;
  private ticketScannerDetectBusy = false;
  private ticketScannerVideoElement: HTMLVideoElement | null = null;
  private readonly warmedTicketQrUrls = new Set<string>();

  registerHost(host: AssetPopupHost | null): void {
    this.hostRef.set(host);
  }

  setPrimaryVisible(isOpen: boolean): void {
    this.primaryVisibleRef.set(isOpen);
  }

  setStackedVisible(isOpen: boolean): void {
    this.stackedVisibleRef.set(isOpen);
  }

  setBasketVisible(isOpen: boolean): void {
    this.basketVisibleRef.set(isOpen);
  }

  syncVisibility(isPrimaryOpen: boolean, isStackedOpen: boolean, isBasketOpen = false): void {
    this.primaryVisibleRef.set(isPrimaryOpen);
    this.stackedVisibleRef.set(isStackedOpen);
    this.basketVisibleRef.set(isBasketOpen);
  }


  prepareTicketPopupOpen(): void {
    this.ticketRowsRef.set([]);
    this.ticketTotalCountRef.set(this.assetTicketsService.peekTicketCountByUser(this.activeUserId()));
    this.showTicketOrderPickerRef.set(false);
    this.selectedTicketRowRef.set(null);
    this.selectedTicketCodeValueRef.set('');
    this.ticketScannerStateRef.set('idle');
    this.ticketScannerResultRef.set(null);
    this.ticketOverlayModeRef.set(null);
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
  }

  resetTicketState(): void {
    this.ticketRowsRef.set([]);
    this.ticketTotalCountRef.set(0);
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

  ticketHeaderSummary(): string {
    const count = this.ticketTotalCountRef();
    return count === 1 ? '1 ticketed event' : `${count} ticketed events`;
  }

  showTicketOrderPicker(): boolean {
    return this.showTicketOrderPickerRef();
  }

  closeTicketOrderPicker(): void {
    this.showTicketOrderPickerRef.set(false);
  }

  ticketDateOrder(): 'upcoming' | 'past' {
    return this.ticketDateOrderRef();
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
    this.ticketRowsRef.set([]);
    this.ticketTotalCountRef.set(this.assetTicketsService.peekTicketCountByUser(this.activeUserId()));
  }

  selectedTicketRow(): AppTypes.ActivityListRow | null {
    return this.selectedTicketRowRef();
  }

  updateTicketListState(change: SmartListStateChange<AppTypes.ActivityListRow>): void {
    this.ticketRowsRef.set([...change.items]);
    this.ticketTotalCountRef.set(Math.max(0, change.total));
    this.warmTicketQrImages(change.items);
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
    this.warmTicketQrImages([row]);
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
      const fallbackRow = this.ticketRowsRef()[0] ?? null;
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

  setTicketScannerVideoElement(element: HTMLVideoElement | null): void {
    this.ticketScannerVideoElement = element;
  }

  private activeUserId(): string {
    return this.appCtx.activeUserId().trim();
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
    return this.assetFacade.createTicketScanPayload(row);
  }

  private ticketPayloadAvatarUrl(payload: AppTypes.TicketScanPayload | null): string {
    return this.assetFacade.ticketPayloadAvatarUrl(payload);
  }

  private ticketPayloadInitials(payload: AppTypes.TicketScanPayload): string {
    return this.assetFacade.ticketPayloadInitials(payload);
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

  private warmTicketQrImages(rows: readonly AppTypes.ActivityListRow[]): void {
    if (typeof fetch === 'undefined' || typeof navigator === 'undefined' || navigator.onLine === false) {
      return;
    }
    for (const row of rows) {
      const qrImageUrl = this.ticketQrImageUrlForRow(row);
      if (!qrImageUrl || this.warmedTicketQrUrls.has(qrImageUrl)) {
        continue;
      }
      this.warmedTicketQrUrls.add(qrImageUrl);
      void fetch(qrImageUrl, {
        mode: 'no-cors',
        cache: 'reload'
      }).catch(() => {
        this.warmedTicketQrUrls.delete(qrImageUrl);
      });
    }
  }

  private ticketQrImageUrlForRow(row: AppTypes.ActivityListRow): string {
    const payload = this.encodeTicketPayload(this.createTicketScanPayload(row));
    if (!payload) {
      return '';
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=1024x1024&format=png&ecc=Q&margin=0&data=${encodeURIComponent(payload)}`;
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
}
