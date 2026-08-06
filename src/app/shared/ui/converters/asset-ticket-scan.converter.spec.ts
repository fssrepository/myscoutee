import { AssetTicketScanConverter } from './asset-ticket-scan.converter';

import type * as AssetContracts from '../../core/contracts/asset.interface';

describe('AssetTicketScanConverter', () => {
  it('keeps the ordinary Member role in a separate contextual badge', () => {
    const view = AssetTicketScanConverter.convert(payload({ holderRole: 'Member' }), null);

    expect(view.eventLine).toBe('Manual QA event');
    expect(view.roleBadgeLabel).toBe('Member');
    expect(view.eventLine).not.toContain('Member');
  });

  it('keeps a contextual Manager role separate from the event line', () => {
    const view = AssetTicketScanConverter.convert(payload({ holderRole: 'Manager' }), null);

    expect(view.eventLine).toBe('Manual QA event');
    expect(view.roleBadgeLabel).toBe('Manager');
    expect(view.eventLine).not.toContain('Manager');
  });
});

function payload(
  overrides: Partial<AssetContracts.TicketScanPayloadDTO> = {}
): AssetContracts.TicketScanPayloadDTO {
  return {
    code: 'TKT-test',
    holderUserId: 'holder-1',
    holderName: 'Nova Social',
    holderAge: 27,
    holderCity: 'Austin',
    holderRole: 'Member',
    eventId: 'event-1',
    eventTitle: 'Manual QA event',
    eventSubtitle: '',
    eventTimeframe: 'Today',
    eventDateLabel: '',
    issuedAtIso: '2030-04-18T18:00:00.000Z',
    usedAtIso: '',
    ...overrides
  };
}
