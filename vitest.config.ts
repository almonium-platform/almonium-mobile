import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Lets the tested `src/` modules import `@/src/...` the way the app code does. */
export default defineConfig({
  resolve: { alias: { '@': dirname(fileURLToPath(import.meta.url)) } },
});
