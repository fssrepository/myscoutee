import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { I18nPipe, PopupComponent, AppMenuDispatcher, AppMenuOutletComponent, AppMenuTriggerComponent } from '@fssrepository/myscoutee-components';
import { PricingSlotPanelComponent } from '../pricing-slot-panel';
import { PricingEditorInputComponent } from '../pricing-editor.component';

@Component({
  selector: 'app-pricing-editor-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    AppMenuOutletComponent,
    AppMenuTriggerComponent,
    PopupComponent,
    PricingSlotPanelComponent,
    I18nPipe
  ],
  templateUrl: '../pricing-editor.component.html',
  styleUrls: [
    '../pricing-editor.component.scss',
    './pricing-editor-popup.component.scss'
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AppMenuDispatcher]
})
export class PricingEditorPopupComponent extends PricingEditorInputComponent {
  protected override readonly popupPresentation = true;
  constructor() {
    super(inject(ChangeDetectorRef));
  }
}
