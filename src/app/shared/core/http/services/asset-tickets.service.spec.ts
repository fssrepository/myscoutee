import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { OfflineCacheService } from '../../base/services/offline-cache.service';
import { HttpAssetTicketsService } from './asset-tickets.service';

describe('HttpAssetTicketsService', () => {
  const get = vi.fn();
  const post = vi.fn();
  const writeTicketPage = vi.fn();
  const readTicketPage = vi.fn();

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    writeTicketPage.mockReset();
    readTicketPage.mockReset().mockReturnValue(null);
    TestBed.configureTestingModule({
      providers: [
        HttpAssetTicketsService,
        { provide: HttpClient, useValue: { get, post } },
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

  it('uses the ticket sync endpoint with the SmartList known window', async () => {
    post.mockReturnValue(of({
      upserts: [{
        id: 'event-b',
        revision: 'revision-b',
        scanCode: 'TKT-b',
        holderUserId: 'holder-1',
        usedAtIso: null,
        type: 'events',
        status: 'A',
        title: 'Event B',
        subtitle: '',
        detail: '',
        dateIso: '2030-04-18T19:00:00.000Z'
      }],
      removedIds: ['events:event-a'],
      total: 1
    }));

    const result = await TestBed.inject(HttpAssetTicketsService).syncTickets({
      userId: ' holder-1 ',
      order: 'upcoming',
      limit: 6,
      knownItems: [{ id: 'events:event-a', revision: 'revision-a' }],
      loadedTail: { id: 'events:event-a', dateIso: '2030-04-18T19:00:00.000Z' }
    });

    expect(post).toHaveBeenCalledWith('/api/assets/tickets/sync', {
      userId: 'holder-1',
      order: 'upcoming',
      limit: 6,
      knownItems: [{ id: 'events:event-a', revision: 'revision-a' }],
      loadedTail: { id: 'events:event-a', dateIso: '2030-04-18T19:00:00.000Z' }
    });
    expect(result.removedIds).toEqual(['events:event-a']);
    expect(result.upserts.map(row => row.id)).toEqual(['event-b']);
    expect(result.total).toBe(1);
  });

  it('posts the raw ticket code and scanner actor without using cached ticket data', async () => {
    post.mockReturnValue(of({
      valid: false,
      reason: 'already_used',
      ticket: null
    }));

    const response = await TestBed.inject(HttpAssetTicketsService).validateTicket({
      code: ' TKT-live-code ',
      userId: ' event-manager '
    });

    expect(post).toHaveBeenCalledWith('/api/assets/tickets/validate', {
      code: 'TKT-live-code',
      userId: 'event-manager'
    });
    expect(response).toEqual({
      valid: false,
      reason: 'already_used',
      ticket: null
    });
    expect(readTicketPage).not.toHaveBeenCalled();
  });

  it('propagates ticket validation transport errors without an offline fallback', async () => {
    const transportError = new Error('network unavailable');
    post.mockReturnValue(throwError(() => transportError));

    await expect(TestBed.inject(HttpAssetTicketsService).validateTicket({
      code: 'TKT-live-code',
      userId: 'event-manager'
    })).rejects.toBe(transportError);

    expect(readTicketPage).not.toHaveBeenCalled();
  });
});
