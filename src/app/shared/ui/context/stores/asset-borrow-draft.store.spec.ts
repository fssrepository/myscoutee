import { APP_STORAGE_KEYS } from '../../../core/common/storage-scope';
import { AssetBorrowDraftStore, type AssetBorrowDraft } from './asset-borrow-draft.store';

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
      paymentStep: true
    }));
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
});
