import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => document.documentElement.classList.add('app-bootstrapped'))
  .catch((err) => console.error(err));
