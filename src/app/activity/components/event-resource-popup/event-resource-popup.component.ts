import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule, MatSelect } from '@angular/material/select';

import { LazyBgImageDirective } from '../../../shared/ui';
import type * as AppTypes from '../../../shared/core/base/models';

interface CapacityEditorState {
  title: string;
  capacityMin: number;
  capacityMax: number;
  capacityLimit: number;
}

interface RouteEditorState {
  title: string;
  routes: string[];
}

export interface EventResourcePopupHost {
  title(): string;
  subtitle(): string;
  summary(): string;
  isMobileView(): boolean;
  isMobilePopupSheetViewport(): boolean;
  resourceFilter(): AppTypes.AssetType;
  resourceFilterOptions(): readonly AppTypes.AssetType[];
  resourceFilterCount(type: AppTypes.AssetType): number;
  resourceTypeClass(type: AppTypes.SubEventResourceFilter): string;
  resourceTypeIcon(type: AppTypes.SubEventResourceFilter): string;
  cards(): AppTypes.SubEventResourceCard[];
  capacityEditor(): CapacityEditorState | null;
  routeEditor(): RouteEditorState | null;
  close(): void;
  selectResourceFilter(filter: AppTypes.SubEventResourceFilter): void;
  onResourceFilterOpened(isOpen: boolean, select: MatSelect): void;
  openMobileResourceFilterSelector(event?: Event): void;
  openAssignPopup(event?: Event): void;
  trackByCard(index: number, card: AppTypes.SubEventResourceCard): string;
  canOpenMap(card: AppTypes.SubEventResourceCard): boolean;
  openMap(card: AppTypes.SubEventResourceCard, event?: Event): void;
  canOpenBadgeDetails(card: AppTypes.SubEventResourceCard): boolean;
  openBadgeDetails(card: AppTypes.SubEventResourceCard, event?: Event): void;
  occupancyLabel(card: AppTypes.SubEventResourceCard): string;
  canOpenAssetMembers(card: AppTypes.SubEventResourceCard): boolean;
  isItemActionMenuOpen(card: AppTypes.SubEventResourceCard): boolean;
  isItemActionMenuOpenUp(card: AppTypes.SubEventResourceCard): boolean;
  toggleItemActionMenu(card: AppTypes.SubEventResourceCard, event: Event): void;
  canJoin(card: AppTypes.SubEventResourceCard): boolean;
  join(card: AppTypes.SubEventResourceCard, event: Event): void;
  canEditCapacity(card: AppTypes.SubEventResourceCard): boolean;
  openCapacityEditor(card: AppTypes.SubEventResourceCard, event: Event): void;
  canEditRoute(card: AppTypes.SubEventResourceCard): boolean;
  routeMenuLabel(card: AppTypes.SubEventResourceCard): string;
  openRouteEditor(card: AppTypes.SubEventResourceCard, event: Event): void;
  delete(card: AppTypes.SubEventResourceCard, event: Event): void;
  closeCapacityEditor(event?: Event): void;
  canSubmitCapacityEditor(): boolean;
  onCapacityMinChange(value: number | string): void;
  onCapacityMaxChange(value: number | string): void;
  saveCapacityEditor(event?: Event): void;
  closeRouteEditor(event?: Event): void;
  routeEditorSupportsMultiRoute(): boolean;
  openRouteMap(event?: Event): void;
  addRouteStop(): void;
  dropRouteStop(event: unknown): void;
  updateRouteStop(index: number, value: string): void;
  openRouteStopMap(index: number, event?: Event): void;
  removeRouteStop(index: number): void;
  canSubmitRouteEditor(): boolean;
  saveRouteEditor(event?: Event): void;
}

@Component({
  selector: 'app-event-resource-popup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    LazyBgImageDirective
  ],
  templateUrl: './event-resource-popup.component.html',
  styleUrls: ['./event-resource-popup.component.scss']
})
export class EventResourcePopupComponent {
  @Input({ required: true }) host!: EventResourcePopupHost;
}
