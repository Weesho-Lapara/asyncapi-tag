import { defineConfig } from 'vitest/config';

// Library build: one ES module and one self-contained IIFE file, both bundling Lit.
// The Python package copies these into src/asyncapi_viewer/static/ at build time.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'AsyncAPIViewer',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'asyncapi-viewer.js' : 'asyncapi-viewer.iife.js'),
    },
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
