import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ExplanationGuideService } from '@fssrepository/myscoutee-components';
import { CommunityAnnouncementsComponent } from './community-announcements.component';
import { CommunityAnnouncementEditorComponent } from './community-announcement-editor.component';
import { CommunityAnnouncementsStore } from '../../context/stores/community/community-announcements.store';
import { I18nService } from '../../../core/base/services/localization/i18n.service';
import { MediaService } from '../../../core/base/services/media/media.service';
import type { CommunityAnnouncement } from '../../../core/contracts/community/community-announcement.interface';

const vote: CommunityAnnouncement = {
  id: 'vote', title: 'Vote', body: 'Proposal', status: 'published', voting: true, closed: false,
  communityId: 'homes', authorAccountId: 'account', results: {yes: 1, no: 0, abstain: 0}, version: 1,
  publishedAtIso: '2026-10-14T10:00:00Z', updatedAtIso: '2026-10-14T10:00:00Z',
  canManage: true, canVote: true, myBallot: null, castVotes: 1, eligibleMembers: 2,
  createdAtIso: '2026-10-14T10:00:00Z', deadlineIso: '2099-01-01T00:00:00Z', attachments: []
};
const i18n = { translate: (key: string) => key, currentLanguage: () => 'en' };
function list() {
  return Object.assign(Object.create(CommunityAnnouncementsComponent.prototype), {
    store: { canManage: () => true }, i18n
  });
}

describe('Announcement voting actions and badges', () => {
  it.each([
    { status: 'draft' }, { status: 'trash' }, { canVote: false }, { myBallot: 'yes' }, { voting: false }
  ])('hides Vote when unavailable: %j', unavailable => {
    expect(list().menu({ ...vote, ...unavailable }).map((item: {id: string}) => item.id)).not.toContain('vote');
  });
  it('uses voting rights independently of admin status and replaces Vote with Results after closure', () => {
    expect(list().menu(vote).map((item: {id: string}) => item.id)).toContain('vote');
    const closed = list().menu({ ...vote, closed: true }).map((item: {id: string}) => item.id);
    expect(closed).toContain('results'); expect(closed).not.toContain('vote');
  });
  it('shows one contextual counter at the top right instead of duplicate voting badges', () => {
    expect(list().row(vote).badges).toEqual([{ label: '1/2', icon: 'how_to_vote', palette: 'blue', position: 'top-right' }]);
    expect(list().row({ ...vote, closed: true }).badges[0].palette).toBe('violet');
    expect(list().row({ ...vote, voting: false }).badges).toEqual([
      { label: 'announcement.notice', tone: 'success', position: 'top-right' }
    ]);
  });
});

describe('Announcement draft header', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    { provide: CommunityAnnouncementsStore, useValue: { userId: () => 'account', groupId: () => 'homes', busy: () => false, error: () => '' } },
    { provide: MediaService, useValue: {} }, { provide: I18nService, useValue: i18n },
    { provide: ExplanationGuideService, useValue: { registerContext: () => () => {} } }
  ] }));
  afterEach(() => TestBed.resetTestingModule());
  it.each([
    [null, false, 'announcement.draft.hint'], ['draft', false, 'announcement.draft.hint'],
    ['published', false, null], ['draft', true, null]
  ])('shows the draft hint only for new or draft editors: %s, readOnly %s', (status, readOnly, expected) => {
    const editor = TestBed.runInInjectionContext(() => new CommunityAnnouncementEditorComponent());
    Object.assign(editor, { editor: signal({ value: status ? { ...vote, status } : null, readOnly }) });
    editor.ngOnChanges();
    expect((editor as unknown as { popup: () => {subtitle: string | null} }).popup().subtitle).toBe(expected);
    editor.ngOnDestroy();
  });
});
