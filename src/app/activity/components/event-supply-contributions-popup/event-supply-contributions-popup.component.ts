import type * as AppDTOs from '../../../shared/core/contracts';
import type * as ContractTypes from '../../../shared/core/contracts';
import * as AppConstants from '../../../shared/core/common/constants';

import {
  Component,
  DoCheck,
  TemplateRef,
  ViewChild,
  inject
} from '@angular/core';
import {
  FormsModule
} from '@angular/forms';
import {
  from
} from 'rxjs';
import {
  PopupComponent,
  SingleRowComponent,
  SmartListComponent,
  type AppMenuItem,
  type AppMenuItemSelectEvent,
  type ListQuery,
  type PopupActionEvent,
  type PopupControl,
  type PopupModel,
  type SingleRowData,
  type SmartListConfig,
  type SmartListItemTemplateContext,
  type SmartListLoadPage
} from '../../../shared/ui';
import {
  FormFlowComponent,
  type FormFlowControlModel,
  type FormFlowModel
} from '../../../shared/ui/components/core/form/flow';
import {
  APP_STATIC_DATA
} from '../../../shared/app-static-data';
import {
  AppUtils
} from '../../../shared/app-utils';
import {
  ActivityResourceBuilder,
  ActivityResourcesService,
  UsersService,
  type UserDto
} from '../../../shared/core';
import {
  AssetStore
} from '../../../shared/ui/context/stores/asset.store';
import {
  SubEventResourcePopupStore
} from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import {
  DialogStore
} from '../../../shared/ui/context/stores/dialog.store';
import type {
  ResourcePopupContext,
  SupplyBringDialogState
} from '../../../shared/ui/context/stores/sub-event-resource-popup.store';
import { UserProfileStore } from '../../../shared/ui/context/stores/user-profile.store';

type ResourceAssetDTO = (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO) & {
  description?: string;
  details?: string;
  sourceLink?: string;
  routes?: string[];
  topics?: string[];
  policies?: AppDTOs.EventPolicyItemDTO[];
  pricing?: AppDTOs.PricingConfig | null;
  locationLabel?: string;
  priceLabel?: string;
  policyCount?: number;
};

interface SupplyContributionListFilters {
  revision?: number;
  contextKey?: string;
}

interface SupplyContributionRemovalRequest {
  assetId: string;
  entryId: string;
  label: string;
}

@Component({
  selector: 'app-event-supply-contributions-popup',
  standalone: true,
  imports: [
    FormsModule,
    FormFlowComponent,
    PopupComponent,
    SingleRowComponent,
    SmartListComponent
  ],
  templateUrl: './event-supply-contributions-popup.component.html',
  styleUrls: ['./event-supply-contributions-popup.component.scss']
})
export class EventSupplyContributionsPopupComponent implements DoCheck {
  protected readonly resourcePopupStore = inject(SubEventResourcePopupStore);

  private readonly userProfileStore = inject(UserProfileStore);
  private readonly assetStore = inject(AssetStore);
  private readonly activityResourcesService = inject(ActivityResourcesService);
  private readonly usersService = inject(UsersService);
  private readonly dialogStore = inject(DialogStore);
  private pendingSupplyBringAbortController: AbortController | null = null;
  private pendingSupplyBringRequestVersion = 0;
  private lastContextKey = '';

  private get users(): UserDto[] {
    return this.usersService.peekCachedUsers();
  }

  private ownedAssetCards(): ResourceAssetDTO[] {
    return this.assetStore.assetCards();
  }

  private get userById(): Map<string, UserDto> {
    return new Map(this.users.map(user => [user.id, user]));
  }

  protected supplyContributionSmartListQuery: Partial<ListQuery<SupplyContributionListFilters>> = {
    filters: {
      revision: 0,
      contextKey: ''
    }
  };

  @ViewChild('supplyContributionSmartList')
  private supplyContributionSmartList?: SmartListComponent<AppDTOs.SubEventSupplyContributionRowDTO, SupplyContributionListFilters>;

  protected supplyContributionItemTemplateRef?: TemplateRef<
    SmartListItemTemplateContext<AppDTOs.SubEventSupplyContributionRowDTO, SupplyContributionListFilters>
  >;

  @ViewChild('supplyContributionItemTemplate', { read: TemplateRef })
  protected set supplyContributionItemTemplate(
    value: TemplateRef<SmartListItemTemplateContext<AppDTOs.SubEventSupplyContributionRowDTO, SupplyContributionListFilters>> | undefined
  ) {
    this.supplyContributionItemTemplateRef = value;
  }

  protected readonly supplyContributionSmartListLoadPage: SmartListLoadPage<
    AppDTOs.SubEventSupplyContributionRowDTO,
    SupplyContributionListFilters
  > = query => from(this.loadSupplyContributionRowsPage(query));

  protected readonly supplyContributionSmartListConfig: SmartListConfig<
    AppDTOs.SubEventSupplyContributionRowDTO,
    SupplyContributionListFilters
  > = {
    pageSize: 12,
    defaultView: 'list',
    headerProgress: {
      enabled: true
    },
    showStickyHeader: false,
    showGroupMarker: () => false,
    emptyLabel: 'No quantity added yet',
    emptyDescription: 'Use the + button in the header to add your quantity row.',
    listLayout: 'card-grid',
    desktopColumns: 1,
    snapMode: 'none',
    containerClass: {
      'experience-card-list': true,
      'assets-card-list': true,
      'subevent-supply-contribution-list': true
    },
    trackBy: (_index, row) => row.id,
    cacheable: {
      identity: row => row.id,
      equals: (current, next) => current.id === next.id
        && current.userId === next.userId
        && current.quantity === next.quantity
        && current.addedAtIso === next.addedAtIso
    },
    sortable: {
      sortKey: row => [-AppUtils.toSortableDate(row.addedAtIso), row.id]
    }
  };

  ngDoCheck(): void {
    const popup = this.resourcePopupStore.popupContextRef();
    const supply = this.resourcePopupStore.supplyPopupRef();
    const contextKey = popup && supply
      ? `${popup.ownerId}:${supply.subEventId}:${supply.assetId}:${this.activeUser().id}`
      : '';
    if (contextKey === this.lastContextKey) {
      return;
    }
    this.lastContextKey = contextKey;
    this.supplyContributionSmartListQuery = {
      filters: {
        revision: Date.now(),
        contextKey
      }
    };
  }

  protected supplyContributionSingleRow(row: AppDTOs.SubEventSupplyContributionRowDTO): SingleRowData {
    return {
      id: row.id,
      title: `${row.name}, ${row.age} · ${row.city}`,
      subtitle: this.addedLabel(row.addedAtIso),
      avatarInitials: row.initials,
      avatarAriaLabel: row.name,
      badges: [{
        label: this.quantityLabel(row.quantity),
        ariaLabel: this.quantityLabel(row.quantity),
        tone: 'inverse',
        position: 'top-right'
      }],
      menuActions: this.canDeleteSupplyContribution(row) ? ['delete'] : []
    };
  }

  protected onSupplyContributionSharedMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as {
      row?: SingleRowData;
      card?: SingleRowData;
      action?: { id?: string };
    } | null | undefined;
    const menuRow = context?.row ?? context?.card;
    const row = menuRow
      ? this.supplyContributionSmartList?.findVisibleItem(item => item.id === menuRow.id)
      : null;
    if (!row || context?.action?.id !== 'delete' || !this.canDeleteSupplyContribution(row)) {
      return;
    }
    this.requestDeleteSupplyContribution(row);
  }

  protected supplyPopupTitle(): string {
    const context = this.resourcePopupStore.supplyPopupRef();
    const popup = this.resourcePopupStore.popupContextRef();
    if (!context || !popup) {
      return APP_STATIC_DATA.assetTypeLabels.Supplies;
    }
    const stageLabel = this.subEventStageLabel(popup.subEvent);
    return stageLabel ? `${context.title} - ${stageLabel}` : context.title;
  }

  protected popupSubtitle(): string {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return 'Event';
    }
    const subEventName = this.subEventDisplayName(context.subEvent);
    if (context.parentTitle && subEventName) {
      return `${context.parentTitle} - ${subEventName}`;
    }
    return context.parentTitle || subEventName || 'Event';
  }

  protected supplyContributionsPopupModel(): PopupModel {
    const title = this.supplyPopupTitle();
    return {
      title,
      subtitle: this.popupSubtitle(),
      translateTitle: false,
      translateSubtitle: false,
      ariaLabel: title,
      closeAriaLabel: 'Close',
      size: 'wide',
      height: 'full',
      headerTone: 'accent',
      bodyLayout: 'fill',
      backdropTone: 'dim',
      headerActions: [{
        id: 'add-supply-quantity',
        icon: 'add',
        ariaLabel: 'Add supply quantity row',
        palette: 'blue'
      }],
      onClose: () => this.closeSupplyContributionsPopup(),
      onAction: event => this.onSupplyContributionsPopupAction(event)
    };
  }

  protected supplyContributionsPopupZIndex(): number {
    return 3200;
  }

  protected bringItemsPopupModel(dialog: SupplyBringDialogState): PopupModel {
    return {
      title: 'Bring Items',
      subtitle: dialog.title,
      translateSubtitle: false,
      ariaLabel: 'Bring Items',
      closeAriaLabel: 'Close bring items',
      size: 'small',
      height: 'auto',
      headerTone: 'accent',
      backdropTone: 'dim',
      headerControls: this.bringItemsPopupHeaderControls(dialog),
      onClose: () => this.cancelBringDialog(),
      onMenuSelect: event => this.onBringItemsMenuSelect(event.itemSelect)
    };
  }

  private bringItemsPopupHeaderControls(dialog: SupplyBringDialogState): readonly PopupControl[] {
    return [{
      kind: 'menu',
      id: 'bring-items-save',
      menuKind: 'inline',
      items: this.bringItemsSaveMenuItems(dialog),
      closeOnSelect: false
    }];
  }

  private bringItemsSaveMenuItems(
    dialog: SupplyBringDialogState
  ): readonly AppMenuItem<'save-supply-quantity'>[] {
    const canSave = this.canSubmitBringDialog();
    return [{
      id: 'save-supply-quantity',
      icon: 'done',
      kind: 'action',
      palette: 'green',
      disabled: !canSave || dialog.busy,
      ariaLabel: 'Save supply quantity',
      progress: dialog.busy
        ? {
            state: 'loading',
            shape: 'circle'
          }
        : dialog.error
          ? {
              state: 'error',
              shape: 'circle'
            }
          : null
    }];
  }

  private onBringItemsMenuSelect(event: AppMenuItemSelectEvent<string>): void {
    if (event.item.id === 'save-supply-quantity') {
      this.confirmBringDialog(event.sourceEvent);
    }
  }

  protected bringItemsPopupZIndex(): number {
    return 3300;
  }

  protected bringItemsFlowModel(dialog: SupplyBringDialogState): FormFlowModel {
    const controls: FormFlowControlModel[] = [{
      id: 'quantity',
      bind: 'quantity',
      kind: 'number',
      layout: 'wide',
      label: 'Items',
      description: `Range: ${dialog.min} - ${dialog.max}`,
      required: true,
      min: dialog.min,
      max: dialog.max,
      step: 1,
      disabled: dialog.busy
    }];
    const errorMessage = this.bringErrorMessage();
    if (errorMessage) {
      controls.push({
        id: 'save-error',
        kind: 'static',
        layout: 'wide',
        label: 'Unable to save quantity',
        summary: {
          hidden: true,
          value: () => errorMessage
        }
      });
    }
    return {
      title: 'Bring Items',
      layout: 'grouped',
      tone: errorMessage ? 'orange' : 'blue',
      header: false,
      summary: { enabled: false },
      completion: { controls: 'none' },
      save: null,
      steps: [{
        id: 'quantity',
        title: '',
        chrome: 'none',
        controls
      }]
    };
  }

  protected onBringItemsFlowValueChange(value: unknown): void {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return;
    }
    this.onBringQuantityChange((value as Record<string, unknown>)['quantity'] as number | string);
  }

  private onSupplyContributionsPopupAction(event: PopupActionEvent): void {
    if (event.action.id === 'add-supply-quantity') {
      this.openBringDialog(event.sourceEvent);
    }
  }

  protected async loadSupplyContributionRowsPage(
    query: ListQuery<SupplyContributionListFilters>
  ): Promise<{ items: AppDTOs.SubEventSupplyContributionRowDTO[]; total: number }> {
    const popup = this.resourcePopupStore.popupContextRef();
    const supply = this.resourcePopupStore.supplyPopupRef();
    if (!popup || !supply) {
      return {
        items: [],
        total: 0
      };
    }
    const page = Math.max(0, Math.trunc(Number(query.page) || 0));
    const pageSize = Math.max(1, Math.trunc(Number(query.pageSize) || 1));
    const result = await this.activityResourcesService.querySupplyContributionPage(
      popup.ownerId,
      supply.subEventId,
      supply.assetId,
      page,
      pageSize,
      this.activeUser().id
    );
    await this.usersService.warmCachedUsers(result.items.map(entry => entry.userId));
    return {
      items: this.buildSupplyContributionRows(result.items),
      total: result.total
    };
  }

  protected closeSupplyContributionsPopup(): void {
    this.abortPendingSupplyBringRequest();
    this.resourcePopupStore.supplyPopupRef.set(null);
    this.resourcePopupStore.bringDialogRef.set(null);
  }

  protected openBringDialog(event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.supplyPopupRef();
    if (!context) {
      return;
    }
    const source = this.ownedAssetCards().find(card => card.id === context.assetId && card.type === AppConstants.ASSET_TYPE_SUPPLIES);
    const settings = this.getSubEventAssignedAssetSettings(context.subEventId, AppConstants.ASSET_TYPE_SUPPLIES);
    const max = Math.max(1, settings[context.assetId]?.capacityMax ?? source?.capacityTotal ?? 1);
    this.resourcePopupStore.bringDialogRef.set({
      subEventId: context.subEventId,
      cardId: context.assetId,
      title: context.title,
      quantity: 1,
      min: 0,
      max,
      busy: false,
      error: null
    });
  }

  protected cancelBringDialog(): void {
    this.abortPendingSupplyBringRequest();
    this.resourcePopupStore.bringDialogRef.set(null);
  }

  protected canSubmitBringDialog(): boolean {
    const dialog = this.resourcePopupStore.bringDialogRef();
    return !!dialog && !dialog.busy && dialog.quantity >= dialog.min && dialog.quantity <= dialog.max;
  }

  protected onBringQuantityChange(value: number | string): void {
    const dialog = this.resourcePopupStore.bringDialogRef();
    if (!dialog || dialog.busy) {
      return;
    }
    const parsed = Number(value);
    const quantity = AppUtils.clampNumber(
      Number.isFinite(parsed) ? Math.trunc(parsed) : dialog.quantity,
      dialog.min,
      dialog.max
    );
    if (quantity === dialog.quantity && !dialog.error) {
      return;
    }
    this.resourcePopupStore.bringDialogRef.set({
      ...dialog,
      quantity,
      error: null
    });
  }

  protected confirmBringDialog(event?: Event): void {
    event?.stopPropagation();
    const dialog = this.resourcePopupStore.bringDialogRef();
    if (!dialog || dialog.busy || !this.canSubmitBringDialog()) {
      return;
    }
    if (dialog.quantity <= 0) {
      this.resourcePopupStore.bringDialogRef.set(null);
      return;
    }

    const nextState = this.buildPopupResourceState();
    if (!nextState) {
      return;
    }

    const nextEntry: AppDTOs.SubEventSupplyContributionEntryDTO = {
      id: `subevent-supply-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: this.activeUser().id,
      quantity: dialog.quantity,
      addedAtIso: AppUtils.toIsoDateTime(new Date())
    };
    const currentEntries = nextState.supplyContributionEntriesByAssetId[dialog.cardId] ?? [];
    nextState.supplyContributionEntriesByAssetId = {
      ...nextState.supplyContributionEntriesByAssetId,
      [dialog.cardId]: [nextEntry, ...currentEntries]
    };

    const requestVersion = ++this.pendingSupplyBringRequestVersion;
    const abortController = new AbortController();
    this.pendingSupplyBringAbortController = abortController;
    this.resourcePopupStore.bringDialogRef.set({
      ...dialog,
      busy: true,
      error: null
    });

    void this.activityResourcesService.replaceSubEventResourceState(nextState, abortController.signal)
      .then(savedState => {
        if (this.pendingSupplyBringAbortController === abortController) {
          this.pendingSupplyBringAbortController = null;
        }
        if (abortController.signal.aborted || requestVersion != this.pendingSupplyBringRequestVersion) {
          return;
        }
        const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
        this.applyPersistedPopupState(resolvedState);
        this.resourcePopupStore.bringDialogRef.set(null);
        this.insertVisibleSupplyContribution(nextEntry);
        this.syncPopupSubEventMetrics();
      })
      .catch(error => {
        if (this.pendingSupplyBringAbortController === abortController) {
          this.pendingSupplyBringAbortController = null;
        }
        if (abortController.signal.aborted || this.isAbortError(error) || requestVersion != this.pendingSupplyBringRequestVersion) {
          return;
        }
        const currentDialog = this.resourcePopupStore.bringDialogRef();
        if (!currentDialog || currentDialog.cardId !== dialog.cardId || currentDialog.subEventId !== dialog.subEventId) {
          return;
        }
        this.resourcePopupStore.bringDialogRef.set({
          ...currentDialog,
          busy: false,
          error: 'Unable to save quantity row.'
        });
      });
  }

  protected bringErrorMessage(): string {
    return this.resourcePopupStore.bringDialogRef()?.error?.trim() ?? '';
  }

  protected canDeleteSupplyContribution(row: AppDTOs.SubEventSupplyContributionRowDTO): boolean {
    return row.userId === this.activeUser().id;
  }

  protected requestDeleteSupplyContribution(row: AppDTOs.SubEventSupplyContributionRowDTO, event?: Event): void {
    event?.stopPropagation();
    const context = this.resourcePopupStore.supplyPopupRef();
    if (!context || row.userId !== this.activeUser().id) {
      return;
    }
    const pending: SupplyContributionRemovalRequest = {
      assetId: context.assetId,
      entryId: row.id,
      label: `${row.name} · ${row.quantity}`
    };
    this.dialogStore.open({
      title: 'Delete quantity row',
      message: `Delete "${pending.label}" from supplies?`,
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      busyConfirmLabel: 'Deleting...',
      confirmTone: 'danger',
      failureMessage: 'Unable to delete quantity row.',
      onConfirm: () => this.removeSupplyContribution(pending)
    });
  }

  private async removeSupplyContribution(pending: SupplyContributionRemovalRequest): Promise<void> {
    const nextState = this.buildPopupResourceState();
    if (!nextState) {
      throw new Error('Unable to delete quantity row.');
    }

    const currentEntries = nextState.supplyContributionEntriesByAssetId[pending.assetId] ?? [];
    const nextEntries = currentEntries.filter(entry => entry.id !== pending.entryId);
    if (nextEntries.length === currentEntries.length) {
      throw new Error('This quantity row is no longer available.');
    }
    nextState.supplyContributionEntriesByAssetId = {
      ...nextState.supplyContributionEntriesByAssetId,
      [pending.assetId]: nextEntries
    };

    const savedState = await this.activityResourcesService.replaceSubEventResourceState(nextState);
    const resolvedState = ActivityResourceBuilder.normalizeState(savedState, nextState) ?? nextState;
    this.applyPersistedPopupState(resolvedState);
    this.supplyContributionSmartList?.removeVisibleItemByIdentity(pending.entryId, { totalDelta: -1 });
    this.syncPopupSubEventMetrics();
  }

  protected addedLabel(addedAtIso: string): string {
    const parsed = new Date(addedAtIso);
    const value = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return value.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  protected quantityLabel(quantity: number): string {
    const normalized = AppUtils.clampNumber(Math.trunc(quantity), 0, Number.MAX_SAFE_INTEGER);
    return normalized === 1 ? '1 item' : `${normalized} items`;
  }

  private activeUser(): UserDto {
    const activeUserId = this.userProfileStore.activeUserId().trim();
    return this.userProfileStore.activeUserProfile()
      ?? this.usersService.peekCachedUserById(activeUserId)
      ?? this.users[0]
      ?? this.createFallbackUser(activeUserId);
  }

  private buildSupplyContributionRows(
    entries: readonly AppDTOs.SubEventSupplyContributionEntryDTO[]
  ): AppDTOs.SubEventSupplyContributionRowDTO[] {
    return entries
      .map(entry => {
        const user = this.userById.get(entry.userId) ?? null;
        return {
          id: entry.id,
          userId: entry.userId,
          name: user?.name ?? 'Unknown member',
          initials: user?.initials ?? AppUtils.initialsFromText(user?.name ?? 'Unknown member'),
          gender: user?.gender ?? 'woman',
          age: user?.age ?? 0,
          city: user?.city ?? '',
          addedAtIso: entry.addedAtIso,
          quantity: AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER)
        };
      })
      .sort((a, b) => AppUtils.toSortableDate(b.addedAtIso) - AppUtils.toSortableDate(a.addedAtIso));
  }

  private insertVisibleSupplyContribution(entry: AppDTOs.SubEventSupplyContributionEntryDTO): void {
    const smartList = this.supplyContributionSmartList;
    const row = this.buildSupplyContributionRows([entry])[0];
    if (!smartList || !row) {
      return;
    }
    smartList.reinsertVisibleItem(row, {
      totalDelta: 1,
      loadedRange: 'before-or-within'
    });
  }

  private buildPopupResourceState(
    context: ResourcePopupContext | null = this.resourcePopupStore.popupContextRef()
  ): AppDTOs.ActivitySubEventResourceStateDTO | null {
    if (!context) {
      return null;
    }
    const ownerId = context.ownerId.trim();
    const subEventId = context.subEvent.id.trim();
    const assetOwnerUserId = this.activeUser().id;
    if (!ownerId || !subEventId || !assetOwnerUserId) {
      return null;
    }
    return {
      ownerId,
      subEventId,
      assetOwnerUserId,
      assetAssignmentIds: {
        [AppConstants.ASSET_TYPE_TRANSPORT]: [...this.resolveSubEventAssignedAssetIds(subEventId, AppConstants.ASSET_TYPE_TRANSPORT)],
        [AppConstants.ASSET_TYPE_ACCOMMODATION]: [...this.resolveSubEventAssignedAssetIds(subEventId, AppConstants.ASSET_TYPE_ACCOMMODATION)],
        [AppConstants.ASSET_TYPE_SUPPLIES]: [...this.resolveSubEventAssignedAssetIds(subEventId, AppConstants.ASSET_TYPE_SUPPLIES)]
      },
      assetSettingsByType: {
        [AppConstants.ASSET_TYPE_TRANSPORT]: { ...this.getSubEventAssignedAssetSettings(subEventId, AppConstants.ASSET_TYPE_TRANSPORT) },
        [AppConstants.ASSET_TYPE_ACCOMMODATION]: { ...this.getSubEventAssignedAssetSettings(subEventId, AppConstants.ASSET_TYPE_ACCOMMODATION) },
        [AppConstants.ASSET_TYPE_SUPPLIES]: { ...this.getSubEventAssignedAssetSettings(subEventId, AppConstants.ASSET_TYPE_SUPPLIES) }
      },
      supplyContributionEntriesByAssetId: Object.fromEntries(
        this.resolveSubEventAssignedAssetIds(subEventId, AppConstants.ASSET_TYPE_SUPPLIES).map(assetId => [
          assetId,
          this.subEventSupplyContributionEntries(subEventId, assetId).map(entry => ({ ...entry }))
        ])
      ),
      fallbackAssetCardsByType: {
        [AppConstants.ASSET_TYPE_TRANSPORT]: this.persistedAssignedFallbackCards(context, AppConstants.ASSET_TYPE_TRANSPORT),
        [AppConstants.ASSET_TYPE_ACCOMMODATION]: this.persistedAssignedFallbackCards(context, AppConstants.ASSET_TYPE_ACCOMMODATION),
        [AppConstants.ASSET_TYPE_SUPPLIES]: this.persistedAssignedFallbackCards(context, AppConstants.ASSET_TYPE_SUPPLIES)
      }
    };
  }

  private applyPersistedPopupState(state: AppDTOs.ActivitySubEventResourceStateDTO): void {
    const normalizedState = ActivityResourceBuilder.normalizeState(state, state);
    if (!normalizedState) {
      return;
    }
    const activeContext = this.resourcePopupStore.popupContextRef();
    if (
      activeContext
      && activeContext.ownerId === normalizedState.ownerId
      && activeContext.subEvent.id === normalizedState.subEventId
    ) {
      this.resourcePopupStore.popupContextRef.set({
        ...activeContext,
        fallbackCardsByType: this.mergePersistedFallbackCards(
          activeContext.fallbackCardsByType,
          normalizedState.fallbackAssetCardsByType,
          normalizedState.subEventId
        )
      });
    }
    for (const type of AppConstants.ASSET_TYPES) {
      this.resourcePopupStore.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(normalizedState.subEventId, type)] = [
        ...(normalizedState.assetAssignmentIds[type] ?? [])
      ];
      this.resourcePopupStore.assignedAssetSettingsByKey[this.subEventAssetAssignmentKey(normalizedState.subEventId, type)] = {
        ...(normalizedState.assetSettingsByType[type] ?? {})
      };
    }
    for (const key of Object.keys(this.resourcePopupStore.supplyContributionEntriesByAssignmentKey)) {
      if (key.startsWith(`${normalizedState.subEventId}:`)) {
        delete this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[key];
      }
    }
    for (const [assetId, entries] of Object.entries(normalizedState.supplyContributionEntriesByAssetId)) {
      this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(normalizedState.subEventId, assetId)] = entries
        .map(entry => ({ ...entry }));
    }
  }

  private syncPopupSubEventMetrics(): void {
    const context = this.resourcePopupStore.popupContextRef();
    if (!context) {
      return;
    }
    const nextSubEvent = this.cloneSubEvent(context.subEvent);
    const cars = this.subEventAssetCapacityMetrics(nextSubEvent, AppConstants.ASSET_TYPE_TRANSPORT);
    const accommodation = this.subEventAssetCapacityMetrics(nextSubEvent, AppConstants.ASSET_TYPE_ACCOMMODATION);
    const supplies = this.subEventAssetCapacityMetrics(nextSubEvent, AppConstants.ASSET_TYPE_SUPPLIES);
    nextSubEvent.carsAccepted = cars.joined;
    nextSubEvent.carsPending = cars.pending;
    nextSubEvent.carsCapacityMin = cars.capacityMin;
    nextSubEvent.carsCapacityMax = cars.capacityMax;
    nextSubEvent.accommodationAccepted = accommodation.joined;
    nextSubEvent.accommodationPending = accommodation.pending;
    nextSubEvent.accommodationCapacityMin = accommodation.capacityMin;
    nextSubEvent.accommodationCapacityMax = accommodation.capacityMax;
    nextSubEvent.suppliesAccepted = supplies.joined;
    nextSubEvent.suppliesPending = supplies.pending;
    nextSubEvent.suppliesCapacityMin = supplies.capacityMin;
    nextSubEvent.suppliesCapacityMax = supplies.capacityMax;
    const metricsChanged = context.subEvent.carsAccepted !== nextSubEvent.carsAccepted
      || context.subEvent.carsPending !== nextSubEvent.carsPending
      || context.subEvent.carsCapacityMin !== nextSubEvent.carsCapacityMin
      || context.subEvent.carsCapacityMax !== nextSubEvent.carsCapacityMax
      || context.subEvent.accommodationAccepted !== nextSubEvent.accommodationAccepted
      || context.subEvent.accommodationPending !== nextSubEvent.accommodationPending
      || context.subEvent.accommodationCapacityMin !== nextSubEvent.accommodationCapacityMin
      || context.subEvent.accommodationCapacityMax !== nextSubEvent.accommodationCapacityMax
      || context.subEvent.suppliesAccepted !== nextSubEvent.suppliesAccepted
      || context.subEvent.suppliesPending !== nextSubEvent.suppliesPending
      || context.subEvent.suppliesCapacityMin !== nextSubEvent.suppliesCapacityMin
      || context.subEvent.suppliesCapacityMax !== nextSubEvent.suppliesCapacityMax;
    const nextContext = {
      ...context,
      subEvent: nextSubEvent
    };
    this.resourcePopupStore.popupContextRef.set(nextContext);
    if (metricsChanged) {
      this.resourcePopupStore.publishSubEventResourceMetrics(nextContext);
    }
  }

  private subEventAssetCapacityMetrics(
    subEvent: ContractTypes.SubEventDTO,
    type: AppConstants.AssetType
  ): { joined: number; capacityMin: number; capacityMax: number; pending: number } {
    const cards = this.subEventAssignedAssetCards(subEvent.id, type);
    const settings = this.getSubEventAssignedAssetSettings(subEvent.id, type);
    const capacityMax = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMax ?? Math.max(0, card.capacityTotal)), 0);
    const capacityMin = cards.reduce((sum, card) => sum + (settings[card.id]?.capacityMin ?? 0), 0);
    const pending = type === AppConstants.ASSET_TYPE_SUPPLIES
      ? 0
      : cards.reduce((sum, card) => (
        sum + ActivityResourceBuilder.subEventOccupancyRequestCount(card, subEvent.id, 'pending')
      ), 0);
    if (type === AppConstants.ASSET_TYPE_SUPPLIES) {
      return {
        joined: cards.reduce((sum, card) => sum + this.subEventSupplyProvidedCount(card.id, subEvent.id), 0),
        capacityMin,
        capacityMax,
        pending
      };
    }
    return {
      joined: cards.reduce((sum, card) => (
        sum + ActivityResourceBuilder.subEventOccupancyRequestCount(card, subEvent.id, 'accepted')
      ), 0),
      capacityMin,
      capacityMax,
      pending
    };
  }

  private getSubEventAssignedAssetSettings(
    subEventId: string,
    type: AppConstants.AssetType
  ): Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const assignedIds = this.resolveSubEventAssignedAssetIds(subEventId, type);
    const existing = this.resourcePopupStore.assignedAssetSettingsByKey[key] ?? {};
    const next: Record<string, AppDTOs.SubEventAssignedAssetSettingsDTO> = {};
    for (const assetId of assignedIds) {
      const source = this.resolveSubEventAssignedAssetCard(subEventId, type, assetId);
      const previous = existing[assetId];
      next[assetId] = {
        capacityMin: Math.max(0, Math.trunc(Number(previous?.capacityMin) || 0)),
        capacityMax: Math.max(0, Math.trunc(Number(previous?.capacityMax ?? source?.capacityTotal) || 0)),
        quantity: Math.max(1, Math.trunc(Number(previous?.quantity) || 1)),
        addedByUserId: `${previous?.addedByUserId ?? ''}`.trim() || this.activeUser().id,
        routeEnabled: previous?.routeEnabled ?? false,
        routes: Array.isArray(previous?.routes) ? [...previous.routes] : []
      };
    }
    this.resourcePopupStore.assignedAssetSettingsByKey[key] = next;
    return next;
  }

  private resolveSubEventAssignedAssetIds(subEventId: string, type: AppConstants.AssetType): string[] {
    const key = this.subEventAssetAssignmentKey(subEventId, type);
    const eligibleIds = [
      ...this.ownedAssetCards().filter(card => card.type === type).map(card => card.id),
      ...this.subEventFallbackAssetCards(subEventId, type).map(card => card.id)
    ];
    const eligible = new Set(eligibleIds);
    const stored = this.resourcePopupStore.assignedAssetIdsByKey[key];
    if (!stored) {
      this.resourcePopupStore.assignedAssetIdsByKey[key] = [];
      return [];
    }
    const normalized = stored.filter(id => eligible.has(id));
    if (normalized.length !== stored.length) {
      this.resourcePopupStore.assignedAssetIdsByKey[key] = [...normalized];
    }
    return normalized;
  }

  private subEventAssignedAssetCards(subEventId: string, type: AppConstants.AssetType): ResourceAssetDTO[] {
    return this.resolveSubEventAssignedAssetIds(subEventId, type)
      .map(assetId => this.resolveSubEventAssignedAssetCard(subEventId, type, assetId))
      .filter((card): card is ResourceAssetDTO => card !== null);
  }

  private resolveSubEventAssignedAssetCard(
    subEventId: string,
    type: AppConstants.AssetType,
    assetId: string
  ): ResourceAssetDTO | null {
    return this.ownedAssetCards().find(card => card.id === assetId && card.type === type)
      ?? this.subEventFallbackAssetCards(subEventId, type).find(card => card.id === assetId) ?? null;
  }

  private subEventFallbackAssetCards(subEventId: string, type: AppConstants.AssetType): ResourceAssetDTO[] {
    const context = this.resourcePopupStore.popupContextRef();
    if (context?.subEvent.id !== subEventId) {
      return [];
    }
    return (context.fallbackCardsByType[type] ?? []).map(card => this.cloneAsset(card));
  }

  private persistedAssignedFallbackCards(
    context: ResourcePopupContext,
    type: AppConstants.AssetType
  ): AppDTOs.AssetDetailDTO[] {
    const assigned = new Set(this.resolveSubEventAssignedAssetIds(context.subEvent.id, type));
    return (context.fallbackCardsByType[type] ?? [])
      .filter(card => assigned.has(card.id) && !this.ownedAssetCards().some(item => item.id === card.id && item.type === type))
      .map(card => this.toAssetDetailDto(card));
  }

  private mergePersistedFallbackCards(
    current: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> | undefined,
    persisted: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> | undefined,
    subEventId: string
  ): Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> {
    const next: Partial<Record<AppConstants.AssetType, ResourceAssetDTO[]>> = {};
    for (const type of AppConstants.ASSET_TYPES) {
      const cardsById = new Map<string, ResourceAssetDTO>();
      for (const card of current?.[type] ?? []) {
        cardsById.set(card.id, this.cloneAsset(card));
      }
      for (const card of persisted?.[type] ?? []) {
        cardsById.set(card.id, this.cloneAsset(card));
      }
      const assigned = new Set(this.resourcePopupStore.assignedAssetIdsByKey[this.subEventAssetAssignmentKey(subEventId, type)] ?? []);
      const cards = [...cardsById.values()].filter(card => assigned.has(card.id));
      if (cards.length > 0) {
        next[type] = cards;
      }
    }
    return next;
  }

  private subEventSupplyContributionEntries(subEventId: string, cardId: string): AppDTOs.SubEventSupplyContributionEntryDTO[] {
    return this.resourcePopupStore.supplyContributionEntriesByAssignmentKey[this.subEventSupplyAssignmentKey(subEventId, cardId)] ?? [];
  }

  private subEventSupplyProvidedCount(cardId: string, subEventId: string): number {
    return this.subEventSupplyContributionEntries(subEventId, cardId)
      .reduce((sum, entry) => sum + AppUtils.clampNumber(Math.trunc(entry.quantity), 0, Number.MAX_SAFE_INTEGER), 0);
  }

  private abortPendingSupplyBringRequest(): void {
    this.pendingSupplyBringRequestVersion += 1;
    const controller = this.pendingSupplyBringAbortController;
    this.pendingSupplyBringAbortController = null;
    controller?.abort();
  }

  private isAbortError(error: unknown): boolean {
    return !!error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError';
  }

  private subEventSupplyAssignmentKey(subEventId: string, cardId: string): string {
    return this.resourcePopupStore.supplyAssignmentKey(subEventId, cardId);
  }

  private subEventAssetAssignmentKey(subEventId: string, type: AppConstants.AssetType): string {
    return this.resourcePopupStore.assetAssignmentKey(subEventId, type);
  }

  private cloneSubEvent(subEvent: ContractTypes.SubEventDTO): ContractTypes.SubEventDTO {
    return {
      ...subEvent
    };
  }

  private cloneAsset(card: ResourceAssetDTO): ResourceAssetDTO {
    return {
      ...card,
      routes: [...(card.routes ?? [])],
      policies: (card.policies ?? []).map(policy => ({ ...policy })),
      requests: card.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      }))
    };
  }

  private toAssetDetailDto(card: ResourceAssetDTO): AppDTOs.AssetDetailDTO {
    return {
      id: card.id,
      type: card.type,
      title: card.title,
      subtitle: card.subtitle,
      category: card.category,
      city: card.city,
      capacityTotal: card.capacityTotal,
      quantity: Math.max(0, Math.trunc(Number(card.quantity) || 0)),
      details: `${card.details ?? card.description ?? ''}`.trim(),
      imageUrl: card.imageUrl,
      sourceLink: `${card.sourceLink ?? ''}`.trim(),
      routes: [...(card.routes ?? [])],
      topics: [...(card.topics ?? [])],
      policies: (card.policies ?? []).map(policy => ({ ...policy })),
      pricing: card.pricing ?? undefined,
      visibility: card.visibility,
      status: card.status,
      ownerUserId: card.ownerUserId,
      ownerName: card.ownerName,
      requests: card.requests.map(request => ({
        ...request,
        booking: request.booking
          ? {
              ...request.booking,
              acceptedPolicyIds: [...(request.booking.acceptedPolicyIds ?? [])]
            }
          : null
      })),
      menuActions: card.menuActions ? [...card.menuActions] : undefined
    };
  }

  private createFallbackUser(userId: string): UserDto {
    return {
      id: userId.trim(),
      name: 'User',
      age: 0,
      birthday: '',
      city: '',
      height: '',
      physique: '',
      languages: [],
      horoscope: '',
      initials: 'U',
      gender: 'woman',
      statusText: '',
      hostTier: '',
      traitLabel: '',
      completion: 0,
      headline: '',
      about: '',
      images: [],
      profileStatus: 'public',
      activities: {
        game: 0,
        chats: 0,
        invitations: 0,
        events: 0,
        hosting: 0,
        cars: 0,
        accommodation: 0,
        supplies: 0,
        tickets: 0,
        contacts: 0,
        feedback: 0
      }
    } satisfies UserDto;
  }

  private subEventDisplayName(subEvent: ContractTypes.SubEventDTO | null | undefined): string {
    const name = `${subEvent?.name ?? ''}`.trim();
    return name || 'Sub Event';
  }

  private subEventStageLabel(subEvent: ContractTypes.SubEventDTO | null | undefined): string {
    const name = this.subEventDisplayName(subEvent);
    return name || 'Sub Event';
  }

}
