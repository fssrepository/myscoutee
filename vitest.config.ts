import { defineConfig } from 'vitest/config';

// Firebase mocks and page-bootstrap module state must not leak across spec files.
export default defineConfig({ test: { isolate: true, maxWorkers: 4 } });
