import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../common/app.db';
import { RateOutboxRepository } from '../../../base/repositories/rate-outbox.repository';
import { BaseUserRatesMapper } from '../../../base/mappers/rate.mapper';
import type { ActivityRateDTO } from '../../../contracts/activity.interface';
import type { UserDto } from '../../../contracts/user.interface';
import { USER_RATES_TABLE_NAME } from '../entity/rate.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { LocalRatesRepository } from './rates.repository';

describe('LocalRatesRepository Met rating lifecycle', () => {
  let db: LocalMemoryDb;
  let repository: LocalRatesRepository;
  const emptyMet: ActivityRateDTO = {
    id: 'meeting', userId: 'b', mode: 'individual', direction: 'met',
    scoreGiven: 0, scoreReceived: 0, met: true,
    eventName: 'Completed table', happenedAt: '2026-01-01T10:00:00Z'
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [
      { provide: RateOutboxRepository, useValue: { queryPendingUserRateRecords: () => [] } }
    ] });
    db = TestBed.inject(LocalMemoryDb);
    await db.resetStorage();
    repository = TestBed.inject(LocalRatesRepository);
    const record = BaseUserRatesMapper.toRecord('a', emptyMet);
    db.write(state => ({ ...state,
      [USERS_TABLE_NAME]: { ids: ['a', 'b'], byId: {
        a: { id: 'a', profileStatus: 'public' } as UserDto,
        b: { id: 'b', profileStatus: 'public' } as UserDto
      } },
      [USER_RATES_TABLE_NAME]: { ids: [record.id], byId: { [record.id]: record },
        idsByRelevantUserId: { a: [record.id], b: [record.id] } }
    }));
  });

  afterEach(() => TestBed.resetTestingModule());

  function item(user: string): ActivityRateDTO {
    const items = repository.queryActivityRateItemsByUserId(user);
    expect(items).toHaveLength(1);
    return items[0];
  }

  function rate(user: string, current: ActivityRateDTO, score: number): void {
    const direction = current.scoreReceived > 0 ? 'met' : 'given';
    const record = BaseUserRatesMapper.toRecord({ kind: 'activity-rate', ownerUserId: user,
      item: current, rating: score, direction });
    expect(record).not.toBeNull();
    repository.upsertGameCardRatings([record!]);
  }

  it('keeps meeting evidence visible without reconstructing current event membership', () => {
    expect(item('a').direction).toBe('met');
    expect(item('b').direction).toBe('met');
    expect(item('a').id).toBe(item('b').id);
  });

  it('adds completed-table evidence to an existing mutual rating without replacing either score', () => {
    const record = BaseUserRatesMapper.toRecord('a', { ...emptyMet, direction: 'mutual', met: false,
      scoreGiven: 7, scoreReceived: 9 });
    db.write(state => ({ ...state, userRates: { ...state.userRates, byId: { [record.id]: record } } }));
    expect(item('a').direction).toBe('mutual');
    repository.projectMetTables([{ memberUserIds: ['a', 'b'] }], 'Finished event', '2026-01-02T10:00:00Z');
    expect(item('a')).toMatchObject({ met: true, direction: 'met', scoreGiven: 7, scoreReceived: 9 });
    expect(item('b')).toMatchObject({ met: true, direction: 'met', scoreGiven: 9, scoreReceived: 7 });
    expect(db.read().userRates.ids).toEqual(['meeting']);
  });

  it('moves both viewers through Met, Given/Received, Met with one stored record', async () => {
    const staleFirstView = item('a');
    rate('b', item('b'), 8);
    expect(item('b')).toMatchObject({ direction: 'given', scoreGiven: 8, scoreReceived: 0 });
    expect(item('a')).toMatchObject({ direction: 'received', scoreGiven: 0, scoreReceived: 8 });
    rate('a', item('a'), 7);
    expect(item('a')).toMatchObject({ direction: 'met', scoreGiven: 7, scoreReceived: 8 });
    expect(item('b')).toMatchObject({ direction: 'met', scoreGiven: 8, scoreReceived: 7 });
    // A delayed edit must not erase the other participant's persisted rating.
    rate('a', staleFirstView, 9);
    expect(item('a')).toMatchObject({ direction: 'met', scoreGiven: 9, scoreReceived: 8 });
    expect(item('b')).toMatchObject({ direction: 'met', scoreGiven: 8, scoreReceived: 9 });
    expect(db.read()[USER_RATES_TABLE_NAME].ids).toEqual(['meeting']);
    for (const user of ['a', 'b']) {
      for (const direction of ['met', 'given', 'received', 'mutual'] as const) {
        const page = await repository.queryActivityRateItemsPage({ ownerUserId: user,
          mode: 'single', displayDirection: direction, sort: 'happenedAt', limit: 10 });
        expect(page.total).toBe(direction === 'met' ? 1 : 0);
      }
    }
  });
});
