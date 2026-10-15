import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../../common/app.db';
import { RouteDelayService } from '../../../../base/services/platform/route-delay.service';
import { SeedUsersRepository } from '../../../seed/repositories/accounts/users-seed.repository';
import { SeedCommunityGroupsRepository } from '../../../seed/repositories/groups/community-groups-seed.repository';
import { SeedCommunityCasesRepository } from '../../../seed/repositories/community/community-cases-seed.repository';
import { SeedServiceOfferingsRepository } from '../../../seed/repositories/community/service-offerings-seed.repository';
import { LocalCommunityCasesRepository } from '../../repositories/community/community-cases.repository';
import { LocalFeedbackService } from './feedback.service';
import { activeCaseParticipantIds } from '../../entity/community/community-case.entity';

describe('Local feedback pagination', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('pages worker-created feedback with image metadata and moves a submitted answer between buckets', async () => {
    TestBed.configureTestingModule({ providers: [
      { provide: RouteDelayService, useValue: { waitForRouteDelay: async () => undefined } }
    ] });
    const db = TestBed.inject(LocalMemoryDb);
    await db.resetStorage();
    const users = TestBed.inject(SeedUsersRepository).seedDefaults();
    TestBed.inject(SeedCommunityGroupsRepository).seedDefaults(users);
    TestBed.inject(SeedCommunityCasesRepository).seedDefaults();
    TestBed.inject(SeedServiceOfferingsRepository).seedDefaults();
    const actor = users.find(u => u.name === 'Alex Turner' && !u.workspaceGroupId)!.id;
    const repository = TestBed.inject(LocalCommunityCasesRepository);
    const service = TestBed.inject(LocalFeedbackService);
    const source = repository.findCase('community-case-park-meters')!;
    for (let i = 0; i < 13; i++) {
      const completed = { ...structuredClone(source), id: `feedback-page-${i}`, status: 'completed' as const,
        counterOwners: undefined,
        updatedAtIso: `2026-10-15T12:00:${String(i).padStart(2, '0')}.000Z` };
      const active = activeCaseParticipantIds(completed);
      completed.feedbackWork = { reviewers: active.filter(id => !completed.support.some(p => p.accountId === id)
        || completed.audienceAccountIds.includes(id) || id === completed.ownerAccountId),
        providers: completed.support.filter(p => p.status === 'accepted' && active.includes(p.accountId)),
        createdAtIso: completed.updatedAtIso, caseTitle: completed.title };
      repository.saveCase(completed);
    }
    await service.drain();
    const userId = `group:myscoutee-community:${actor}`;
    const query = { userId, page: 0, pageSize: 12, filter: 'pending' as const };
    const first = await service.loadPage(query);
    expect(first.evaluationCounts['pending']).toBe(13);
    expect(first.evaluations).toHaveLength(12);
    const second = await service.loadPage({ ...query, page: 1 });
    expect(second.evaluations).toHaveLength(1);
    expect(new Set([...first.evaluations, ...second.evaluations].map(item => item.feedback.id)).size).toBe(13);
    expect([...first.evaluations, ...second.evaluations].every(item => item.serviceTitle && item.serviceImageUrl)).toBe(true);
    await service.action(first.evaluations[0].feedback.id, { userId, action: 'submit',
      criteria: { quality: 8, reliability: 8, communication: 8, value: 10 }, comment: '' });
    expect((await service.loadPage(query)).evaluationCounts['pending']).toBe(12);
    const submitted = await service.loadPage({ ...query, filter: 'feedbacked' });
    expect(submitted.evaluations).toHaveLength(1);
    expect(submitted.evaluations[0].feedback.average).toBe(8.5);
    expect((await service.loadPage({ ...query, page: 1 })).evaluations).toHaveLength(0);
  });
});
