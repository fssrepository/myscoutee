import {
  SeedEventsBuilder,
  URBAN_PHOTO_SPRINT_PROMO_CODES
} from './events-seed.builder';

describe('SeedEventsBuilder invitation pricing', () => {
  it('carries Urban Photo Sprint VIP promo pricing into the bootstrap record collection', () => {
    const invitationsByUser = SeedEventsBuilder.buildSeedInvitationItemsByUser();
    const invitation = invitationsByUser['u3']
      ?.find(item => item.id === 'i5' && item.description === 'Urban Photo Sprint');
    const collection = SeedEventsBuilder.buildRecordCollection({
      invitationsByUser,
      eventsByUser: SeedEventsBuilder.buildSeedEventItemsByUser(),
      hostingByUser: SeedEventsBuilder.buildSeedHostingItemsByUser(),
      statusById: SeedEventsBuilder.buildSeedStatusById()
    });
    const persistedRecord = collection.ids
      .map(id => collection.byId[id])
      .find(record => (
        record?.id === 'i5'
        && record.title === 'Urban Photo Sprint'
      ));
    const pricing = persistedRecord?.pricing;
    const promoCodes = pricing?.audience.promoCodes.map(item => item.code) ?? [];

    expect(invitation).toBeDefined();
    expect(persistedRecord).toBeDefined();
    expect(persistedRecord?.invitedMemberUserIds).toContain('u3');
    expect(pricing?.enabled).toBe(true);
    expect(pricing?.audience.enabled).toBe(true);
    expect(promoCodes).toEqual([...URBAN_PHOTO_SPRINT_PROMO_CODES]);
    expect(promoCodes.length).toBeGreaterThan(1);
    expect(promoCodes.filter(code => code.startsWith('VIP')).length).toBeGreaterThan(1);
    expect(promoCodes).toEqual(promoCodes.map(code => code.trim().toUpperCase()));
    expect(new Set(promoCodes).size).toBe(promoCodes.length);
  });
});
