import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { OfflineCacheService } from '../../base/services/offline-cache.service';
import { HttpAssetTicketsService } from './asset-tickets.service';

describe('HttpAssetTicketsService', () => {
  const get = vi.fn();
  const writeTicketPage = vi.fn();
  const readTicketPage = vi.fn();

  beforeEach(() => {
    get.mockReset();
    writeTicketPage.mockReset();
    readTicketPage.mockReset().mockReturnValue(null);
    TestBed.configureTestingModule({
      providers: [
        HttpAssetTicketsService,
        { provide: HttpClient, useValue: { get } },
        {
          provide: OfflineCacheService,
          useValue: { writeTicketPage, readTicketPage }
        }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('queries tickets for the selected profile instead of the signed-in actor', async () => {
    get.mockReturnValue(of({ items: [], total: 0 }));

    await TestBed.inject(HttpAssetTicketsService).queryTicketPage({
      userId: ' nagy-eszter ',
      page: 0,
      pageSize: 20,
      order: 'upcoming'
    });

    const [, options] = get.mock.calls[0];
    expect(options.params.get('userId')).toBe('nagy-eszter');
    expect(options.params.get('order')).toBe('upcoming');
  });
});
