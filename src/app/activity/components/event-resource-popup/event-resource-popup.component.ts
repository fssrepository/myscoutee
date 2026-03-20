import { CommonModule } from '@angular/common';
import { Component, DoCheck, Input, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule, MatSelect } from '@angular/material/select';
import { of } from 'rxjs';

import {
  InfoCardComponent,
  SmartListComponent,
  type InfoCardData,
  type InfoCardMenuAction,
  type InfoCardMenuActionEvent,
  type ListQuery,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage
} from '../../../shared/ui';
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
  resourceFilterPanelWidth(): string;
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
    SmartListComponent,
    InfoCardComponent
  ],
  templateUrl: './event-resource-popup.component.html',
  styleUrls: ['./event-resource-popup.component.scss']
})
export class EventResourcePopupComponent implements DoCheck {
  private lastCardsSignature = '';

  @Input({ required: true }) host!: EventResourcePopupHost;

  protected resourceFilterOpen = false;

  protected resourceSmartListQuery: Partial<ListQuery<{ revision: number }>> = {
    filters: { revision: 0 }
  };

  protected resourceItemTemplateRef?: TemplateRef<SmartListItemTemplateContext<AppTypes.SubEventResourceCard, { revision: number }>>;

  @ViewChild('resourceItemTemplate', { read: TemplateRef })
  private set resourceItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppTypes.SubEventResourceCard, { revision: number }>> | undefined
  ) {
    this.resourceItemTemplateRef = value;
  }

  protected readonly resourceSmartListLoadPage: SmartListLoadPage<AppTypes.SubEventResourceCard, { revision: number }> = (
    query
  ) => {
    const cards = this.host?.cards?.() ?? [];
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const start = page * pageSize;
    return of({
      items: cards.slice(start, start + pageSize),
      total: cards.length
    });
  };

  protected readonly resourceSmartListConfig: SmartListConfig<AppTypes.SubEventResourceCard, { revision: number }> = {
    pageSize: 18,
    loadingDelayMs: 0,
    loadingWindowMs: 900,
    defaultView: 'list',
    headerProgress: {
      enabled: true
    },
    emptyLabel: 'No assigned resources yet.',
    emptyDescription: 'Assign current-user assets to see them here.',
    showStickyHeader: false,
    showGroupMarker: () => false,
    listLayout: 'card-grid',
    desktopColumns: 3,
    snapMode: 'none',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'subevent-resource-card-list': true
    },
    trackBy: (_index, card) => card.id
  };

  ngDoCheck(): void {
    const cards = this.host?.cards?.() ?? [];
    const signature = `${this.host?.resourceFilter?.() ?? ''}:${cards.map(card => [
      card.id,
      card.accepted,
      card.pending,
      card.capacityTotal
    ].join(':')).join('|')}`;
    if (signature === this.lastCardsSignature) {
      return;
    }
    this.lastCardsSignature = signature;
    this.resourceSmartListQuery = {
      filters: {
        revision: Date.now()
      }
    };
  }

  protected resourceInfoCard(
    card: AppTypes.SubEventResourceCard,
    options: { groupLabel?: string | null } = {}
  ): InfoCardData {
    return {
      rowId: card.id,
      groupLabel: options.groupLabel ?? null,
      title: card.title,
      imageUrl: card.imageUrl,
      metaRows: [`${card.type} · ${card.subtitle} · ${card.city}`],
      description: card.details,
      leadingIcon: {
        icon: this.host.resourceTypeIcon(card.type)
      },
      mediaStart: this.resourceMediaStart(card),
      mediaEnd: {
        variant: 'badge',
        tone: 'default',
        label: this.host.occupancyLabel(card),
        interactive: this.host.canOpenBadgeDetails(card),
        pendingCount: card.pending,
        ariaLabel: this.host.canOpenAssetMembers(card)
          ? 'Open member requests'
          : 'Open resource details'
      },
      menuActions: this.resourceMenuActions(card),
      clickable: false
    };
  }

  protected openResourceCardMap(card: AppTypes.SubEventResourceCard): void {
    if (!this.host.canOpenMap(card)) {
      return;
    }
    this.host.openMap(card);
  }

  protected openResourceCardBadgeDetails(card: AppTypes.SubEventResourceCard): void {
    if (!this.host.canOpenBadgeDetails(card)) {
      return;
    }
    this.host.openBadgeDetails(card);
  }

  protected onResourceFilterOpenedChange(isOpen: boolean, select: MatSelect): void {
    this.resourceFilterOpen = isOpen;
    this.host.onResourceFilterOpened(isOpen, select);
  }

  protected onResourceCardMenuAction(card: AppTypes.SubEventResourceCard, event: InfoCardMenuActionEvent): void {
    if (event.actionId === 'join') {
      this.host.join(card, new Event('click'));
      return;
    }
    if (event.actionId === 'capacity') {
      this.host.openCapacityEditor(card, new Event('click'));
      return;
    }
    if (event.actionId === 'route') {
      this.host.openRouteEditor(card, new Event('click'));
      return;
    }
    this.host.delete(card, new Event('click'));
  }

  private resourceMediaStart(card: AppTypes.SubEventResourceCard): NonNullable<InfoCardData['mediaStart']> | null {
    if (!this.host.canOpenMap(card)) {
      return null;
    }
    return {
      variant: 'avatar',
      tone: 'default',
      icon: 'location_on',
      interactive: true,
      ariaLabel: card.type === 'Car' ? 'Open route map' : 'Open accommodation map'
    };
  }

  private resourceMenuActions(card: AppTypes.SubEventResourceCard): readonly InfoCardMenuAction[] {
    const actions: InfoCardMenuAction[] = [];
    if (this.host.canJoin(card)) {
      actions.push({
        id: 'join',
        label: 'Join',
        icon: 'login',
        tone: 'accent'
      });
    }
    if (this.host.canEditCapacity(card)) {
      actions.push({
        id: 'capacity',
        label: 'Edit Capacity',
        icon: 'edit'
      });
    }
    if (this.host.canEditRoute(card)) {
      actions.push({
        id: 'route',
        label: this.host.routeMenuLabel(card),
        icon: 'route'
      });
    }
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: 'delete',
      tone: 'destructive'
    });
    return actions;
  }
}
