import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { ACTIVITIES_DATA_SOURCE } from './shared/activities-data-source';
import { DemoActivitiesDataSourceService } from './shared/demo-activities-data-source.service';
import { HttpActivitiesDataSourceService } from './shared/http-activities-data-source.service';
import { DemoUsersService } from './shared/core/demo/users';
import { HttpUsersService } from './shared/core/http/users';
import { USERS_DATA_SOURCE } from './shared/core/users';

const activitiesDataSourceMode = (environment as { activitiesDataSource?: 'demo' | 'http' }).activitiesDataSource ?? 'demo';
const usersDataSourceMode = environment.loginEnabled ? 'http' : 'demo';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    DemoActivitiesDataSourceService,
    HttpActivitiesDataSourceService,
    DemoUsersService,
    HttpUsersService,
    {
      provide: ACTIVITIES_DATA_SOURCE,
      useFactory: (
        demoSource: DemoActivitiesDataSourceService,
        httpSource: HttpActivitiesDataSourceService
      ) => (activitiesDataSourceMode === 'http' ? httpSource : demoSource),
      deps: [DemoActivitiesDataSourceService, HttpActivitiesDataSourceService]
    },
    {
      provide: USERS_DATA_SOURCE,
      useFactory: (
        demoSource: DemoUsersService,
        httpSource: HttpUsersService
      ) => (usersDataSourceMode === 'http' ? httpSource : demoSource),
      deps: [DemoUsersService, HttpUsersService]
    }
  ]
};
