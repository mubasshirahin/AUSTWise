import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({ root: path.resolve(__dirname, '..'), plugins: [react()], resolve: { alias: [
  { find: /^.*\/context\/AuthContext(\.jsx)?$/, replacement: path.resolve(__dirname, 'AuthMock.jsx') },
  { find: /^.*\/context\/RoutineContext(\.jsx)?$/, replacement: path.resolve(__dirname, 'RoutineMock.jsx') },
  { find: /^.*\/utils\/liveStore(\.js)?$/, replacement: path.resolve(__dirname, 'LiveMock.jsx') },
] }, server: { port: 5201, strictPort: true } });
