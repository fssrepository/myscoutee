import { TestBed } from '@angular/core/testing';
import { LocalMemoryDb } from '../../../../common/app.db';
import { HELP_CENTER_TABLE_NAME, type HelpCenterTable } from '../../../source/entity/content/content.entity';
import { SeedHelpCenterRepository } from './help-center-seed.repository';

describe('Integration guide seed upgrades', () => {
  let db: LocalMemoryDb;
  let seed: SeedHelpCenterRepository;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    db = TestBed.inject(LocalMemoryDb);
    await db.resetStorage();
    seed = TestBed.inject(SeedHelpCenterRepository);
    await seed.seedDefaults();
  });

  afterEach(() => TestBed.resetTestingModule());

  for (const edited of [true, false]) {
    it(`${edited ? 'retains administrator edits' : 'advances untouched system guides'} when a new seed arrives`, async () => {
      const key = 'explanation:en:profile.integration-help';
      const expected: Array<{ baseId: string | null; shippedId: string; previousId: string }> = [];
      const stagePrevious = (table: HelpCenterTable, baseId: string | null): HelpCenterTable => {
        const shippedId = table.activeRevisionIdsByKind![key];
        if (!shippedId) throw new Error(`Missing seeded guide for ${baseId ?? 'Dating'}`);
        const shipped = table.revisionsById[shippedId];
        const previousId = `${shippedId}-previous`;
        expected.push({ baseId, shippedId, previousId });
        const revisionsById = { ...table.revisionsById };
        delete revisionsById[shippedId];
        revisionsById[previousId] = { ...shipped, id: previousId, version: shipped.version - 1,
          title: 'Retained administrator guide', createdByUserId: 'system',
          updatedByUserId: edited ? 'qa-admin' : 'system', active: true };
        return { ...table, revisionsById,
          revisionIds: [...table.revisionIds.filter(id => id !== shippedId), previousId],
          activeRevisionIdsByKind: { ...table.activeRevisionIdsByKind, [key]: previousId } };
      };
      db.write(state => {
        const root = state[HELP_CENTER_TABLE_NAME];
        return { ...state, [HELP_CENTER_TABLE_NAME]: {
          ...stagePrevious(root, null),
          baseGroups: Object.fromEntries(Object.entries(root.baseGroups ?? {})
            .map(([id, table]) => [id, stagePrevious(table, id)]))
        } };
      });

      await seed.seedDefaults();

      const root = db.read()[HELP_CENTER_TABLE_NAME];
      expect(expected).toHaveLength(3);
      for (const { baseId, shippedId, previousId } of expected) {
        const table = baseId ? root.baseGroups![baseId] : root;
        expect(table.activeRevisionIdsByKind![key]).toBe(edited ? previousId : shippedId);
        expect(table.revisionsById[previousId].title).toBe('Retained administrator guide');
        expect(table.revisionsById[previousId].active).toBe(edited);
        expect(table.revisionsById[shippedId].active).toBe(!edited);
      }
    });
  }
});
