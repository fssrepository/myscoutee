import assert from 'node:assert/strict';
import { compiledDevModules } from './compiled-dev-modules.mjs';

// Read the existing watcher output; no compiler, browser or fixture changes.
assert.ok(process.argv[2], 'Pass the current dev output directory');
const compiled = compiledDevModules(process.argv[2]);
const SmartList = await compiled.symbol('SmartListComponent');
const list = Object.create(SmartList.prototype);
list.items = [{ id: 'first' }, { id: 'second' }];
list.groups = [{ label: 'First', startIndex: 0 }, { label: 'Second', startIndex: 1 }];
list.currentQuery = () => ({ view: 'list' });
const surface = { scrollHeight: 500, clientHeight: 700, scrollTop: 0 };
const markers = () => list.groups.map((group, index) => list.shouldShowGroupMarker(group, index));

for (const layout of ['card-grid', 'stack']) {
  list.config = { listLayout: layout, snapMode: 'mandatory', showFirstGroupMarker: true };
  surface.clientHeight = 700;
  list.updateScrollProgress(surface);
  assert.equal(list.shouldShowStickyHeader(), true);
  assert.deepEqual(markers(), [false, true], `${layout}: no duplicate below the sticky header`);
  surface.clientHeight = 300;
  list.updateScrollProgress(surface);
  assert.deepEqual(markers(), [true, true], `${layout}: first marker returns when scrollable`);
  surface.clientHeight = 700;
  list.updateScrollProgress(surface);
  assert.deepEqual(markers(), [false, true], `${layout}: resizing back restores the same rule`);
}

list.config.showStickyHeader = false;
assert.deepEqual(markers(), [true, true], 'Without a sticky header, do not lose the first group label');
list.config = { showStickyHeader: true, showGroupMarker: () => false };
assert.deepEqual(markers(), [false, false], 'Explicit ungrouped surfaces remain ungrouped');
list.config = { showGroupMarker: ({ groupIndex }) => groupIndex > 0 };
surface.clientHeight = 300;
list.updateScrollProgress(surface);
assert.deepEqual(markers(), [false, true], 'Activity chat keeps its existing first-marker exception');

// Snap targeting belongs to the list's owned shells, regardless of card names.
const childList = {};
const row = { kind: 'single-row', closest: () => root };
const event = { kind: 'activity-event', closest: () => root };
const nested = { kind: 'nested-row', closest: () => childList };
const root = { querySelectorAll: selector => {
  assert.equal(selector, '.smart-list__item-shell[data-smart-list-index]');
  return [row, event, nested];
} };
assert.deepEqual(list.listCardSnapTargets(root), [row, event]);
console.log('PASS shared group markers: desktop/mobile/desktop transitions; sticky retained; no-sticky and explicit exceptions preserved; generic owned snap targets.');
