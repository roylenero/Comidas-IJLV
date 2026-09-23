import { defineConfig } from 'vitest/config';

// Pruebas de reglas de Firestore. Requieren el emulador (npm run test:rules lo levanta).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
