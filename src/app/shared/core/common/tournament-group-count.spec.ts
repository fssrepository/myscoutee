import { describe, expect, it } from 'vitest';

import { tournamentGroupCountForIncoming } from './tournament-group-count';

describe('tournamentGroupCountForIncoming', () => {
  it('caps parent incoming capacity at the stage maximum', () => {
    expect(tournamentGroupCountForIncoming({
      groupCapacityMin: 1,
      groupCapacityMax: 2,
      incomingCapacityMax: 8,
      stageCapacityMax: 4
    })).toBe(2);
  });

  it('uses the advancing capacity for a downstream stage', () => {
    expect(tournamentGroupCountForIncoming({
      groupCapacityMin: 1,
      groupCapacityMax: 2,
      incomingCapacityMax: 2,
      stageCapacityMax: 2
    })).toBe(1);
  });

  it('uses whichever capacity boundary is available', () => {
    expect(tournamentGroupCountForIncoming({
      groupCapacityMin: 1,
      groupCapacityMax: 2,
      incomingCapacityMax: 8
    })).toBe(4);
    expect(tournamentGroupCountForIncoming({
      groupCapacityMin: 1,
      groupCapacityMax: 2,
      stageCapacityMax: 4
    })).toBe(2);
  });
});
