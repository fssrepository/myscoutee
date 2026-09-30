import { InjectionToken, inject } from '@angular/core';
import { ExplanationGuideService } from './explanation-guide.service';
import { LandingContentService } from './landing-content.service';

// A separate instance of the shared engine: never calls authenticated help routes.
export const LANDING_EXPLANATION_GUIDE = new InjectionToken<ExplanationGuideService>('Landing explanation guide', {
  providedIn: 'root', factory: () => {
    const content = inject(LandingContentService);
    return new ExplanationGuideService({
      dismissalScope: 'visit',
      loadState: (context, language) => content.loadExplanationState(context, language)
    });
  }
});
