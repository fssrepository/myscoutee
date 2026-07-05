import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewEncapsulation,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { APP_STATIC_DATA } from '../../../../shared/app-static-data';
import { AssetCardBuilder } from '../../../../shared/core/base/builders';
import { AssetDefaultsBuilder } from '../../../../shared/core/base/builders/asset-defaults.builder';
import * as AppConstants from '../../../../shared/core/common/constants';
import type * as ContractTypes from '../../../../shared/core/contracts';
import {
  SubEventResourcePopupStore,
  type ResourceAssetViewState
} from '../../../../shared/ui/context/stores/sub-event-resource-popup.store';
import {
  PopupComponent,
  type PopupAction,
  type PopupActionEvent,
  type PopupModel
} from '../../../../shared/ui/components/core/popup';

export type EventResourceAssetViewModel = ResourceAssetViewState;

@Component({
  selector: 'app-event-resource-asset-view',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PopupComponent],
  templateUrl: './event-resource-asset-view.component.html',
  styleUrl: './event-resource-asset-view.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventResourceAssetViewComponent implements OnChanges {
  @Input() view: EventResourceAssetViewModel | null = null;
  @Input() parentZIndex = 2600;

  private readonly resourcePopupStore = inject(SubEventResourcePopupStore);

  protected readonly assetTypeTransport = AppConstants.ASSET_TYPE_TRANSPORT;
  protected showPoliciesPopup = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['view']) {
      this.showPoliciesPopup = false;
    }
  }

  protected close(event?: Event): void {
    event?.stopPropagation();
    this.resourcePopupStore.requestResourceAssetViewClose(event);
  }

  protected requestMembers(view: EventResourceAssetViewModel, event: Event): void {
    event.stopPropagation();
    this.resourcePopupStore.requestResourceAssetViewMembers(view, event);
  }

  protected canRequestMembers(): boolean {
    return this.resourcePopupStore.assetViewOutletContext() === 'resourcePopup';
  }

  protected openPoliciesPopup(event: Event): void {
    event.stopPropagation();
    this.showPoliciesPopup = true;
  }

  protected closePoliciesPopup(event?: Event): void {
    event?.stopPropagation();
    this.showPoliciesPopup = false;
  }

  protected assetViewPopupModel(view: EventResourceAssetViewModel): PopupModel {
    return {
      title: this.title(view),
      subtitle: view.card.title,
      ariaLabel: this.title(view),
      closeAriaLabel: 'Close asset view',
      closeOnBackdrop: true,
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      headerActions: this.assetViewHeaderActions(view),
      onClose: event => this.close(event),
      onAction: event => this.onAssetViewPopupAction(view, event)
    };
  }

  protected assetViewPopupZIndex(): number {
    return this.parentZIndex + 100;
  }

  private assetViewHeaderActions(view: EventResourceAssetViewModel): readonly PopupAction[] {
    if (!this.canRequestMembers()) {
      return [];
    }
    const pending = Math.max(0, Math.trunc(Number(view.card.pending) || 0));
    return [{
      id: 'members',
      icon: 'groups',
      label: pending > 0 ? `Members ${pending}` : 'Members',
      ariaLabel: 'Open asset members',
      palette: 'blue'
    }];
  }

  private onAssetViewPopupAction(
    view: EventResourceAssetViewModel,
    event: PopupActionEvent
  ): void {
    if (event.action.id === 'members') {
      this.requestMembers(view, event.sourceEvent);
    }
  }

  protected title(view: EventResourceAssetViewModel): string {
    return view.mode === 'edit' ? 'Edit Asset' : 'View Asset';
  }

  protected resourceTypeClass(type: AppConstants.SubEventResourceFilter): string {
    return AssetDefaultsBuilder.assetTypeClass(type === 'Members' ? AppConstants.ASSET_TYPE_TRANSPORT : type);
  }

  protected resourceTypeIcon(type: AppConstants.SubEventResourceFilter): string {
    return type === 'Members' ? 'groups' : AssetDefaultsBuilder.assetTypeIcon(type);
  }

  protected resourceTypeLabel(type: AppConstants.SubEventResourceFilter): string {
    return APP_STATIC_DATA.subEventResourceFilterLabels[type];
  }

  protected categoryLabel(view: EventResourceAssetViewModel): string {
    return AssetDefaultsBuilder.assetCategoryLabel(view.source?.category);
  }

  protected categoryClass(view: EventResourceAssetViewModel): string {
    return AssetDefaultsBuilder.assetCategoryClass(view.source?.category);
  }

  protected categoryIcon(view: EventResourceAssetViewModel): string {
    return AssetDefaultsBuilder.assetCategoryIcon(view.source?.category);
  }

  protected totalCapacity(view: EventResourceAssetViewModel): number {
    return Math.max(1, Number(view.source?.capacityTotal ?? view.card.capacityTotal) || 1);
  }

  protected quantity(view: EventResourceAssetViewModel): number {
    return Math.max(1, Number(view.source?.quantity ?? 1) || 1);
  }

  protected sourceLink(view: EventResourceAssetViewModel): string {
    return `${view.source?.sourceLink ?? view.card.sourceLink ?? ''}`.trim();
  }

  protected imageUrl(view: EventResourceAssetViewModel): string {
    return `${view.source?.imageUrl ?? view.card.imageUrl ?? ''}`.trim();
  }

  protected policies(view: EventResourceAssetViewModel): readonly ContractTypes.EventPolicyDTO[] {
    return AssetCardBuilder.assetPoliciesEnabled(view.source) ? view.source?.policies ?? [] : [];
  }

  protected requiredPoliciesCount(view: EventResourceAssetViewModel): number {
    return this.policies(view).filter(policy => policy.required !== false).length;
  }

  protected optionalPoliciesCount(view: EventResourceAssetViewModel): number {
    return Math.max(0, this.policies(view).length - this.requiredPoliciesCount(view));
  }

  protected policyMetaLabel(policy: ContractTypes.EventPolicyDTO): string {
    return policy.required === false ? 'Optional policy' : 'Required approval';
  }

  protected policyPreview(policy: ContractTypes.EventPolicyDTO): string {
    const description = policy.description.trim();
    if (description.length > 0) {
      return description;
    }
    return policy.required === false
      ? 'Borrowers can review this policy before sending the request.'
      : 'Borrowers must approve this lending policy before sending the request.';
  }

  protected routeStops(view: EventResourceAssetViewModel): readonly string[] {
    return view.card.routes.map(stop => stop.trim()).filter(Boolean);
  }

  protected hasRoute(view: EventResourceAssetViewModel): boolean {
    return this.routeStops(view).length > 0;
  }

  protected routeSummaryTitle(view: EventResourceAssetViewModel): string {
    const count = this.routeStops(view).length;
    if (count === 0) {
      return 'No route';
    }
    return `${count} ${count === 1 ? 'stop' : 'stops'}`;
  }

  protected routeSummaryMeta(view: EventResourceAssetViewModel): string {
    const stops = this.routeStops(view);
    if (stops.length === 0) {
      return 'No route is set for this event asset.';
    }
    return `${stops[0]}${stops.length > 1 ? ' · ' + stops[stops.length - 1] : ''}`;
  }

  protected pricingEnabled(view: EventResourceAssetViewModel): boolean {
    return Boolean(view.source?.pricing?.enabled);
  }

  protected pricingModeLabel(view: EventResourceAssetViewModel): string {
    const mode = view.source?.pricing?.mode ?? 'fixed';
    return mode
      .split('-')
      .map(part => part.length > 0 ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
      .join(' ');
  }

  protected pricingBaseLabel(view: EventResourceAssetViewModel): string {
    const pricing = view.source?.pricing;
    return this.formatMoney(Number(pricing?.basePrice) || 0, pricing?.currency || 'USD');
  }

  protected pricingChargeLabel(view: EventResourceAssetViewModel): string {
    switch (view.source?.pricing?.chargeType) {
      case 'per_attendee':
        return 'per attendee';
      case 'per_slot':
        return 'per slot';
      case 'per_booking':
      default:
        return 'per booking';
    }
  }

  protected pricingWhyLabel(view: EventResourceAssetViewModel): string {
    const pricing = view.source?.pricing;
    if (!pricing?.enabled) {
      return 'Pricing is currently disabled for this asset.';
    }
    if (pricing.mode === 'fixed') {
      return 'Pricing Mode is set to Fixed, so demand and time rules are not changing the amount yet.';
    }
    const activeRules = [
      pricing.demandRulesEnabled ? 'demand rules' : '',
      pricing.timeRulesEnabled ? 'time rules' : ''
    ].filter(Boolean);
    return activeRules.length > 0
      ? `This preview uses the base price and can be adjusted by ${activeRules.join(' and ')}.`
      : 'This preview is currently showing the base price.';
  }

  private formatMoney(amount: number, currency = 'USD'): string {
    switch ((currency || '').trim().toUpperCase()) {
      case 'EUR':
        return `EUR ${(Number(amount) || 0).toFixed(2)}`;
      case 'GBP':
        return `GBP ${(Number(amount) || 0).toFixed(2)}`;
      default:
        return `$${(Number(amount) || 0).toFixed(2)}`;
    }
  }

}
