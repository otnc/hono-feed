import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'middleware/index': 'src/middleware/index.ts',
    'formats/rss': 'src/formats/rss/index.ts',
    'formats/atom': 'src/formats/atom/index.ts',
    'formats/json': 'src/formats/json.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  // Support 'Edge'
  platform: 'neutral',
  // peer dependency
  external: ['hono'],
})
