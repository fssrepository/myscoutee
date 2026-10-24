// Local tests delegate to the shared nginx browser implementation.
process.env.MYSCOUTEE_FRONTEND_ROOT = new URL('../', import.meta.url).pathname;
await import('../../nginx/browser/landing-debug.test.mjs');
