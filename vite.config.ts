import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Deutsch Turbo',
        short_name: 'DeutschTurbo',
        description: 'Professor particular de alemão com IA e voz',
        theme_color: '#081220',
        background_color: '#081220',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(rootDir, './src'),
    },
  },
  server: {
    watch: {
      // Ignora o backend e arquivos de config/ambiente para evitar recarregamentos
      // da página que derrubam a sessão Gemini Live no meio da conversa.
      ignored: [
        '**/server/**',
        '**/.env*',
        '**/package.json',
        '**/tsconfig*.json',
        '**/vite.config.ts',
        '**/node_modules/**',
      ],
    },
  },
});
