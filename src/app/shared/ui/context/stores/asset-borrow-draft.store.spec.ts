import { APP_STORAGE_KEYS } from '../../../core/common/storage-scope';
import {
  AssetBorrowDraftStore,
  assetBorrowSelectionSignature,
  type AssetBorrowDraft
} from './asset-borrow-draft.store';

describe('AssetBorrowDraftStore', () => {
  const draft = (overrides: Partial<AssetBorrowDraft> = {}): AssetBorrowDraft => ({
    userId: ' nova ',
    subEventId: ' stage-1 ',
    cardId: ' asset-1 ',
    ownerUserId: ' casey ',
    title: ' Paid Transport ',
    quantity: 1,
    startAtIso: '2026-09-08T09:00:00.000Z',
    endAtIso: '2026-09-08T11:00:00.000Z',
    acceptedPolicyIds: [' policy-1 ', 'policy-1'],
    checkoutSessionId: null,
    paymentMethod: null,
    paymentStep: true,
    confirmedSelectionSignature: null,
    expiresAtIso: '2026-09-08T11:20:00.000Z',
    updatedAtMs: 10,
    ...overrides
  });

  beforeEach(() => {
    window.localStorage.removeItem(APP_STORAGE_KEYS.assetBorrowDrafts);
  });

  afterEach(() => {
    window.localStorage.removeItem(APP_STORAGE_KEYS.assetBorrowDrafts);
  });

  it('reconstructs a normalized payment-phase draft after store recreation', () => {
    const first = new AssetBorrowDraftStore();
    first.save(draft());

    const reconstructed = new AssetBorrowDraftStore().read('nova', 'stage-1', 'asset-1');

    expect(reconstructed).toEqual(jasmine.objectContaining({
      userId: 'nova',
      subEventId: 'stage-1',
      cardId: 'asset-1',
      ownerUserId: 'casey',
      title: 'Paid Transport',
      quantity: 1,
      acceptedPolicyIds: ['policy-1'],
      paymentStep: true,
      confirmedSelectionSignature: assetBorrowSelectionSignature({
        quantity: 1,
        startAtIso: '2026-09-08T09:00:00.000Z',
        endAtIso: '2026-09-08T11:00:00.000Z',
        acceptedPolicyIds: ['policy-1']
      })
    }));
  });

  it('keeps the confirmed baseline stable while current draft values change', () => {
    const store = new AssetBorrowDraftStore();
    const baseline = assetBorrowSelectionSignature(draft());
    store.save(draft({ confirmedSelectionSignature: baseline }));
    store.save(draft({ quantity: 2, confirmedSelectionSignature: baseline, updatedAtMs: 20 }));

    const reconstructed = new AssetBorrowDraftStore().read('nova', 'stage-1', 'asset-1');

    expect(reconstructed?.quantity).toBe(2);
    expect(reconstructed?.confirmedSelectionSignature).toBe(baseline);
    expect(assetBorrowSelectionSignature(reconstructed!)).not.toBe(baseline);
  });

  it('keeps drafts isolated by user, sub-event and asset and persists clear', () => {
    const first = new AssetBorrowDraftStore();
    first.save(draft());
    first.save(draft({ cardId: 'asset-2', updatedAtMs: 20 }));
    first.save(draft({ userId: 'riley', updatedAtMs: 30 }));

    expect(first.list('nova', 'stage-1').map(item => item.cardId)).toEqual(['asset-2', 'asset-1']);

    first.clear('nova', 'stage-1', 'asset-1');
    const reconstructed = new AssetBorrowDraftStore();
    expect(reconstructed.read('nova', 'stage-1', 'asset-1')).toBeNull();
    expect(reconstructed.read('nova', 'stage-1', 'asset-2')).not.toBeNull();
    expect(reconstructed.read('riley', 'stage-1', 'asset-1')).not.toBeNull();
  });

  it('reconciles missing, succeeded and expired deleted server baskets', () => {
    const store = new AssetBorrowDraftStore();
    store.save(draft({ cardId: 'missing', updatedAtMs: 10 }));
    store.save(draft({ cardId: 'succeeded', updatedAtMs: 20 }));
    store.save(draft({ cardId: 'expired', expiresAtIso: '2026-09-08T10:00:00.000Z', updatedAtMs: 30 }));
    store.save(draft({ cardId: 'recoverable', updatedAtMs: 40 }));
    store.save(draft({ cardId: 'fresh-deleted', updatedAtMs: 50 }));

    store.reconcileServerCheckoutStates(
      'nova',
      'stage-1',
      ['missing', 'succeeded', 'expired', 'recoverable', 'fresh-deleted'],
      {
        succeeded: 'succeeded',
        expired: 'deleted',
        recoverable: 'failed',
        'fresh-deleted': 'deleted'
      },
      Date.parse('2026-09-08T10:01:00.000Z')
    );

    expect(store.list('nova', 'stage-1').map(item => item.cardId)).toEqual(['fresh-deleted', 'recoverable']);
  });
});
