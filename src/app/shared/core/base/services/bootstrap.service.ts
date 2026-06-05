export type BootstrapProcessStage =
  | 'selector'
  | 'helpCenter'
  | 'ideaPosts'
  | 'chats'
  | 'events'
  | 'users'
  | 'contacts'
  | 'feedback'
  | 'ratings'
  | 'affinityGraph'
  | 'assets'
  | 'activityMembers'
  | 'activityResources'
  | 'indexedDb'
  | 'ready'
  | 'session'
  | 'sessionChats'
  | 'sessionIndexedDb'
  | 'sessionReady';

export interface BootstrapProcessState {
  percent: number;
  label: string;
  stage: BootstrapProcessStage;
}

export interface BootstrapProcessStep {
  stage: BootstrapProcessStage;
  percent: number;
  label: string;
}

export const BOOTSTRAP_PROCESS_STEPS: readonly BootstrapProcessStep[] = [
  { stage: 'selector', percent: 0, label: 'Preparing demo selector' },
  { stage: 'helpCenter', percent: 5, label: 'Preparing help content' },
  { stage: 'ideaPosts', percent: 8, label: 'Preparing article content' },
  { stage: 'chats', percent: 11, label: 'Loading chats' },
  { stage: 'events', percent: 22, label: 'Loading events' },
  { stage: 'users', percent: 34, label: 'Preparing demo users' },
  { stage: 'contacts', percent: 40, label: 'Preparing contacts' },
  { stage: 'feedback', percent: 46, label: 'Preparing event feedback' },
  { stage: 'ratings', percent: 52, label: 'Loading ratings' },
  { stage: 'assets', percent: 64, label: 'Preparing owned assets' },
  { stage: 'activityMembers', percent: 82, label: 'Preparing activity members' },
  { stage: 'activityResources', percent: 94, label: 'Preparing activity resources' },
  { stage: 'indexedDb', percent: 98, label: 'Syncing demo IndexedDB' },
  { stage: 'ready', percent: 100, label: 'Demo data ready' }
];

export const SESSION_PROCESS_STEPS: readonly BootstrapProcessStep[] = [
  { stage: 'session', percent: 0, label: 'Preparing demo session' },
  { stage: 'sessionChats', percent: 38, label: 'Preparing chat threads' },
  { stage: 'sessionIndexedDb', percent: 84, label: 'Syncing demo IndexedDB' },
  { stage: 'sessionReady', percent: 100, label: 'Demo session ready' }
];

const PROCESS_STEP_BY_STAGE = new Map<BootstrapProcessStage, BootstrapProcessStep>(
  [...BOOTSTRAP_PROCESS_STEPS, ...SESSION_PROCESS_STEPS].map(step => [step.stage, step])
);

export function bootstrapProcessStep(stage: BootstrapProcessStage): BootstrapProcessState {
  return PROCESS_STEP_BY_STAGE.get(stage) ?? BOOTSTRAP_PROCESS_STEPS[0];
}
