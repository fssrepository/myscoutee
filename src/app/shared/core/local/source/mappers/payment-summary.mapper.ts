import type { PaymentEuroSummaryDto } from '../../../contracts/payment-method.interface';
import { SEED_PAYMENT_EXCHANGE_RATES } from '../../seed/payment-exchange-rates';

type Amounts = Partial<Pick<PaymentEuroSummaryDto, 'outgoing' | 'incoming' | 'gross' | 'refunded'>>;

export class LocalPaymentSummaryMapper {
  static build(userId: string, rows: readonly ({ currency: string } & Amounts)[]): PaymentEuroSummaryDto {
    const saved = globalThis.localStorage?.getItem(`myscoutee.summary-currency.${userId}`) || 'EUR';
    const currency = Object.hasOwn(SEED_PAYMENT_EXCHANGE_RATES, saved) ? saved : 'EUR';
    const result: PaymentEuroSummaryDto = {
      currency, currencies: Object.keys(SEED_PAYMENT_EXCHANGE_RATES).sort(),
      outgoing: 0, incoming: 0, gross: 0, refunded: 0, net: 0, missingRates: 0
    };
    for (const row of rows) {
      const rate = SEED_PAYMENT_EXCHANGE_RATES[row.currency];
      if (!rate) { result.missingRates++; continue; }
      for (const key of ['outgoing', 'incoming', 'gross', 'refunded'] as const) {
        result[key] += Math.round((row[key] ?? 0) / rate * SEED_PAYMENT_EXCHANGE_RATES[currency] * 100);
      }
    }
    for (const key of ['outgoing', 'incoming', 'gross', 'refunded'] as const) result[key] /= 100;
    result.net = Math.round((result.gross - result.refunded) * 100) / 100;
    return result;
  }
}
