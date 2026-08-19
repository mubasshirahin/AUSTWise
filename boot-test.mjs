import { writeFileSync } from 'node:fs';
process.argv.push('--vite');
await import('./server/dev.mjs');
setTimeout(() => {
  writeFileSync('boot-marker.txt', 'timeout reached: ' + new Date().toISOString());
  process.exit(0);
}, 12000);