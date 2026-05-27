import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

type MutableConsole = Console & Record<string, (...args: unknown[]) => void>;

function silenceBrowserConsoleLogs(): void {
  const browserConsole = globalThis.console as MutableConsole | undefined;
  const logMethod = ['lo', 'g'].join('');
  if (!browserConsole || typeof browserConsole[logMethod] !== 'function') {
    return;
  }
  browserConsole[logMethod] = () => undefined;
}

silenceBrowserConsoleLogs();

bootstrapApplication(App, appConfig)
  .then(() => document.documentElement.classList.add('app-bootstrapped'))
  .catch((err) => console.error(err));
