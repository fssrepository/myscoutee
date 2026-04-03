import { CommonModule } from '@angular/common';
import { Component, HostListener, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import type * as AppTypes from '../../../shared/core/base/models';

@Component({
  selector: 'app-asset-form-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatSelectModule
  ],
  templateUrl: './asset-form-popup.component.html',
  styleUrl: './asset-form-popup.component.scss'
})
export class AssetFormPopupComponent {
  @Input() visible = false;
  @Input() title = '';
  @Input({ required: true }) assetForm!: Omit<AppTypes.AssetCard, 'id' | 'requests'>;
  @Input() canSave = false;
  @Input() isSavePending = false;
  @Input() saveRingPerimeter = 100;
  @Input() sourceRefreshEnabled = false;
  @Input() assetFormVisibility: AppTypes.EventVisibility = 'Invitation only';
  @Input() assetTypeOptions: readonly AppTypes.AssetType[] = [];
  @Input() assetFormRouteStops: string[] = [];
  @Input() isEventEditorReadOnly = false;
  @Input({ required: true }) assetTypeClass!: (type: AppTypes.AssetFilterType) => string;
  @Input({ required: true }) assetTypeIcon!: (type: AppTypes.AssetFilterType) => string;
  @Input({ required: true }) assetTypeLabel!: (type: AppTypes.AssetFilterType) => string;
  @Input({ required: true }) eventVisibilityClass!: (option: AppTypes.EventVisibility) => string;
  @Input({ required: true }) close!: () => void;
  @Input({ required: true }) save!: () => void | Promise<void>;
  @Input({ required: true }) setAssetFormRouteStop!: (index: number, value: string) => void;
  @Input({ required: true }) openAssetFormRouteStopMap!: (index: number, event?: Event) => void;
  @Input({ required: true }) refreshAssetFromSourceLink!: () => void | Promise<void>;
  @Input({ required: true }) onAssetImageFileSelected!: (file: File) => void;
  protected showMobileAssetTypePicker = false;

  protected requestClose(): void {
    if (this.isSavePending) {
      return;
    }
    this.close();
  }

  protected submitForm(): void {
    if (!this.canSave || this.isSavePending) {
      return;
    }
    void this.save();
  }

  protected isPropertyAssetForm(): boolean {
    return this.assetForm?.type === 'Accommodation';
  }

  protected openMobileAssetTypeSelector(event: Event): void {
    if (!this.isMobileAssetTypeSheetViewport() || this.isSavePending) {
      return;
    }
    event.stopPropagation();
    this.showMobileAssetTypePicker = !this.showMobileAssetTypePicker;
  }

  protected selectMobileAssetType(type: AppTypes.AssetType, event?: Event): void {
    if (this.isSavePending) {
      return;
    }
    event?.stopPropagation();
    this.assetForm.type = type;
    this.showMobileAssetTypePicker = false;
  }

  protected isMobileAssetTypeSheetViewport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 900px)').matches;
  }

  @HostListener('window:keydown.escape', ['$event'])
  protected onEscapePressed(event: Event): void {
    if (!this.showMobileAssetTypePicker) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    this.showMobileAssetTypePicker = false;
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (!target.closest('.asset-form-mobile-type-picker')) {
      this.showMobileAssetTypePicker = false;
    }
  }

  protected onImageFileChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    this.onAssetImageFileSelected(file);
    target.value = '';
  }
}
