import { AssetTicketBuilder } from './asset-ticket.builder';

import type * as AssetContracts from '../../contracts/asset.interface';

describe('AssetTicketBuilder', () => {
  it('uses the server-issued scan code without serializing holder or event data into it', () => {
    const row = ticketRow({
      scanCode: 'TKT-opaque-server-value'
    });

    const payload = AssetTicketBuilder.createScanPayload(row, {
      id: 'holder-1',
      name: 'Sensitive Person',
      age: 31,
      city: 'Sensitive City'
    });

    expect(payload.code).toBe('TKT-opaque-server-value');
    expect(payload.code).not.toContain('Sensitive Person');
    expect(payload.code).not.toContain('Sensitive City');
  });

  it('round-trips deterministic demo codes containing only ids and a checksum', () => {
    const code = AssetTicketBuilder.createDemoScanCode('event/with space', 'holder@example');

    expect(AssetTicketBuilder.parseDemoScanCode(code)).toEqual({
      eventId: 'event/with space',
      holderUserId: 'holder@example'
    });
    expect(AssetTicketBuilder.parseDemoScanCode(`${code}tampered`)).toBeNull();
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
