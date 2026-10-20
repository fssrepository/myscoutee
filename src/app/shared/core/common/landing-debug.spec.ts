import { vi } from 'vitest';
import { finishLandingDebug, LandingDebugErrorHandler, markLandingDebug } from './landing-debug';

describe('optional landing debug hooks', () => {
  afterEach(() => { delete window.__myscouteeLandingDebug; vi.restoreAllMocks(); });
  it('leaves disabled deployments without any reporter or state', () => {
    expect(() => { markLandingDebug('login.click'); finishLandingDebug(); }).not.toThrow();
    expect(window.__myscouteeLandingDebug).toBeUndefined();
  });
  it('cannot fail an application action when diagnostics itself fails', () => {
    const fail = () => { throw Error('probe failure'); };
    window.__myscouteeLandingDebug = { mark: fail, error: fail, finish: fail };
    expect(() => { markLandingDebug('login.click'); finishLandingDebug(); }).not.toThrow();
  });
  it('forwards caught Angular errors while retaining normal console reporting', () => {
    const error = new TypeError('application error');
    const report = vi.fn(); const output = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.__myscouteeLandingDebug = { mark: vi.fn(), error: report, finish: vi.fn() };
    new LandingDebugErrorHandler().handleError(error);
    expect(report).toHaveBeenCalledExactlyOnceWith(error); expect(output).toHaveBeenCalled();
  });
});
