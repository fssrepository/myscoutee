import {
  CommonModule
} from '@angular/common';
import {
  Component,
  NgZone,
  OnDestroy,
  computed,
  effect,
  inject,
  untracked
} from '@angular/core';
import {
  MatButtonModule
} from '@angular/material/button';
import {
  MatIconModule
} from '@angular/material/icon';

import {
  AssetTicketBuilder
} from '../../../shared/core/base/builders';
import {
  UsersService,
  type UserDto
} from '../../../shared/core';
import {
  AssetPopupStore
} from '../../../shared/ui/context/stores/asset-popup.store';
import {
  AssetTicketScanConverter
} from '../../../shared/ui/converters/asset-ticket-scan.converter';
import {
  AssetTicketCodePopupComponent
} from '../asset-ticket-code-popup/asset-ticket-code-popup.component';
import {
  AssetTicketScannerPopupComponent
} from '../asset-ticket-scanner-popup/asset-ticket-scanner-popup.component';

import type * as AssetContracts from '../../../shared/core/contracts/asset.interface';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';

type TicketPerson = Pick<UserDto, 'id' | 'name' | 'age' | 'city' | 'gender' | 'initials' | 'images'>;

interface BrowserBarcodeDetectorResult {
  rawValue?: string;
}

interface BrowserBarcodeDetector {
  detect(image: ImageBitmapSource): Promise<BrowserBarcodeDetectorResult[]>;
}

interface BrowserBarcodeDetectorConstructor {
  new(options?: { formats?: string[] }): BrowserBarcodeDetector;
}

@Component({
  selector: 'app-asset-ticket-scan-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    AssetTicketCodePopupComponent,
    AssetTicketScannerPopupComponent
  ],
  templateUrl: './asset-ticket-scan-popup.component.html',
  styleUrl: './asset-ticket-scan-popup.component.scss'
})
export class AssetTicketScanPopupComponent implements OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly usersService = inject(UsersService);
  protected readonly store = inject(AssetPopupStore);

  private ticketScannerTimer: ReturnType<typeof setTimeout> | null = null;
  private ticketScannerMediaStream: MediaStream | null = null;
  private ticketScannerDetectionFrame: number | null = null;
  private ticketScannerDetectBusy = false;
  private ticketScannerVideoElement: HTMLVideoElement | null = null;
  private readonly warmedTicketQrUrls = new Set<string>();

  protected readonly visible = computed(() => (
    this.store.ticketScanMode() === 'ticketCode'
    || this.store.ticketScanMode() === 'ticketScanner'
  ));
  protected readonly ticketCodeView = computed(() => {
    const payload = this.selectedTicketPayload();
    return AssetTicketScanConverter.convert(payload, this.ticketPayloadUser(payload));
  });
  protected readonly ticketScannerView = computed(() => {
    const payload = this.store.ticketScannerResultRef();
    return AssetTicketScanConverter.convert(payload, this.ticketPayloadUser(payload));
  });
  protected readonly ticketQrImageUrl = computed(() => {
    const encodedPayload = this.store.selectedTicketCodeValueRef() || this.encodedSelectedTicketPayload();
    return AssetTicketScanConverter.qrImageUrl(encodedPayload);
  });

  constructor() {
    effect(() => {
      const rows = this.store.ticketRowsRef();
      untracked(() => this.warmTicketQrImages(rows));
    });
    effect(() => {
      const mode = this.store.ticketScanMode();
      untracked(() => {
        if (mode === 'ticketScanner') {
          this.ensureScannerTicketSelection();
          this.startTicketScannerReading();
          return;
        }
        this.cancelTicketScannerTimer();
        this.stopTicketScannerCamera();
      });
    });
  }

  ngOnDestroy(): void {
    this.ticketScannerVideoElement = null;
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
  }

  protected isMobileView(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const isNarrowViewport = window.matchMedia('(max-width: 760px)').matches;
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    return isNarrowViewport && hasCoarsePointer;
  }

  protected closeTicketScanPopup(event?: Event): void {
    event?.stopPropagation();
    this.cancelTicketScannerTimer();
    this.stopTicketScannerCamera();
    this.store.closeTicketScan();
  }

  protected retryTicketScanner(event?: Event): void {
    event?.stopPropagation();
    this.store.retryTicketScanner();
    this.startTicketScannerReading();
  }

  protected onTicketScannerVideoElementChange(element: HTMLVideoElement | null): void {
    this.ticketScannerVideoElement = element;
  }

  private ensureScannerTicketSelection(): void {
    const selectedRow = this.store.selectedTicketRowRef();
    const selectedCode = this.store.selectedTicketCodeValueRef();
    if (selectedRow && selectedCode) {
      return;
    }
    const fallbackRow = selectedRow ?? this.store.ticketRowsRef()[0] ?? null;
    if (!fallbackRow) {
      this.store.selectedTicketRowRef.set(null);
      this.store.selectedTicketCodeValueRef.set('');
      return;
    }
    this.store.selectedTicketRowRef.set(fallbackRow);
    this.store.selectedTicketCodeValueRef.set(this.encodeTicketPayload(this.createTicketScanPayload(fallbackRow)));
  }

  private selectedTicketPayload(): AssetContracts.TicketScanPayloadDTO | null {
    const decoded = this.decodeTicketPayload(this.store.selectedTicketCodeValueRef());
    if (decoded) {
      return decoded;
    }
    const row = this.store.selectedTicketRowRef();
    if (!row) {
      return null;
    }
    return {
      ...this.createTicketScanPayload(row),
      code: this.store.selectedTicketCodeValueRef() || this.createTicketScanPayload(row).code
    };
  }

  private encodedSelectedTicketPayload(): string {
    const payload = this.selectedTicketPayload();
    return payload ? this.encodeTicketPayload(payload) : '';
  }

  private createTicketScanPayload(row: AssetContracts.AssetTicketDTO): AssetContracts.TicketScanPayloadDTO {
    return AssetTicketBuilder.createScanPayload(row, this.resolveActiveTicketHolder() ?? {
      id: this.currentActiveUserId(),
      name: 'Ticket Holder',
      age: 0,
      city: ''
    });
  }

  private currentActiveUserId(): string {
    return this.userProfileStore.getActiveUserId().trim();
  }

  private resolveActiveTicketHolder(): TicketPerson | null {
    const activeUserId = this.currentActiveUserId();
    const activeProfile = this.userProfileStore.activeUserProfile();
    if (activeProfile && activeProfile.id.trim() === activeUserId) {
      return activeProfile;
    }
    return this.ticketPayloadUser({
      code: '',
      holderUserId: activeUserId,
      holderName: '',
      holderAge: 0,
      holderCity: '',
      holderRole: 'Member',
      eventId: '',
      eventTitle: '',
      eventSubtitle: '',
      eventTimeframe: '',
      eventDateLabel: '',
      issuedAtIso: ''
    });
  }

  private ticketPayloadUser(payload: AssetContracts.TicketScanPayloadDTO | null): TicketPerson | null {
    const normalizedUserId = payload?.holderUserId?.trim() ?? '';
    if (!normalizedUserId) {
      return null;
    }
    const cachedProfile = this.userProfileStore.getUserProfile(normalizedUserId);
    if (cachedProfile) {
      return cachedProfile;
    }
    return this.userById.get(normalizedUserId) ?? null;
  }

  private get users(): UserDto[] {
    return this.usersService.peekCachedUsers();
  }

  private get userById(): Map<string, UserDto> {
    return new Map(this.users.map(user => [user.id, user]));
  }

  private encodeTicketPayload(payload: AssetContracts.TicketScanPayloadDTO): string {
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

  private decodeTicketPayload(encoded: string): AssetContracts.TicketScanPayloadDTO | null {
    try {
      if (typeof TextDecoder === 'undefined' || typeof atob === 'undefined') {
        return null;
      }
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(json) as Partial<AssetContracts.TicketScanPayloadDTO>;
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

  private warmTicketQrImages(rows: readonly AssetContracts.AssetTicketDTO[]): void {
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

  private ticketQrImageUrlForRow(row: AssetContracts.AssetTicketDTO): string {
    const payload = this.encodeTicketPayload(this.createTicketScanPayload(row));
    return AssetTicketScanConverter.qrImageUrl(payload);
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
    if (this.store.ticketScanModeRef() !== 'ticketScanner') {
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
      if (this.store.selectedTicketCodeValueRef()) {
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
      const decoded = this.decodeTicketPayload(this.store.selectedTicketCodeValueRef());
      if (decoded) {
        this.applyTicketScannerSuccess(decoded);
        return;
      }
      const selectedRow = this.store.selectedTicketRowRef();
      if (selectedRow) {
        this.applyTicketScannerSuccess(this.createTicketScanPayload(selectedRow));
        return;
      }
      this.ngZone.run(() => {
        this.store.applyTicketScannerIdle();
      });
      this.stopTicketScannerCamera();
    }, 1200);
  }

  private startTicketScannerDetectionLoop(detector: BrowserBarcodeDetector, videoElement: HTMLVideoElement): void {
    this.cancelTicketScannerDetectionLoop();
    this.ticketScannerDetectBusy = false;
    const tick = (): void => {
      if (this.store.ticketScanModeRef() !== 'ticketScanner' || this.store.ticketScannerStateRef() !== 'reading') {
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

  private ticketScannerPayloadFromResults(results: BrowserBarcodeDetectorResult[]): AssetContracts.TicketScanPayloadDTO | null {
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

  private applyTicketScannerSuccess(payload: AssetContracts.TicketScanPayloadDTO): void {
    this.cancelTicketScannerTimer();
    this.ngZone.run(() => {
      this.store.applyTicketScannerSuccess(payload);
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

  private createBrowserBarcodeDetector(): BrowserBarcodeDetector | null {
    const maybeCtor = (globalThis as { BarcodeDetector?: BrowserBarcodeDetectorConstructor }).BarcodeDetector;
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
