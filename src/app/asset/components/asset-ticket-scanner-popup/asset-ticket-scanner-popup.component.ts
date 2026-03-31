
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';

import type * as AppTypes from '../../../shared/core/base/models';

@Component({
  selector: 'app-asset-ticket-scanner-popup',
  standalone: true,
  imports: [],
  templateUrl: './asset-ticket-scanner-popup.component.html',
  styleUrl: './asset-ticket-scanner-popup.component.scss'
})
export class AssetTicketScannerPopupComponent implements AfterViewInit, OnDestroy {
  @Input() state: 'idle' | 'reading' | 'success' = 'idle';
  @Input() result: AppTypes.TicketScanPayload | null = null;
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
}
