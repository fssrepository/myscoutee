import { describe, expect, it } from 'vitest';
import { SeedHelpCenterContentBuilder } from './help-center-content-seed.builder';
import en from '../../../../../../../assets/i18n/en.json';
import de from '../../../../../../../assets/i18n/de.json';
import es from '../../../../../../../assets/i18n/es.json';

describe('localized default help seeds', () => {
  for (const bundle of [de, es]) {
    it(`seeds complete ${bundle.lang} documents without English fallbacks`, () => {
      const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
      const keys = new Map(Object.entries(en.messages).map(([key, value]) => [normalize(value), key]));
      const missing = new Set<string>();
      const translate = (text: string) => {
        if (!text.trim()) return text;
        const key = keys.get(normalize(text)) ?? text;
        const value = (bundle.messages as Record<string, string>)[key];
        if (!value) missing.add(text);
        return value ?? text;
      };
      for (const kind of ['help', 'privacy', 'terms'] as const) {
        const revision = SeedHelpCenterContentBuilder.defaultRevision(kind, bundle.lang, null, translate);
        expect(revision.lang).toBe(bundle.lang);
        expect(revision.sections.length).toBeGreaterThan(0);
      }
      for (const context of SeedHelpCenterContentBuilder.explanationBootstrapContextKeys()) {
        const revision = SeedHelpCenterContentBuilder.defaultRevision('explanation', bundle.lang, context, translate);
        expect(revision.lang).toBe(bundle.lang);
        expect(revision.sections.length, context).toBeGreaterThan(0);
      }
      expect([...missing]).toEqual([]);
    });
  }
});
