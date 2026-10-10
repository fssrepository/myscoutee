import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { ActivityEventInfoCardMenuConverter, type ActivityEventInfoCardMenuSubject } from './activity-event-info-card-menu.converter';

const subject: ActivityEventInfoCardMenuSubject = {
  menu: 'activity-event-card', id: 'invitation', status: 'I', ownerUserId: 'organizer',
  invitedMemberUserIds: ['viewer'], sourceLink: 'https://example.com/event'
};
const menu = (patch: Partial<ActivityEventInfoCardMenuSubject> = {}) =>
  ActivityEventInfoCardMenuConverter.convert({ ...subject, ...patch }, { activeUserId: 'viewer' });
const ids = (patch: Partial<ActivityEventInfoCardMenuSubject> = {}) => menu(patch).map(item => item.id);

describe('activity event organizer and external actions', () => {
  it('keeps invitation actions alongside external info and follow', () => {
    expect(ids()).toEqual(expect.arrayContaining(['viewInvitation', 'accept', 'rejectInvitation', 'externalInfo', 'followOrganizer']));
    expect(ids()).not.toContain('unfollowOrganizer');
  });
  it('offers unfollow for an already followed organizer using the common palette', () => {
    const items = menu({ organizerFollowed: true });
    expect(items.map(item => item.id)).not.toContain('followOrganizer');
    expect(items.find(item => item.id === 'unfollowOrganizer')).toMatchObject({ label: 'event.following.unfollow', palette: 'cyan' });
  });
  it.each(['', 'ftp://example.com/event'])('does not offer an unusable external link: %s', sourceLink => {
    expect(ids({ sourceLink })).not.toContain('externalInfo');
  });
  it('does not offer self-follow', () => {
    expect(ids({ ownerUserId: 'viewer' })).not.toContain('followOrganizer');
    expect(ids({ ownerUserId: 'viewer', organizerFollowed: true })).not.toContain('unfollowOrganizer');
  });
  it('preserves the existing trash menu', () => {
    expect(ids({ status: 'T' })).toEqual(['restore', 'view', 'askOrganizer']);
  });
});
