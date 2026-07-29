import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { HttpOperatorBootstrapAuthService } from './operator-bootstrap-auth.service';

describe('HttpOperatorBootstrapAuthService', () => {
  const post = vi.fn();

  beforeEach(() => {
    post.mockReset();
    TestBed.configureTestingModule({
      providers: [
        HttpOperatorBootstrapAuthService,
        { provide: HttpClient, useValue: { post } }
      ]
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('posts the installer credential only to the operator bootstrap endpoint', async () => {
    post.mockReturnValue(of({
      tokenType: 'OperatorBootstrap',
      accessToken: 'signed-token',
      email: 'operator@example.test',
      expiresAt: '2099-07-29T12:00:00Z'
    }));

    await expect(TestBed.inject(HttpOperatorBootstrapAuthService).signIn({
      email: 'operator@example.test',
      password: 'installer-password'
    })).resolves.toEqual({
      tokenType: 'OperatorBootstrap',
      accessToken: 'signed-token',
      email: 'operator@example.test',
      expiresAt: '2099-07-29T12:00:00Z'
    });

    expect(post).toHaveBeenCalledWith(
      `${(environment.apiBaseUrl ?? '/api').replace(/\/+$/, '')}/auth/operator-bootstrap`,
      {
        email: 'operator@example.test',
        password: 'installer-password'
      }
    );
  });

  it('rejects a malformed bootstrap token response', async () => {
    post.mockReturnValue(of({
      tokenType: 'Bearer',
      accessToken: '',
      email: 'operator@example.test',
      expiresAt: 'invalid'
    }));

    await expect(TestBed.inject(HttpOperatorBootstrapAuthService).signIn({
      email: 'operator@example.test',
      password: 'installer-password'
    })).rejects.toThrow('operator.bootstrap.auth.response.invalid');
  });
});
