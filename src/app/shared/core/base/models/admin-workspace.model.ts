export type AdminBootstrapProcessStage = 'selector' | 'indexedDb' | 'records' | 'affinityGraph' | 'profile' | 'ready';

export interface AdminBootstrapProcessState {
  percent: number;
  label: string;
  stage: AdminBootstrapProcessStage;
}
