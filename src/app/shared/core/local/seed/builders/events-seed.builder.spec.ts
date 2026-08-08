import {
  SeedEventsBuilder,
  URBAN_PHOTO_SPRINT_PROMO_CODES
} from './events-seed.builder';
import { demoEventPlaceholder } from './demo-image-pool';

describe('SeedEventsBuilder invitation pricing', () => {
  it('carries Urban Photo Sprint VIP promo pricing into the bootstrap record collection', () => {
    const invitationsByUser = SeedEventsBuilder.buildSeedInvitationItemsByUser();
    const invitation = invitationsByUser['u3']
      ?.find(item => item.id === 'i5');
    const expectedPresentation = demoEventPlaceholder('demo-event-invitations:u3:i5');
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
      ));
    const pricing = persistedRecord?.pricing;
    const promoCodes = pricing?.audience.promoCodes.map(item => item.code) ?? [];

    expect(invitation).toBeDefined();
    expect(persistedRecord).toBeDefined();
    expect(invitation?.description).toBe(expectedPresentation.title);
    expect(persistedRecord?.title).toBe(expectedPresentation.title);
    expect(persistedRecord?.subtitle).toBe(expectedPresentation.subtitle);
    expect(persistedRecord?.location).toBe(expectedPresentation.location);
    expect(persistedRecord?.imageUrl).toBe(expectedPresentation.imageUrl);
    expect(persistedRecord?.invitedMemberUserIds).toContain('u3');
    expect(pricing?.enabled).toBe(true);
    expect(pricing?.audience.enabled).toBe(true);
    expect(promoCodes).toEqual([...URBAN_PHOTO_SPRINT_PROMO_CODES]);
    expect(promoCodes.length).toBeGreaterThan(1);
    expect(promoCodes.filter(code => code.startsWith('VIP')).length).toBeGreaterThan(1);
    expect(promoCodes).toEqual(promoCodes.map(code => code.trim().toUpperCase()));
    expect(new Set(promoCodes).size).toBe(promoCodes.length);
  });

  it('synchronizes frontend-local event display data without changing fixture identities', () => {
    const eventsByUser = SeedEventsBuilder.buildSeedEventItemsByUser();
    const alpine = eventsByUser['u1']?.find(item => item.id === 'e1');
    const expectedPresentation = demoEventPlaceholder('demo-event-events:u1:e1');

    expect(alpine?.id).toBe('e1');
    expect(alpine?.title).toBe(expectedPresentation.title);
    expect(alpine?.shortDescription).toBe(expectedPresentation.subtitle);
    expect(alpine?.location).toBe(expectedPresentation.location);
    expect(alpine?.imageUrl).toBe(expectedPresentation.imageUrl);
    expect(alpine?.topics).toEqual([...expectedPresentation.topics]);
  });
});
