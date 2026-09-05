import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { from } from 'rxjs';

import { AssetCardBuilder, AssetsService, EventsService, I18nService, PaymentMethodsService } from '../../../core';
import type * as AppDTOs from '../../../core/contracts';
import * as AppConstants from '../../../core/common/constants';
import type { ListQuery } from '../../../core/contracts/list.interface';
import type {
  PaymentHistoryItemDto,
  PaymentMethodRegistrationDto,
  SavedPaymentMethodDto
} from '../../../core/contracts/payment-method.interface';
import { UserProfileStore } from '../../context/stores/user-profile.store';
import { PaymentMethodsPopupStore } from '../../context/stores/payment-methods-popup.store';
import { ActivitiesPopupStore } from '../../context/stores/activities-popup.store';
import { EventCheckoutDialogStore } from '../../context/stores/event-checkout-dialog.store';
import { AssetStore } from '../../context/stores/asset.store';
import { AssetPopupStore } from '../../context/stores/asset-popup.store';
import { DialogStore } from '../../context/stores/dialog.store';
import type { AppMenuItemSelectEvent, AppMenuTrigger } from '../core/menu';
import {
  PopupComponent,
  type PopupControl,
  type PopupMenuSelectEvent,
  type PopupModel
} from '../core/popup';
import {
  SmartListComponent,
  type SmartListConfig,
  type SmartListLoadPage
} from '../core/smart-list';
import {
  PaymentCardComponent,
  SingleRowComponent,
  type PaymentCardData,
  type SingleRowData
} from '../core/smart-list/card';
import { I18nPipe } from '../../pipes';

interface PaymentListFilters { revision: number; }
interface PaymentPopupMenuContext { action: 'open-cards' | 'add-card' | 'confirm-card'; }

@Component({
  selector: 'app-payment-methods-popup',
  standalone: true,
  imports: [PopupComponent, SmartListComponent, PaymentCardComponent, SingleRowComponent, I18nPipe],
  templateUrl: './payment-methods-popup.component.html',
  styleUrl: './payment-methods-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentMethodsPopupComponent implements OnDestroy {
  protected readonly store = inject(PaymentMethodsPopupStore);
  private readonly userProfileStore = inject(UserProfileStore);
  private readonly paymentMethods = inject(PaymentMethodsService);
  private readonly events = inject(EventsService);
  private readonly activities = inject(ActivitiesPopupStore);
  private readonly eventCheckoutDialog = inject(EventCheckoutDialogStore);
  private readonly assets = inject(AssetsService);
  private readonly assetStore = inject(AssetStore);
  private readonly assetPopup = inject(AssetPopupStore);
  private readonly dialogStore = inject(DialogStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly i18n = inject(I18nService);

  private readonly revisionRef = signal(0);
  private readonly canAddRef = signal(false);
  private readonly cardsOpenRef = signal(false);
  private readonly registrationRef = signal<{
    id: string;
    url: string;
    safeUrl: SafeResourceUrl;
    expiresAtIso: string;
    replacesPaymentMethodId: string | null;
  } | null>(null);
  private readonly registrationFrameOpenRef = signal(false);
  private readonly busyRef = signal(false);
  private readonly errorRef = signal('');
  private readonly spendingTotalsRef = signal<Record<string, number>>({});
  private readonly loadedCardsById = new Map<string, SavedPaymentMethodDto>();
  private registrationPoll: ReturnType<typeof setTimeout> | null = null;
  private registrationRefreshInFlight = false;

  protected readonly cardsOpen = this.cardsOpenRef.asReadonly();
  protected readonly registration = this.registrationRef.asReadonly();
  protected readonly registrationFrameOpen = this.registrationFrameOpenRef.asReadonly();
  protected readonly busy = this.busyRef.asReadonly();
  protected readonly error = this.errorRef.asReadonly();
  protected readonly spendingTotals = this.spendingTotalsRef.asReadonly();
  protected readonly localMode = this.paymentMethods.localModeEnabled;
  protected readonly pickerMode = computed(() => this.store.picker() !== null);

  protected readonly query = computed<Partial<ListQuery<PaymentListFilters>>>(() => ({
    page: 0,
    pageSize: 6,
    sort: 'createdAt',
    direction: 'desc',
    filters: { revision: this.revisionRef() }
  }));

  protected readonly allHistoryQuery = computed<Partial<ListQuery<PaymentListFilters>>>(() => ({
    page: 0,
    pageSize: 20,
    sort: 'createdDate',
    direction: 'desc',
    filters: { revision: this.revisionRef() }
  }));

  protected readonly cardListConfig: SmartListConfig<SavedPaymentMethodDto, PaymentListFilters> = {
    pageSize: 6,
    defaultView: 'list',
    showStickyHeader: false,
    emptyLabel: 'payment.cards.empty',
    emptyDescription: this.localMode
      ? 'payment.cards.empty.local.description'
      : 'payment.cards.empty.description',
    listLayout: 'card-grid',
    desktopColumns: 2,
    mobileColumns: 1,
    snapMode: 'none',
    headerProgress: { enabled: true, placement: 'inline', tone: 'accent' },
    containerClass: { 'payment-method-card-list': true },
    trackBy: (_index, item) => item.id
  };

  protected readonly allHistoryListConfig: SmartListConfig<PaymentHistoryItemDto, PaymentListFilters> = {
    pageSize: 20,
    defaultView: 'list',
    showStickyHeader: false,
    emptyLabel: 'payment.history.empty',
    emptyDescription: 'payment.history.empty.description',
    listLayout: 'stack',
    snapMode: 'none',
    headerProgress: { enabled: true, placement: 'inline', tone: 'accent' },
    trackBy: (_index, item) => item.id
  };

  protected readonly loadCards: SmartListLoadPage<SavedPaymentMethodDto, PaymentListFilters> = (query, context) => from(
    this.paymentMethods.queryPage(this.activeUserId(), query, context?.signal).then(page => {
      this.loadedCardsById.clear();
      page.items.forEach(item => this.loadedCardsById.set(item.id, { ...item }));
      this.canAddRef.set(page.canAdd === true);
      if (page.pendingRegistration?.status === 'pending') {
        this.trackRegistration(page.pendingRegistration, false);
      }
      const pending = page.pendingRegistration?.status === 'pending'
        ? this.pendingPaymentMethod(page.pendingRegistration)
        : null;
      if (!pending) return page;
      const replacedId = page.pendingRegistration?.replacesPaymentMethodId?.trim() || null;
      const replaced = Boolean(replacedId && page.items.some(item => item.id === replacedId));
      const items = replaced
        ? page.items.map(item => item.id === replacedId ? pending : item)
        : [...page.items, pending];
      return { ...page, items, total: Math.min(6, page.total + (replaced ? 0 : 1)) };
    })
  );

  protected readonly loadAllHistory: SmartListLoadPage<PaymentHistoryItemDto, PaymentListFilters> = (query, context) => from(
    this.paymentMethods.queryAllHistory(this.activeUserId(), query, context?.signal).then(page => {
      this.spendingTotalsRef.set({ ...page.spendingTotals });
      return page;
    })
  );

  protected mainPopupModel(): PopupModel<PaymentPopupMenuContext> {
    return {
      title: 'payment.history.title',
      subtitle: this.historySubtitle(),
      translateSubtitle: false,
      ariaLabel: 'payment.history.title',
      closeAriaLabel: 'payment.history.close',
      size: 'wide',
      height: 'full',
      bodyLayout: 'fill',
      headerTone: 'accent',
      headerPalette: 'blue',
      headerControls: [this.headerActionControl({
        id: 'open-cards',
        icon: 'credit_card',
        label: 'payment.cards.open',
        ariaLabel: 'payment.cards.open.aria',
        palette: 'blue',
        layout: 'pill',
        action: 'custom',
        context: { action: 'open-cards' }
      })],
      onMenuSelect: event => this.onHeaderMenuSelect(event),
      onClose: () => this.closeAll()
    };
  }

  protected cardsPopupModel(): PopupModel<PaymentPopupMenuContext> {
    const headerControls: PopupControl<PaymentPopupMenuContext>[] = [this.headerActionControl({
      id: 'add-card',
      icon: 'add',
      label: 'payment.cards.add',
      ariaLabel: 'payment.cards.add.aria',
      disabled: this.localMode || !this.canAddRef() || this.busyRef() || this.registrationRef() !== null,
      palette: 'green',
      layout: 'pill',
      action: 'custom',
      context: { action: 'add-card' }
    })];
    if (this.pickerMode()) {
      headerControls.push(this.headerActionControl({
        id: 'confirm-card',
        icon: 'done',
        ariaLabel: 'payment.cards.select.confirm',
        disabled: !this.selectedPaymentMethod(),
        palette: 'green',
        layout: 'icon',
        action: 'custom',
        context: { action: 'confirm-card' }
      }));
    }
    return {
      title: this.pickerMode() ? 'payment.cards.select.title' : 'payment.cards.title',
      subtitle: this.localMode ? 'payment.cards.subtitle.local' : 'payment.cards.subtitle',
      ariaLabel: this.pickerMode() ? 'payment.cards.select.aria' : 'payment.cards.manage.aria',
      closeAriaLabel: 'payment.cards.close',
      size: 'wide',
      height: 'full',
      bodyLayout: 'fill',
      headerTone: 'accent',
      headerPalette: 'blue',
      headerControls,
      onMenuSelect: event => this.onHeaderMenuSelect(event),
      onClose: () => this.closeCards()
    };
  }

  protected registrationPopupModel(): PopupModel {
    return {
      title: 'payment.registration.title',
      subtitle: 'payment.registration.subtitle',
      ariaLabel: 'payment.registration.aria',
      closeAriaLabel: 'payment.registration.close',
      size: 'default',
      height: 'full',
      bodyLayout: 'flush',
      headerTone: 'accent',
      headerPalette: 'green',
      onClose: () => this.closeRegistration()
    };
  }

  protected paymentCard(method: SavedPaymentMethodDto): PaymentCardData {
    const loading = method.status === 'registering';
    return {
      id: method.id,
      provider: method.provider,
      brand: method.brand,
      last4: method.last4,
      expiryMonth: method.expiryMonth,
      expiryYear: method.expiryYear,
      cardholderName: method.cardholderName,
      artworkUrl: method.artworkUrl,
      loading,
      loadingLabel: loading ? 'payment.registration.pending' : undefined,
      disabled: loading,
      selected: this.pickerMode() && this.store.selectedPaymentMethodId() === method.id,
      paymentMenuActions: loading || this.pickerMode() ? [] : [
        ...(!this.localMode
          ? [{ id: 'replace-payment-card', label: 'payment.cards.replace', icon: 'published_with_changes', tone: 'accent' as const }]
          : []),
        { id: 'delete-payment-card', label: 'payment.cards.delete', icon: 'delete', tone: 'destructive' }
      ]
    };
  }

  protected historyRow(item: PaymentHistoryItemDto, withMenu = false): SingleRowData<PaymentHistoryItemDto> {
    const amount = new Intl.NumberFormat(undefined, { style: 'currency', currency: item.currency || 'HUF' })
      .format(Number(item.amount) || 0);
    const date = new Date(item.createdAtIso);
    const statusLabel = this.paymentStatusLabel(item.status);
    return {
      id: item.id,
      title: amount,
      subtitle: item.sourceId || this.i18n.translate('payment'),
      detail: Number.isNaN(date.getTime()) ? null : date.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      icon: item.status === 'captured' ? 'check_circle' : item.status === 'released' ? 'undo' : 'payments',
      badges: [
        {
          label: item.provider,
          icon: item.provider.toLowerCase() === 'stripe' ? 'payment' : 'account_balance_wallet',
          tone: item.provider.toLowerCase() === 'stripe' ? 'info' : 'accent',
          position: 'inline'
        },
        {
          label: statusLabel,
          tone: item.status === 'captured' ? 'success' : item.status === 'failed' ? 'danger' : 'muted',
          position: 'top-right'
        }
      ],
      menuActions: withMenu ? ['paymentSummary'] : [],
      eagerDetail: item
    };
  }

  protected onPaymentHistoryMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    if (event.id !== 'paymentSummary') return;
    const row = (event.context as { row?: SingleRowData<PaymentHistoryItemDto> } | undefined)?.row;
    const item = row?.eagerDetail;
    if (item) void this.openPaymentSummary(item);
  }

  protected selectCard(method: SavedPaymentMethodDto, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.pickerMode() || method.status !== 'active') return;
    this.store.togglePickerSelection(method.id);
  }

  protected onCardMenuSelect(event: AppMenuItemSelectEvent<string, unknown>): void {
    const context = event.context as {
      menu?: string;
      item?: SavedPaymentMethodDto;
      paymentMethodId?: string;
    } | undefined;
    const paymentMethodId = `${context?.paymentMethodId ?? context?.item?.id ?? ''}`.trim();
    const method = context?.item ?? this.loadedCardsById.get(paymentMethodId) ?? null;
    if (!method) return;
    event.sourceEvent.preventDefault();
    event.sourceEvent.stopPropagation();
    if (event.id === 'replace-payment-card') {
      void this.beginRegistration(method.id);
    } else if (event.id === 'delete-payment-card') {
      this.confirmDelete(method);
    }
  }

  private confirmDelete(method: SavedPaymentMethodDto): void {
    this.dialogStore.open({
      title: 'payment.cards.delete.title',
      message: this.i18n.translateParams('payment.cards.delete.message', {
        brand: method.brand,
        last4: method.last4
      }),
      cancelLabel: 'cancel',
      confirmLabel: 'payment.cards.delete',
      busyConfirmLabel: 'payment.cards.delete.busy',
      confirmTone: 'danger',
      failureMessage: 'payment.cards.delete.error',
      onConfirm: async () => {
        await this.paymentMethods.deletePaymentMethod(this.activeUserId(), method.id);
        this.loadedCardsById.delete(method.id);
        this.errorRef.set('');
        this.revisionRef.update(value => value + 1);
      }
    });
  }

  @HostListener('window:message', ['$event'])
  protected onProviderMessage(event: MessageEvent): void {
    const registration = this.registrationRef();
    if (!registration || event.origin !== this.origin(registration.url)) return;
    const payload = event.data as { type?: string; registrationId?: string; status?: string } | null;
    if (payload?.type !== 'myscoutee:payment-method-registration' || payload.registrationId !== registration.id) return;
    if (payload.status === 'completed' || payload.status === 'cancelled' || payload.status === 'expired' || payload.status === 'failed') {
      this.registrationFrameOpenRef.set(false);
      void this.refreshRegistration();
    }
  }

  private onHeaderMenuSelect(event: PopupMenuSelectEvent<PaymentPopupMenuContext>): void {
    event.itemSelect.sourceEvent.preventDefault();
    event.itemSelect.sourceEvent.stopPropagation();
    const action = event.itemSelect.context?.action;
    if (action === 'add-card') {
      void this.beginRegistration(null);
      return;
    }
    if (action === 'open-cards') {
      this.errorRef.set('');
      this.cardsOpenRef.set(true);
      return;
    }
    if (action === 'confirm-card') {
      const selected = this.selectedPaymentMethod();
      if (selected) this.store.confirm(selected);
    }
  }

  private selectedPaymentMethod(): SavedPaymentMethodDto | null {
    const selectedId = this.store.selectedPaymentMethodId();
    return selectedId ? this.loadedCardsById.get(selectedId) ?? null : null;
  }

  private async beginRegistration(replacesPaymentMethodId: string | null): Promise<void> {
    if (this.localMode || this.busyRef()) return;
    this.busyRef.set(true);
    this.errorRef.set('');
    try {
      const registration = await this.paymentMethods.beginRegistration(this.activeUserId(), {
        replacesPaymentMethodId
      });
      this.trackRegistration(registration, true);
      this.revisionRef.update(value => value + 1);
    } catch (error) {
      this.errorRef.set(error instanceof Error ? error.message : this.i18n.translate('payment.registration.error.start'));
    } finally {
      this.busyRef.set(false);
    }
  }

  private startRegistrationPolling(): void {
    this.stopRegistrationPolling();
    this.registrationPoll = setTimeout(() => void this.refreshRegistration(), 1500);
  }

  private async refreshRegistration(): Promise<void> {
    const current = this.registrationRef();
    if (!current || this.registrationRefreshInFlight) return;
    this.registrationRefreshInFlight = true;
    try {
      const registration = await this.paymentMethods.refreshRegistration(this.activeUserId(), current.id);
      if (registration.status === 'pending') {
        if (this.registrationExpired(current.expiresAtIso)) this.finishRegistration('expired');
        return;
      }
      this.finishRegistration(registration.status);
      if (registration.status === 'completed') {
        this.errorRef.set('');
      } else if (registration.status !== 'cancelled') {
        this.errorRef.set(this.i18n.translateParams('payment.registration.error.ended', { status: registration.status }));
      }
    } catch (error) {
      this.errorRef.set(error instanceof Error ? error.message : this.i18n.translate('payment.registration.error.status'));
      if (this.registrationExpired(current.expiresAtIso)) this.finishRegistration('expired');
    } finally {
      this.registrationRefreshInFlight = false;
      if (this.registrationRef()?.id === current.id) this.startRegistrationPolling();
    }
  }

  private closeRegistration(): void {
    this.registrationFrameOpenRef.set(false);
  }

  private closeAll(): void {
    this.closeRegistration();
    this.cardsOpenRef.set(false);
    this.errorRef.set('');
    this.store.close();
  }

  private closeCards(): void {
    this.closeRegistration();
    if (this.pickerMode()) {
      this.closeAll();
    } else {
      this.cardsOpenRef.set(false);
    }
  }

  private stopRegistrationPolling(): void {
    if (this.registrationPoll !== null) {
      clearTimeout(this.registrationPoll);
      this.registrationPoll = null;
    }
  }

  private trackRegistration(registration: PaymentMethodRegistrationDto, openFrame: boolean): void {
    if (registration.status !== 'pending') {
      this.finishRegistration(registration.status);
      return;
    }
    const paymentUrl = registration.paymentUrl?.trim() || '';
    if (!paymentUrl) throw new Error(this.i18n.translate('payment.registration.error.page'));
    const current = this.registrationRef();
    if (current?.id !== registration.id) {
      this.registrationRef.set({
        id: registration.id,
        url: paymentUrl,
        safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(paymentUrl),
        expiresAtIso: registration.expiresAtIso,
        replacesPaymentMethodId: registration.replacesPaymentMethodId?.trim() || null
      });
      this.startRegistrationPolling();
    }
    if (openFrame) this.registrationFrameOpenRef.set(true);
  }

  private finishRegistration(status: string): void {
    this.stopRegistrationPolling();
    this.registrationFrameOpenRef.set(false);
    this.registrationRef.set(null);
    this.revisionRef.update(value => value + 1);
    if (status === 'expired') {
      this.errorRef.set(this.i18n.translate('payment.registration.error.expired'));
    }
  }

  private registrationExpired(expiresAtIso: string): boolean {
    const expiry = Date.parse(expiresAtIso);
    return Number.isFinite(expiry) && Date.now() >= expiry;
  }

  private pendingPaymentMethod(registration: PaymentMethodRegistrationDto): SavedPaymentMethodDto {
    return {
      id: `registration:${registration.id}`,
      provider: registration.provider,
      brand: '',
      last4: '',
      expiryMonth: 1,
      expiryYear: 2000,
      cardholderName: '',
      artworkKey: '',
      artworkUrl: '',
      status: 'registering',
      createdAtIso: '',
      updatedAtIso: ''
    };
  }

  private activeUserId(): string {
    const userId = this.userProfileStore.activeUserId().trim();
    if (!userId) throw new Error('A signed-in user is required.');
    return userId;
  }

  private origin(url: string): string {
    try { return new URL(url, window.location.href).origin; } catch { return ''; }
  }

  private headerActionControl(trigger: AppMenuTrigger): PopupControl<PaymentPopupMenuContext> {
    return { kind: 'menu', id: trigger.id ?? 'payment-header-action', trigger };
  }

  private paymentStatusLabel(status: string): string {
    const normalized = `${status ?? ''}`.trim().toLowerCase();
    return normalized ? this.i18n.translate(`payment.status.${normalized}`, status) : '';
  }

  private historySubtitle(): string {
    const base = this.i18n.translate('payment.history.subtitle');
    const totals = Object.entries(this.spendingTotalsRef())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, amount]) => new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency
      }).format(Number(amount) || 0));
    return totals.length > 0
      ? `${base} · ${this.i18n.translate('payment.history.spent')}: ${totals.join(' · ')}`
      : base;
  }

  private async openPaymentSummary(item: PaymentHistoryItemDto): Promise<void> {
    if (item.fulfillmentKind === 'client') {
      await this.openAssetPaymentSummary(item);
      return;
    }
    this.errorRef.set('');
    const userId = this.activeUserId();
    try {
      await this.activities.ensureActivitiesPopupLoaded();
      const record = await this.events.queryKnownRecordById(userId, item.sourceId);
      if (!record) {
        this.errorRef.set(this.i18n.translate('payment.summary.error.source.unavailable'));
        return;
      }
      this.store.close();
      this.eventCheckoutDialog.open({
        mode: 'join',
        userId,
        record,
        readOnlySummary: true,
        preloadedCheckoutBasket: await this.paymentSummaryBasket(userId, item, record.title),
        title: 'event.checkout.payment.summary',
        subtitle: record.timeframe,
        failureMessage: this.i18n.translate('payment.summary.error.open'),
        onSubmit: () => undefined
      });
    } catch {
      this.errorRef.set(this.i18n.translate('payment.summary.error.open'));
    }
  }

  private async openAssetPaymentSummary(item: PaymentHistoryItemDto): Promise<void> {
    this.errorRef.set('');
    const userId = this.activeUserId();
    try {
      const card = await this.findPaymentAsset(userId, item.sourceId);
      if (!card) {
        this.errorRef.set(this.i18n.translate('payment.summary.error.asset.unavailable'));
        return;
      }
      const request = (card.requests ?? []).find(candidate =>
        `${candidate.userId ?? ''}`.trim() === userId
        && (!item.checkoutSessionId
          || `${candidate.booking?.paymentSessionId ?? ''}`.trim() === item.checkoutSessionId)
      ) ?? (card.requests ?? []).find(candidate => `${candidate.userId ?? ''}`.trim() === userId) ?? null;
      const audit = item.checkoutSessionId
        ? await this.events.loadCheckoutPaymentAudit(userId, card.id, item.checkoutSessionId)
        : null;
      const startAtIso = `${request?.booking?.startAtIso ?? item.createdAtIso}`.trim();
      const endAtIso = `${request?.booking?.endAtIso ?? startAtIso}`.trim();
      const quantity = Math.max(1, Math.trunc(Number(request?.booking?.quantity) || 1));
      const currency = `${audit?.currency ?? item.currency ?? 'USD'}`.trim() || 'USD';
      const rows = audit?.pricingSummaryRows?.length
        ? audit.pricingSummaryRows.map(row => ({ ...row }))
        : audit?.lineItems?.length
          ? audit.lineItems.map((line, index) => ({
              key: `payment-history-${line.id || index}`,
              label: line.label,
              detail: line.detail,
              amount: line.amount,
              currency: line.currency,
              multiplier: null
            }))
          : [{
              key: `payment-history-${item.id}`,
              label: card.title,
              detail: request?.booking?.timeframe ?? null,
              amount: item.amount,
              currency,
              multiplier: null
            }];
      await this.assetPopup.ensureAssetPopupLoaded();
      this.store.close();
      this.assetStore.openAssetEditorEdit({
        cardId: card.id,
        form: AssetCardBuilder.buildAssetFormFromCard(card),
        visibility: AssetCardBuilder.visibilityFromCard(card),
        loading: false,
        readOnly: true,
        runtimeAssignment: {
          quantity,
          quantityMax: quantity,
          quantityLabel: this.i18n.translate('quantity'),
          quantityDescription: request?.booking?.timeframe ?? undefined,
          editable: false
        },
        checkout: {
          sourceId: card.id,
          mode: 'payment-summary',
          phase: 'payment',
          title: this.i18n.translate('event.checkout.payment.summary'),
          subtitle: card.title,
          dateRange: { startAt: startAtIso, endAt: endAtIso, precision: 'minute' },
          dateRangeModel: {
            mode: 'range',
            precision: 'minute',
            valueFormat: 'iso-date-time',
            range: {
              start: { label: this.i18n.translate('asset.borrow.start') },
              end: { label: this.i18n.translate('asset.borrow.end') }
            }
          },
          availableQuantity: quantity,
          pricingPreview: {
            rows,
            totalAmount: Number(audit?.amount ?? item.amount) || 0,
            currency
          },
          acceptedPolicyIds: [...(request?.booking?.acceptedPolicyIds ?? [])],
          footerItems: [],
          busy: false,
          error: null,
          paymentProviderLabel: 'event.editor.payment.recorded',
          paymentStatusLabel: audit?.auditKind === 'booking_price_revision'
            ? 'event.editor.payment.recorded.revised'
            : this.paymentStatusLabel(audit?.status ?? item.status),
          paymentNote: audit?.auditKind === 'booking_price_revision'
            ? 'event.editor.payment.recorded.revision.note'
            : 'event.editor.payment.recorded.note'
        }
      });
    } catch {
      this.errorRef.set(this.i18n.translate('payment.summary.error.open'));
    }
  }

  private async findPaymentAsset(
    userId: string,
    sourceId: string
  ): Promise<AppDTOs.AssetDTO | AppDTOs.AssetDetailDTO | null> {
    const normalizedSourceId = sourceId.trim();
    if (!normalizedSourceId) return null;
    const cached = this.assets.peekOwnedAssetById(userId, normalizedSourceId);
    if (cached) return cached;
    const detail = await this.assets.loadOwnedAssetDetailById(userId, normalizedSourceId);
    if (detail) return detail;
    const visibleByType = await Promise.all(AppConstants.ASSET_TYPES.map(type =>
      this.assets.queryVisibleAssets({ userId, type })
    ));
    const visible = visibleByType.flat().find(card => card.id === normalizedSourceId) ?? null;
    if (!visible) return null;
    return await this.assets.loadOwnedAssetDetailById(userId, visible.id) ?? visible;
  }

  private async paymentSummaryBasket(
    userId: string,
    item: PaymentHistoryItemDto,
    fallbackLabel: string
  ): Promise<AppDTOs.EventCheckoutBasket> {
    const audit = item.checkoutSessionId
      ? await this.events.loadCheckoutPaymentAudit(userId, item.sourceId, item.checkoutSessionId)
      : null;
    const currency = `${audit?.currency ?? item.currency ?? 'USD'}`.trim() || 'USD';
    const amount = Number(audit?.amount ?? item.amount) || 0;
    const items = audit?.basketItems?.length
      ? audit.basketItems.map(basketItem => ({ ...basketItem }))
      : [{
          id: `payment-history-${item.id}`,
          kind: 'event' as const,
          sourceId: item.sourceId,
          label: fallbackLabel,
          detail: '',
          amount,
          currency,
          quantity: 1,
          status: 'confirmed' as const,
          resultState: item.status === 'failed' ? 'failed' as const : 'succeeded' as const,
          pricingSummaryRows: audit?.pricingSummaryRows?.map(row => ({ ...row })) ?? [],
          checkoutSessionId: item.checkoutSessionId ?? null,
          createdAtIso: item.createdAtIso
        }];
    return {
      userId,
      sourceId: item.sourceId,
      status: 'confirmed',
      items,
      pricingSummaryRows: audit?.pricingSummaryRows?.map(row => ({ ...row })) ?? [],
      lineItems: audit?.lineItems?.map(line => ({ ...line })) ?? [],
      totalAmount: amount,
      currency,
      checkoutSessionId: item.checkoutSessionId ?? null,
      appliedPromoCodes: []
    };
  }

  ngOnDestroy(): void {
    this.stopRegistrationPolling();
  }
}
