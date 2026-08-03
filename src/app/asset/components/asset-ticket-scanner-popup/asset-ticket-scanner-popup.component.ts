import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';

import { I18nPipe } from '../../../shared/ui';

import type * as AssetContracts from '../../../shared/core/contracts/asset.interface';

@Component({
  selector: 'app-asset-ticket-scanner-popup',
  standalone: true,
  imports: [I18nPipe],
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
  @Input() roleEventLine = '';
  @Input() dateLine = '';
  @Input({ required: true }) retry!: (event?: Event) => void;

  @Output() readonly videoElementChange = new EventEmitter<HTMLVideoElement | null>();

  @ViewChild('ticketScannerVideo') private ticketScannerVideoRef?: ElementRef<HTMLVideoElement>;

  ngAfterViewInit(): void {
    this.videoElementChange.emit(this.ticketScannerVideoRef?.nativeElement ?? null);
  }

  ngOnDestroy(): void {
    this.videoElementChange.emit(null);
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
