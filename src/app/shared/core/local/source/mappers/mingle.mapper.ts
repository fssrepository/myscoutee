import type { LocalMingleSession } from '../entity/mingle.entity';

export function completedMinglePeerIds(session: LocalMingleSession | undefined, viewerId: string): string[] {
  return [...new Set((session?.rounds ?? []).filter(round => round.completedAtIso)
    .flatMap(round => round.tables.filter(table => table.memberUserIds.includes(viewerId)))
    .flatMap(table => table.memberUserIds))].filter(id => id !== viewerId).sort();
}
