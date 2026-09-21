import { LocalUserRatesMapper } from '../mappers/rate.mapper';
import { Injectable, inject } from '@angular/core';
import { LocalMemoryDb } from '../../../common/app.db';
import { ActivityEventDetailDTO, type ActivityEventRecord } from '../../../contracts/activity.interface';
import type { MingleStateDTO } from '../../../contracts/event.interface';
import { ACTIVITY_MEMBERS_TABLE_NAME, type ActivityMemberRecord } from '../entity/activity.entity';
import { MINGLE_SESSIONS_TABLE_NAME, type LocalMingleSession, type LocalMingleRound, type LocalMingleTable } from '../entity/mingle.entity';
import { USER_RATES_TABLE_NAME } from '../entity/rate.entity';
import { USERS_TABLE_NAME } from '../entity/user.entity';
import { planMingleTables } from '../planners/mingle-table-planner';
import { LocalEventsRepository } from './events.repository';
import { LocalRatesRepository } from './rates.repository';
import { LocalNotificationsRepository } from './notifications.repository';

@Injectable({ providedIn: 'root' })
export class LocalMingleRepository {
  private readonly db = inject(LocalMemoryDb);
  private readonly events = inject(LocalEventsRepository);
  private readonly rates = inject(LocalRatesRepository);
  private readonly notifications = inject(LocalNotificationsRepository);

  async flushToIndexedDb(): Promise<void> { await this.db.flushToIndexedDb(); }

  query(userId: string, eventId?: string | null, roundNumber?: number | null): MingleStateDTO | null {
    userId = userId.trim();
    eventId = eventId?.trim();
    if (!userId) return null;
    const sessions = this.db.read()[MINGLE_SESSIONS_TABLE_NAME];
    const candidates = eventId ? [sessions.byId[eventId]] : sessions.ids.map(id => sessions.byId[id])
      .filter(session => session.status !== 'COMPLETED').sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
    for (const candidate of candidates) {
      if (!candidate) continue;
      const event = this.events.queryEventRecordById(userId, candidate.eventId);
      if (!event || event.mode !== 'Mingle') continue;
      const manager = this.canManage(event, userId);
      if (!manager && !this.acceptedMembers(event.id).some(member => member.userId === userId)) continue;
      let session = candidate;
      // The local adapter has no server scheduler: resume elapsed phases on the next read.
      // Phase boundaries, rather than the observation time, preserve timers after reload.
      while (session.phaseEndsAtIso && Date.parse(session.phaseEndsAtIso) <= Date.now()
        && (session.status === 'ROUND' || session.status === 'BREAK')) {
        try { session = this.mutate(event, session, 'next', Date.parse(session.phaseEndsAtIso)); }
        catch { break; } // Keep a failed assignment visible and retry when membership/configuration changes.
      }
      return this.toState(event, session, userId, roundNumber);
    }
    return null;
  }

  apply(eventId: string, actorId: string, action: string): MingleStateDTO {
    actorId = actorId.trim(); eventId = eventId.trim();
    const event = this.events.queryEventRecordById(actorId, eventId);
    if (!event || event.mode !== 'Mingle') return this.fail('MINGLE_EVENT_NOT_FOUND');
    if (!this.canManage(event, actorId)) return this.fail('MINGLE_MANAGE_FORBIDDEN');
    const session = this.db.read()[MINGLE_SESSIONS_TABLE_NAME].byId[eventId] ?? null;
    return this.toState(event, this.mutate(event, session, action.trim().toLowerCase(), Date.now()), actorId);
  }

  private mutate(event: ActivityEventRecord, current: LocalMingleSession | null, action: string, now: number): LocalMingleSession {
    if (!event.mingleConfiguration) return this.fail('MINGLE_CONFIGURATION_REQUIRED');
    const config = ActivityEventDetailDTO.normalizeMingleConfiguration(event.mingleConfiguration)!;
    if (!current && action !== 'start') return this.fail('MINGLE_SESSION_NOT_STARTED');
    const iso = new Date(now).toISOString();
    const next: LocalMingleSession = current ? structuredClone(current) : {
      eventId: event.id, status: 'COMPLETED', roundNumber: 0, phaseStartedAtIso: iso,
      phaseEndsAtIso: null, pausedFromStatus: null, pausedRemainingSeconds: 0, revision: 0, updatedAtIso: iso, rounds: []
    };
    let createdRound: LocalMingleRound | null = null;
    let completedRound: LocalMingleRound | null = null;
    const phase = (status: 'ROUND' | 'BREAK', minutes: number) => {
      next.status = status; next.phaseStartedAtIso = iso;
      next.phaseEndsAtIso = new Date(now + minutes * 60_000).toISOString();
      next.pausedFromStatus = null; next.pausedRemainingSeconds = 0;
    };
    const finishRound = () => {
      const round = next.rounds.find(item => item.roundNumber === next.roundNumber);
      if (round && !round.completedAtIso) {
        round.tables = this.actualTables(event.id, round);
        round.completedAtIso = iso;
        completedRound = round;
      }
    };
    const complete = () => {
      if (next.status === 'ROUND' || (next.status === 'PAUSED' && next.pausedFromStatus === 'ROUND')) finishRound();
      next.status = 'COMPLETED'; next.phaseEndsAtIso = null;
      next.pausedFromStatus = null; next.pausedRemainingSeconds = 0;
    };
    const startRound = () => {
      if (next.roundNumber >= config.plannedRounds) return this.fail('MINGLE_ROUND_LIMIT_REACHED');
      const members = this.acceptedMembers(event.id);
      if (members.length < 2) return this.fail('MINGLE_MEMBERS_INSUFFICIENT', { required: 2, accepted: members.length });
      const scores = new Map<string, number>();
      const rates = this.db.read()[USER_RATES_TABLE_NAME];
      for (const rate of Object.values(rates.byId)) {
        const key = [rate.fromUserId, rate.toUserId].sort().join('\n');
        scores.set(key, Math.max(scores.get(key) ?? 0, LocalUserRatesMapper.affinityWeight(rate)));
      }
      const tables = planMingleTables({
        userIds: members.map(member => member.userId),
        genders: new Map(members.map(member => [member.userId, member.gender])),
        groupSize: config.groupSize, roundNumber: next.roundNumber + 1,
        requireGenderBalance: config.requireGenderBalance,
        previousTables: next.rounds.filter(round => round.completedAtIso).flatMap(round => round.tables),
        affinity: (left, right) => scores.get([left, right].sort().join('\n')) ?? 0
      });
      if (!tables.length) return this.fail(config.requireGenderBalance
        ? 'MINGLE_TABLE_ASSIGNMENT_UNAVAILABLE_GENDER_BALANCE' : 'MINGLE_TABLE_ASSIGNMENT_UNAVAILABLE',
      { accepted: members.length, groupSize: config.groupSize });
      next.roundNumber++;
      createdRound = { roundNumber: next.roundNumber, startedAtIso: iso, completedAtIso: null, tables };
      next.rounds.push(createdRound);
      phase('ROUND', config.roundDurationMinutes);
    };
    switch (action) {
      case 'start':
        if (current && current.status !== 'COMPLETED') return current;
        startRound(); break;
      case 'next': case 'advance':
        if (next.status === 'ROUND') {
          finishRound();
          if (next.roundNumber >= config.plannedRounds) complete(); else phase('BREAK', config.breakDurationMinutes);
        } else if (next.status === 'BREAK' || next.status === 'COMPLETED') startRound();
        else return this.fail('MINGLE_STATE_CANNOT_ADVANCE');
        break;
      case 'pause':
        if (next.status !== 'ROUND' && next.status !== 'BREAK') return next;
        next.pausedRemainingSeconds = Math.max(0, Math.ceil((Date.parse(next.phaseEndsAtIso!) - now) / 1000));
        next.pausedFromStatus = next.status; next.status = 'PAUSED'; next.phaseEndsAtIso = null; break;
      case 'resume':
        if (next.status !== 'PAUSED') return next;
        phase(next.pausedFromStatus ?? 'ROUND', next.pausedRemainingSeconds / 60); break;
      case 'complete': case 'stop':
        if (next.status === 'COMPLETED') return next;
        complete(); break;
      default: return this.fail('MINGLE_ACTION_UNSUPPORTED');
    }
    next.revision++; next.updatedAtIso = iso;
    this.db.write(state => ({ ...state, [MINGLE_SESSIONS_TABLE_NAME]: {
      byId: { ...state[MINGLE_SESSIONS_TABLE_NAME].byId, [event.id]: next },
      ids: [...new Set([...state[MINGLE_SESSIONS_TABLE_NAME].ids, event.id])]
    } }));
    if (createdRound) this.installMembers(event, createdRound, iso);
    if (completedRound) this.rates.projectMetTables((completedRound as LocalMingleRound).tables, event.title, iso);
    return next;
  }

  private installMembers(event: ActivityEventRecord, round: LocalMingleRound, iso: string): void {
    const members = this.acceptedMembers(event.id);
    const byUser = new Map(members.map(member => [member.userId, member]));
    this.db.write(state => {
      const table = state[ACTIVITY_MEMBERS_TABLE_NAME];
      const byId = { ...table.byId }, ids = new Set(table.ids), idsByOwnerKey = { ...table.idsByOwnerKey };
      for (const assignment of round.tables) {
        const ownerId = this.groupId(event.id, round.roundNumber, assignment.tableNumber);
        const ownerKey = `group:${ownerId}`;
        idsByOwnerKey[ownerKey] = [];
        for (const userId of assignment.memberUserIds) {
          const id = `${ownerKey}:${userId}`;
          const member = byUser.get(userId)!;
          byId[id] = { ...member, id, ownerId, ownerKey, ownerType: 'group', role: 'Member',
            organizerOnly: false, createdAtIso: iso, updatedAtIso: iso, createdMs: Date.parse(iso), updatedMs: Date.parse(iso) };
          ids.add(id); idsByOwnerKey[ownerKey].push(id);
        }
      }
      return { ...state, [ACTIVITY_MEMBERS_TABLE_NAME]: { ...table, byId, ids: [...ids], idsByOwnerKey } };
    });
    const assignments = new Map(round.tables.flatMap(table => table.memberUserIds.map(id => [id, table.tableNumber] as const)));
    this.notifications.append(members.map(member => {
      const table = assignments.get(member.userId);
      return {
        id: `mingle:${event.id}:${round.roundNumber}:${member.userId}`, recipientUserId: member.userId,
        kind: table ? 'mingle-table-assignment' : 'mingle-table-waiting', category: 'event',
        title: table ? 'Your Speed meeting table is ready' : 'Speed meeting round started',
        message: table ? `Go to Table ${table} for round ${round.roundNumber}.` : 'Waiting for a table assignment.',
        createdAtIso: iso, sourceType: 'event', sourceId: event.id, actionPath: `/game?mingleEventId=${event.id}`,
        payload: { eventId: event.id, roundNumber: String(round.roundNumber), tableNumber: table ? String(table) : '', mingle: 'true' }
      };
    }));
  }

  private actualTables(eventId: string, round: LocalMingleRound): LocalMingleTable[] {
    if (round.completedAtIso) return round.tables;
    const members = this.db.read()[ACTIVITY_MEMBERS_TABLE_NAME];
    return round.tables.map(table => ({ tableNumber: table.tableNumber, memberUserIds:
      [...new Set((members.idsByOwnerKey[`group:${this.groupId(eventId, round.roundNumber, table.tableNumber)}`] ?? [])
        .map(id => members.byId[id]).filter(member => member?.status === 'accepted' && !member.organizerOnly)
        .map(member => member.userId))].sort()
    }));
  }

  private toState(event: ActivityEventRecord, session: LocalMingleSession, actor: string, requestedRound?: number | null): MingleStateDTO {
    const round = session.rounds.find(item => item.roundNumber === (requestedRound ?? session.roundNumber));
    const tables = round ? this.actualTables(event.id, round) : [];
    const own = tables.find(table => table.memberUserIds.includes(actor));
    const manager = this.canManage(event, actor);
    const users = this.db.read()[USERS_TABLE_NAME];
    return { eventId: event.id, eventTitle: event.title, status: session.status,
      roundNumber: round?.roundNumber ?? session.roundNumber, plannedRounds: event.mingleConfiguration?.plannedRounds ?? session.roundNumber,
      phaseStartedAtIso: session.phaseStartedAtIso, phaseEndsAtIso: session.phaseEndsAtIso,
      remainingSeconds: session.status === 'PAUSED' ? session.pausedRemainingSeconds
        : Math.max(0, Math.ceil((Date.parse(session.phaseEndsAtIso ?? '') - Date.now()) / 1000)) || 0,
      tableNumber: own?.tableNumber ?? null, canManage: manager,
      waitingForTable: !own && this.acceptedMembers(event.id).some(member => member.userId === actor), revision: session.revision,
      tables: (manager ? tables : own ? [own] : []).map(table => ({ tableNumber: table.tableNumber,
        subEventId: `mingle-round-${round!.roundNumber}`, memberOwnerId: this.groupId(event.id, round!.roundNumber, table.tableNumber),
        participants: table.memberUserIds.map(userId => { const user = users.byId[userId];
          return { userId, name: user?.name ?? userId, initials: user?.initials ?? '', avatarUrl: user?.images?.[0] ?? null }; })
      })) };
  }

  private acceptedMembers(eventId: string): ActivityMemberRecord[] {
    const members = this.db.read()[ACTIVITY_MEMBERS_TABLE_NAME];
    return [...new Map((members.idsByOwnerKey[`event:${eventId}`] ?? []).map(id => members.byId[id])
      .filter(member => member?.status === 'accepted' && !member.organizerOnly).map(member => [member.userId, member])).values()];
  }
  private canManage(event: ActivityEventRecord, userId: string): boolean {
    return event.creatorUserId === userId || (event.adminIds ?? []).includes(userId);
  }
  private groupId(eventId: string, round: number, table: number): string { return `${eventId}:mingle-round-${round}:table:${table}`; }
  private fail(code: string, parameters: Record<string, number> = {}): never {
    throw Object.assign(new Error(code), { code, parameters });
  }
}
