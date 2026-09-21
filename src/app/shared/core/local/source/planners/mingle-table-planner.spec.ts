import { planMingleTables } from './mingle-table-planner';

describe('planMingleTables', () => {
  it('avoids previous table peers before considering affinity', () => {
    const first = plan(['a', 'b', 'c', 'd'], 2);
    const next = planMingleTables({ userIds: ['d', 'c', 'b', 'a'], groupSize: 2, roundNumber: 2,
      previousTables: first, genders: new Map(), requireGenderBalance: false,
      affinity: (a, b) => first.some(table => table.memberUserIds.includes(a) && table.memberUserIds.includes(b)) ? 1 : 0 });
    for (const table of next) expect(first.some(previous => previous.memberUserIds.join() === table.memberUserIds.join())).toBe(false);
    expect(next.flatMap(table => table.memberUserIds).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('rotates the waiting participants and keeps full balanced tables', () => {
    const input = { userIds: ['a', 'b', 'c', 'd', 'e', 'f'], groupSize: 4, previousTables: [],
      genders: new Map([['a','woman'],['b','woman'],['c','woman'],['d','woman'],['e','man'],['f','man']]),
      requireGenderBalance: true, affinity: () => 0 };
    const first = planMingleTables({ ...input, roundNumber: 1 });
    const second = planMingleTables({ ...input, roundNumber: 2 });
    expect(first).toHaveLength(1);
    expect(first[0].memberUserIds).toEqual(['a', 'b', 'e', 'f']);
    expect(second[0].memberUserIds).toEqual(['c', 'd', 'e', 'f']);
  });

  it('handles odd group sizes and redistributes a singleton when a donor exists', () => {
    expect(plan(['a','b','c','d','e','f','g'], 6).map(table => table.memberUserIds.length)).toEqual([4,3]);
    const balanced = planMingleTables({ userIds: ['a','b','c','d','e','f'], groupSize: 3, roundNumber: 1,
      previousTables: [], genders: new Map([['a','woman'],['b','woman'],['c','woman'],['d','man'],['e','man'],['f','man']]),
      requireGenderBalance: true, affinity: () => 0 });
    expect(balanced.map(table => table.memberUserIds.length)).toEqual([3,3]);
  });
});
function plan(userIds: string[], groupSize: number) {
  return planMingleTables({ userIds, groupSize, roundNumber: 1, previousTables: [],
    genders: new Map(), requireGenderBalance: false, affinity: () => 0 });
}
