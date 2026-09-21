import type { LocalMingleTable } from '../entity/mingle.entity';

/** Local counterpart of EventGeneratorByMingle: repeats, balance, affinity, size, table index. */
export function planMingleTables(input: {
  userIds: readonly string[];
  genders: ReadonlyMap<string, string>;
  groupSize: number;
  roundNumber: number;
  requireGenderBalance: boolean;
  previousTables: readonly LocalMingleTable[];
  affinity: (left: string, right: string) => number;
}): LocalMingleTable[] {
  let members = [...new Set(input.userIds.map(id => id.trim()).filter(Boolean))].sort();
  if (!members.length) return [];
  const size = Math.max(2, Math.min(20, input.groupSize));
  const genders = new Map(members.flatMap(id => {
    const gender = input.genders.get(id)?.trim().toLowerCase();
    return gender ? [[id, gender] as const] : [];
  }));
  const categories = [...new Set(genders.values())].sort();
  let quotas: Map<string, number>[] = [];
  if (input.requireGenderBalance) {
    if (categories.length !== 2) return [];
    const [first, second] = categories.map(category => members.filter(id => genders.get(id) === category));
    const base = Math.floor(size / 2);
    const count = Math.min(Math.floor((first.length + second.length) / size),
      Math.floor(first.length / base), Math.floor(second.length / base));
    if (!count) return [];
    const extras = count * (size % 2);
    const firstExtra = Math.min(extras, first.length - count * base);
    const secondExtra = extras - firstExtra;
    if (secondExtra > second.length - count * base) return [];
    const slice = (values: string[], take: number) => Array.from({ length: take },
      (_, index) => values[((Math.max(1, input.roundNumber) - 1) * take + index) % values.length]);
    members = [...slice(first, count * base + firstExtra), ...slice(second, count * base + secondExtra)].sort();
    quotas = Array.from({ length: count }, (_, index) => new Map([
      [categories[0], base + Number(index < firstExtra)],
      [categories[1], base + Number(index >= firstExtra && index < firstExtra + secondExtra)]
    ]));
  }
  const repeats = new Map<string, Map<string, number>>();
  for (const table of input.previousTables) {
    const unique = [...new Set(table.memberUserIds)];
    for (const left of unique) {
      const peers = repeats.get(left) ?? new Map<string, number>();
      for (const right of unique) if (left !== right) peers.set(right, (peers.get(right) ?? 0) + 1);
      repeats.set(left, peers);
    }
  }
  const tables: string[][] = Array.from({ length: Math.ceil(members.length / size) }, () => []);
  const total = (id: string) => [...(repeats.get(id)?.values() ?? [])].reduce((sum, n) => sum + n, 0);
  members.sort((a, b) => total(b) - total(a) || (a < b ? -1 : a > b ? 1 : 0));
  for (const member of members) {
    const gender = genders.get(member) ?? '';
    const candidates = tables.map((table, index) => ({ table, index }))
      .filter(({ table, index }) => table.length < size && (!input.requireGenderBalance
        || table.filter(id => genders.get(id) === gender).length < (quotas[index].get(gender) ?? 0)))
      .map(({ table, index }) => {
        const counts = categories.map(category => table.filter(id => genders.get(id) === category).length + Number(gender === category));
        return { table, costs: [
          table.reduce((sum, id) => sum + (repeats.get(member)?.get(id) ?? 0), 0),
          input.requireGenderBalance ? Math.max(...counts) - Math.min(...counts) : 0,
          -table.reduce((sum, id) => sum + input.affinity(member, id), 0),
          table.length, index
        ] };
      });
    candidates.sort((a, b) => {
      for (let index = 0; index < a.costs.length; index++) {
        const delta = a.costs[index] - b.costs[index];
        if (delta) return delta;
      }
      return 0;
    });
    candidates[0].table.push(member);
  }
  const singleton = tables.find(table => table.length === 1);
  const donor = tables.filter(table => table.length > 2).sort((a, b) => b.length - a.length)[0];
  if (singleton && donor) singleton.push(donor.pop()!);
  return tables.map((members, index) => ({ tableNumber: index + 1, memberUserIds: members.sort() }))
    .filter(table => table.memberUserIds.length);
}
