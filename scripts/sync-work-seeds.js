#!/usr/bin/env node

// Browser-local seed data is the canonical Work/Community demo/content source. This
// updates versioned Mongo fixtures only; it never writes to a running database.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = path.join(root, 'src/app/shared/core/local/seed/data');
const mongo = path.resolve(root, '../server/docker/conf/mongodb');
const check = process.argv.includes('--check');
const staged = new Map();
const read = file => staged.has(file) ? structuredClone(staged.get(file)) : JSON.parse(fs.readFileSync(file, 'utf8'));
const group = read(path.join(data, 'work-group.json'));
const locations = read(path.join(data, 'demo-locations.json'));
const date = '2026-09-20T12:00:00.000Z';
let stale = false;
function write(file, value) { staged.set(file, structuredClone(value)); }
function flush() {
  // Validate every catalog before writing any file: Mongo's unique revision key must survive import.
  for (const [file, rows] of staged) if (file.endsWith('/helpCenterRevisions.json')) {
    const identities = new Set();
    for (const row of rows) {
      const context = JSON.stringify([row.baseGroupId ?? null, row.documentType, row.lang, row.contextKey ?? null]);
      const identity = `${context}:${row.version}`;
      if (identities.has(identity)) throw new Error(`Duplicate guide revision in ${file}: ${identity}`);
      identities.add(identity);
    }
  }
  for (const [file, value] of staged) {
    if (file.endsWith('/helpCenterRevisions.json') && fs.existsSync(file)) {
      const previous = JSON.parse(fs.readFileSync(file, 'utf8'));
      const order = new Map(previous.map((row,index) => [row._id,index]));
      const family = row => JSON.stringify([row.baseGroupId, row.documentType, row.lang, row.contextKey]);
      const groupOrder = new Map(previous.filter(row => row.baseGroupId).map(row => [family(row), order.get(row._id)]));
      const position = row => order.get(row._id) ?? (row.baseGroupId ? groupOrder.get(family(row)) : undefined) ?? Infinity;
      value.sort((a,b) => position(a) - position(b) || a._id.localeCompare(b._id));
    }
    const content = JSON.stringify(value, null, 2) + '\n';
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) continue;
    if (check) { console.error(`Stale seed: ${path.relative(root, file)}`); stale = true; }
    else fs.writeFileSync(file, content);
  }
}
const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
// A guide update must reach local group seeds and Mongo through this same owner.
// Previously only the unscoped Mongo revision was regenerated, leaving group guides stale.
const guideVersions = read(path.join(data, 'help-center-guide-versions.json'));
const guideCatalog = read(path.join(data, 'help-center-guide-fields.json'));
const guideBundles = Object.fromEntries(['en','hu'].map(lang => [lang, read(path.join(root, `src/assets/i18n/${lang}.json`)).messages]));
function guideRevision(source, context, lang, version, baseGroupId, id) {
  const messages = guideBundles[lang];
  const text = key => {
    if (!messages[key]) throw new Error(`Missing guide translation: ${lang}/${key}`);
    return messages[key];
  };
  const sections = guideCatalog[context].map(field => ({
    id:`guide-${field.id.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`, guideStepId:field.id,
    icon:field.group==='card'?'touch_app':field.group==='popup'?'close':'help_outline',
    title:text(field.i18nKey+'.label'), blurb:'', contentHtml:`<p>${escapeHtml(text(field.i18nKey+'.description'))}</p>`
  }));
  return {...source, _id:id, documentType:'explanation', baseGroupId, contextKey:context,
    lang, languageLabel:lang==='hu'?'Magyar':'English', version, active:true, presentation:'tour',
    title:messages[`guide.context.${context}.title`] ?? source.title,
    summary:messages[`guide.context.${context}.summary`] ?? source.summary,
    description:messages[`guide.context.${context}.description`] ?? source.description,
    sections, updatedDate:'2026-10-07T00:00:00.000Z', updatedUser:'system'};
}
for (const groupType of ['work', 'community']) {
  const file = path.join(data, `${groupType}-help-center.json`);
  let rows = read(file);
  for (const [context, version] of Object.entries(guideVersions)) for (const lang of ['en','hu']) {
    const matches = rows.filter(row => row.documentType === 'explanation' && row.contextKey === context && row.lang === lang);
    const source = matches.sort((a,b) => b.version-a.version)[0];
    if (source && source.version > version) throw new Error(`Guide version would regress: ${groupType}/${context}/${lang}`);
    const template = source ?? {...rows.find(row => row.contextKey === 'profile.integrations' && row.lang === lang),
      isSystem:false, createdDate:'2026-10-07T00:00:00.000Z', createdUser:'system'};
    const next = guideRevision(template, context, lang, version, `myscoutee-${groupType}`,
      `${groupType}:explanation-${context}-${lang}-v${version}`);
    // Keep one current canonical group revision at its old position. Runtime user revisions are not touched.
    let inserted = false;
    rows = rows.flatMap(row => {
      if (!matches.includes(row)) return [row];
      if (inserted) return [];
      inserted = true; return [next];
    });
    if (!inserted) rows.push(next);
  }
  write(file, rows);
}
const articles = read(path.join(data, 'work-articles.json')).map(({ id, ...post }) => ({
  ...post, _id: id, contentKey: id.replace(/-hu$/, ''), languageLabel: post.lang === 'hu' ? 'Magyar' : 'English',
  contentHtml: `${post.contentHtml}\n<figure><img src="${post.imageUrl}" alt="${escapeHtml(post.title)}"></figure>`,
  imageUrls: [post.imageUrl], published: true, trashed: false, trashedAtIso: null, trashedByUserId: null,
  createdDate: '2026-10-05T00:00:00.000Z', createdUser: 'system', updatedDate: '2026-10-05T00:00:00.000Z', updatedUser: 'system'
}));
const slides = ['dating', 'work', 'community'].flatMap(type => read(path.join(data, `landing-slides-${type}.json`))
  .map(slide => ({ _id: slide.id, ...slide, workspaceGroupId: type === 'dating' ? null : `myscoutee-${type}` })));
for (const database of ['demo_db', 'e2e_db', 'myscoutee_db']) {
  const dir = path.join(mongo, database);
  write(path.join(dir, 'ideaPosts.json'), [...read(path.join(dir, 'ideaPosts.json')).filter(post => post.workspaceGroupId !== group.id), ...articles]);
  write(path.join(dir, 'landingSlides.json'), slides);
  const configFile = path.join(dir, 'affinityConfigs.json');
  const configs = read(configFile).filter(config => config.key !== group.id);
  const workConfigs = configs.filter(config => config.key === 'default').map(config => ({ ...config,
    _id: `work-parameters-v${config.version}`, key: group.id }));
  write(configFile, [...configs, ...workConfigs]);
  const helpFile = path.join(dir, 'helpCenterRevisions.json');
  const helpDefaults = read(path.join(data, 'work-help-center.json'));
  const helpDefaultIds = new Set(helpDefaults.map(row => row._id));
  write(helpFile, [...read(helpFile).filter(row => row.baseGroupId !== group.id && !helpDefaultIds.has(row._id)),
    ...helpDefaults]);
  const rateFile = path.join(dir, 'exchangeRates.json');
  const ratesCatalog = read(rateFile).filter(row => row.baseGroupId !== group.id);
  write(rateFile, [...ratesCatalog, ...ratesCatalog.filter(row => !row.baseGroupId).map(row => ({
    ...row, _id: `${group.id}:${row._id}`, date: row._id, baseGroupId: group.id
  }))]);
  const jobFile = path.join(dir, 'notificationRuleConfigs.json');
  const jobKeys = new Set(read(path.join(data, 'work-job-keys.json')));
  const backgroundJobs = read(path.join(data, 'background-job-definitions.json'));
  const backgroundKeys = new Set(backgroundJobs.map(job => job.ruleKey));
  const jobs = read(jobFile).filter(job => job.baseGroupId !== group.id && (job.baseGroupId || !backgroundKeys.has(job.ruleKey)));
  for (const job of backgroundJobs) jobs.push({
    _id: `notification-rule-${job.ruleKey}`, syncKey: `notification-rule-${job.ruleKey}`, ruleKey: job.ruleKey,
    label: `admin.jobs.rule.${job.ruleKey}`, category: 'admin.jobs.category.scheduled',
    description: `admin.jobs.rule.${job.ruleKey}.description`, actionKey: job.ruleKey, triggerKind: 'scheduled_process',
    enabled: true, manualRunEnabled: false, adminManageable: true, priority: 200,
    channels: { pushEnabled: false, emailEnabled: false, inAppEnabled: false, supportChatEnabled: false },
    timing: { mode: 'interval', intervalAmount: job.intervalSeconds, intervalUnit: 'seconds',
      intervalSeconds: job.intervalSeconds, time: '00:00', timezone: 'UTC' },
    scheduleSlots: [], parameters: [], message: {}, runState: {}, runHistory: [],
    createdDate: date, createdUser: 'system', updatedDate: date, updatedUser: 'system'
  });
  const workJobs = jobs.filter(job => !job.baseGroupId && jobKeys.has(job.ruleKey)).map(job => ({
    ...job, _id: `work-job:${job.ruleKey}`, syncKey: `work-job:${job.ruleKey}`, baseGroupId: group.id,
    runState: { currentStatus: 'ready', progressPercent: 0, pendingCount: 0 }, runHistory: []
  }));
  write(jobFile, [...jobs, ...workJobs]);
  for (const collection of ['emailTemplates', 'notificationTemplates', 'emailCampaignRules']) {
    const file = path.join(dir, `${collection}.json`);
    const rows = read(file).filter(row => row.baseGroupId !== group.id);
    write(file, [...rows, ...rows.filter(row => !row.baseGroupId).map(row => ({ ...row,
      _id: `work:${row._id}`, ...(row.syncKey ? { syncKey: `work:${row.syncKey}` } : {}), baseGroupId: group.id
    }))]);
  }
  if (database === 'myscoutee_db') {
    // The public base workspace is configuration, with no synthetic members.
    const groupsFile = path.join(dir, 'communityGroups.json');
    const groups = read(groupsFile).filter(record => record._id !== group.id);
    groups.push({ _id: group.id, groupType: group.groupType, ownerUserId: 'system', name: group.name,
      description: group.description, imageUrl: null, category: 'work', visibility: 'public', hideMembers: false,
      policy: { workspace: true, enabled: false, requiredFields: [] }, createdAtIso: date, updatedAtIso: date,
      version: 0, moderationStatus: 'accepted', moderationVersion: 0, pendingMembers: 0 });
    write(groupsFile, groups);
    continue;
  }
  const users = read(path.join(dir, 'users.json')).filter(user => user.workspaceGroupId !== group.id);
  const byName = new Map(users.filter(user => !user.workspaceGroupId).map(user => [user.name, user]));
  const cities = Object.entries(locations.cities);
  for (const [index, account] of locations.accounts.entries()) {
    const user = byName.get(account.name);
    if (!user) throw new Error(`Missing ${database} demo account ${account.name}`);
    const [city, center] = cities[Math.floor(index / 4) % cities.length];
    let hash = 0;
    for (const char of account.id) hash = (hash * 31 + char.charCodeAt(0)) % 104729;
    const coordinates = locations.promptUserIds.includes(account.id) ? null : {
      latitude: Number((center.latitude + ((hash % 29) - 14) * 0.0012).toFixed(6)),
      longitude: Number((center.longitude + ((Math.floor(hash / 29) % 29) - 14) * 0.0012).toFixed(6))
    };
    const partitionKey = coordinates ? ({ Budapest: 'country:hu', Berlin: 'country:de', Madrid: 'country:es', London: 'country:gb' })[city] : null;
    for (const profile of users.filter(profile => profile === user || profile.accountUserId === user.userId)) {
      Object.assign(profile, { city, locationCoordinates: coordinates, partitionKey });
    }
  }
  const owner = byName.get(group.owner);
  if (!owner) throw new Error(`Missing Work owner in ${database}`);
  const records = read(path.join(dir, 'communityGroups.json')).filter(record => record._id !== group.id);
  records.push({ _id: group.id, groupType: group.groupType, ownerUserId: owner.userId, name: group.name,
    description: group.description, imageUrl: null, category: 'work', visibility: 'public', hideMembers: false,
    policy: { workspace: true, enabled: false, requiredFields: [] }, createdAtIso: date, updatedAtIso: date,
    version: 0, moderationStatus: 'accepted', moderationVersion: 0, pendingMembers: 0 });
  const members = read(path.join(dir, 'activityMembers.json')).filter(member => !(member.ownerType === 'community' && member.ownerId === group.id));
  const profileFields = ['name', 'initials', 'age', 'birthday', 'gender', 'city', 'height', 'physique', 'languages', 'horoscope', 'headline', 'about', 'images', 'locationCoordinates', 'partitionKey', 'profileDetails', 'profileStatus', 'status', 'statusText', 'completion', 'profileFormVersion'];
  const adminNames = group.adminIds.map(id => users.find(user => user.userId === id)?.name);
  for (const name of [group.owner, ...group.memberNames, ...adminNames]) {
    const account = byName.get(name);
    if (!account) throw new Error(`Missing Work member ${name}`);
    const memberId = `community:${group.id}:${account.userId}`;
    members.push({ _id: memberId, syncKey: memberId, ownerType: 'community', ownerId: group.id, userId: account.userId,
      role: account === owner || account.userId.startsWith('admin-demo-') ? 'Admin' : 'Member', status: 'accepted',
      requestKind: null, pendingSource: null, invitedByUserId: null, organizerOnly: false, metWhere: group.name,
      metAtIso: date, actionAtIso: date, createdDate: date, updatedDate: date, createdUser: owner.userId, updatedUser: owner.userId });
    const profileId = `group:${group.id}:${account.userId}`;
    users.push({ _id: profileId, userId: profileId, syncKey: profileId, workspaceGroupId: group.id, accountUserId: account.userId,
      ...Object.fromEntries(profileFields.filter(key => account[key] !== undefined).map(key => [key, account[key]])),
      ...(group.adminIds.includes(account.userId) ? { hostTier: 'Admin' } : {}),
      operator: false, activities: { game: 0, chats: 0, invitations: 0, events: 0, hosting: 0 } });
  }
  write(path.join(dir, 'communityGroups.json'), records);
  const campaignTemplates = read(path.join(data, 'work-campaigns.json'));
  const campaignRecords = campaignTemplates.map(({ id, ownerName, ...campaign }) => {
    const owner = users.find(user => user.workspaceGroupId === group.id && user.name === ownerName);
    if (!owner) throw new Error(`Missing campaign owner ${ownerName}`);
    return { _id: id, ...campaign, workspaceGroupId: group.id, ownerUserId: owner.userId, imageUrls: [], attachments: [],
      createdAtIso: '2026-10-01T10:00:00.000Z', updatedAtIso: '2026-10-01T10:00:00.000Z', version: 0 };
  });
  write(path.join(dir, 'campaigns.json'), campaignRecords);
  const activity = read(path.join(data, 'work-activity.json'));
  const workUsers = new Map(users.filter(user => user.workspaceGroupId === group.id).map(user => [user.name, user]));
  const stamp = '2026-10-01T10:00:00.000Z';
  const rates = read(path.join(dir, 'userRates.json')).filter(rate => !rate.campaignId);
  for (const rate of activity.ratings) {
    const from = workUsers.get(rate.from).userId; const to = workUsers.get(rate.to).userId;
    const id = `game-card:${from}:${to}:campaign:${rate.campaignId}`;
    const reciprocal = activity.ratings.find(r => r.campaignId === rate.campaignId && r.from === rate.to && r.to === rate.from)?.rating ?? 0;
    rates.push({ _id: id, syncKey: id, mode: 'single', campaignId: rate.campaignId, ownerUserId: from, relatedUserId: to,
      scoreGiven: rate.rating, scoreReceived: reciprocal, met: false, mutuallyRated: reciprocal > 0,
      affinityScore: (rate.rating + (reciprocal || rate.rating)) / 20, evidenceConfidence: 1,
      createdDate: stamp, updatedDate: stamp, createdUser: from, updatedUser: from });
  }
  const events = read(path.join(dir, 'events.json')).filter(event => !event.sourceId?.startsWith('work-event-'));
  const eventIds = new Set(activity.events.map(event => event.id));
  const rosterRecords = members.filter(member => !(member.ownerType === 'event' && eventIds.has(member.ownerId)));
  for (const template of activity.events) {
    const campaign = campaignRecords.find(c => c._id === template.campaignId);
    const owner = users.find(user => user.userId === campaign.ownerUserId);
    const roster = [owner, ...template.participants.map(name => workUsers.get(name))];
    events.push({ _id: template.id, sourceId: template.id, syncKey: template.id, campaignId: campaign._id,
      workspaceGroupId: group.id, ownerUserId: owner.userId, creatorUserId: owner.userId, organizerUserId: owner.userId,
      admins: [owner.userId], status: 'A', published: true, title: template.title, subtitle: campaign.description,
      creatorName: owner.name, creatorInitials: owner.initials, creatorCity: owner.city, creatorGender: owner.gender,
      startAtIso: template.startAtIso, endAtIso: template.endAtIso, location: owner.city, locationCoordinates: owner.locationCoordinates,
      visibility: 'Invitation only', blindMode: 'Open Event', capacityMin: 1, capacityMax: template.capacity, capacityTotal: template.capacity,
      acceptedMembers: roster.length, acceptedMemberUserIds: roster.map(user => user.userId), pendingMembers: 0,
      pendingMemberUserIds: [], invitedMemberUserIds: [], pendingRequestMemberUserIds: [], autoInviter: false,
      ticketing: false, slotsEnabled: false, subEventsEnabled: false, eventType: 'main', mode: 'Casual',
      imageUrl: '', sourceLink: '', topics: [], subEvents: [], subEventDefinitions: [], activity: 0, unread: 0,
      paymentDeadlineHours: 4, paymentDeadlineEnabled: true, createdDate: stamp, updatedDate: stamp, createdUser: owner.userId, updatedUser: owner.userId });
    for (const user of roster) {
      const id = `event:${template.id}:${user.userId}`;
      rosterRecords.push({ _id: id, syncKey: id, ownerType: 'event', ownerId: template.id, userId: user.userId,
        role: user === owner ? 'Admin' : 'Member', status: 'accepted', organizerOnly: false,
        metAtIso: stamp, actionAtIso: stamp, metWhere: template.title, createdDate: stamp, updatedDate: stamp,
        createdUser: owner.userId, updatedUser: owner.userId });
    }
  }
  // Snapshot counts use the same seeded-date horizon as the versioned demo, not generation time.
  const snapshotAt = Date.parse('2026-10-05T00:00:00.000Z');
  for (const user of workUsers.values()) {
    const upcoming = events.filter(event => event.workspaceGroupId === group.id && Date.parse(event.endAtIso) > snapshotAt
      && event.acceptedMemberUserIds.includes(user.userId));
    const hosting = upcoming.filter(event => event.creatorUserId === user.userId).length;
    const active = upcoming.length - hosting;
    user.activities = { ...user.activities, events: active, hosting, invitations: 0,
      event: { all: upcoming.length, active, hosting, pending: 0, invitations: 0, drafts: 0, watchlist: 0, trash: 0 } };
  }
  write(path.join(dir, 'users.json'), users);
  write(path.join(dir, 'userRates.json'), rates);
  write(path.join(dir, 'events.json'), events);
  write(path.join(dir, 'activityMembers.json'), rosterRecords);

}
// Community shares the established content/configuration synchronization path;
// its private demo workspaces and memberships use the same canonical definitions.
const community = read(path.join(data, 'community-group.json'));
const communityDefinitions = [
  { ...community, category: 'neighbourhood', visibility: 'public', hideMembers: false, requiredFields: [] },
  ...read(path.join(data, 'community-workspaces.json'))
];
const communityIds = new Set(communityDefinitions.map(item => item.id));
for (const database of ['demo_db', 'e2e_db', 'myscoutee_db']) {
  const dir = path.join(mongo, database);
  const communityArticles = read(path.join(data, 'community-articles.json')).map(({ id, ...post }) => ({
    ...post, _id: id, contentKey: id.replace(/-hu$/, ''), languageLabel: post.lang === 'hu' ? 'Magyar' : 'English',
    contentHtml: `${post.contentHtml}\n<figure><img src="${post.imageUrl}" alt="${escapeHtml(post.title)}"></figure>`,
    imageUrls: [post.imageUrl], published: true, trashed: false, trashedAtIso: null, trashedByUserId: null,
    createdDate: '2026-10-05T00:00:00.000Z', createdUser: 'system', updatedDate: '2026-10-05T00:00:00.000Z', updatedUser: 'system'
  }));
  const postFile = path.join(dir, 'ideaPosts.json');
  write(postFile, [...read(postFile).filter(post => post.workspaceGroupId !== community.id), ...communityArticles]);
  const helpFile = path.join(dir, 'helpCenterRevisions.json');
  write(helpFile, [...read(helpFile).filter(row => row.baseGroupId !== community.id), ...read(path.join(data, 'community-help-center.json'))]);
  for (const collection of ['affinityConfigs', 'exchangeRates', 'notificationRuleConfigs', 'emailTemplates', 'notificationTemplates', 'emailCampaignRules']) {
    const file = path.join(dir, `${collection}.json`);
    const rows = read(file).filter(row => (collection === 'affinityConfigs' ? row.key : row.baseGroupId) !== community.id);
    const templates = rows.filter(row => (collection === 'affinityConfigs' ? row.key : row.baseGroupId) === group.id);
    const copies = templates.map(row => {
      const copy = structuredClone(row);
      copy._id = copy._id.replaceAll('myscoutee-work', community.id).replace(/^work([:-])/, 'community$1');
      if (copy.syncKey) copy.syncKey = copy.syncKey.replace(/^work([:-])/, 'community$1');
      if (collection === 'affinityConfigs') copy.key = community.id;
      else copy.baseGroupId = community.id;
      return copy;
    });
    if (collection === 'notificationRuleConfigs') {
      for (const job of read(path.join(data, 'community-job-definitions.json'))) copies.push({
        _id: `community-job:${job.ruleKey}`, syncKey: `community-job:${job.ruleKey}`, baseGroupId: community.id,
        ruleKey: job.ruleKey, label: `admin.jobs.rule.${job.ruleKey}`, category: 'admin.jobs.category.scheduled',
        description: `admin.jobs.rule.${job.ruleKey}.description`, actionKey: job.ruleKey, triggerKind: 'scheduled_process',
        enabled: true, manualRunEnabled: false, adminManageable: true, priority: 270,
        channels: { pushEnabled: false, emailEnabled: false, inAppEnabled: false, supportChatEnabled: false },
        timing: { mode: 'interval', intervalAmount: job.intervalSeconds, intervalUnit: 'seconds', intervalSeconds: job.intervalSeconds, time: '00:00', timezone: 'UTC' },
        scheduleSlots: [], parameters: [], message: {}, runState: {}, runHistory: [],
        createdDate: date, createdUser: 'system', updatedDate: date, updatedUser: 'system'
      });
    }
    write(file, [...rows, ...copies]);
  }
  const groupsFile = path.join(dir, 'communityGroups.json');
  const groups = read(groupsFile).filter(item => !communityIds.has(item._id));
  const production = database === 'myscoutee_db';
  const users = production ? [] : read(path.join(dir, 'users.json')).filter(user => !communityIds.has(user.workspaceGroupId));
  const accounts = new Map(users.filter(user => !user.workspaceGroupId).map(user => [user.name, user]));
  const members = production ? [] : read(path.join(dir, 'activityMembers.json'))
    .filter(member => member.ownerType !== 'community' || !communityIds.has(member.ownerId));
  for (const definition of production ? [communityDefinitions[0]] : communityDefinitions) {
    const owner = production ? { userId: 'system' } : accounts.get(definition.owner);
    if (!owner) throw new Error(`Missing Community owner ${definition.owner}`);
    groups.push({ _id: definition.id, groupType: 'community', ownerUserId: owner.userId,
      name: definition.name, description: definition.description, imageUrl: null, category: definition.category,
      visibility: definition.visibility, hideMembers: definition.hideMembers,
      policy: { workspace: true, enabled: false, requiredFields: definition.requiredFields },
      createdAtIso: date, updatedAtIso: date, version: 0, moderationStatus: 'accepted', moderationVersion: 0, pendingMembers: 0 });
    if (production) continue;
    const extra = definition.members ?? definition.memberNames.map(name => ({ name, status: 'accepted' }));
    const adminNames = (definition.adminIds ?? []).map(id => users.find(user => user.userId === id)?.name);
    const roster = [{ name: definition.owner, role: 'Admin', status: 'accepted', votingEligible: definition.ownerVotingEligible === true }, ...extra,
      ...adminNames.map(name => ({ name, role: 'Admin', status: 'accepted' }))];
    for (const entry of roster) {
      const account = accounts.get(entry.name);
      if (!account) throw new Error(`Missing Community member ${entry.name}`);
      const id = `community:${definition.id}:${account.userId}`;
      members.push({ _id: id, syncKey: id, ownerType: 'community', ownerId: definition.id, userId: account.userId,
        role: entry.role ?? 'Member', status: entry.status, votingEligible: entry.votingEligible === true, requestKind: null, pendingSource: null, invitedByUserId: null,
        organizerOnly: false, metWhere: definition.name, metAtIso: date, actionAtIso: date,
        createdDate: date, updatedDate: date, createdUser: owner.userId, updatedUser: owner.userId });
      const fields = ['name','initials','age','birthday','gender','city','height','physique','languages','horoscope','headline','about',
        'images','locationCoordinates','partitionKey','profileDetails','profileStatus','status','statusText','completion','profileFormVersion'];
      const profileId = `group:${definition.id}:${account.userId}`;
      users.push({ _id: profileId, userId: profileId, syncKey: profileId, workspaceGroupId: definition.id, accountUserId: account.userId,
        ...Object.fromEntries(fields.filter(key => account[key] !== undefined).map(key => [key, account[key]])),
        ...(definition.id === community.id && community.adminIds.includes(account.userId) ? { hostTier: 'Admin' } : {}),
        operator: false, activities: { game: 0, chats: 0, invitations: 0, events: 0, hosting: 0 } });
    }
  }
  write(groupsFile, groups);
  if (!production) { write(path.join(dir, 'users.json'), users); write(path.join(dir, 'activityMembers.json'), members); }
}
for (const database of ['demo_db', 'e2e_db']) {
  const dir = path.join(mongo, database), users = read(path.join(dir, 'users.json'));
  const byName = new Map(users.filter(u => !u.workspaceGroupId).map(u => [u.name, u.userId]));
  const account = name => { const id = byName.get(name); if (!id) throw new Error(`Missing Community actor: ${name}`); return id; };
  const common = { baseGroupId: community.id, createdAtIso: '2026-10-05T00:00:00.000Z', updatedAtIso: '2026-10-05T00:00:00.000Z', version: 0 };
  const cases = read(path.join(data, 'community-cases.json')).map(({ id, ownerName, audienceNames, participantNames, attentionNames, support, memberStatuses, chatNames, boardTasks, offers, ...row }) => ({
    _id: id, ...row, ...common, ownerAccountId: account(ownerName), audienceAccountIds: audienceNames.map(account), participantAccountIds: participantNames.map(account),
    attentionAccountIds: attentionNames.map(account), support: support.map(({ name, ...s }) => ({ ...s, accountId: account(name) })), memberStates: Object.fromEntries(Object.entries(memberStatuses).map(([name,status])=>[account(name),status])),
    chatAccountIds: chatNames.map(account), boardTasks: boardTasks.map(({id,assigneeNames,...task})=>({_id:id,...task,assigneeAccountIds:assigneeNames.map(account)})),
    recommendations: [], offers: offers.map(({id,providerName,...offer})=>({_id:id,...offer,providerAccountId:account(providerName)})), scheduledTaskId: null, dueAtIso: null
  }));
  const tasks = read(path.join(data, 'community-scheduled-tasks.json')).map(({ id, ownerName, audienceNames, ...row }) => ({
    _id: id, ...row, ...common, ownerAccountId: account(ownerName), audienceAccountIds: audienceNames.map(account)
  }));
  write(path.join(dir, 'serviceCases.json'), cases);
  const caseIds = new Set(cases.map(c => c._id));
  const caseChats = cases.flatMap(c => {
    const accepted = c.participantAccountIds.filter(id => c.memberStates[id] === 'accepted');
    const customer = id => !c.support.some(s => s.accountId === id) || c.audienceAccountIds.includes(id) || c.ownerAccountId === id;
    const threads = [{id:`c-case-${c._id}`, title:c.title, caseOfferId:null, accounts:accepted.filter(id=>customer(id)||c.chatAccountIds.includes(id))},
      ...c.offers.map(o=>({id:`c-case-offer-${c._id}-${o._id}`,title:`${c.title} · ${o.amount} ${o.currency}`,caseOfferId:o._id,accounts:accepted.filter(id=>customer(id)||id===o.providerAccountId)}))];
    return threads.flatMap(thread=>{
      const memberIds=thread.accounts.map(id=>`group:${community.id}:${id}`);
      return memberIds.map(ownerUserId=>({_id:`seed:${ownerUserId}:${thread.id}`,id:thread.id,ownerUserId,ownerId:c._id,caseOfferId:thread.caseOfferId,
        channelType:'case',avatar:'C',title:thread.title,memberIds,unread:0,lastMessage:'',lastSenderId:'',dateIso:c.updatedAtIso,revision:1}));
    });
  });
  const chatsFile=path.join(dir,'chats.json');
  write(chatsFile,[...read(chatsFile).filter(chat=>chat.channelType!=='case'||!caseIds.has(chat.ownerId)),...caseChats]);

  write(path.join(dir, 'communityScheduledTasks.json'), tasks);
  const announcements = read(path.join(data, 'community-announcements.json')).map(({ id, authorName, ...a }) => ({ _id: id, ...a, authorAccountId: account(authorName) }));
  write(path.join(dir, 'communityAnnouncements.json'), announcements);
  write(path.join(dir, 'serviceOfferings.json'), read(path.join(data, 'service-offerings.json')).map(({ id, ownerName, staffNames, ...service }) => ({
    _id: id, ...service, baseGroupId: community.id, ownerAccountId: account(ownerName), staffAccountIds: staffNames.map(account) })));
}

// Base guides use the same fields, text and versions as the group catalogs above.
for (const database of ['demo_db', 'e2e_db', 'myscoutee_db']) {
  const file = path.join(mongo, database, 'helpCenterRevisions.json');
  const rows = read(file);
  for (const [context, version] of Object.entries(guideVersions)) for (const lang of ['en','hu']) {
    const previous = rows.filter(row => !row.baseGroupId && row.contextKey === context && row.lang === lang)
      .sort((a,b) => b.version-a.version)[0];
    const source = previous ?? read(path.join(data,'work-help-center.json')).find(row => row.contextKey === context && row.lang === lang);
    if (!source) throw new Error(`Missing guide source: ${context}/${lang}`);
    const id = `explanation-${context.replaceAll('.','-')}-default-${lang}-v${version}`;
    for (const row of rows) if (!row.baseGroupId && row.contextKey === context && row.lang === lang) row.active=false;
    const next = guideRevision(source, context, lang, version, null, id);
    const index=rows.findIndex(row=>row._id===id); if(index<0) rows.push(next); else rows[index]=next;
  }
  write(file,rows);
}
const guideFields = Object.values(read(path.join(data, 'help-center-guide-fields.json'))).flat();
for (const database of ['demo_db', 'e2e_db', 'myscoutee_db']) {
  write(path.join(mongo, database, 'helpCenterGuideFields.json'), guideFields.map(field => ({ _id: `${field.screenKey}--${field.id}`, ...field })));
}

// Payment fixtures share one canonical source with the browser-local ledger.
for(const database of ['demo_db','e2e_db']) {
 const dir=path.join(mongo,database),id=value=>typeof value==='object'?value.$oid:value;
 const users=read(path.join(dir,'users.json')).filter(u=>!u.workspaceGroupId),events=read(path.join(dir,'events.json')),assets=read(path.join(dir,'assets.json'));
 const refs=new Map(users.map(u=>[`user:${u.name}`,id(u._id)]));
 for(const e of events)refs.set(`event:${e.title}`,id(e._id));
 for(const a of assets){const owner=users.find(u=>id(u._id)===a.ownerUserId);if(owner)refs.set(`asset:${owner.name}:${a.title}`,id(a._id));}
 const resolve=value=>Array.isArray(value)?value.map(resolve):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolve(v)])):typeof value==='string'&&/^(user|event|asset):/.test(value)?(refs.get(value)??(()=>{throw new Error(`Missing ${database} payment reference ${value}`)})()):value;
 const source=read(path.join(data,'payment-fixtures.json'));
 const fixtures=resolve(database==='demo_db'?source:{methods:source.methods});
 for(const [key,collection] of (database==='demo_db'?[['methods','savedPaymentMethods'],['payments','payments']]:[['methods','savedPaymentMethods']])){const file=path.join(dir,`${collection}.json`),ids=new Set(fixtures[key].map(row=>row._id));write(file,[...read(file).filter(row=>!ids.has(id(row._id))),...fixtures[key]]);}
}
// Privileged demo inboxes use the same definitions as the local seed builder.
for (const database of ['demo_db', 'e2e_db']) {
  const dir = path.join(mongo, database);
  const users = read(path.join(dir, 'users.json'));
  const settings = read(path.join(dir, 'appSettings.json')).find(row => row._id === 'app-settings-global');
  const admins = new Set(settings?.adminAccessEnabled ? settings.adminEmails ?? [] : []);
  const definitions = read(path.join(data, 'role-notifications.json'));
  const file = path.join(dir, 'userNotifications.json');
  const rows = read(file).filter(row => !row._id.includes(':notification-role-v1:'));
  for (const user of users.filter(row => !row.workspaceGroupId && (row.operator || admins.has(row.email)))) {
    const role = user.operator ? 'operator' : 'admin';
    for (const [index, definition] of definitions.filter(item => item.role === role).entries()) {
      const { role: _role, ...item } = definition;
      const id = `${user.userId}:notification-role-v1:${item.kind}`;
      const at = new Date(Date.parse('2026-07-27T18:30:00.000Z') - index * 60_000).toISOString();
      rows.push({ ...item, _id: id, syncKey: id, recipientUserId: user.userId, readAtIso: null,
        createdDate: at, updatedDate: at, createdUser: 'system', updatedUser: 'system' });
    }
    user.activities = { ...user.activities, notifications: rows.filter(row => row.recipientUserId === user.userId && !row.readAtIso).length };
  }
  write(file, rows);
  write(path.join(dir, 'users.json'), users);
}
flush();
if (stale) process.exitCode = 1;
else console.log(check ? 'Work and Community content and demo seeds are synchronized.' : 'Updated Work and Community content and demo seeds.');
