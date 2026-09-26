import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { DeploymentBrandingDto } from '../../../shared/core/contracts/deployment-configuration.interface';
import { DeploymentBrandComponent } from '../../../shared/ui/components/core/deployment-brand/deployment-brand.component';
import { AppMenuComponent } from '../../../shared/ui/components/core/menu/menu.component';
import type { AppMenuItem, AppMenuItemSelectEvent } from '../../../shared/ui/components/core/menu/menu.types';

// The same header is painted before the protected route is ready. It contains
// no user data or actions until Home supplies the authenticated menu model.
export const HOME_HEADER_LOADING_ITEMS: readonly AppMenuItem<string, never>[] = [
  { id: 'home-mode', label: 'Preferences', icon: 'person', kind: 'select-trigger',
    layout: 'pill', palette: 'blue', disabled: true, ariaLabel: 'Select game mode' },
  { id: 'home-filter', label: 'home.filters', layout: 'pill', icon: 'filter_alt', kind: 'action', palette: 'filter',
    disabled: true, ariaLabel: 'Open profile filters' },
  { id: 'home-history', label: 'ratings', layout: 'pill', icon: 'history', kind: 'action', palette: 'gold',
    disabled: true, ariaLabel: 'Open game history' }
];

@Component({
  selector: 'app-home-header',
  imports: [DeploymentBrandComponent, AppMenuComponent],
  template: `
    <header class="game-header">
      <a class="game-brand" [attr.aria-label]="branding.productName + ' home'">
        <app-deployment-brand [branding]="branding"></app-deployment-brand>
      </a>
      @if (showControls) {
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
  @Input() items: readonly AppMenuItem<string, TContext>[] = HOME_HEADER_LOADING_ITEMS;
  @Input() showControls = true;
  @Output() readonly itemSelect = new EventEmitter<AppMenuItemSelectEvent<string, TContext>>();
}
