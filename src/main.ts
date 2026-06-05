import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';
import { appScopedIndexedDbName, removeScopedStorageEntries } from './app/shared/core/base/storage-scope';

type MutableConsole = Console & Record<string, (...args: unknown[]) => void>;

declare global {
  interface Window {
    __myscouteeWarmup?: {
      showNoNetwork?: () => void;
      showFailure?: (title?: string, message?: string) => void;
    };
  }
}

const BOOTSTRAPPED_CLASS = 'app-bootstrapped';
const BOOTSTRAP_RESUME_RELOAD_KEY = 'myscoutee.bootstrap.resume-reload.v1';
const BOOTSTRAP_RESUME_GRACE_MS = 12_000;

const bootstrapStartedAt = Date.now();
let bootstrapSettled = false;

function silenceBrowserConsoleLogs(): void {
  const browserConsole = globalThis.console as MutableConsole | undefined;
  const logMethod = ['lo', 'g'].join('');
  if (!browserConsole || typeof browserConsole[logMethod] !== 'function') {
    return;
  }
  browserConsole[logMethod] = () => undefined;
}

function bindBootstrapResumeRecovery(): void {
  window.addEventListener('pageshow', recoverBootstrapOnResume);
  window.addEventListener('focus', recoverBootstrapOnResume);
  document.addEventListener('visibilitychange', recoverBootstrapOnResume);
}

function unbindBootstrapResumeRecovery(): void {
  window.removeEventListener('pageshow', recoverBootstrapOnResume);
  window.removeEventListener('focus', recoverBootstrapOnResume);
  document.removeEventListener('visibilitychange', recoverBootstrapOnResume);
}

function recoverBootstrapOnResume(): void {
  if (bootstrapSettled || document.visibilityState === 'hidden') {
    return;
  }
  if (Date.now() - bootstrapStartedAt < BOOTSTRAP_RESUME_GRACE_MS) {
    return;
  }
  const attemptKey = `${location.origin}${location.pathname}${location.search}`;
  try {
    if (sessionStorage.getItem(BOOTSTRAP_RESUME_RELOAD_KEY) === attemptKey) {
      return;
    }
    sessionStorage.setItem(BOOTSTRAP_RESUME_RELOAD_KEY, attemptKey);
  } catch {
    return;
  }
  window.location.reload();
}

function clearBootstrapResumeReloadGuard(): void {
  try {
    sessionStorage.removeItem(BOOTSTRAP_RESUME_RELOAD_KEY);
  } catch {
    // A blocked sessionStorage should not keep a healthy bootstrap marked stale.
  }
}

function markBootstrapped(): void {
  bootstrapSettled = true;
  unbindBootstrapResumeRecovery();
  clearBootstrapResumeReloadGuard();
  document.documentElement.classList.add(BOOTSTRAPPED_CLASS);
}

function markBootstrapFailed(err: unknown): void {
  bootstrapSettled = true;
  unbindBootstrapResumeRecovery();
  console.error(err);
  window.__myscouteeWarmup?.showFailure?.(
    'Unable to start',
    'The app could not finish starting. Please check the network and retry.'
  );
}

async function resetDemoStorageBeforeBootstrap(): Promise<void> {
  if (environment.activitiesDataSource !== 'local') {
    return;
  }
  try {
    removeScopedStorageEntries(localStorage, 'demo');
  } catch {
    // A blocked localStorage should not break demo startup.
  }
  try {
    removeScopedStorageEntries(sessionStorage, 'demo');
  } catch {
    // A blocked sessionStorage should not break demo startup.
  }
  if (typeof indexedDB === 'undefined') {
    return;
  }
  await new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(appScopedIndexedDbName('demo'));
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

silenceBrowserConsoleLogs();
bindBootstrapResumeRecovery();

resetDemoStorageBeforeBootstrap()
  .then(() => bootstrapApplication(App, appConfig))
  .then(() => markBootstrapped())
  .catch(err => markBootstrapFailed(err));
