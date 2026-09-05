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
  amount: number;
  currency: string;
  bookingStatus: string;
  auditKind: string;
  fulfillmentKind?: string | null;
  checkoutSessionId?: string | null;
  createdAtIso: string;
  paymentMethod?: SavedPaymentMethodDto | null;
}

export interface PaymentHistoryPageDto extends PageResult<PaymentHistoryItemDto> {
  spendingTotals: Record<string, number>;
  incomeTotals: Record<string, number>;
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
}
