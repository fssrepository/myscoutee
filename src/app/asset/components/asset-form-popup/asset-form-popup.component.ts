import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
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
  @Input() assetFormVisibility: AppTypes.EventVisibility = 'Invitation only';
  @Input() assetTypeOptions: readonly AppTypes.AssetType[] = [];
  @Input() assetFormRouteStops: string[] = [];
  @Input() isEventEditorReadOnly = false;
  @Input({ required: true }) assetTypeClass!: (type: AppTypes.AssetFilterType) => string;
  @Input({ required: true }) assetTypeIcon!: (type: AppTypes.AssetFilterType) => string;
  @Input({ required: true }) eventVisibilityClass!: (option: AppTypes.EventVisibility) => string;
  @Input({ required: true }) close!: () => void;
  @Input({ required: true }) save!: () => void;
  @Input({ required: true }) setAssetFormRouteStop!: (index: number, value: string) => void;
  @Input({ required: true }) openAssetFormRouteStopMap!: (index: number, event?: Event) => void;
  @Input({ required: true }) refreshAssetFromSourceLink!: () => void;
  @Input({ required: true }) onAssetImageFileSelected!: (file: File) => void;

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
