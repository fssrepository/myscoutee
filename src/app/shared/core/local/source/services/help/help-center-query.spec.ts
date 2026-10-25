import { SeedHelpCenterRepository } from '../../../seed/repositories/help/help-center-seed.repository';
import { SeedHelpCenterContentBuilder } from '../../../seed/builders/help/help-center-content-seed.builder';
import { HELP_CENTER_TABLE_NAME, type HelpCenterRevisionRecord } from '../../entity/content/content.entity';
import { LocalHelpCenterMapper } from '../../mappers/help/help-center.mapper';
import { LocalHelpCenterService } from './help-center.service';

function fixture() {
  const revision = SeedHelpCenterContentBuilder.defaultRevision('explanation', 'en', 'landing.home');
  const selected = LocalHelpCenterMapper.toRecord(revision);
  const unrelated = (id: string, values: Partial<HelpCenterRevisionRecord>) => {
    const record = { ...selected, id, ...values };
    Object.defineProperty(record, 'sections', { get() { throw new Error('Unrelated document sections must not be copied'); } });
    return record;
  };
  const records = [selected,
    unrelated('other-language', { lang: 'hu' }),
    unrelated('other-kind', { documentKind: 'privacy' }),
    unrelated('other-context', { contextKey: 'landing.setup' })];
  const table = { revisionIds: records.map(record => record.id),
    revisionsById: Object.fromEntries(records.map(record => [record.id, record])),
    activeRevisionIdsByKind: { 'explanation:en:landing.home': selected.id } };
  return { table, selected };
}

describe('Local help projection during landing loading', () => {
  for (const [name, owner] of [['seed', SeedHelpCenterRepository], ['read', LocalHelpCenterService]] as const) {
    it(`${name} projects only the requested document and keeps its returned sections isolated`, () => {
      const { table, selected } = fixture();
      const context = Object.create(owner.prototype);
      const result = context.revisionsForKind(table, 'explanation', 'en', 'landing.home');
      expect(result.map((revision: { id: string }) => revision.id)).toEqual([selected.id]);
      const original = selected.sections[0].title;
      result[0].sections[0].title = 'Changed copy';
      expect(selected.sections[0].title).toBe(original);
    });
  }

  it('keeps existing normalized guide sections when a new seed is inserted', async () => {
    const { selected } = fixture();
    const existing = { ...selected };
    Object.defineProperty(existing, 'sections', { get() { throw new Error('Existing sections must not be copied again'); } });
    const table = { revisionIds: [existing.id], revisionsById: { [existing.id]: existing } };
    const context = Object.create(SeedHelpCenterRepository.prototype);
    const normalized = context.normalizedRevisionsById(table);
    expect(normalized[existing.id]).toBe(existing);
  });

  it('still normalizes legacy metadata without mutating its stored sections', () => {
    const { selected } = fixture();
    const legacy = { ...selected, lang: 'en-US', languageLabel: '', contextKey: ` ${selected.contextKey} ` };
    const table = { revisionIds: [legacy.id], revisionsById: { [legacy.id]: legacy } };
    const context = Object.create(SeedHelpCenterRepository.prototype);
    const normalized = context.normalizedRevisionsById(table)[legacy.id];
    expect(normalized).toMatchObject({ lang: 'en', languageLabel: 'English', contextKey: selected.contextKey });
    normalized.sections[0].title = 'Changed normalized copy';
    expect(legacy.sections[0].title).toBe(selected.sections[0].title);
  });

  it('reuses a current seeded guide without loading or translating another catalog', async () => {
    const { table } = fixture();
    const i18n = { ensureLanguageLoaded: vi.fn(), translateForLanguage: vi.fn() };
    const context = Object.assign(Object.create(SeedHelpCenterRepository.prototype), {
      memoryDb: { read: () => ({ [HELP_CENTER_TABLE_NAME]: table }), write: vi.fn() }, i18n
    });
    expect(await context.ensureSeeded('explanation', 'en', 'landing.home')).toBe(false);
    expect(i18n.ensureLanguageLoaded).not.toHaveBeenCalled();
    expect(i18n.translateForLanguage).not.toHaveBeenCalled();
    expect(context.memoryDb.write).not.toHaveBeenCalled();
  });
});
