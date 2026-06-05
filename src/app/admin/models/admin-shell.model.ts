export type AdminPopupKind =
  | 'reports'
  | 'feedback'
  | 'chat'
  | 'chat-review'
  | 'warn-chat'
  | 'profile'
  | 'help-editor'
  | 'idea-editor'
  | 'notifications'
  | 'params'
  | 'stats'
  | 'affinity-graph'
  | 'monitoring'
  | 'item-preview';

export type AdminBootstrapProcessStage = 'selector' | 'indexedDb' | 'records' | 'affinityGraph' | 'profile' | 'ready';

export interface AdminBootstrapProcessState {
  percent: number;
  label: string;
  stage: AdminBootstrapProcessStage;
}
