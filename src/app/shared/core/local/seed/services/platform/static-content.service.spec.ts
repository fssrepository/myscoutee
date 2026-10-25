import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../base/services/localization/i18n.service';
import { LocalMemoryDb } from '../../../../common/app.db';
import { HELP_CENTER_TABLE_NAME } from '../../../source/entity/content/content.entity';
import { SeedIdeaPostsRepository } from '../../repositories/content/idea-posts-seed.repository';
import { SeedHelpCenterRepository } from '../../repositories/help/help-center-seed.repository';
import { SeedStaticContentService } from './static-content.service';

describe('Landing content language', () => {
  let language: string;
  const ensureLanguageLoaded = vi.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    language = 'hu';
    ensureLanguageLoaded.mockClear();
    TestBed.configureTestingModule({ providers: [
      { provide: I18nService, useValue: {
        currentLanguage: () => language, ensureLanguageLoaded,
        translateForLanguage: (key: string) => key
      } },
      { provide: SeedIdeaPostsRepository, useValue: { seedDefaults: () => Promise.resolve() } }
    ] });
    await TestBed.inject(LocalMemoryDb).resetStorage();
  });
  afterEach(() => TestBed.resetTestingModule());

  it.each(['en', 'hu', 'de', 'es'] as const)('prepares only the current %s language for every landing base', async lang => {
    language = lang;
    await TestBed.inject(SeedStaticContentService).ensureReady();
    expect(new Set(ensureLanguageLoaded.mock.calls.map(([value]) => value))).toEqual(new Set([lang]));
    const root = TestBed.inject(LocalMemoryDb).read()[HELP_CENTER_TABLE_NAME];
    const privacyId = root.activeRevisionIdsByKind?.[`privacy:${lang}`];
    if (!privacyId) throw new Error(`Missing ${lang} privacy seed`);
    const privacy = root.revisionsById[privacyId];
    expect(privacy.title).toBe({ en: 'Data privacy', hu: 'Adatvédelem', de: 'Datenschutz', es: 'Privacidad de datos' }[lang]);
    for (const table of [root, ...Object.values(root.baseGroups ?? {})]) {
      expect(new Set(Object.values(table.revisionsById).filter(row => row.active).map(row => row.lang))).toEqual(new Set([lang]));
      expect(table.activeRevisionIdsByKind?.[`terms:${lang}`]).toBeTruthy();
    }
  });

  it('still prepares every language for the existing admin bootstrap', async () => {
    await TestBed.inject(SeedStaticContentService).ensureReady();
    ensureLanguageLoaded.mockClear();
    await TestBed.inject(SeedHelpCenterRepository).seedDefaults();
    const root = TestBed.inject(LocalMemoryDb).read()[HELP_CENTER_TABLE_NAME];
    for (const table of [root, ...Object.values(root.baseGroups ?? {})]) {
      expect(new Set(Object.values(table.revisionsById).map(row => row.lang))).toEqual(new Set(['en', 'hu', 'de', 'es']));
    }
  });
});
