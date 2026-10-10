import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

export function loadLocalEnvironment() {
  if (!existsSync('.env')) return;
  loadEnvFile('.env');
}
