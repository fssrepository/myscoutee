import type { EventCheckoutRequest } from '../../../contracts/activity.interface';

import { LocalEventCheckoutBasketsMapper } from './event-checkout-basket.mapper';

describe('LocalEventCheckoutBasketsMapper applied promo codes', () => {
  it('normalizes and preserves applied promo codes through a request-record-DTO round trip', () => {
    const request: EventCheckoutRequest = {
      userId: ' user-1 ',
      sourceId: 'event-1',
      optionalSubEventIds: [],
      assetSelections: [],
      acceptedPolicyIds: [],
      appliedPromoCodes: [
        ' vipphoto20 ',
        'VIPPHOTO20',
        'vipsprint5',
        '',
        '  lucaguest10 '
      ],
      basketItems: [],
      pricingSummaryRows: [],
      checkoutState: 'draft',
      lineItems: [],
      totalAmount: 25,
      currency: 'USD'
    };

    const record = LocalEventCheckoutBasketsMapper.toRecordFromRequest(request);
    const dto = LocalEventCheckoutBasketsMapper.toDto(record);
    const roundTrippedRecord = LocalEventCheckoutBasketsMapper.toRecord(dto);
    const expectedCodes = ['VIPPHOTO20', 'VIPSPRINT5', 'LUCAGUEST10'];

    expect(record?.userId).toBe('user-1');
    expect(record?.appliedPromoCodes).toEqual(expectedCodes);
    expect(dto?.appliedPromoCodes).toEqual(expectedCodes);
    expect(roundTrippedRecord?.appliedPromoCodes).toEqual(expectedCodes);
  });
});
