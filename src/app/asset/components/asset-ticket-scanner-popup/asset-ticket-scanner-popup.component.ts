import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';

import {
  AppMenuComponent,
  I18nPipe,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '../../../shared/ui';

import type * as AssetContracts from '../../../shared/core/contracts/asset.interface';

@Component({
  selector: 'app-asset-ticket-scanner-popup',
  standalone: true,
  imports: [AppMenuComponent, I18nPipe],
  templateUrl: './asset-ticket-scanner-popup.component.html',
  styleUrl: './asset-ticket-scanner-popup.component.scss'
})
export class AssetTicketScannerPopupComponent implements AfterViewInit, OnDestroy {
  @Input() state: 'idle' | 'reading' | 'validating' | 'valid' | 'invalid' | 'error' = 'idle';
  @Input() result: AssetContracts.TicketScanPayloadDTO | null = null;
  @Input() reason: AssetContracts.AssetTicketValidationReason | null = null;
  @Input() avatarUrl = '';
  @Input() initials = '';
  @Input() personLine = '';
  @Input() roleBadgeLabel = '';
  @Input() eventLine = '';
  @Input() dateLine = '';
  @Input() lastFrameUrl = '';
  @Input({ required: true }) toggleCamera!: (event?: Event) => void;

  @Output() readonly videoElementChange = new EventEmitter<HTMLVideoElement | null>();

  @ViewChild('ticketScannerVideo') private ticketScannerVideoRef?: ElementRef<HTMLVideoElement>;

  ngAfterViewInit(): void {
    this.videoElementChange.emit(this.ticketScannerVideoRef?.nativeElement ?? null);
  }

  ngOnDestroy(): void {
    this.videoElementChange.emit(null);
  }

  protected cameraEnabled(): boolean {
    return this.state === 'reading';
  }

  protected cameraToggleMenuItems(): readonly AppMenuItem<'ticket-camera-toggle'>[] {
    const enabled = this.cameraEnabled();
    return [{
      id: 'ticket-camera-toggle',
      label: enabled ? 'asset.ticket.scan.camera.on' : 'asset.ticket.scan.camera.off',
      ariaLabel: enabled ? 'asset.ticket.scan.camera.turn.off' : 'asset.ticket.scan.camera.turn.on',
      icon: enabled ? 'videocam' : 'videocam_off',
      kind: 'toggle',
      layout: 'pill',
      surface: 'tinted',
      palette: enabled ? 'green' : 'red',
      active: enabled,
      checked: enabled,
      showToggleIndicator: true,
      closeOnSelect: false,
      disabled: this.state === 'validating'
    }];
  }

  protected onCameraToggle(event: AppMenuItemSelectEvent<'ticket-camera-toggle'>): void {
    this.toggleCamera(event.sourceEvent);
  }

  protected resultMessage(): string {
    if (this.state === 'valid') {
      return 'asset.ticket.scan.accepted';
    }
    if (this.state === 'invalid') {
      switch (this.reason) {
        case 'already_used':
          return 'asset.ticket.scan.already.used';
        case 'not_authorized':
          return 'asset.ticket.scan.not.authorized';
        case 'expired':
          return 'asset.ticket.scan.expired';
        case 'revoked':
          return 'asset.ticket.scan.revoked';
        case 'event_unavailable':
          return 'asset.ticket.scan.event.unavailable';
        default:
          return 'asset.ticket.scan.invalid';
      }
    }
    if (this.state === 'error') {
      return 'asset.ticket.scan.error';
    }
    return 'asset.ticket.scan.prompt';
  }
}
