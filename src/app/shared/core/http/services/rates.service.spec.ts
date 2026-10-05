import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { HttpRatesService } from './rates.service';
import { RateOutboxRepository } from '../../base/repositories/rate-outbox.repository';
import { BaseUserRatesMapper } from '../../base/mappers/rate.mapper';
import type { ActivityRateDTO } from '../../contracts/activity.interface';

describe('HTTP campaign rating context', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('keeps aggregate and campaign editor rows separate and includes the campaign on a reply', async () => {
    const make = (campaignId: string | null): ActivityRateDTO => ({
      id: `game-card:organizer:member${campaignId ? `:campaign:${campaignId}` : ''}`,
      userId: 'member', campaignId, mode: 'individual', direction: 'received',
      eventName: '', scoreGiven: 0, scoreReceived: campaignId ? 6 : 8, happenedAt: '2026-10-01T10:00:00Z', met: false
    });
    const get = vi.fn((url: string, options: { params: { get(key: string): string | null } }) => {
      const row = make(options.params.get('campaignId'));
      return of(url.endsWith('/page') ? { items: [row], total: 1, nextCursor: null } : [row]);
    });
    TestBed.configureTestingModule({ providers: [
      { provide: HttpClient, useValue: { get } },
      { provide: RateOutboxRepository, useValue: { queryPendingUserRatesOutbox: () => [], queryPendingUserRateRecords: () => [] } }
    ] });
    const rates = TestBed.inject(HttpRatesService);
    await rates.queryRateItemsByUser('organizer');
    const page = await rates.queryActivitiesRatePage('organizer', { page: 0, pageSize: 10,
      filters: { campaignId: 'idea-one', rateFilter: 'individual-received' } });
    const editorRow = rates.peekRateItemsByUser('organizer', 'idea-one').find(row => row.id === page.items[0].id)!;
    expect(editorRow.scoreReceived).toBe(6);
    expect(rates.peekRateItemsByUser('organizer')[0].scoreReceived).toBe(8);
    const reply = BaseUserRatesMapper.toRecord({ kind: 'activity-rate', ownerUserId: 'organizer', rating: 9,
      item: { ...editorRow, scoreGiven: 9, direction: 'mutual' } });
    expect(reply?.campaignId).toBe('idea-one');
    expect(reply?.ownerUserId).toBe('organizer');
    expect(BaseUserRatesMapper.toSyncPayload(reply!)?.campaignId).toBe('idea-one');
  });
});
