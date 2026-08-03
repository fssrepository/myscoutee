import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { I18nService } from '../../../shared/core';
import type * as AssetContracts from '../../../shared/core/contracts/asset.interface';
import { AssetTicketCodePopupComponent } from './asset-ticket-code-popup.component';

describe('AssetTicketCodePopupComponent', () => {
  const currentLanguage = signal('en');

  beforeEach(() => {
    currentLanguage.set('en');
    TestBed.configureTestingModule({
      imports: [AssetTicketCodePopupComponent],
      providers: [{
        provide: I18nService,
        useValue: {
          currentLanguage: currentLanguage.asReadonly(),
          revision: () => 0,
          translate: (value: string | null | undefined) => value ?? ''
        }
      }]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('formats the check-in timestamp with the language selected in the app', () => {
    currentLanguage.set('hu');
    const fixture = TestBed.createComponent(AssetTicketCodePopupComponent);
    fixture.componentInstance.selectedTicketRow = ticketRow({
      usedAtIso: '2030-04-18T18:45:00.000Z'
    });
    const toLocaleString = vi.spyOn(Date.prototype, 'toLocaleString')
      .mockReturnValue('2030. 04. 18. 20:45:00');

    const label = (fixture.componentInstance as unknown as {
      checkedInAtLabel(): string;
    }).checkedInAtLabel();

    expect(toLocaleString).toHaveBeenCalledWith('hu');
    expect(label).toBe('2030. 04. 18. 20:45:00');
  });
});

function ticketRow(
  overrides: Partial<AssetContracts.AssetTicketDTO> = {}
): AssetContracts.AssetTicketDTO {
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
