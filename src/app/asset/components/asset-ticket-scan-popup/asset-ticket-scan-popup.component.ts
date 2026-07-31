import {
  Component,
  NgZone,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';

import {
  AssetTicketBuilder
} from '../../../shared/core/base/builders';
import {
  AssetTicketsService,
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
  PopupComponent,
  type PopupModel
} from '../../../shared/ui';
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
    PopupComponent,
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
  private readonly assetTicketsService = inject(AssetTicketsService);
  protected readonly store = inject(AssetPopupStore);

  private ticketScannerMediaStream: MediaStream | null = null;
  private ticketScannerDetectionFrame: number | null = null;
  private ticketScannerDetectBusy = false;
  private ticketScannerVideoElement: HTMLVideoElement | null = null;
  private ticketScannerGeneration = 0;
  private ticketQrGeneration = 0;

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
  protected readonly ticketQrImageUrl = signal('');

  constructor() {
    effect(() => {
      const mode = this.store.ticketScanMode();
      const row = this.store.selectedTicketRowRef();
      const selectedCode = this.store.selectedTicketCodeValueRef();
      untracked(() => {
        if (mode === 'ticketScanner') {
          this.startTicketScannerReading();
          return;
        }
        this.invalidateTicketScannerSession();
        this.stopTicketScannerCamera();
        if (mode === 'ticketCode' && row && !row.usedAtIso) {
          void this.renderTicketQrCode(selectedCode || row.scanCode);
        } else {
          this.clearTicketQrCode();
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.ticketScannerVideoElement = null;
    this.invalidateTicketScannerSession();
    this.stopTicketScannerCamera();
    this.clearTicketQrCode();
  }

  protected ticketScanPopupModel(): PopupModel {
    const isTicketCode = this.store.ticketScanMode() === 'ticketCode';
    const selectedTicketUsed = !!this.store.selectedTicketRowRef()?.usedAtIso;
    const title = isTicketCode
      ? (selectedTicketUsed ? 'asset.ticket.checked.in' : 'asset.ticket.title')
      : 'asset.ticket.scan.title';
    return {
      title,
      ariaLabel: title,
      closeAriaLabel: 'Close',
      size: 'wide',
      height: isTicketCode ? 'full' : 'auto',
      headerTone: 'accent',
      bodyLayout: isTicketCode ? 'fill' : 'default',
      onClose: event => this.closeTicketScanPopup(event)
    };
  }

  protected ticketScanPopupZIndex(): number {
    return 12100;
  }

  protected closeTicketScanPopup(event?: Event): void {
    event?.stopPropagation();
    this.invalidateTicketScannerSession();
    this.stopTicketScannerCamera();
    this.store.closeTicketScan();
  }

  protected readonly retryTicketScanner = (event?: Event): void => {
    event?.stopPropagation();
    this.store.retryTicketScanner();
    this.startTicketScannerReading();
  };

  protected onTicketScannerVideoElementChange(element: HTMLVideoElement | null): void {
    this.ticketScannerVideoElement = element;
  }

  private selectedTicketPayload(): AssetContracts.TicketScanPayloadDTO | null {
    const row = this.store.selectedTicketRowRef();
    if (!row) {
      return null;
    }
    return AssetTicketBuilder.createScanPayload(
      {
        ...row,
        scanCode: this.store.selectedTicketCodeValueRef().trim() || row.scanCode
      },
      this.resolveTicketHolder(row) ?? {
        id: row.holderUserId,
        name: 'Ticket Holder',
        age: 0,
        city: ''
      }
    );
  }

  private resolveTicketHolder(row: AssetContracts.AssetTicketDTO): TicketPerson | null {
    const holderUserId = row.holderUserId.trim();
    if (!holderUserId) {
      return null;
    }
    return this.userProfileStore.getUserProfile(holderUserId)
      ?? this.userById.get(holderUserId)
      ?? null;
  }

  private currentActiveUserId(): string {
    return this.userProfileStore.getActiveUserId().trim();
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

  private async renderTicketQrCode(scanCode: string): Promise<void> {
    const generation = ++this.ticketQrGeneration;
    this.ticketQrImageUrl.set('');
    try {
      const imageUrl = await AssetTicketScanConverter.qrImageDataUrl(scanCode);
      if (generation === this.ticketQrGeneration && this.store.ticketScanModeRef() === 'ticketCode') {
        this.ticketQrImageUrl.set(imageUrl);
      }
    } catch {
      if (generation === this.ticketQrGeneration) {
        this.ticketQrImageUrl.set('');
      }
    }
  }

  private clearTicketQrCode(): void {
    this.ticketQrGeneration += 1;
    this.ticketQrImageUrl.set('');
  }

  private startTicketScannerReading(): void {
    const generation = ++this.ticketScannerGeneration;
    this.stopTicketScannerCamera();
    void this.startTicketScannerSession(generation);
  }

  private invalidateTicketScannerSession(): void {
    this.ticketScannerGeneration += 1;
  }

  private scannerSessionIsCurrent(
    generation: number,
    expectedState: 'reading' | 'validating' = 'reading'
  ): boolean {
    return generation === this.ticketScannerGeneration
      && this.store.ticketScanModeRef() === 'ticketScanner'
      && this.store.ticketScannerStateRef() === expectedState;
  }

  private async startTicketScannerSession(generation: number): Promise<void> {
    if (!this.scannerSessionIsCurrent(generation)) {
      return;
    }
    const videoElement = await this.waitForTicketScannerVideo();
    if (!videoElement || !this.scannerSessionIsCurrent(generation)) {
      this.applyTicketScannerError(generation);
      return;
    }
    const stream = await this.startTicketScannerMediaStream();
    if (!stream || !this.scannerSessionIsCurrent(generation)) {
      stream?.getTracks().forEach(track => track.stop());
      this.applyTicketScannerError(generation);
      return;
    }
    this.ticketScannerMediaStream = stream;
    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.setAttribute('playsinline', 'true');
    try {
      await videoElement.play();
    } catch {
      this.applyTicketScannerError(generation);
      return;
    }
    if (!this.scannerSessionIsCurrent(generation)) {
      this.stopTicketScannerCamera();
      return;
    }
    const detector = this.createBrowserBarcodeDetector();
    if (!detector) {
      this.applyTicketScannerError(generation);
      return;
    }
    this.startTicketScannerDetectionLoop(detector, videoElement, generation);
  }

  private startTicketScannerDetectionLoop(
    detector: BrowserBarcodeDetector,
    videoElement: HTMLVideoElement,
    generation: number
  ): void {
    this.cancelTicketScannerDetectionLoop();
    this.ticketScannerDetectBusy = false;
    const tick = (): void => {
      if (!this.scannerSessionIsCurrent(generation)) {
        this.cancelTicketScannerDetectionLoop();
        return;
      }
      if (!this.ticketScannerDetectBusy && videoElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        this.ticketScannerDetectBusy = true;
        void detector.detect(videoElement)
          .then(results => {
            const code = this.ticketScannerCodeFromResults(results);
            if (code) {
              this.beginTicketValidation(code, generation);
            }
          })
          .catch(() => {
            this.applyTicketScannerError(generation);
          })
          .finally(() => {
            this.ticketScannerDetectBusy = false;
          });
      }
      this.ticketScannerDetectionFrame = requestAnimationFrame(tick);
    };
    this.ticketScannerDetectionFrame = requestAnimationFrame(tick);
  }

  private ticketScannerCodeFromResults(results: BrowserBarcodeDetectorResult[]): string {
    for (const result of results) {
      const rawCode = `${result.rawValue ?? ''}`.trim();
      if (rawCode) {
        return rawCode;
      }
    }
    return '';
  }

  private beginTicketValidation(code: string, generation: number): void {
    if (!this.scannerSessionIsCurrent(generation)) {
      return;
    }
    this.ngZone.run(() => {
      this.store.applyTicketScannerValidating();
    });
    this.stopTicketScannerCamera();
    void this.validateTicket(code, generation);
  }

  private async validateTicket(code: string, generation: number): Promise<void> {
    try {
      const response = await this.assetTicketsService.validateTicket({
        code,
        userId: this.currentActiveUserId()
      });
      if (!this.scannerSessionIsCurrent(generation, 'validating')) {
        return;
      }
      this.ngZone.run(() => {
        if (response.valid && response.reason === 'valid' && response.ticket) {
          this.store.applyTicketScannerValid(response.ticket);
          return;
        }
        if (!response.valid && response.reason !== 'valid') {
          this.store.applyTicketScannerInvalid(response.reason);
          return;
        }
        this.store.applyTicketScannerError();
      });
    } catch {
      if (this.scannerSessionIsCurrent(generation, 'validating')) {
        this.ngZone.run(() => this.store.applyTicketScannerError());
      }
    }
  }

  private applyTicketScannerError(generation: number): void {
    if (!this.scannerSessionIsCurrent(generation)) {
      return;
    }
    this.ngZone.run(() => this.store.applyTicketScannerError());
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
