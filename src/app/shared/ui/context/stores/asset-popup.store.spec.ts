import { AssetPopupStore } from './asset-popup.store';

import type * as AssetContracts from '../../../core/contracts/asset.interface';

describe('AssetPopupStore ticket validation state', () => {
  it('only keeps attendee details for a valid server response without changing the organizer ticket list', () => {
    const store = new AssetPopupStore();
    store.updateTicketList([ticketRow()], 1);
    store.openTicketScanner();
    store.applyTicketScannerValidating();

    store.applyTicketScannerValid(scanPayload());

    expect(store.ticketScannerState()).toBe('valid');
    expect(store.ticketScannerResult()?.holderUserId).toBe('holder-1');
    expect(store.ticketRowsRef()[0]?.usedAtIso).toBeNull();
  });

  it('clears attendee details for invalid and transport-error states', () => {
    const store = new AssetPopupStore();
    store.openTicketScanner();
    store.applyTicketScannerValid(scanPayload());

    store.applyTicketScannerInvalid('already_used');
    expect(store.ticketScannerState()).toBe('invalid');
    expect(store.ticketScannerReason()).toBe('already_used');
    expect(store.ticketScannerResult()).toBeNull();

    store.applyTicketScannerError();
    expect(store.ticketScannerState()).toBe('error');
    expect(store.ticketScannerReason()).toBeNull();
    expect(store.ticketScannerResult()).toBeNull();
  });

  it('keeps an open ticket popup in sync with the polled ticket row', () => {
    const store = new AssetPopupStore();
    const original = ticketRow();
    const refreshed = {
      ...original,
      usedAtIso: '2030-04-18T18:45:00.000Z'
    };
    store.openTicketCode(original, original.scanCode);

    store.updateTicketList([refreshed], 1);

    expect(store.selectedTicketRow()).toBe(refreshed);
    expect(store.selectedTicketRow()?.usedAtIso).toBe('2030-04-18T18:45:00.000Z');
    expect(store.selectedTicketCodeValueRef()).toBe(original.scanCode);
    expect(store.ticketScanMode()).toBe('ticketCode');
  });
});

function ticketRow(): AssetContracts.AssetTicketDTO {
  return {
    id: 'event-1',
    scanCode: 'TKT-code',
    holderUserId: 'holder-1',
    usedAtIso: null,
    type: 'events',
    title: 'Evening event',
    subtitle: 'Main hall',
    detail: 'Tonight',
    dateIso: '2030-04-18T19:00:00.000Z'
  };
}

function scanPayload(): AssetContracts.TicketScanPayloadDTO {
  return {
    code: 'TKT-code',
    holderUserId: 'holder-1',
    holderName: 'Ticket Holder',
    holderAge: 30,
    holderCity: 'Budapest',
    holderRole: 'Member',
    eventId: 'event-1',
    eventTitle: 'Evening event',
    eventSubtitle: 'Main hall',
    eventTimeframe: 'Tonight',
    eventDateLabel: 'Tonight',
    issuedAtIso: '2030-04-18T19:00:00.000Z',
    usedAtIso: '2030-04-18T18:45:00.000Z'
  };
}
