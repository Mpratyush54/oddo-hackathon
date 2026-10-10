import { spawn } from 'node:child_process';
const processes = [
  spawn(
    process.execPath,
    [process.argv.includes('--demo') ? 'backend/demo/api.js' : 'backend/src/entrypoints/local.js'],
    { stdio: 'inherit' },
  ),
  spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      '--config',
      'frontend/vite.config.ts',
      '--host',
      '127.0.0.1',
      '--port',
      '5174',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_BACKEND_MODE: process.argv.includes('--demo') ? 'demo' : 'aws',
        VITE_API_URL: '/api',
      },
    },
  ),
];
const close = () => {
  for (const child of processes) child.kill();
};
process.on('SIGINT', () => {
  close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  close();
  process.exit(0);
});
process.on('exit', close);
for (const child of processes)
  child.on('error', (error) => {
    console.error(error.message);
    close();
    process.exit(1);
  });
