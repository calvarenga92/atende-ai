import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // 5173 é a origem que a API libera por padrão (CORS_ORIGENS).
  server: { port: 5173, strictPort: true },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/teste/preparar.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
