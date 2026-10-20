import { ErrorHandler, Injectable } from '@angular/core';

declare global {
  interface Window {
    __myscouteeLandingDebug?: {
      mark(name: string): void;
      error(error: unknown): void;
      finish(): void;
    };
  }
}

// The early HTML recorder owns its memory, deadline and transport. These hooks
// are no-ops unless nginx enabled it for this particular landing document.
export function markLandingDebug(name: string): void {
  try { window.__myscouteeLandingDebug?.mark(name); } catch { /* Diagnostics cannot break the flow. */ }
}

export function finishLandingDebug(): void {
  try { window.__myscouteeLandingDebug?.finish(); } catch { /* Best effort. */ }
}

@Injectable()
export class LandingDebugErrorHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    try { window.__myscouteeLandingDebug?.error(error); } catch { /* Keep Angular's normal reporting. */ }
    super.handleError(error);
  }
}
