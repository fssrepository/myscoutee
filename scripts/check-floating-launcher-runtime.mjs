import assert from 'node:assert/strict';
import { compiledDevModules } from './compiled-dev-modules.mjs';

// Geometry regression checks against the running watcher's AOT output. No
// compiler or browser is started; rectangles and visibility are test inputs.
assert.ok(process.argv[2], 'Pass the existing dev output directory');
const compiled = compiledDevModules(process.argv[2]);
const [FloatingLauncherComponent, signal, runInInjectionContext] = await Promise.all(
  ['FloatingLauncherComponent', 'signal', 'runInInjectionContext'].map(compiled.symbol));
// The bundler keeps the registry private to the launcher's chunk. Capture its
// real DI token without adding a production export solely for this check.
let FloatingLauncherRegistry;
const captured = new Error('registry captured');
assert.throws(() => runInInjectionContext({ get(token, fallback) {
  if (token.name.replace(/^_/, '') === 'FloatingLauncherRegistry') {
    FloatingLauncherRegistry = token; throw captured;
  }
  if (token.name === 'ElementRef') return { nativeElement: {} };
  if (fallback !== undefined) return fallback;
  throw new Error('Unexpected provider ' + token.name);
} }, () => new FloatingLauncherComponent()), error => error === captured);
globalThis.Node = { DOCUMENT_POSITION_FOLLOWING: 4 };
const box = (top, left = 320, height = 42, width = 42) => ({ top, bottom: top + height, left, right: left + width, height, width });

function fixture({ width = 390, height = 844, top = 700, peers = [box(700)], rates = false, fullscreen = false, frozen = false, controls = [] } = {}) {
  const registry = new FloatingLauncherRegistry(), counts = { scans: 0, selectors: 0, rectangles: 0, hitTests: 0, writes: 0 };
  const viewport = { innerWidth: width, innerHeight: height, getComputedStyle: element => ({ visibility: element.hidden ? 'hidden' : 'visible' }) };
  const rail = { getBoundingClientRect: () => { counts.rectangles++; return { bottom: 800 }; } };
  const panel = { getBoundingClientRect: () => { counts.rectangles++; return { bottom: 806 }; }, closest: () => fullscreen ? {} : null };
  const document = { defaultView: viewport,
    querySelector: selector => { counts.selectors++; return selector.startsWith('.explanation-guide-overlay') ? (frozen ? {} : null) : (rates ? panel : null); },
    querySelectorAll: selector => { counts.scans++; assert.ok(!selector.includes('app-floating-launcher'), 'Never scan the document for peers'); return controls; },
    elementFromPoint: () => { counts.hitTests++; return controls[0] ?? null; }
  };
  const host = { ownerDocument: document, isConnected: true, order: 0, closest: () => rail,
    compareDocumentPosition: other => other.order > 0 ? 4 : 2 };
  const component = Object.create(FloatingLauncherComponent.prototype);
  const lift = signal(0), originalSet = lift.set;
  lift.set = value => { counts.writes++; originalSet(value); };
  const menu = { getBoundingClientRect: () => { counts.rectangles++; return box(top + component.position.y - lift(), 320 + component.position.x); } };
  Object.assign(component, { host: { nativeElement: host }, menu: { nativeElement: menu }, launchers: registry,
    lift, dragging: signal(false), targeted: signal(false), ratingPanelAnchor: false, position: { x: 0, y: 0 },
    positionChange: { emit: position => { component.position = position; } }, dismissed: { emit: () => {} } });
  const remove = peers.map((peer, index) => registry.register({ ownerDocument: document, isConnected: true, order: index + 1 },
    () => ({ hidden: peer.hidden, getBoundingClientRect: () => { counts.rectangles++; return peer; } })));
  return { component, counts, remove, registry, host, viewport, renderedTop: () => menu.getBoundingClientRect().top,
    check: () => component.avoidActions() };
}

for (const options of [{ width: 1280 }, {}, { rates: true }]) {
  const f = fixture(options); f.check();
  assert.equal(f.renderedTop(), 650);
  for (let i = 0; i < 20; i++) f.check();
  assert.equal(f.counts.writes, 1, 'Repeated layout must settle without a signal feedback loop');
  if (options.width === 1280 || options.rates) assert.equal(f.counts.scans, 0);
  f.remove[0](); f.check();
  assert.equal(f.renderedTop(), options.rates ? 650 : 700, 'Removal restores the appropriate user/panel anchor');
}
console.log('PASS desktop/mobile peer clearance, settled updates and unregister cleanup');

for (const peer of [{ ...box(700), hidden: true }, box(700, 320, 0), box(700, 40)]) {
  const f = fixture({ width: 1280, peers: [peer] }); f.check(); assert.equal(f.renderedTop(), 700);
}
const order = fixture({ peers: [] });
order.registry.register({ ownerDocument: order.host.ownerDocument, isConnected: true, order: -1 }, () => ({ getBoundingClientRect: () => assert.fail('Earlier launcher must not push a later launcher') }));
order.registry.register({ ownerDocument: order.host.ownerDocument, isConnected: false, order: 2 }, () => assert.fail('Disconnected host must not be read'));
order.check(); assert.equal(order.renderedTop(), 700);
console.log('PASS hidden/empty/horizontally separate peers, DOM priority and disconnected hosts');

const edge = fixture({ width: 1280, top: 12, peers: [box(12)] }); edge.check(); assert.equal(edge.renderedTop(), 62);
const crowded = fixture({ width: 1280, height: 300, top: 110, peers: [box(110), box(20, 320, 60)] });
crowded.check(); assert.equal(crowded.renderedTop(), 160, 'Downward fallback must clear the lower obstacle as well');
console.log('PASS top edge and multiple-obstacle fallback without re-entering an earlier obstacle');

for (const fullscreen of [false, true]) {
  const f = fixture({ rates: true, fullscreen, peers: [] });
  f.check(); assert.equal(f.renderedTop(), fullscreen ? 610 : 650);
  const writes = f.counts.writes, before = f.counts.rectangles;
  for (let frame = 0; frame < 200; frame++) f.check();
  assert.equal(f.counts.writes, writes, 'Rates scroll must not move the stable launcher');
  assert.equal(f.counts.scans, 0, 'Rates must not enumerate Save/eye controls or launchers');
  assert.equal(f.counts.hitTests, 0, 'Rates must not hit-test scrolling card controls');
  assert.equal(f.counts.rectangles - before, 600, 'Exactly menu, rail and panel reads per recheck, independent of card count');
}
const ratesOverlap = fixture({ rates: true, peers: [box(650)] }); ratesOverlap.check();
assert.equal(ratesOverlap.renderedTop(), 600, 'Panel anchoring must not skip peer clearance');
assert.equal(ratesOverlap.counts.scans, 0);
console.log('PASS Rates 56/96px anchors and 400 scroll rechecks: no DOM enumeration, card hit-tests or repeated writes');

const guide = fixture({ frozen: true }); guide.check(); assert.equal(guide.renderedTop(), 650);
guide.check(); assert.equal(guide.counts.writes, 1); assert.equal(guide.counts.scans, 0);
const drag = fixture({ width: 1280 }); drag.component.dragging.set(true); drag.check(); assert.equal(drag.counts.rectangles, 0);
drag.component.dragging.set(false); drag.check();
drag.component.drag({ phase: 'end', moved: true, centerX: 0, centerY: 0 });
assert.equal(drag.renderedTop(), 650, 'Release keeps the visible clearance in the user drag offset');
drag.component.move({ x: -200, y: -50 }); drag.check(); assert.equal(drag.renderedTop(), 650);
console.log('PASS open-guide peer clearance and drag/release continuity');

// Deterministic generated interval cases: if any vertical slot exists, the
// returned position must fit and clear every obstacle, including nested boxes.
let seed = 117;
const random = max => (seed = (seed * 1664525 + 1013904223) >>> 0) % max;
const solver = Object.create(FloatingLauncherComponent.prototype);
for (let test = 0; test < 1500; test++) {
  const height = 25 + random(35), viewportHeight = 180 + random(700), maxTop = viewportHeight - height - 8;
  const obstacles = Array.from({ length: random(9) }, () => ({ box: box(random(viewportHeight + 100) - 50, 320, 20 + random(130)) }));
  const preferred = random(viewportHeight + 100) - 50;
  const clear = top => top >= 8 && top <= maxTop && obstacles.every(({ box }) => top + height + 8 <= box.top || top - 8 >= box.bottom);
  const candidates = [8, maxTop, ...obstacles.flatMap(({ box }) => [box.top - 8 - height, box.bottom + 8])];
  const result = solver.clearanceTop(preferred, height, maxTop, [...obstacles], () => true);
  if (candidates.some(clear)) assert.ok(clear(result), JSON.stringify({ preferred, height, maxTop, obstacles, result }));
}
console.log('PASS 1500 deterministic multi-obstacle cases: clear bounded placement whenever a vertical slot exists');
