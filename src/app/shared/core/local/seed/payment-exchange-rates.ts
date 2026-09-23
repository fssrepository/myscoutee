// Fixed frontend-local demo values, matching the packaged payment simulator.
// HTTP/Explore adapters obtain their observations from the backend instead.
export const SEED_PAYMENT_EXCHANGE_RATES: Readonly<Record<string, number>> = Object.freeze({
  EUR: 1, HUF: 400, USD: 1.10, GBP: 0.85, CZK: 25, PLN: 4.25, CHF: 0.95
});
