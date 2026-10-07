import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = fileURLToPath(new URL('.', import.meta.url));
const project = resolve(root, '..');
const specs = process.argv.slice(2);
if (specs.some(value => value.startsWith('-'))) {
  console.error('严格入口只接受保存的 spec 文件路径。');
  process.exit(2);
}
const runDir = resolve(root, 'runs', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(runDir, { recursive: true });
function fingerprints(folder = root, prefix = '') {
  const entries = readdirSync(folder, { withFileTypes: true }).filter(item => item.name !== 'runs');
  return Object.fromEntries(entries.flatMap(item => {
    const relative = `${prefix}${item.name}`;
    if (item.isDirectory()) return Object.entries(fingerprints(resolve(folder, item.name), `${relative}/`));
    if (!item.isFile() || (item.name !== 'Makefile' && !/\.(?:mjs|js|ts|json|md)$/.test(item.name))) return [];
    return [[relative, createHash('sha256').update(readFileSync(resolve(folder, item.name))).digest('hex')]];
  }).sort(([a], [b]) => a.localeCompare(b)));
}
const before = fingerprints();
let cli;
try {
  const require = createRequire(resolve(project, 'package.json'));
  cli = resolve(dirname(require.resolve('@playwright/test/package.json')), 'cli.js');
} catch {
  console.error('当前项目缺少 @playwright/test；未执行测试。');
  process.exit(2);
}
const started = performance.now();
const child = spawnSync(process.execPath, [cli, 'test', '--config', resolve(root, 'playwright.config.mjs'),
  '--workers=1', '--retries=0', '--max-failures=0',
  ...(process.env.E2E_STRICT_HEADED === '1' ? ['--headed'] : []), ...specs], {
  cwd: project, env: { ...process.env, E2E_STRICT_RUN_DIR: runDir },
  encoding: 'utf8', timeout: 300_000, maxBuffer: 8 * 1024 * 1024,
});
// 不回显 runner 任意文本；原始启动日志可能敏感，仅留本地供审核。
writeFileSync(resolve(runDir, 'runner.local.log'), `${child.stdout || ''}\n${child.stderr || ''}`);
const after = fingerprints();
const sourceUnchanged = JSON.stringify(before) === JSON.stringify(after);
const runnerExit = Number.isInteger(child.status) ? child.status : 1;
let summary;
try { summary = JSON.parse(readFileSync(resolve(runDir, 'summary.json'), 'utf8')); } catch {}
const counts = summary?.counts || null;
const strictResultValid = Boolean(summary) && !summary.runnerError
  && counts?.failed === 0 && counts?.skipped === 0;
// 标准 runner 的非零退出原样保留；expected-failure/skip 也不能让严格结果变绿。
const exitCode = runnerExit || (sourceUnchanged && strictResultValid ? 0 : 1);
const execution = {
  nodeVersion: process.version, runnerExit, exitCode, signal: child.signal,
  processWallMs: performance.now() - started, sourceUnchanged, strictResultValid, sourceSha256: before,
  mode: 'saved-playwright-script-no-model-no-healing',
};
writeFileSync(resolve(runDir, 'execution.json'), JSON.stringify(execution, null, 2));
console.log(JSON.stringify({ runDir, ...execution, sourceSha256: undefined, counts }, null, 2));
process.exitCode = exitCode;
