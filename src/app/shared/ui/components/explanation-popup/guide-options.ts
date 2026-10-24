import type { ExplanationGuideOptions } from '../../../core/base/services/help/explanation-guide.service';

import { EXPLAINABLE_SURFACES } from '../../../core/common/help-center-options';
import { APP_STORAGE_KEYS } from '../../../core/common/storage-scope';

/** Product surfaces, consent and persistence stay with the application. */
export function myScouteeGuideOptions(
  options: Pick<ExplanationGuideOptions, 'loadState' | 'storageKey' | 'dismissalScope'>
): ExplanationGuideOptions {
  return {
    ...options,
    isExplainableContext: contextKey => EXPLAINABLE_SURFACES
      .some(surface => surface.enabled && surface.key === contextKey),
    // The one-step introduction points at the launcher above the consent popup.
    contextPriority: contextKey => contextKey === 'landing.guide' ? 2
      : contextKey === null || EXPLAINABLE_SURFACES
        .some(surface => surface.key === contextKey && surface.owner === 'popup') ? 1 : 0,
    introduction: {
      contextKey: 'landing.guide',
      shouldOffer: () => {
        try {
          return localStorage.getItem(APP_STORAGE_KEYS.explanationGuideIntroductionSeen) !== 'true'
            && !localStorage.getItem(APP_STORAGE_KEYS.entryConsent);
        } catch { return true; }
      },
      onComplete: () => {
        try { localStorage.setItem(APP_STORAGE_KEYS.explanationGuideIntroductionSeen, 'true'); }
        catch { /* Session-only when storage is unavailable. */ }
      }
    }
  };
}
