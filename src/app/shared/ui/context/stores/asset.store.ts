import { Injectable, computed, signal } from '@angular/core';

import { AssetDto } from '../../../core/contracts';
import { PricingBuilder } from '../../../core/base/builders';
import * as AppConstants from '../../../core/common/constants';
import type * as AppDTOs from '../../../core/contracts';
import type { AppMenuItem } from '../../components/core/menu';
import type {
  DateInputModel,
  DateInputRangeValue
} from '../../components/core/form/inputs/date-input';
import type {
  PricingEditorRuntimePreview
} from '../../components/core/form/inputs/pricing-editor';

export interface AssetVisibleListState {
  items: readonly AppDTOs.AssetDTO[];
  total: number;
  initialLoading: boolean;
}

export interface AssetVisibleListPatch {
  items: AppDTOs.AssetDTO[];
  total: number;
}

export interface AssetDeletedEvent {
  cardId: string;
  revision: number;
}

export type AssetFormState = Omit<AppDTOs.AssetDetailDTO, 'id' | 'requests'>;

export interface AssetEditorRuntimeRouteState {
  routeEnabled: boolean;
  routes: string[];
  editable: boolean;
  title?: string;
  subtitle?: string;
  openLabel?: string;
  emptyLabel?: string;
  readOnlyEmptyLabel?: string;
  popupTitle?: string;
  popupSubtitle?: string;
  parentZIndex?: number | null;
}

export interface AssetEditorRuntimeAssignmentState {
  quantity: number;
  quantityMax: number;
  quantityLabel?: string;
  quantityDescription?: string;
  editable: boolean;
  onChange?: (quantity: number) => void;
  onSave?: (state: { quantity: number; routeEnabled: boolean; routes: readonly string[] }) =>
    void
    | { quantity: number; routeEnabled: boolean; routes: readonly string[] }
    | Promise<void | { quantity: number; routeEnabled: boolean; routes: readonly string[] }>;
}

export type AssetEditorCheckoutMode = 'borrow' | 'payment-summary';
export type AssetEditorCheckoutPhase = 'review' | 'payment' | 'summary';

export interface AssetEditorCheckoutState {
  sourceId: string;
  mode: AssetEditorCheckoutMode;
  phase: AssetEditorCheckoutPhase;
  title: string;
  subtitle?: string | null;
  dateRange: DateInputRangeValue;
  dateRangeModel: DateInputModel;
  availableQuantity: number;
  pricingPreview: PricingEditorRuntimePreview;
  acceptedPolicyIds: string[];
  footerItems: readonly AppMenuItem<string>[];
  busy: boolean;
  error: string | null;
  paymentProviderLabel?: string | null;
  paymentStatusLabel?: string | null;
  paymentNote?: string | null;
  onDateRangeChange?: (value: DateInputRangeValue) => void;
  onPolicyToggle?: (policyId: string) => void;
  onFooterItemSelect?: (itemId: string, event: Event) => void;
  onClose?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class AssetStore {
  private readonly assetCardsRef = signal<AppDTOs.AssetDTO[]>([]);
  private assetMutationVersion = 0;
  private visibleListContextKey = '';
  private visibleListSignature = '';
  private visibleListCardCount = 0;
  private visibleListReady = false;
  private visibleListRenderedCount = 0;

  readonly assetFilterRef = signal<AppConstants.AssetFilterType>(AppConstants.ASSET_TYPE_TRANSPORT);
  readonly activePopupFilterRef = signal<AppConstants.AssetFilterType | null>(null);
  readonly activeOwnerUserIdRef = signal('');
  readonly showAssetFormRef = signal(false);
  readonly editingAssetIdRef = signal<string | null>(null);
  readonly assetFormReadOnlyRef = signal(false);
  readonly assetFormParentZIndexRef = signal<number | null>(null);
  readonly assetFormRuntimeRouteRef = signal<AssetEditorRuntimeRouteState | null>(null);
  readonly assetFormSavedRuntimeRouteRef = signal<AssetEditorRuntimeRouteState | null>(null);
  readonly assetFormRuntimeAssignmentRef = signal<AssetEditorRuntimeAssignmentState | null>(null);
  readonly assetFormSavedRuntimeAssignmentRef = signal<AssetEditorRuntimeAssignmentState | null>(null);
  readonly assetFormCheckoutRef = signal<AssetEditorCheckoutState | null>(null);
  readonly assetFormLoadingRef = signal(false);
  readonly assetFormSavePendingRef = signal(false);
  readonly pendingAssetDeleteCardIdRef = signal<string | null>(null);
  readonly assetDeletePendingRef = signal(false);
  readonly pendingAssetDeleteLabelRef = signal('');
  readonly pendingAssetDeleteErrorRef = signal('');
  readonly assetFormRef = signal<AssetFormState>({
    type: AppConstants.ASSET_TYPE_TRANSPORT,
    title: '',
    subtitle: '',
    city: '',
    capacityTotal: 4,
    quantity: 1,
    details: '',
    imageUrl: '',
    sourceLink: '',
    policiesEnabled: false
  });
  readonly assetFormVisibilityRef = signal<AppConstants.EventVisibility>('Public');
  readonly assetFormDraftIdRef = signal('');
  readonly assetFormLoadGenerationRef = signal(0);
  readonly assetListRevisionRef = signal(0);
  readonly assetListReloadRevisionRef = signal(0);
  readonly assetListLoadingRef = signal(false);
  readonly uiRevisionRef = signal(0);
  readonly deletedAssetEventRef = signal<AssetDeletedEvent | null>(null);

  readonly assetCards = this.assetCardsRef.asReadonly();
  readonly assetCount = computed(() => this.assetCardsRef().length);
  readonly assetFilter = this.assetFilterRef.asReadonly();
  readonly activePopupFilter = this.activePopupFilterRef.asReadonly();
  readonly activeOwnerUserId = this.activeOwnerUserIdRef.asReadonly();
  readonly showAssetForm = this.showAssetFormRef.asReadonly();
  readonly editingAssetId = this.editingAssetIdRef.asReadonly();
  readonly assetFormReadOnly = this.assetFormReadOnlyRef.asReadonly();
  readonly assetFormParentZIndex = this.assetFormParentZIndexRef.asReadonly();
  readonly assetFormRuntimeRoute = this.assetFormRuntimeRouteRef.asReadonly();
  readonly assetFormSavedRuntimeRoute = this.assetFormSavedRuntimeRouteRef.asReadonly();
  readonly assetFormRuntimeAssignment = this.assetFormRuntimeAssignmentRef.asReadonly();
  readonly assetFormSavedRuntimeAssignment = this.assetFormSavedRuntimeAssignmentRef.asReadonly();
  readonly assetFormCheckout = this.assetFormCheckoutRef.asReadonly();
  readonly assetFormLoading = this.assetFormLoadingRef.asReadonly();
  readonly assetFormSavePending = this.assetFormSavePendingRef.asReadonly();
  readonly pendingAssetDeleteCardId = this.pendingAssetDeleteCardIdRef.asReadonly();
  readonly assetDeletePending = this.assetDeletePendingRef.asReadonly();
  readonly pendingAssetDeleteLabel = this.pendingAssetDeleteLabelRef.asReadonly();
  readonly pendingAssetDeleteError = this.pendingAssetDeleteErrorRef.asReadonly();
  readonly assetForm = this.assetFormRef.asReadonly();
  readonly assetFormVisibility = this.assetFormVisibilityRef.asReadonly();
  readonly assetFormDraftId = this.assetFormDraftIdRef.asReadonly();
  readonly assetFormLoadGeneration = this.assetFormLoadGenerationRef.asReadonly();
  readonly assetListRevision = this.assetListRevisionRef.asReadonly();
  readonly assetListReloadRevision = this.assetListReloadRevisionRef.asReadonly();
  readonly assetListLoading = this.assetListLoadingRef.asReadonly();
  readonly uiRevision = this.uiRevisionRef.asReadonly();
  readonly deletedAssetEvent = this.deletedAssetEventRef.asReadonly();
  readonly popupOpen = computed(() => this.activePopupFilterRef() !== null);
  readonly ticketPopup = computed(() => this.popupOpen() && this.assetFilterRef() === AppConstants.ASSET_FILTER_TICKET);

  setAssetCards(cards: readonly AppDTOs.AssetDTO[]): void {
    this.assetCardsRef.set(AssetDto.cloneList(cards));
  }

  applyAssetCards(
    cards: readonly (AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO)[],
    options: { reloadList?: boolean; mutation?: boolean } = {}
  ): boolean {
    const nextCards = AssetDto.cloneList(cards);
    if (AssetDto.listEquals(this.assetCardsRef(), nextCards)) {
      return false;
    }
    if (options.mutation === true) {
      this.markAssetMutation();
    }
    this.assetCardsRef.set(nextCards);
    this.bumpAssetListRevision(options.reloadList !== false);
    return true;
  }

  replaceAssetCard(
    card: AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO,
    options: { reloadList?: boolean; mutation?: boolean } = {}
  ): boolean {
    const normalizedCard = AssetDto.clone(card);
    const nextCards = this.assetCardsRef().some(item => item.id === normalizedCard.id)
      ? this.assetCardsRef().map(item => item.id === normalizedCard.id ? normalizedCard : item)
      : [normalizedCard, ...this.assetCardsRef()];
    return this.applyAssetCards(nextCards, options);
  }

  removeAssetCard(cardId: string, options: { reloadList?: boolean; mutation?: boolean } = {}): boolean {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return false;
    }
    return this.applyAssetCards(
      this.assetCardsRef().filter(card => card.id !== normalizedCardId),
      options
    );
  }

  markAssetMutation(): number {
    this.assetMutationVersion += 1;
    return this.assetMutationVersion;
  }

  currentAssetMutationVersion(): number {
    return this.assetMutationVersion;
  }

  setActiveOwnerUserId(userId: string): boolean {
    const normalizedUserId = userId.trim();
    if (normalizedUserId === this.activeOwnerUserIdRef()) {
      return false;
    }
    this.activeOwnerUserIdRef.set(normalizedUserId);
    return true;
  }

  isActiveOwnerUser(userId: string): boolean {
    return this.activeOwnerUserIdRef() === userId.trim();
  }

  openAssetPopup(filter: AppConstants.AssetFilterType): void {
    this.assetFilterRef.set(filter);
    this.activePopupFilterRef.set(filter);
    this.closeAssetEditor();
  }

  closeAssetPopup(): void {
    this.activePopupFilterRef.set(null);
    this.closeAssetEditor();
    this.resetAssetDeleteDialog();
  }

  selectAssetFilter(filter: AppConstants.AssetFilterType): void {
    this.assetFilterRef.set(filter);
    this.activePopupFilterRef.set(filter);
    this.touchUiState();
  }

  setAssetListLoading(loading: boolean): void {
    this.assetListLoadingRef.set(loading);
    this.touchUiState();
  }

  touchUiState(): void {
    this.uiRevisionRef.update(value => value + 1);
  }

  bumpAssetListRevision(reloadList = true): void {
    this.assetListRevisionRef.update(value => value + 1);
    if (reloadList) {
      this.assetListReloadRevisionRef.update(value => value + 1);
    }
  }

  recordAssetDeleted(cardId: string): void {
    const normalizedCardId = cardId.trim();
    if (!normalizedCardId) {
      return;
    }
    this.deletedAssetEventRef.update(event => ({
      cardId: normalizedCardId,
      revision: (event?.revision ?? 0) + 1
    }));
  }

  resetAssetDeleteDialog(): void {
    this.pendingAssetDeleteCardIdRef.set(null);
    this.assetDeletePendingRef.set(false);
    this.pendingAssetDeleteLabelRef.set('');
    this.pendingAssetDeleteErrorRef.set('');
    this.touchUiState();
  }

  requestAssetDelete(card: AppDTOs.AssetDTO): void {
    this.pendingAssetDeleteCardIdRef.set(card.id);
    this.pendingAssetDeleteLabelRef.set(`Delete ${card.title}?`);
    this.pendingAssetDeleteErrorRef.set('');
    this.assetDeletePendingRef.set(false);
    this.touchUiState();
  }

  cancelAssetDelete(): void {
    if (this.assetDeletePendingRef()) {
      return;
    }
    this.pendingAssetDeleteCardIdRef.set(null);
    this.pendingAssetDeleteLabelRef.set('');
    this.pendingAssetDeleteErrorRef.set('');
    this.touchUiState();
  }

  beginAssetDelete(): string | null {
    const pendingCardId = this.pendingAssetDeleteCardIdRef();
    if (!pendingCardId || this.assetDeletePendingRef()) {
      return null;
    }
    this.pendingAssetDeleteErrorRef.set('');
    this.assetDeletePendingRef.set(true);
    this.touchUiState();
    return pendingCardId;
  }

  completeAssetDelete(): void {
    this.assetDeletePendingRef.set(false);
    this.pendingAssetDeleteCardIdRef.set(null);
    this.pendingAssetDeleteLabelRef.set('');
    this.touchUiState();
  }

  failAssetDelete(message: string): void {
    this.assetDeletePendingRef.set(false);
    this.pendingAssetDeleteErrorRef.set(message);
    this.touchUiState();
  }

  openAssetEditorCreate(form: AssetFormState, draftId: string): number {
    const generation = this.bumpAssetEditorGeneration();
    this.showAssetFormRef.set(true);
    this.assetFormLoadingRef.set(false);
    this.assetFormSavePendingRef.set(false);
    this.assetFormReadOnlyRef.set(false);
    this.assetFormParentZIndexRef.set(null);
    this.assetFormRuntimeRouteRef.set(null);
    this.assetFormSavedRuntimeRouteRef.set(null);
    this.assetFormRuntimeAssignmentRef.set(null);
    this.assetFormSavedRuntimeAssignmentRef.set(null);
    this.assetFormCheckoutRef.set(null);
    this.editingAssetIdRef.set(null);
    this.assetFormDraftIdRef.set(draftId.trim() || `asset-${Date.now()}`);
    this.assetFormVisibilityRef.set('Public');
    this.assetFormRef.set(form);
    this.touchUiState();
    return generation;
  }

  openAssetEditorEdit(options: {
    cardId: string;
    form: AssetFormState;
    visibility: AppConstants.EventVisibility;
    loading: boolean;
    readOnly?: boolean;
    parentZIndex?: number | null;
    runtimeRoute?: AssetEditorRuntimeRouteState | null;
    runtimeAssignment?: AssetEditorRuntimeAssignmentState | null;
    checkout?: AssetEditorCheckoutState | null;
  }): number {
    const generation = this.bumpAssetEditorGeneration();
    this.showAssetFormRef.set(true);
    this.assetFormLoadingRef.set(options.loading);
    this.assetFormSavePendingRef.set(false);
    this.assetFormReadOnlyRef.set(options.readOnly === true);
    this.assetFormParentZIndexRef.set(this.normalizeParentZIndex(options.parentZIndex));
    const runtimeRoute = this.cloneRuntimeRoute(options.runtimeRoute);
    const runtimeAssignment = this.cloneRuntimeAssignment(options.runtimeAssignment);
    this.assetFormRuntimeRouteRef.set(runtimeRoute);
    this.assetFormSavedRuntimeRouteRef.set(this.cloneRuntimeRoute(runtimeRoute));
    this.assetFormRuntimeAssignmentRef.set(runtimeAssignment);
    this.assetFormSavedRuntimeAssignmentRef.set(this.cloneRuntimeAssignment(runtimeAssignment));
    this.assetFormCheckoutRef.set(this.cloneCheckout(options.checkout));
    this.assetFormDraftIdRef.set('');
    this.editingAssetIdRef.set(options.cardId);
    this.assetFormVisibilityRef.set(options.visibility);
    this.assetFormRef.set(runtimeAssignment
      ? {
          ...options.form,
          quantity: runtimeAssignment.quantity
        }
      : options.form);
    this.touchUiState();
    return generation;
  }

  applyAssetEditorForm(
    cardId: string,
    visibility: AppConstants.EventVisibility,
    form: AssetFormState
  ): void {
    const runtimeAssignment = this.assetFormRuntimeAssignmentRef();
    this.editingAssetIdRef.set(cardId);
    this.assetFormVisibilityRef.set(visibility);
    this.assetFormRef.set(runtimeAssignment
      ? {
          ...form,
          quantity: runtimeAssignment.quantity
        }
      : form);
    this.touchUiState();
  }

  closeAssetEditor(): number {
    const generation = this.bumpAssetEditorGeneration();
    this.showAssetFormRef.set(false);
    this.editingAssetIdRef.set(null);
    this.assetFormReadOnlyRef.set(false);
    this.assetFormParentZIndexRef.set(null);
    this.assetFormRuntimeRouteRef.set(null);
    this.assetFormSavedRuntimeRouteRef.set(null);
    this.assetFormRuntimeAssignmentRef.set(null);
    this.assetFormSavedRuntimeAssignmentRef.set(null);
    this.assetFormCheckoutRef.set(null);
    this.assetFormLoadingRef.set(false);
    this.assetFormSavePendingRef.set(false);
    this.assetFormDraftIdRef.set('');
    this.touchUiState();
    return generation;
  }

  isCurrentAssetEditorLoad(generation: number, assetId: string): boolean {
    return this.showAssetFormRef()
      && this.assetFormLoadGenerationRef() === generation
      && this.editingAssetIdRef() === assetId;
  }

  setAssetEditorVisibility(option: AppConstants.EventVisibility): void {
    if (this.assetFormReadOnlyRef() || this.assetFormLoadingRef() || this.assetFormSavePendingRef()) {
      return;
    }
    this.assetFormVisibilityRef.set(option);
    this.touchUiState();
  }

  setAssetEditorForm(form: AssetFormState): void {
    if (this.assetFormReadOnlyRef() || this.assetFormLoadingRef() || this.assetFormSavePendingRef()) {
      return;
    }
    this.assetFormRef.set(this.cloneAssetForm(form));
    this.touchUiState();
  }

  setAssetEditorRuntimeRouteState(state: {
    routeEnabled?: boolean | null;
    routes?: readonly string[] | null;
  }): void {
    const current = this.assetFormRuntimeRouteRef();
    if (!current) {
      return;
    }
    this.assetFormRuntimeRouteRef.set({
      ...current,
      routeEnabled: typeof state.routeEnabled === 'boolean' ? state.routeEnabled : current.routeEnabled,
      routes: state.routes === undefined ? current.routes : this.cloneStringList(state.routes)
    });
    this.touchUiState();
  }

  setAssetEditorRuntimeAssignmentState(state: {
    quantity?: number | null;
    quantityMax?: number | null;
    quantityLabel?: string | null;
    quantityDescription?: string | null;
    editable?: boolean | null;
  }): void {
    const current = this.assetFormRuntimeAssignmentRef();
    if (!current) {
      return;
    }
    const quantityMax = state.quantityMax === undefined
      ? current.quantityMax
      : this.normalizeRuntimeQuantityMax(state.quantityMax);
    const quantity = state.quantity === undefined
      ? this.normalizeRuntimeQuantity(current.quantity, quantityMax, current.quantity)
      : this.normalizeRuntimeQuantity(state.quantity, quantityMax, current.quantity);
    this.assetFormRuntimeAssignmentRef.set({
      ...current,
      quantity,
      quantityMax,
      quantityLabel: state.quantityLabel === undefined
        ? current.quantityLabel
        : `${state.quantityLabel ?? ''}`.trim() || undefined,
      quantityDescription: state.quantityDescription === undefined
        ? current.quantityDescription
        : `${state.quantityDescription ?? ''}`.trim() || undefined,
      editable: typeof state.editable === 'boolean' ? state.editable : current.editable
    });
    this.assetFormRef.set({
      ...this.assetFormRef(),
      quantity
    });
    this.touchUiState();
  }

  setAssetEditorCheckoutState(state: AssetEditorCheckoutState | null): void {
    this.assetFormCheckoutRef.set(this.cloneCheckout(state));
    this.touchUiState();
  }

  setAssetEditorImageUrl(imageUrl: string): void {
    if (this.assetFormReadOnlyRef() || this.assetFormLoadingRef() || this.assetFormSavePendingRef()) {
      return;
    }
    this.assetFormRef().imageUrl = imageUrl.trim();
    this.touchUiState();
  }

  setAssetEditorLoading(loading: boolean): void {
    this.assetFormLoadingRef.set(loading);
    this.touchUiState();
  }

  beginAssetEditorSave(): boolean {
    if (this.assetFormReadOnlyRef() || this.assetFormLoadingRef() || this.assetFormSavePendingRef()) {
      return false;
    }
    this.assetFormSavePendingRef.set(true);
    this.touchUiState();
    return true;
  }

  beginAssetEditorRuntimeAssignmentSave(): boolean {
    const current = this.assetFormRuntimeAssignmentRef();
    if (!current?.editable || this.assetFormLoadingRef() || this.assetFormSavePendingRef()) {
      return false;
    }
    this.assetFormSavePendingRef.set(true);
    this.touchUiState();
    return true;
  }

  completeAssetEditorSave(): void {
    this.assetFormSavePendingRef.set(false);
    this.closeAssetEditor();
  }

  failAssetEditorSave(): void {
    this.assetFormSavePendingRef.set(false);
    this.touchUiState();
  }

  completeAssetEditorRuntimeAssignmentSave(state: {
    quantity: number;
    routeEnabled: boolean;
    routes: readonly string[];
  }): void {
    const currentAssignment = this.assetFormRuntimeAssignmentRef();
    if (currentAssignment) {
      const nextAssignment = this.cloneRuntimeAssignment({
        ...currentAssignment,
        quantity: state.quantity
      });
      this.assetFormRuntimeAssignmentRef.set(nextAssignment);
      this.assetFormSavedRuntimeAssignmentRef.set(this.cloneRuntimeAssignment(nextAssignment));
    }
    const currentRoute = this.assetFormRuntimeRouteRef();
    if (currentRoute) {
      const next = this.cloneRuntimeRoute({
        ...currentRoute,
        routeEnabled: state.routeEnabled === true,
        routes: this.cloneStringList(state.routes)
      });
      this.assetFormRuntimeRouteRef.set(next);
      this.assetFormSavedRuntimeRouteRef.set(this.cloneRuntimeRoute(next));
    }
    this.assetFormSavePendingRef.set(false);
    this.closeAssetEditor();
  }

  private bumpAssetEditorGeneration(): number {
    const nextGeneration = this.assetFormLoadGenerationRef() + 1;
    this.assetFormLoadGenerationRef.set(nextGeneration);
    return nextGeneration;
  }

  private normalizeParentZIndex(value: number | null | undefined): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
  }

  private cloneRuntimeRoute(
    state: AssetEditorRuntimeRouteState | null | undefined
  ): AssetEditorRuntimeRouteState | null {
    if (!state) {
      return null;
    }
    return {
      ...state,
      routeEnabled: state.routeEnabled === true,
      routes: this.cloneStringList(state.routes),
      editable: state.editable === true,
      parentZIndex: this.normalizeParentZIndex(state.parentZIndex)
    };
  }

  private cloneRuntimeAssignment(
    state: AssetEditorRuntimeAssignmentState | null | undefined
  ): AssetEditorRuntimeAssignmentState | null {
    if (!state) {
      return null;
    }
    const quantityMax = this.normalizeRuntimeQuantityMax(state.quantityMax);
    return {
      ...state,
      quantityMax,
      quantity: this.normalizeRuntimeQuantity(state.quantity, quantityMax),
      editable: state.editable === true
    };
  }

  private cloneCheckout(
    state: AssetEditorCheckoutState | null | undefined
  ): AssetEditorCheckoutState | null {
    if (!state) {
      return null;
    }
    return {
      ...state,
      sourceId: state.sourceId.trim(),
      title: state.title.trim(),
      subtitle: `${state.subtitle ?? ''}`.trim() || null,
      dateRange: { ...state.dateRange },
      dateRangeModel: {
        ...state.dateRangeModel,
        field: state.dateRangeModel.field ? { ...state.dateRangeModel.field } : undefined,
        range: state.dateRangeModel.range
          ? {
              ...state.dateRangeModel.range,
              bounds: state.dateRangeModel.range.bounds
                ? { ...state.dateRangeModel.range.bounds }
                : state.dateRangeModel.range.bounds,
              start: state.dateRangeModel.range.start
                ? { ...state.dateRangeModel.range.start }
                : state.dateRangeModel.range.start,
              end: state.dateRangeModel.range.end
                ? { ...state.dateRangeModel.range.end }
                : state.dateRangeModel.range.end
            }
          : undefined,
        meta: state.dateRangeModel.meta ? { ...state.dateRangeModel.meta } : state.dateRangeModel.meta
      },
      availableQuantity: Math.max(0, Math.trunc(Number(state.availableQuantity) || 0)),
      pricingPreview: {
        ...state.pricingPreview,
        rows: (state.pricingPreview.rows ?? []).map(row => ({ ...row }))
      },
      acceptedPolicyIds: [...new Set(state.acceptedPolicyIds)]
        .map(policyId => policyId.trim())
        .filter(Boolean),
      footerItems: (state.footerItems ?? []).map(item => ({ ...item })),
      busy: state.busy === true,
      error: `${state.error ?? ''}`.trim() || null
    };
  }

  private normalizeRuntimeQuantityMax(value: unknown): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  private normalizeRuntimeQuantity(value: unknown, max: unknown, fallback = 1): number {
    const limit = this.normalizeRuntimeQuantityMax(max);
    const parsed = Math.trunc(Number(value));
    const fallbackValue = Math.trunc(Number(fallback));
    const resolved = Number.isFinite(parsed) && parsed > 0
      ? parsed
      : (Number.isFinite(fallbackValue) && fallbackValue > 0 ? fallbackValue : 1);
    return Math.min(limit, Math.max(1, resolved));
  }

  private cloneAssetForm(form: AssetFormState): AssetFormState {
    return {
      ...form,
      routes: [...(form.routes ?? [])],
      topics: [...(form.topics ?? [])],
      policies: (form.policies ?? []).map(policy => ({ ...policy })),
      pricing: PricingBuilder.clonePricingConfig(form.pricing ?? null)
    };
  }

  private cloneStringList(items: readonly string[] | null | undefined): string[] {
    return (items ?? []).map(item => `${item ?? ''}`.trim()).filter(item => item.length > 0);
  }

  cardsByType(type: AppConstants.AssetType): AppDTOs.AssetDTO[] {
    return this.assetCardsRef().filter(card => card.type === type);
  }

  orderedCardsByType(type: AppConstants.AssetType, selectedAssetIds: ReadonlySet<string> | null = null): AppDTOs.AssetDTO[] {
    return this.cardsByType(type).sort((left, right) => {
      if (selectedAssetIds) {
        const selectedDelta = Number(selectedAssetIds.has(right.id)) - Number(selectedAssetIds.has(left.id));
        if (selectedDelta !== 0) {
          return selectedDelta;
        }
      }
      return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    });
  }

  findAsset(assetId: string, type?: AppConstants.AssetType): AppDTOs.AssetDTO | null {
    const normalizedAssetId = assetId.trim();
    if (!normalizedAssetId) {
      return null;
    }
    return this.assetCardsRef().find(card => (
      card.id === normalizedAssetId
      && (type === undefined || card.type === type)
    )) ?? null;
  }

  hasAsset(assetId: string, type?: AppConstants.AssetType): boolean {
    return this.findAsset(assetId, type) !== null;
  }

  resetVisibleAssetListSync(): void {
    this.visibleListContextKey = '';
    this.visibleListSignature = '';
    this.visibleListCardCount = 0;
    this.visibleListReady = false;
    this.visibleListRenderedCount = 0;
  }

  trackVisibleAssetListState(
    state: AssetVisibleListState,
    cards: readonly AppDTOs.AssetDTO[]
  ): AssetVisibleListPatch | null {
    this.visibleListRenderedCount = state.items.length;
    this.visibleListReady = !state.initialLoading;
    if (!this.visibleListReady || state.total === cards.length) {
      return null;
    }
    return this.createVisibleAssetListPatch(cards, state.total, state.items.length);
  }

  syncVisibleAssetList(
    options: {
      active: boolean;
      contextKey: string;
      cards: readonly AppDTOs.AssetDTO[];
      renderedCount: number;
    }
  ): AssetVisibleListPatch | null {
    if (!options.active) {
      this.resetVisibleAssetListSync();
      return null;
    }
    const signature = this.visibleAssetListSignature(options.contextKey, options.cards);
    if (options.contextKey !== this.visibleListContextKey) {
      this.visibleListContextKey = options.contextKey;
      this.visibleListSignature = signature;
      this.visibleListCardCount = options.cards.length;
      this.visibleListReady = false;
      this.visibleListRenderedCount = 0;
      return null;
    }
    if (signature === this.visibleListSignature) {
      return null;
    }
    const previousCardCount = this.visibleListCardCount;
    this.visibleListSignature = signature;
    this.visibleListCardCount = options.cards.length;
    return this.createVisibleAssetListPatch(options.cards, previousCardCount, options.renderedCount);
  }

  private createVisibleAssetListPatch(
    cards: readonly AppDTOs.AssetDTO[],
    previousCardCount: number,
    renderedCount: number
  ): AssetVisibleListPatch | null {
    if (!this.visibleListReady) {
      return null;
    }
    const visibleCount = Math.max(this.visibleListRenderedCount, renderedCount);
    const allCardsWereVisible = visibleCount >= previousCardCount;
    let nextVisibleCount = Math.min(cards.length, visibleCount);

    if (cards.length > previousCardCount && allCardsWereVisible) {
      nextVisibleCount = Math.min(cards.length, visibleCount + 1);
    }

    return {
      items: cards.slice(0, nextVisibleCount),
      total: cards.length
    };
  }

  private visibleAssetListSignature(contextKey: string, cards: readonly AppDTOs.AssetDTO[]): string {
    return `${contextKey}:${cards.map(card => [
      card.id,
      card.type,
      card.title,
      card.subtitle,
      card.city,
      card.capacityTotal,
      card.quantity,
      card.description,
      card.imageUrl,
      card.locationLabel ?? '',
      card.priceLabel ?? '',
      card.policyCount ?? 0,
      card.visibility ?? '',
      card.status ?? '',
      card.ownerUserId ?? '',
      card.ownerName ?? '',
      (card.menuActions ?? []).join(','),
      card.requests.map(request => [
        request.id,
        request.status,
        request.note,
        request.requestKind ?? '',
        request.booking?.quantity ?? '',
        request.booking?.inventoryApplied ?? '',
        (request.menuActions ?? []).join(',')
      ].join('/')).join(',')
    ].join(':')).join('|')}`;
  }
}
