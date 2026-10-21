import { ProfileViewPopupComponent } from './profile-view-popup.component';
import { UserDto } from '../../../shared/core/contracts/accounts/user.interface';
import huBundle from '../../../../assets/i18n/hu.json';

// Rendering labels must not change the identifiers used by profile visibility.
describe('Profile captions without an English reference catalog', () => {
  const messages: Record<string, string> = huBundle.messages;
  const translate = (key: string) => {
    if (!Object.hasOwn(messages, key)) throw new Error(`Expected a translation key: ${key}`);
    return messages[key];
  };
  function profile(): any {
    return Object.assign(Object.create(ProfileViewPopupComponent.prototype), {
      i18nService: { translate }, hiddenFields: () => new Set(['Name']),
      experiences: () => [], target: () => null
    });
  }
  it('preserves visibility identifiers and user text while selecting direct label keys', () => {
    const component = profile();
    const user = Object.assign(new UserDto(), { name: 'User-supplied name', city: 'User-supplied city', headline: 'My headline' });
    const rows = component.buildBasicsRows(user);
    expect(rows.some((row: {label: string}) => row.label === 'Name')).toBe(false);
    expect(rows.find((row: {label: string}) => row.label === 'City')).toMatchObject({
      labelKey: 'profile.city', value: 'User-supplied city'
    });
    expect(component.buildAboutRows(user)[0]).toMatchObject({ labelKey: 'headline', value: 'My headline' });
    for (const row of [...rows, ...component.buildAboutRows(user)]) expect(translate(row.labelKey)).toBeTruthy();
    expect(component.displayTitle(user)).toBe('User-supplied name');
  });
  it('translates empty captions but leaves custom profile values untouched', () => {
    const component = profile();
    expect(component.headerTitle(null)).toBe(messages['profile']);
    expect(component.headerSubtitle(null)).toBe(messages['loading.profile']);
    expect(component.displayDetailValue({ labelKey: 'profile.details.children', value: 'yes' }))
      .toBe(messages['profile.children.has']);
    expect(component.displayDetailValue({ labelKey: 'profile.details.religion', value: 'My custom value' }))
      .toBe('My custom value');
    expect(component.valueOrNotSet('')).toBe(messages['not.set']);
  });
});
