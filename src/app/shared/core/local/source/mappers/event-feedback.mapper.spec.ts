import type { ActivityEventDTO } from '../../../contracts/activity.interface';
import type { UserDto } from '../../../contracts/user.interface';
import { LocalEventFeedbackMapper } from './event-feedback.mapper';

describe('Local feedback mode isolation', () => {
  const users = ['viewer', 'host', 'outsider', ...Array.from({ length: 7 }, (_, i) => `peer-${i}`)]
    .map(id => ({ id, name: id, initials: id, images: [] } as unknown as UserDto));
  const peers = users.filter(user => user.id.startsWith('peer-')).map(user => user.id);
  function detail(mode: 'Casual' | 'Tournament' | 'Mingle', includePeers = true) {
    const event = { id: 'event', type: 'events', userId: 'viewer', creatorUserId: 'host', mode,
      title: 'Event', status: 'A', startAtIso: '2030-01-01T10:00:00Z', endAtIso: '2030-01-01T11:00:00Z',
      acceptedMemberUserIds: ['viewer', 'outsider'], pendingMemberUserIds: [] } as ActivityEventDTO;
    return LocalEventFeedbackMapper.toDetail({ query: { eventId: 'event', userId: 'viewer' },
      events: [event], activeUser: users[0], users, nowMs: Date.parse('2030-01-01T14:00:00Z'),
      minglePeersByEventId: mode === 'Mingle' ? { event: includePeers ? peers : [] } : {} });
  }
  for (const mode of ['Casual', 'Tournament'] as const) {
    it(`keeps ${mode} feedback based on event participants without round data`, () => {
      expect(detail(mode).cards.map(card => card.targetUserId)).toEqual(['host', 'outsider']);
    });
  }
  it('includes every completed table peer without the ordinary five-person cap', () => {
    expect(detail('Mingle').cards.map(card => card.targetUserId)).toEqual(['host', ...peers]);
  });
  it('does not substitute unrelated attendees when no table has completed', () => {
    expect(detail('Mingle', false).cards.map(card => card.targetUserId)).toEqual(['host']);
  });
});
