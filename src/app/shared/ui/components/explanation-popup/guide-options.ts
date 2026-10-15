import type { ExplanationGuideOptions } from '@fssrepository/myscoutee-components';
import { APP_STATIC_DATA } from '../../../core/common/app-static-data';
import { APP_STORAGE_KEYS } from '../../../core/common/storage-scope';

/** Product surfaces, consent and persistence stay with the application. */
export function myScouteeGuideOptions(
  options: Pick<ExplanationGuideOptions, 'loadState' | 'storageKey' | 'dismissalScope'>
): ExplanationGuideOptions {
  return {
    ...options,
    isExplainableContext: contextKey => APP_STATIC_DATA.explainableSurfaces
      .some(surface => surface.enabled && surface.key === contextKey),
    // The one-step introduction points at the launcher above the consent popup.
    contextPriority: contextKey => contextKey === 'landing.guide' ? 2
      : contextKey === null || APP_STATIC_DATA.explainableSurfaces
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
