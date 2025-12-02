import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared/config': path.resolve(__dirname, '../../shared/config/src/index.ts'),
      '@shared/utils': path.resolve(__dirname, '../../shared/utils/src/index.ts'),
      '@shared/types': path.resolve(__dirname, '../../shared/types/src/index.ts'),
      '@shared/eventbus': path.resolve(__dirname, '../../shared/eventbus/src/index.ts'),
      '@shared/middleware': path.resolve(__dirname, '../../shared/middleware/src/index.ts'),
      '@shared/db/schema': path.resolve(__dirname, '../../shared/db/src/schema.ts'),
      '@factories/src': path.resolve(__dirname, '../../factories/src/index.ts'),
      '@factories/src/index.js': path.resolve(__dirname, '../../factories/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/**/__tests__/**/*.ts'],
    globals: true,
    coverage: {
      enabled: false,
    },
  },
})