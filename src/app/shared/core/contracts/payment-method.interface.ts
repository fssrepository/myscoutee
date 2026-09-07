import type { ListQuery, PageResult } from './list.interface';

export type PaymentProvider = 'stripe' | 'barion';
export type PaymentHistoryDirection = 'all' | 'expenses' | 'income';
export type PaymentMethodRegistrationStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface SavedPaymentMethodDto {
  id: string;
  provider: PaymentProvider;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  cardholderName: string;
  artworkKey: string;
  artworkUrl: string;
  status: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface SavedPaymentMethodsPageDto extends PageResult<SavedPaymentMethodDto> {
  canAdd: boolean;
  pendingRegistration: PaymentMethodRegistrationDto | null;
  currentProvider: PaymentProvider | 'none' | null;
}

export interface PaymentMethodRegistrationRequestDto {
  provider?: PaymentProvider | null;
  replacesPaymentMethodId?: string | null;
}

export interface PaymentMethodRegistrationDto {
  id: string;
  provider: PaymentProvider;
  status: PaymentMethodRegistrationStatus;
  paymentUrl: string | null;
  expiresAtIso: string;
  replacesPaymentMethodId: string | null;
  paymentMethod: SavedPaymentMethodDto | null;
}

export interface PaymentHistoryItemDto {
  id: string;
  sourceId: string;
  direction: 'expense' | 'income';
  paymentMethodId?: string | null;
  provider: string;
  status: string;
  failureReason?: string | null;
  amount: number;
  currency: string;
  bookingStatus: string;
  auditKind: string;
  fulfillmentKind?: string | null;
  checkoutSessionId?: string | null;
  createdAtIso: string;
  recipientUserId?: string | null;
  serviceContext?: 'asset' | 'event' | null;
  contextEventId?: string | null;
  contextSubEventId?: string | null;
  contextAssetId?: string | null;
  refundRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected' | string | null;
  refundRequestedAtIso?: string | null;
  refundedAtIso?: string | null;
  canRequestRefund?: boolean;
  canApproveRefund?: boolean;
  refundPreview?: PaymentRefundPreviewDto | null;
  paymentMethod?: SavedPaymentMethodDto | null;
}

export interface PaymentRefundPreviewDto {
  paidAmount: number;
  refundableAmount: number;
  retainedAmount: number;
  currency: string;
  status: 'none' | 'not_eligible' | 'partial' | 'full' | string;
  ruleId?: string | null;
  ruleOffsetUnit?: 'hours' | 'days' | 'weeks' | 'months' | string | null;
  ruleOffsetValue?: number | null;
  refundKind?: 'full' | 'percent' | 'fixed_amount' | 'none' | string | null;
  refundValue?: number | null;
  ruleDescription?: string | null;
}

export interface PaymentHistoryPageDto extends PageResult<PaymentHistoryItemDto> {
  spendingTotals: Record<string, number>;
  incomeTotals: Record<string, number>;
  pendingRefundCount: number;
}

export interface PaymentHistoryMutationDto {
  item: PaymentHistoryItemDto;
  spendingTotals: Record<string, number>;
  incomeTotals: Record<string, number>;
  pendingRefundCount: number;
}

export interface PaymentMethodDataService {
  queryPage(userId: string, query: ListQuery, signal?: AbortSignal): Promise<SavedPaymentMethodsPageDto>;
  beginRegistration(
    userId: string,
    request: PaymentMethodRegistrationRequestDto,
    signal?: AbortSignal
  ): Promise<PaymentMethodRegistrationDto>;
  refreshRegistration(userId: string, registrationId: string, signal?: AbortSignal): Promise<PaymentMethodRegistrationDto>;
  deletePaymentMethod(userId: string, paymentMethodId: string, signal?: AbortSignal): Promise<void>;
  queryHistory(
    userId: string,
    paymentMethodId: string,
    query: ListQuery,
    signal?: AbortSignal
  ): Promise<PaymentHistoryPageDto>;
  queryAllHistory(userId: string, query: ListQuery, signal?: AbortSignal): Promise<PaymentHistoryPageDto>;
  requestRefund(userId: string, paymentId: string, signal?: AbortSignal): Promise<PaymentHistoryMutationDto>;
  approveRefund(userId: string, paymentId: string, signal?: AbortSignal): Promise<PaymentHistoryMutationDto>;
}
