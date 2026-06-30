import { test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const project_root = path.join(import.meta.dir, '..');
const jest_bin = path.join(project_root, 'node_modules', '.bin', 'jest');

test('jest suite', () => {
  const result = spawnSync(jest_bin, [], {
    cwd: project_root,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  expect(result.status).toBe(0);
});
