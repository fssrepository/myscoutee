import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  type UiBranding as DeploymentBrandingDto,
  DeploymentBrandComponent,
  AppMenuComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent
} from '@myscoutee/components';

@Component({
  selector: 'app-home-header',
  imports: [DeploymentBrandComponent, AppMenuComponent],
  template: `
    <header class="game-header">
      <a class="game-brand" [attr.aria-label]="branding.productName + ' home'">
        <app-deployment-brand [branding]="branding"></app-deployment-brand>
      </a>
      @if (showControls && items.length) {
        <div class="game-actions">
          <app-menu class="game-header-menu" kind="inline" layout="row" [model]="{ density: 'compact' }"
            [items]="items" (itemSelect)="itemSelect.emit($event)"></app-menu>
        </div>
      }
    </header>
  `,
  styleUrl: './home-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeHeaderComponent<TContext = unknown> {
  @Input({ required: true }) branding!: DeploymentBrandingDto;
  @Input() items: readonly AppMenuItem<string, TContext>[] = [];
  @Input() showControls = true;
  @Output() readonly itemSelect = new EventEmitter<AppMenuItemSelectEvent<string, TContext>>();
}
