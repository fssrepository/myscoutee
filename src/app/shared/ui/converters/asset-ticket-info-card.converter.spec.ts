import { AssetTicketInfoCardConverter } from './asset-ticket-info-card.converter';

import type * as AssetContracts from '../../core/contracts/asset.interface';

describe('AssetTicketInfoCardConverter', () => {
  it('keeps the QR action on an unused ticket', () => {
    const card = AssetTicketInfoCardConverter.convert(ticketRow());

    expect(card.surfaceTone).toBe('default');
    expect(card.mediaEnd).toMatchObject({
      icon: 'qr_code_2',
      interactive: true,
      ariaLabel: 'Open ticket QR code'
    });
  });

  it('shows a checked-in action and contextual card tone for a used ticket', () => {
    const card = AssetTicketInfoCardConverter.convert(ticketRow({
      usedAtIso: '2030-04-18T18:45:00.000Z'
    }));

    expect(card.surfaceTone).toBe('published');
    expect(card.mediaEnd).toMatchObject({
      icon: 'check_circle',
      label: 'asset.ticket.checked.in',
      tone: 'stage-finalized',
      interactive: true,
      ariaLabel: 'asset.ticket.checkin.details.aria'
    });
  });
});

function ticketRow(overrides: Partial<AssetContracts.AssetTicketDTO> = {}): AssetContracts.AssetTicketDTO {
  return {
    id: 'event-1',
    scanCode: 'TKT-code',
    holderUserId: 'holder-1',
    usedAtIso: null,
    type: 'events',
    title: 'Evening event',
    subtitle: 'Main hall',
    detail: 'Tonight',
    dateIso: '2030-04-18T19:00:00.000Z',
    ...overrides
  };
}
