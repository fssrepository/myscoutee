import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../../environments/environment';
import { HttpAdminWorkspaceService } from '../../http/services/admin-workspace.service';
import { LocalAdminWorkspaceService } from '../../local/source/services/admin-workspace.service';
import { ShareTokensService } from './share-tokens.service';
import { UsersService } from './users.service';
import { AdminWorkspaceDataService } from './admin-workspace-data.service';

describe('AdminWorkspaceDataService route boundary', () => {
  const originalActivitiesDataSource = environment.activitiesDataSource;
  const originalFirebaseLoginEnabled = environment.firebaseLoginEnabled;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminWorkspaceDataService,
        { provide: HttpAdminWorkspaceService, useValue: {} },
        { provide: LocalAdminWorkspaceService, useValue: {} },
        { provide: ShareTokensService, useValue: {} },
        { provide: UsersService, useValue: {} }
      ]
    });
  });

  afterEach(() => {
    environment.activitiesDataSource = originalActivitiesDataSource;
    environment.firebaseLoginEnabled = originalFirebaseLoginEnabled;
    TestBed.resetTestingModule();
  });

  it('uses the Java-backed admin workspace in every HTTP selector build', () => {
    environment.activitiesDataSource = 'http';
    environment.firebaseLoginEnabled = false;

    const service = TestBed.inject(AdminWorkspaceDataService);

    expect(service.shouldUseLocalAdminHelpSession).toBe(false);
  });

  it('keeps selector preparation browser-local only in an explicit local build', () => {
    environment.activitiesDataSource = 'local';
    environment.firebaseLoginEnabled = true;

    const service = TestBed.inject(AdminWorkspaceDataService);

    expect(service.shouldUseLocalAdminHelpSession).toBe(true);
  });
});
