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
  const queryPendingRatedGameCardUserIds = vi.fn();
  const queryPendingRatedGameCardPairKeys = vi.fn();

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
    queryPendingRatedGameCardUserIds.mockReset().mockReturnValue([]);
    queryPendingRatedGameCardPairKeys.mockReset().mockReturnValue([]);
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
            queryPendingRatedGameCardUserIds,
            queryPendingRatedGameCardPairKeys,
            enqueueGameCardRatingOutbox: vi.fn(),
            enqueueGameCardPairRatingOutbox: vi.fn(),
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

  it('forces the two-card preload and keeps the social stack positions stable', async () => {
    queryUserGameCardsByFilter
      .mockResolvedValueOnce({
        cards: {
          filterCount: 2,
          cardUserIds: [],
          socialCards: [
            socialCard('pair-1', 'user-1', 'user-2'),
            socialCard('pair-2', 'user-3', 'user-4')
          ],
          nextCursor: null
        }
      })
      .mockResolvedValueOnce({
        cards: {
          filterCount: 2,
          cardUserIds: [],
          socialCards: [
            socialCard('pair-3', 'user-5', 'user-6')
          ],
          nextCursor: null
        }
      });
    const service = TestBed.inject(GameService);

    await service.loadInitialUserGameCardsStackPage(
      'active-user',
      null,
      10,
      'separated-friends'
    );
    queryPendingRatedGameCardPairKeys.mockReturnValue(['user-1:user-2']);
    service.recordUserGameCardPairRating('active-user', 'user-1', 'user-2', 4);
    expect(service.peekUserGameCardsStackSnapshot('active-user').filterCount).toBe(1);
    const preloaded = await service.loadNextUserGameCardsStackPage(
      'active-user',
      null,
      10,
      'separated-friends',
      null,
      null,
      undefined,
      true
    );

    expect(queryUserGameCardsByFilter).toHaveBeenCalledTimes(2);
    expect(queryUserGameCardsByFilter.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        cursor: null,
        excludedSocialCardIds: ['pair-1', 'pair-2']
      })
    );
    expect(preloaded.socialCards.map(card => card.id)).toEqual(['pair-1', 'pair-2', 'pair-3']);
    expect(preloaded.filterCount).toBe(2);
  });
});

function socialCard(id: string, userId: string, secondaryUserId: string) {
  return {
    id,
    userId,
    secondaryUserId,
    socialContext: 'separated-friends' as const
  };
}
