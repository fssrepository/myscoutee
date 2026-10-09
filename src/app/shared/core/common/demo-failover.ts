import { reportBackendReadiness } from './backend-connectivity';
import { environment } from '../../../../environments/environment';

// Resolve before importing App: storage keys and adapters
// must see the same environment for the whole lifetime of one page.
const FAILOVER_KEY = 'myscoutee.demo.failover';
const HTTP_SESSION = 'myscoutee.http.session.v1';
const LOCAL_SESSION = 'myscoutee.demo.session.v1';
const LOCAL_ACTOR = 'myscoutee.demo.demo.active-user.v1';
const LOCAL_SESSION_BEFORE = `${FAILOVER_KEY}.local-session-before`;
const PAIR_KEY = `${FAILOVER_KEY}.pair`;
const API_BASE = environment.apiBaseUrl ?? '/api';
let enabled = false;
let local = false;
let checking = false;
let started = false;
let statusEvents: EventSource | null = null;
let streamReady = false;
let streamDeadline: ReturnType<typeof setTimeout> | undefined;
let writes = 0;
let idsPromise: Promise<Map<string, string>> | null = null;

interface DemoSession { kind: 'demo'; userId: string; sessionId?: string; supportContext?: unknown; }
interface DemoPair { http: string; local: string; }

function readSession(key: string): DemoSession | null {
  try {
    const session = JSON.parse(localStorage.getItem(key) || 'null');
    return session?.kind === 'demo' && !session.supportContext && typeof session.userId === 'string'
      ? session : null;
  } catch { return null; }
}

export function demoSeedUserIds(): Promise<Map<string, string>> {
  // Canonical Mongo seed conversion: SHA-1("users:uN").slice(0, 24).
  // This maps public demo identities; it is not authentication or a signature.
  return idsPromise ??= Promise.all(Array.from({ length: 50 }, async (_, index) => {
    const id = `u${index + 1}`;
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`users:${id}`));
    const httpId = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
    return [httpId, id] as const;
  })).then(entries => new Map(entries));
}

function eligibleSession(): DemoSession | null {
  // Never substitute synthetic data for Firebase, operator or support sessions.
  return readSession(HTTP_SESSION);
}

async function backendReachable(): Promise<boolean> {
  if (statusEvents) return streamReady;
  try {
    const url = new URL(`${API_BASE.replace(/\/$/, '')}/runtime-status`, document.baseURI);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(1000) });
    const status = response.ok ? await response.json() : null;
    const serverTime = Date.parse(response.headers.get('Date') ?? '');
    const reachable = readyStatus(status, Number.isFinite(serverTime) ? serverTime : Date.now());
    reportBackendReadiness(reachable);
    return reachable;
  } catch { reportBackendReadiness(false); return false; }
}

function readyStatus(status: { ready?: unknown; checkedAt?: unknown } | null, now: number): boolean {
  const age = now / 1000 - Number(status?.checkedAt);
  return status?.ready === true && Number.isFinite(age) && age >= -5 && age <= 10;
}

function initialBackendReady(): boolean {
  // Nginx embeds the same snapshot served by the poll endpoint in the HTML head.
  // No startup fetch/timer: absent, stale or unprocessed static HTML is not green.
  let ready = false;
  try {
    ready = navigator.onLine !== false
      && readyStatus(JSON.parse(document.getElementById('myscoutee-runtime-status')?.textContent ?? ''), Date.now());
  } catch { /* Native GitHub builds skip this entire HTTP startup path. */ }
  reportBackendReadiness(ready);
  return ready;
}

function isLandingPage(): boolean {
  const base = new URL(document.baseURI).pathname.replace(/\/$/, '');
  const path = location.pathname.replace(/\/$/, '');
  return path === base || path === `${base}/entry`;
}

function anonymousLanding(): boolean {
  // A retained real/operator/support session must never become a synthetic actor.
  return isLandingPage() && localStorage.getItem(HTTP_SESSION) === null;
}

function useLocalAdapters(): void {
  local = true;
  Object.assign(environment, { activitiesDataSource: 'local', operatorRegistryDataSource: 'local',
    firebaseLoginEnabled: false,
    firebaseMessagingEnabled: false, paymentIntegrationEnabled: false, paymentSimulatorConfigUrl: null });
}

function safeToSwitch(): boolean {
  const path = location.pathname.replace(/\/$/, '');
  return (path === '/game' || isLandingPage())
    && document.visibilityState === 'visible' && writes === 0
    && !document.querySelector('.ui-popup')
    && !document.activeElement?.matches('input,textarea,[contenteditable="true"]');
}

function restoreLocalSession(): void {
  const before = localStorage.getItem(LOCAL_SESSION_BEFORE);
  if (before === null) return;
  const saved = JSON.parse(before) as { session: string | null; actor: string | null };
  for (const [key, value] of [[LOCAL_SESSION, saved.session], [LOCAL_ACTOR, saved.actor]]) {
    if (value === null) localStorage.removeItem(key!);
    else localStorage.setItem(key!, value!);
  }
  localStorage.removeItem(LOCAL_SESSION_BEFORE);
  localStorage.removeItem(PAIR_KEY);
}

export async function prepareDemoFailover(): Promise<void> {
  if (environment.activitiesDataSource !== 'http') return;
  enabled = true;
  local = false;
  if (anonymousLanding()) {
    restoreLocalSession();
    if (!initialBackendReady()) useLocalAdapters();
    return;
  }
  const session = eligibleSession();
  const localId = session && (await demoSeedUserIds()).get(session.userId);
  if (!session || !localId) { restoreLocalSession(); return; }
  if (initialBackendReady()) { restoreLocalSession(); return; }

  let previousPair = localStorage.getItem(PAIR_KEY);
  if (previousPair && JSON.parse(previousPair).http !== session.userId) {
    restoreLocalSession();
    previousPair = null;
  }
  const pair: DemoPair = { http: session.userId, local: localId };
  // An explicit logout in the local demo must not immediately log it back in.
  if (previousPair && readSession(LOCAL_SESSION)?.userId !== localId) {
    enabled = false;
    localStorage.removeItem(HTTP_SESSION);
    restoreLocalSession();
    return;
  }
  if (!localStorage.getItem(LOCAL_SESSION_BEFORE)) {
    localStorage.setItem(LOCAL_SESSION_BEFORE, JSON.stringify({
      session: localStorage.getItem(LOCAL_SESSION), actor: localStorage.getItem(LOCAL_ACTOR)
    }));
  }
  localStorage.setItem(PAIR_KEY, JSON.stringify(pair));
  if (!previousPair) {
    localStorage.setItem(LOCAL_SESSION, JSON.stringify({ kind: 'demo', userId: localId,
      sessionId: `session:${crypto.randomUUID()}` }));
    localStorage.setItem(LOCAL_ACTOR, localId);
  }
  useLocalAdapters();
}

export function demoFailoverEnabled(): boolean { return enabled; }
export function demoFailoverSeedWarmupNeeded(): boolean {
  return enabled && !local && eligibleSession() !== null;
}

export function demoFailoverLocalUser(): string | null {
  return enabled && local && eligibleSession() ? readSession(LOCAL_SESSION)?.userId ?? null : null;
}

export function trackDemoWrite(start: boolean): void {
  if (enabled) writes = Math.max(0, writes + (start ? 1 : -1));
}

export async function checkDemoFailover(): Promise<void> {
  if (!enabled || checking || document.visibilityState !== 'visible') return;
  checking = true;
  try {
    if (anonymousLanding()) {
      const reachable = await backendReachable();
      // Change adapters only at a fresh bootstrap, preserving their storage scopes.
      // An open form/popup defers the reload; the next poll retries after it closes.
      if (reachable === local && safeToSwitch()) location.reload();
      return;
    }
    const session = eligibleSession();
    if (!session || !(await demoSeedUserIds()).has(session.userId)) return;
    if (local) {
      const pair = JSON.parse(localStorage.getItem(PAIR_KEY) || 'null') as DemoPair | null;
      if (pair?.http !== session.userId || readSession(LOCAL_SESSION)?.userId !== pair.local) return;
    }
    const reachable = await backendReachable();
    if (!local && !reachable && safeToSwitch() && eligibleSession()?.userId === session.userId) {
      location.reload();
    }
  } finally { checking = false; }
}

export function startDemoFailover(): void {
  if (!enabled || started) return;
  started = true;
  streamReady = initialBackendReady();
  const url = new URL(`${API_BASE.replace(/\/$/, '')}/runtime-status/events`, document.baseURI);
  const connect = (): void => {
    const events = new EventSource(url.href);
    statusEvents = events;
    const setReady = (ready: boolean): void => {
      const changed = streamReady !== ready;
      streamReady = ready;
      reportBackendReadiness(ready);
      if (changed) void checkDemoFailover();
    };
    const armDeadline = (): void => {
      clearTimeout(streamDeadline);
      streamDeadline = setTimeout(() => {
        events.close();
        setReady(false);
        connect();
      }, 45000);
    };
    const receive = (event: MessageEvent): void => {
      try {
        const value = JSON.parse(event.data);
        if (typeof value.ready !== 'boolean' || typeof value.known !== 'boolean') throw new Error('Invalid runtime status');
        armDeadline();
        setReady(value.known && value.ready);
      } catch { setReady(false); }
    };
    events.addEventListener('status', receive as EventListener);
    events.addEventListener('ping', receive as EventListener);
    events.onerror = () => setReady(false);
    armDeadline();
  };
  connect();
  window.addEventListener('pagehide', () => { statusEvents?.close(); clearTimeout(streamDeadline); });
  window.addEventListener('pageshow', event => { if (event.persisted) connect(); });
  window.addEventListener('online', () => void checkDemoFailover());
  window.addEventListener('offline', () => void checkDemoFailover());
  window.addEventListener('focus', () => void checkDemoFailover());
  document.addEventListener('visibilitychange', () => void checkDemoFailover());
  // This timer retries only local safe-to-switch decisions (e.g. a closed popup);
  // status comes from SSE, with no periodic HTTP status fetch.
  // The landing recovers in both directions. Active demo sessions keep the
  // existing recovery-on-natural-reload rule, so edits are never discarded.
  const schedule = (): void => {
    window.setTimeout(() => void checkDemoFailover().finally(schedule), 10000);
  };
  schedule();
}
