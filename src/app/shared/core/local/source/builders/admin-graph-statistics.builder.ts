import type { AdminAffinityGraphDto, AdminStatsGraphDto, AdminStatsBreakdownItemDto } from '../../../contracts/admin.interface';
import type { UserRateRecord } from '../entity/rate.entity';
import type { ActivityMemberRecord } from '../entity/activity.entity';
import type { UserRecord } from '../entity/user.entity';

interface Edge { left: string; right: string; weight: number; count: number; weak: boolean; recurring: boolean; first: string; last: string; }
const clamp = (value: number, low = 0, high = 100) => Math.max(low, Math.min(high, value));
const pct = (value: number, total: number) => Math.round(clamp(value * 100 / Math.max(1, total)));

/** Local counterpart of AdminGraphScienceService: same group boundary, graph measures and health thresholds. */
export function adminGraphStatistics(template: AdminStatsGraphDto, graph: AdminAffinityGraphDto | null | undefined,
  users: UserRecord[], rates: UserRateRecord[], members: ActivityMemberRecord[], now: Date): AdminStatsGraphDto {
  const names = new Map(users.map(user => [user.id, user.name]));
  const edges = new Map<string, Edge>();
  const add = (left: string, right: string, weight: number, weak: boolean, recurring: boolean, date: string) => {
    if (left === right || !names.has(left) || !names.has(right)) return;
    const key = [left, right].sort().join(':');
    const old = edges.get(key);
    edges.set(key, { left, right, weight: Math.max(old?.weight ?? 0, weight), count: (old?.count ?? 0) + 1,
      weak: weak || !!old?.weak, recurring: recurring || !!old?.recurring || (old?.count ?? 0) >= 2,
      first: date && (!old?.first || date < old.first) ? date : old?.first ?? '',
      last: date && (!old?.last || date > old.last) ? date : old?.last ?? '' });
  };
  for (const edge of graph?.edges ?? []) add(edge.source, edge.target, clamp(edge.weight / 10, .05, 1.4),
    edge.weight / 10 < .35, false, edge.updatedDate ?? '');
  for (const rate of rates) {
    const mutual = rate.displayDirection === 'mutual' || (Number(rate.scoreGiven) > 0 && Number(rate.scoreReceived) > 0);
    const met = !!rate.met || rate.displayDirection === 'met';
    const outside = rate.socialContext === 'separated-friends';
    const weight = Math.max(mutual ? .9 : met ? .7 : outside ? .25 : rate.socialContext === 'friends-in-common' ? .55 : .35,
      clamp(rate.rate / 10, .05, 1));
    add(rate.fromUserId, rate.toUserId, weight, outside || (!mutual && !met && weight < .45),
      mutual || met || (rate.bridgeCount ?? 0) > 1, rate.updatedAtIso || rate.createdAtIso);
    if (rate.bridgeUserId) add(rate.bridgeUserId, rate.toUserId, Math.max(.12, weight * .35), true, false, rate.updatedAtIso);
  }
  const accepted = new Map<string, ActivityMemberRecord[]>();
  for (const member of members) {
    if (member.ownerType !== 'event') continue;
    if (member.invitedByUserId) add(member.invitedByUserId, member.userId, .38, true, false, member.actionAtIso || member.metAtIso || member.updatedAtIso);
    if (member.status === 'accepted' && names.has(member.userId)) accepted.set(member.ownerId, [...(accepted.get(member.ownerId) ?? []), member]);
  }
  for (const members of accepted.values()) for (let i = 0; i < Math.min(60, members.length); i++) {
    for (let j = i + 1; j < Math.min(60, members.length); j++) add(members[i].userId, members[j].userId, .22, true, false,
      [members[i].metAtIso || members[i].actionAtIso, members[j].metAtIso || members[j].actionAtIso].sort().at(-1) ?? '');
  }
  const rows = [...edges.values()];
  const adjacency = new Map<string, Map<string, number>>();
  for (const edge of rows) for (const [left, right] of [[edge.left, edge.right], [edge.right, edge.left]]) {
    if (!adjacency.has(left)) adjacency.set(left, new Map());
    adjacency.get(left)!.set(right, edge.weight);
  }
  const nodes = [...adjacency.keys()], labels = new Map(nodes.map(node => [node, node]));
  for (let iteration = 0; iteration < 8; iteration++) {
    let changed = false;
    for (const node of nodes) {
      const scores = new Map<string, number>();
      for (const [neighbor, weight] of adjacency.get(node)!) {
        const label = labels.get(neighbor)!; scores.set(label, (scores.get(label) ?? 0) + Math.max(.01, weight));
      }
      const selected = [...scores].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? labels.get(node)!;
      if (selected !== labels.get(node)) { labels.set(node, selected); changed = true; }
    }
    if (!changed) break;
  }
  const sizes = new Map<string, number>(), clustering = new Map<string, number>(), bridges = new Map<string, number>();
  for (const label of labels.values()) sizes.set(label, (sizes.get(label) ?? 0) + 1);
  let reach = 0;
  for (const node of nodes) {
    const neighbors = [...adjacency.get(node)!.keys()]; let linked = 0;
    for (let i = 0; i < neighbors.length; i++) for (let j = i + 1; j < neighbors.length; j++) if (adjacency.get(neighbors[i])?.has(neighbors[j])) linked++;
    clustering.set(node, neighbors.length < 2 ? 0 : linked * 2 / (neighbors.length * (neighbors.length - 1)));
    const reached = new Set(neighbors.flatMap(neighbor => [neighbor, ...adjacency.get(neighbor)!.keys()])); reached.delete(node);
    reach += reached.size / Math.max(1, nodes.length - 1);
    const communities = new Set(neighbors.map(neighbor => labels.get(neighbor)));
    if (communities.size >= 2) bridges.set(names.get(node) ?? node, Math.max(1, Math.round((communities.size - 1) * 34 + neighbors.length * 4
      + [...adjacency.get(node)!.values()].reduce((a, b) => a + b, 0) * 10 - clustering.get(node)! * 22)));
  }
  const reachability = Math.round(reach * 100 / Math.max(1, nodes.length));
  const clustered = Math.round([...clustering.values()].reduce((a, b) => a + b, 0) * 100 / Math.max(1, nodes.length));
  const weak = pct(rows.filter(edge => edge.weak).length, rows.length), recurring = pct(rows.filter(edge => edge.recurring).length, rows.length);
  const largest = pct(Math.max(0, ...sizes.values()), nodes.length);
  const quality = Math.round(rows.reduce((sum, edge) => sum + clamp(edge.weight, 0, 1), 0) * 100 / Math.max(1, rows.length));
  const clusterQuality = nodes.length <= 1 ? 0 : Math.round(clamp(100 - Math.abs(clustered - 38) * 2.2) * .45
    + clamp(100 - Math.max(0, largest - 40) * 1.7) * .35 + clamp(sizes.size * 100 / Math.max(1, nodes.length / 7)) * .2);
  const health = Math.round(clamp(reachability * .36 + clamp(100 - Math.abs(weak - 35) * 2.1) * .24
    + clamp(100 - Math.abs(clustered - 38) * 2.2) * .22 + Math.min(100, recurring * 2.2) * .18, 20, 100));
  const metrics: Record<string, number> = { 'graph-health': health, 'graph-users': nodes.length, 'graph-edges': rows.length,
    'graph-avg-degree': Math.round(rows.length * 20 / Math.max(1, nodes.length)), 'graph-communities': sizes.size,
    'graph-bridges': Math.min(8, bridges.size), 'graph-network-quality': quality, 'graph-cluster-quality': clusterQuality };
  const genders = new Map(users.map(user => [user.id, String(user.gender).toLowerCase().replace('woman', 'female').replace(/^man$/, 'male')]));
  const genderScores = new Map<string, number[]>();
  const addScore = (from: string, to: string, score: number | null | undefined) => {
    if (!Number.isFinite(score) || Number(score) <= 0 || !genders.has(from) || !genders.has(to)) return;
    const key = `gender-${genders.get(from)}-to-${genders.get(to)}`;
    genderScores.set(key, [...(genderScores.get(key) ?? []), Number(score)]);
  };
  for (const rate of rates) {
    addScore(rate.fromUserId, rate.toUserId, rate.scoreGiven);
    addScore(rate.toUserId, rate.fromUserId, rate.scoreReceived);
  }
  for (const [key, scores] of genderScores) metrics[key] = Math.round(scores.reduce((a, b) => a + b, 0) * 10 / scores.length);
  const breakdown = (entries: [string, number][], icon: string): AdminStatsBreakdownItemDto[] => entries.sort((a, b) => b[1] - a[1])
    .slice(0, 8).map(([label, value]) => ({ key: label, labelKey: '', label, value, total: nodes.length, icon, tone: 'blue' }));
  const insight = nodes.length < 8 ? 'cold' : reachability < 45 ? 'fragmented' : weak < 20 ? 'closed' : clustered > 68 ? 'cliques'
    : bridges.size < Math.max(2, nodes.length / 18) ? 'bridge-risk' : 'healthy';
  const signalValues = { 'reachability-2-hop': reachability, 'weak-tie-ratio': weak, clustering: clustered, 'recurring-edge-ratio': recurring,
    'bridge-coverage': pct(Math.min(8, bridges.size), nodes.length), 'largest-community': largest, 'network-quality': quality, 'cluster-quality': clusterQuality };
  return { ...template, healthScore: health, healthLabelKey: `stats.graph.health.${health >= 80 ? 'good' : health >= 60 ? 'watch' : 'risk'}`,
    insightKey: `stats.graph.insight.${insight}`, metrics: template.metrics.map(metric => ({ ...metric, value: metrics[metric.key] ?? 0,
      valueLabel: (metric.key === 'graph-avg-degree' || metric.key.startsWith('gender-')) ? ((metrics[metric.key] ?? 0) / 10).toFixed(1) : `${metrics[metric.key] ?? 0}`, percent: clamp(metrics[metric.key] ?? 0) })),
    bridgeUsers: breakdown([...bridges], 'conversion_path'), communities: breakdown([...sizes.values()].sort((a, b) => b - a).map((size, i) => [`Community ${i + 1}`, size]), 'bubble_chart'),
    signals: template.signals.map(signal => ({ ...signal, value: signalValues[signal.key as keyof typeof signalValues] ?? 0, total: 100 })),
    timeline: Array.from({ length: 14 }, (_, i) => {
      const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (13 - i) * 86400000);
      const start = day.getTime(), end = start + 86400000;
      const active = rows.filter(edge => Date.parse(edge.last) >= start - 30 * 86400000 && Date.parse(edge.last) < end);
      return { dateKey: day.toISOString().slice(0, 10), label: day.toISOString().slice(0, 10), activeEdges: active.length,
        newEdges: rows.filter(edge => Date.parse(edge.first) >= start && Date.parse(edge.first) < end).length,
        recurringEdges: rows.filter(edge => edge.recurring && Date.parse(edge.last) >= start && Date.parse(edge.last) < end).length,
        weakTies: active.filter(edge => edge.weak).length, bridgeUsers: Math.min(8, bridges.size), communities: sizes.size,
        networkQuality: Math.round(active.reduce((sum, edge) => sum + clamp(edge.weight, 0, 1), 0) * 100 / Math.max(1, active.length)), clusterQuality };
    }) };
}
