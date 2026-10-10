import { spawn } from 'node:child_process';
const processes = [
  spawn(process.execPath, ['server/api.mjs'], { stdio: 'inherit' }),
  spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174'],
    { stdio: 'inherit' },
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
