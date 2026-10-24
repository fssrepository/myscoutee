import { OperatorSettlementFilters } from '../../../contracts/operator/operator.interface';
import type { ListQuery } from '@fssrepository/myscoutee-components';
export class OperatorSettlementBuilder {

  static queryFilters(query: ListQuery<OperatorSettlementFilters>) {
    const limit = Math.max(1, Math.min(100, Math.trunc(Number(query.pageSize) || 10)));
    const currencyCode = `${query.filters?.currencyCode ?? ''}`.trim().toUpperCase();
    const fromPeriod = `${query.filters?.fromPeriod ?? ''}`.trim();
    const throughPeriod = `${query.filters?.throughPeriod ?? ''}`.trim();
    if (currencyCode && !/^[A-Z]{3}$/.test(currencyCode)) {
      throw new Error('operator.revenue.settlement.currency.invalid');
    }
    if ((fromPeriod && !this.validSettlementPeriod(fromPeriod))
      || (throughPeriod && !this.validSettlementPeriod(throughPeriod))
      || (fromPeriod && throughPeriod && fromPeriod > throughPeriod)) {
      throw new Error('operator.revenue.settlement.period.invalid');
    }
    const cursor = this.decodeSettlementCursor(query.cursor);
    return { limit, currencyCode, fromPeriod, throughPeriod, cursor };
  }

  static decodeSettlementCursor(
    cursor: string | null | undefined
  ): {
    afterPeriod: string;
    afterSettlementId: string;
  } | null {
    const normalized = `${cursor ?? ''}`.trim();
    if (!normalized) {
      return null;
    }
    if (!normalized.startsWith('operator-settlement:')) {
      throw new Error('operator.revenue.settlement.cursor.invalid');
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(
        normalized.slice('operator-settlement:'.length)
      )) as {
        afterPeriod?: unknown;
        afterSettlementId?: unknown;
      };
      const afterPeriod = `${parsed.afterPeriod ?? ''}`.trim();
      const afterSettlementId =
        `${parsed.afterSettlementId ?? ''}`.trim();
      if (
        !this.validSettlementPeriod(afterPeriod)
        || !/^stl_[0-9a-f]{32}$/.test(afterSettlementId)
      ) {
        throw new Error();
      }
      return { afterPeriod, afterSettlementId };
    } catch {
      throw new Error('operator.revenue.settlement.cursor.invalid');
    }
  }

  static validSettlementPeriod(value: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  }
}
