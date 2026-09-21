import { APP_INDEXED_DB_KEYS } from '../../../common/storage-scope';

export const MINGLE_SESSIONS_TABLE_NAME = APP_INDEXED_DB_KEYS.mingleSessions;
export interface LocalMingleTable {
  tableNumber: number;
  memberUserIds: string[];
}
export interface LocalMingleRound {
  roundNumber: number;
  startedAtIso: string;
  completedAtIso: string | null;
  tables: LocalMingleTable[];
}
export interface LocalMingleSession {
  eventId: string;
  status: 'ROUND' | 'BREAK' | 'PAUSED' | 'COMPLETED';
  roundNumber: number;
  phaseStartedAtIso: string;
  phaseEndsAtIso: string | null;
  pausedFromStatus: 'ROUND' | 'BREAK' | null;
  pausedRemainingSeconds: number;
  revision: number;
  updatedAtIso: string;
  rounds: LocalMingleRound[];
}
export interface LocalMingleSessions {
  byId: Record<string, LocalMingleSession>;
  ids: string[];
}
export type MingleMemorySchema = Record<typeof MINGLE_SESSIONS_TABLE_NAME, LocalMingleSessions>;
