import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import pkg from './package.json';

export default defineConfig({ plugins: [react(), tailwindcss()], define: { __APP_VERSION__: JSON.stringify(pkg.version) }, server: { host: '127.0.0.1', port: 1420, strictPort: true }, clearScreen: false });
