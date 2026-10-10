import { InjectionToken, inject } from '@angular/core';
import { ExplanationGuideService } from '@myscoutee/components';
import { myScouteeGuideOptions } from '../../../ui/components/explanation-popup/guide-options';
import { LandingContentService } from './landing-content.service';
import { backendUnavailable } from '../../common/backend-connectivity';
import { environment } from '../../../../../environments/environment';

// A separate instance of the shared engine: never calls authenticated help routes.
export const LANDING_EXPLANATION_GUIDE = new InjectionToken<ExplanationGuideService>('Landing explanation guide', {
  providedIn: 'root', factory: () => {
    const content = inject(LandingContentService);
    return new ExplanationGuideService(myScouteeGuideOptions({
      dismissalScope: 'visit',
      loadState: (context, language) => {
        if (environment.activitiesDataSource === 'http' && backendUnavailable()) {
          return Promise.reject(new Error('Backend unavailable'));
        }
        return content.loadExplanationState(context, language);
      }
    }));
  }
});
