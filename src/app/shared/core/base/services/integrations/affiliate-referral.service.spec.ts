import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { AffiliateReferralService } from './affiliate-referral.service';

describe('Affiliate referral intent', () => {
  it('keeps the first valid code through authentication and clears after save', () => {
    const service = new AffiliateReferralService();
    service.clear();
    service.capture('invalid');
    expect(service.pending()).toBeUndefined();
    service.capture('00000000-0000-4000-8000-000000000001');
    service.capture('00000000-0000-4000-8000-000000000002');
    expect(service.pending()).toBe('00000000-0000-4000-8000-000000000001');
    service.clear();
    expect(service.pending()).toBeUndefined();
  });
});
