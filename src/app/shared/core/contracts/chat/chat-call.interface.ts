export interface ChatCallStunNode { id: string; label: string; urls: string[]; }
export interface ChatCallParticipant { sessionId: string; userId: string; bundle: string; clientId: string; video: boolean; moderator: boolean; mutedByAdmin: boolean; }
export type ChatCallRequest =
  | { action: 'configuration' }
  | { action: 'join'; callId: string; bundle: string; clientId: string; video: boolean; nodeId: string }
  | { action: 'leave'; callId: string }
  | { action: 'decline'; callId: string }
  | { action: 'mute'; callId: string; targetSessionId: string; muted: boolean }
  | { action: 'commit'; callId: string; epoch: number; data: string }
  | { action: 'signal'; callId: string; targetSessionId: string; data: string };
export type ChatCallEvent =
  | { kind: 'configuration'; nodes: ChatCallStunNode[]; available: boolean }
  | { kind: 'availability'; available: boolean }
  | { kind: 'committed'; callId: string; epoch: number }
  | { kind: 'mls'; callId: string; senderSessionId: string; epoch: number; data: string }
  | { kind: 'invite'; callId: string; video: boolean; nodeId: string }
  | { kind: 'roster'; callId: string; selfSessionId: string; participants: ChatCallParticipant[]; nodeId: string; epoch: number }
  | { kind: 'signal'; callId: string; senderSessionId: string; data: string }
  | { kind: 'ended'; callId: string }
  | { kind: 'declined'; callId: string }
  | { kind: 'error'; error: string };
