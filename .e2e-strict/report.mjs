import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const project = resolve(root, '..');
const runs = resolve(root, 'runs');
const reports = existsSync(runs) ? readdirSync(runs, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => resolve(runs, entry.name, 'html'))
  .filter(folder => existsSync(resolve(folder, 'index.html')))
  .sort((a, b) => statSync(resolve(b, 'index.html')).mtimeMs - statSync(resolve(a, 'index.html')).mtimeMs) : [];

if (!reports.length) {
  console.error('尚无测试报告，请先执行 make run 或 make headed。');
  process.exit(2);
}

const require = createRequire(resolve(project, 'package.json'));
const cli = resolve(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
const child = spawnSync(process.execPath, [cli, 'show-report', reports[0], '--host', '127.0.0.1'], {
  cwd: project, stdio: 'inherit',
});
process.exitCode = Number.isInteger(child.status) ? child.status : 1;
