import { Injectable } from '@angular/core';

export type BootstrapProcessStage =
  | 'selector'
  | 'helpCenter'
  | 'ideaPosts'
  | 'chats'
  | 'events'
  | 'users'
  | 'contacts'
  | 'profileExperiences'
  | 'feedback'
  | 'ratings'
  | 'affinityGraph'
  | 'assets'
  | 'activityMembers'
  | 'activityResources'
  | 'communityGroups'
  | 'adminUsers'
  | 'operatorUsers'
  | 'adminWorkspaceData'
  | 'adminHelpLinks'
  | 'indexedDb'
  | 'ready'
  | 'session'
  | 'sessionChats'
  | 'sessionFeedback'
  | 'sessionIndexedDb'
  | 'sessionReady';

export interface BootstrapProcessState<Stage extends string = BootstrapProcessStage> {
  percent: number;
  label: string;
  stage: Stage;
}

export interface BootstrapProcessStep<Stage extends string = BootstrapProcessStage> {
  stage: Stage;
  percent: number;
  label: string;
}

export type BootstrapProcessListener<Stage extends string = BootstrapProcessStage> = (
  state: BootstrapProcessState<Stage>
) => void;

export const BOOTSTRAP_PROCESS_STEPS: readonly BootstrapProcessStep[] = [
  { stage: 'selector', percent: 0, label: 'demo.selector.loading.title' },
  { stage: 'chats', percent: 11, label: 'demo.seed.chats.loading' },
  { stage: 'events', percent: 22, label: 'demo.seed.events.loading' },
  { stage: 'users', percent: 34, label: 'demo.seed.users.preparing' },
  { stage: 'contacts', percent: 40, label: 'demo.seed.contacts.preparing' },
  { stage: 'profileExperiences', percent: 43, label: 'demo.seed.experiences.preparing' },
  { stage: 'feedback', percent: 46, label: 'demo.seed.feedback.preparing' },
  { stage: 'ratings', percent: 52, label: 'demo.seed.ratings.loading' },
  { stage: 'assets', percent: 64, label: 'demo.seed.assets.preparing' },
  { stage: 'activityMembers', percent: 82, label: 'demo.seed.members.preparing' },
  { stage: 'communityGroups', percent: 88, label: 'demo.seed.groups.preparing' },
  { stage: 'activityResources', percent: 94, label: 'demo.seed.resources.preparing' },
  { stage: 'helpCenter', percent: 95, label: 'demo.seed.help.preparing' },
  { stage: 'ideaPosts', percent: 96, label: 'demo.seed.articles.preparing' },
  { stage: 'adminUsers', percent: 97, label: 'demo.seed.admin.users.preparing' },
  { stage: 'operatorUsers', percent: 97, label: 'demo.seed.users.preparing' },
  { stage: 'adminWorkspaceData', percent: 97, label: 'demo.seed.admin.workspace.preparing' },
  { stage: 'adminHelpLinks', percent: 97, label: 'demo.seed.admin.help.preparing' },
  { stage: 'affinityGraph', percent: 97, label: 'demo.seed.admin.graph.preparing' },
  { stage: 'indexedDb', percent: 98, label: 'demo.seed.database.syncing' },
  { stage: 'ready', percent: 100, label: 'demo.data.ready' }
];

export const SESSION_PROCESS_STEPS: readonly BootstrapProcessStep[] = [
  { stage: 'session', percent: 0, label: 'demo.session.preparing' },
  { stage: 'sessionChats', percent: 38, label: 'demo.seed.threads.preparing' },
  { stage: 'sessionFeedback', percent: 62, label: 'demo.seed.feedback.preparing' },
  { stage: 'sessionIndexedDb', percent: 84, label: 'demo.seed.database.syncing' },
  { stage: 'sessionReady', percent: 100, label: 'demo.session.ready.title' }
];

const PROCESS_STEP_BY_STAGE = new Map<BootstrapProcessStage, BootstrapProcessStep>(
  [...BOOTSTRAP_PROCESS_STEPS, ...SESSION_PROCESS_STEPS].map(step => [step.stage, step])
);

export function bootstrapProcessStep(stage: BootstrapProcessStage): BootstrapProcessState {
  return PROCESS_STEP_BY_STAGE.get(stage) ?? BOOTSTRAP_PROCESS_STEPS[0];
}

@Injectable({
  providedIn: 'root'
})
export class BootstrapProcessService {
  normalize<Stage extends string>(
    state: BootstrapProcessState<Stage>,
    fallbackLabel = 'demo.seed.preparing'
  ): BootstrapProcessState<Stage> {
    return {
      percent: Math.max(0, Math.min(100, Math.round(state.percent))),
      label: state.label.trim() || fallbackLabel,
      stage: state.stage
    };
  }

  async runStep<Stage extends string, T = void>(
    step: BootstrapProcessStep<Stage>,
    onProgress: BootstrapProcessListener<Stage> | undefined,
    work?: () => T | Promise<T>
  ): Promise<T> {
    onProgress?.(this.normalize(step));
    await this.waitForUiYield();
    const result = work ? await work() : undefined as T;
    await this.waitForUiYield();
    return result;
  }

  waitForUiYield(): Promise<void> {
    return new Promise(resolve => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(resolve, 0);
    });
  }
}
