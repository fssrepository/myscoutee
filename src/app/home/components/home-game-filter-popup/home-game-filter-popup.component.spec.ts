import { describe, expect, it } from 'vitest';
import { SimpleChange } from '@angular/core';
import { HomeGameFilterPopupComponent } from './home-game-filter-popup.component';
import { createInitialGameFilter, GameFilterMenuKind } from '../../shared/home-game-filter.shared';
import { APP_STATIC_DATA } from '../../../shared/core/common/app-static-data';
import { ProfileFormFlowConverter } from '../../../shared/ui/converters/profile/profile-form-flow.converter';
import type { FormFlowMenuControlConfig } from '@myscoutee/components';
import { UserDto } from '../../../shared/core/contracts/user.interface';

class Filter extends HomeGameFilterPopupComponent {
  model = this.filterMenuModel.bind(this);
  searchable = this.filterMenuSearchable.bind(this);
  select = this.onGameFilterMenuSelect.bind(this);
  draft() { return this.filterDraft; }
}
function popup() {
  const component = new Filter();
  component.context = { activeUser: new UserDto(), users: [], filter: createInitialGameFilter(),
    interestOptionGroups: [], valueOptionGroups: [] };
  component.ngOnChanges({ context: new SimpleChange(null, component.context, true) });
  return component;
}
const fields: [GameFilterMenuKind, string][] = [
  ['interests', 'interests'], ['values', 'values'], ['physiques', 'physique'], ['languages', 'languages'],
  ['genders', 'gender'], ['smoking', 'smoking'], ['drinking', 'drinking'], ['workout', 'workout'],
  ['pets', 'pets'], ['familyPlans', 'familyPlans'], ['children', 'children'], ['loveStyles', 'loveStyle'],
  ['communicationStyles', 'communicationStyle'], ['sexualOrientations', 'sexualOrientation'], ['religions', 'religion']
];
describe('profile filter catalogs with an empty result set', () => {
  it.each(fields)('%s keeps every profile editor choice, label, icon and palette as a multi-select', (kind, id) => {
    const field = ProfileFormFlowConverter.convert(null).steps.flatMap(step => step.controls ?? []).find(item => item.id === id)!;
    const config = field.config as FormFlowMenuControlConfig;
    const source = config.items ?? config.model!.groups!.flatMap(group => group.items ?? []);
    const model = popup().model(kind);
    const items = model.groups!.flatMap(group => group.items ?? []);
    expect(items).toHaveLength(source.length);
    for (const item of source) {
      expect(items.find(candidate => candidate.value === item.value)).toMatchObject({
        value: item.value, label: item.label, icon: item.icon, palette: item.palette,
        kind: 'checkbox', disabled: false, closeOnSelect: false
      });
    }
    expect(model.maxSelected).toBeNull();
  });
  it('always offers all 12 zodiac signs and all 8 impression traits', () => {
    const component = popup();
    expect(component.model('horoscopes').groups!.flatMap(group => group.items!)).toHaveLength(12);
    expect(component.model('traitLabels').groups!.flatMap(group => group.items!).map(item => item.value))
      .toEqual(APP_STATIC_DATA.personalityTraitCatalog.map(trait => trait.label));
  });
  it('retains grouped long lists and searches only interests, values and languages', () => {
    const component = popup();
    for (const kind of ['interests', 'values', 'languages'] as const) {
      expect(component.model(kind).groups!.length).toBeGreaterThan(1);
      expect(component.searchable(kind)).toBe(true);
    }
    for (const kind of [...fields.map(([kind]) => kind), 'horoscopes', 'traitLabels'] as GameFilterMenuKind[]) {
      if (!['interests', 'values', 'languages'].includes(kind)) expect(component.searchable(kind)).toBe(false);
    }
  });
  it('toggles and removes old lowercase values without duplicate selection and retains custom saved values', () => {
    const component = popup();
    component.draft().children = ['yes', 'custom'];
    let item = component.model('children').groups![0].items!.find(item => item.value === 'Yes')!;
    expect(item.checked).toBe(true);
    component.select({ sourceEvent: new Event('click'), item, id: item.id, context: item.context, value: item.value, action: 'select' });
    expect(component.draft().children).toEqual(['custom']);
    item = component.model('children').groups![0].items!.find(item => item.value === 'custom')!;
    component.select({ sourceEvent: new Event('click'), item, id: item.id, context: item.context, value: item.value, action: 'remove' });
    expect(component.draft().children).toEqual([]);
  });
});
