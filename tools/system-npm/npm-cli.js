#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { execPath, platform } from 'node:process';

const npm = join(dirname(execPath), platform === 'win32' ? 'npm.cmd' : 'npm');
const child = spawn(npm, process.argv.slice(2), {
  stdio: 'inherit',
  shell: platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
