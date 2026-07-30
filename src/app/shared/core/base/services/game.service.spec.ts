import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../../environments/environment';
import { HttpGameService } from '../../http/services/game.service';
import { LocalRatesRepository } from '../../local/source/repositories/rates.repository';
import { LocalGameService } from '../../local/source/services/game.service';
import { AppRuntimeStore } from '../../../ui/context/stores/app-runtime.store';
import { GameService } from './game.service';
import { RateOutboxService } from './rate-outbox.service';
import { SessionService } from './session.service';

describe('GameService', () => {
  const originalActivitiesDataSource = environment.activitiesDataSource;
  const queryUserGameCardsByFilter = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    environment.activitiesDataSource = 'http';
    queryUserGameCardsByFilter.mockReset().mockResolvedValue({
      cards: {
        filterCount: 6,
        cardUserIds: [],
        socialCards: [],
        nextCursor: null
      }
    });
    TestBed.configureTestingModule({
      providers: [
        GameService,
        AppRuntimeStore,
        {
          provide: SessionService,
          useValue: { currentSession: () => null }
        },
        {
          provide: LocalGameService,
          useValue: {
            whenReady: () => Promise.resolve(),
            queryUserGameCardsByFilter: vi.fn(),
            queryGameCardsUsersSnapshot: () => []
          }
        },
        {
          provide: HttpGameService,
          useValue: {
            queryUserGameCardsByFilter,
            queryGameCardsUsersSnapshot: () => []
          }
        },
        {
          provide: LocalRatesRepository,
          useValue: {
            queryRatedGameCardUserIds: () => [],
            queryRatedGameCardPairKeys: () => []
          }
        },
        {
          provide: RateOutboxService,
          useValue: {
            queryPendingRatedGameCardUserIds: () => [],
            queryPendingRatedGameCardPairKeys: () => [],
            flushPendingUserRatesOutboxBatch: () => Promise.resolve()
          }
        }
      ]
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    environment.activitiesDataSource = originalActivitiesDataSource;
    TestBed.resetTestingModule();
  });

  it('forwards seen card identifiers to the paginated data source request', async () => {
    await TestBed.inject(GameService).loadUserGameCardsByFilter({
      userId: ' active-user ',
      mode: 'outside-network',
      cursor: '10',
      pageSize: 10,
      excludedCardUserIds: [' user-1 ', 'user-1', 'user-2'],
      excludedSocialCardIds: [' pair-1 ', 'pair-1', 'pair-2']
    });

    expect(queryUserGameCardsByFilter).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'active-user',
        cursor: '10',
        pageSize: 10,
        excludedCardUserIds: ['user-1', 'user-2'],
        excludedSocialCardIds: ['pair-1', 'pair-2']
      }),
      undefined
    );
  });

  it('uses the loaded page identifiers when requesting the next stack page', async () => {
    queryUserGameCardsByFilter
      .mockResolvedValueOnce({
        cards: {
          filterCount: 4,
          cardUserIds: ['user-1', 'user-2'],
          socialCards: [],
          nextCursor: '2'
        }
      })
      .mockResolvedValueOnce({
        cards: {
          filterCount: 4,
          cardUserIds: ['user-3', 'user-4'],
          socialCards: [],
          nextCursor: null
        }
      });
    const service = TestBed.inject(GameService);

    await service.loadInitialUserGameCardsStackPage('active-user', null, 2);
    const secondPage = await service.loadNextUserGameCardsStackPage('active-user', null, 2);

    expect(queryUserGameCardsByFilter.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        cursor: '2',
        excludedCardUserIds: ['user-1', 'user-2']
      })
    );
    expect(secondPage.cardUserIds).toEqual(['user-1', 'user-2', 'user-3', 'user-4']);
    expect(secondPage.nextCursor).toBeNull();
  });
});
