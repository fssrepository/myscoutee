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

export type AdminBootstrapProgressStage = 'selector' | 'indexedDb' | 'records' | 'affinityGraph' | 'profile' | 'ready';

export interface AdminBootstrapProgressState {
  percent: number;
  label: string;
  stage: AdminBootstrapProgressStage;
}
