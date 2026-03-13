import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-asset-delete-confirm',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './asset-delete-confirm.component.html',
  styleUrl: './asset-delete-confirm.component.scss'
})
export class AssetDeleteConfirmComponent {
  @Input() visible = false;
  @Input() label = '';
  @Input({ required: true }) cancel!: () => void;
  @Input({ required: true }) confirm!: () => void;
}
