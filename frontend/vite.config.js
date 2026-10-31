import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gatewayTarget = env.VITE_API_GATEWAY_TARGET || 'http://localhost:3000';

  return {
    plugins: [react()],
    server: {
      host: 'localhost',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: gatewayTarget,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
