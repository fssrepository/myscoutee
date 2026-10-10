import { MYSCOUTEE_FORM_FLOW_CONTROLS } from './form-flow-controls';
import { MediaService } from '../core/base/services/media.service';
import { DeploymentConfigurationService } from '../core/base/services/deployment-configuration.service';
import { MYSCOUTEE_IMAGE_DETAILS } from './image-details';
import { inject } from '@angular/core';
import { FORM_FLOW_CONTROLS, UI_BRANDING, UI_IMAGE_DETAILS, UI_IMAGE_UPLOAD, EXPLANATION_GUIDE_OPTIONS, UI_IMAGE_URLS, UI_LIST_DEFAULTS, provideUiTranslations } from '@myscoutee/components';
import { I18nService } from '../core/base/services/i18n.service';
import { HelpCenterService } from '../core/base/services/help-center.service';
import { APP_STORAGE_KEYS } from '../core/common/storage-scope';
import { myScouteeGuideOptions } from './guide-options';
import { MYSCOUTEE_IMAGE_URLS } from './image-urls';
import { ROUTE_CONFIG } from '../core/base/config';

/** Bind the shared UI to the application's existing translation state. */
export const MYSCOUTEE_UI_PROVIDERS = [
  provideUiTranslations(I18nService),
  { provide: FORM_FLOW_CONTROLS, useValue: MYSCOUTEE_FORM_FLOW_CONTROLS },
  { provide: UI_IMAGE_UPLOAD, useExisting: MediaService },
  { provide: UI_IMAGE_DETAILS, useValue: MYSCOUTEE_IMAGE_DETAILS },
  { provide: UI_BRANDING, useFactory: () => inject(DeploymentConfigurationService).branding },
  { provide: UI_IMAGE_URLS, useValue: MYSCOUTEE_IMAGE_URLS },
  { provide: UI_LIST_DEFAULTS, useFactory: () => ({loadingWindowMs: ROUTE_CONFIG.defaultRequestTimeoutMs}) },
  {
    provide: EXPLANATION_GUIDE_OPTIONS,
    useFactory: () => {
      const help = inject(HelpCenterService);
      return myScouteeGuideOptions({
        storageKey: APP_STORAGE_KEYS.explanationGuideEnabled,
        loadState: (context, language) => help.loadExplanationState(context, language)
      });
    }
  }
];

export default MYSCOUTEE_UI_PROVIDERS;
