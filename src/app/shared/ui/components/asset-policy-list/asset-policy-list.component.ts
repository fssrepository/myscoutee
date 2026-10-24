import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { I18nPipe } from '@fssrepository/myscoutee-components';
import type { EventPolicyDTO } from '../../../core/contracts';

@Component({
  selector: 'app-asset-policy-list',
  standalone: true,
  imports: [I18nPipe],
  templateUrl: './asset-policy-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [':host { display: contents; }']
})
export class AssetPolicyListComponent {
  @Input() policies: readonly EventPolicyDTO[] = [];
  @Input() acceptedPolicyIds: readonly string[] = [];
  @Output() readonly policyToggled = new EventEmitter<string>();
}
