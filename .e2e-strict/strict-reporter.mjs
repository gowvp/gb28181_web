import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const safeId = value => typeof value === 'string' && /^[a-z][a-z0-9_.:-]{0,63}$/.test(value) ? value : 'redacted';
const number = value => Number.isFinite(value) ? value : null;
function safeEntry(value) {
  let origin = 'unavailable';
  try {
    const url = new URL(value.origin);
    if (['http:', 'https:'].includes(url.protocol)) origin = url.origin;
  } catch {}
  return {
    requestNumber: number(value.requestNumber), stepIndex: number(value.stepIndex),
    origin, method: /^[A-Z]+$/.test(value.method || '') ? value.method : 'OTHER',
    resourceType: /^[a-z]+$/.test(value.resourceType || '') ? value.resourceType : 'other',
    category: safeId(value.category), ruleId: safeId(value.ruleId),
    status: number(value.status),
    disposition: ['failed', 'ignored', 'expected'].includes(value.disposition) ? value.disposition : 'failed',
    ...(value.routeLabel ? { routeLabel: safeId(value.routeLabel) } : {}),
  };
}
// 只从允许字段生成摘要；原始 HTML/trace/截图另留本地，不能视为已脱敏。
function safeNetwork(result) {
  const item = result.attachments.find(attachment => attachment.name === 'strict-network');
  if (!item) return { faults: [], exclusions: [], steps: [] };
  try {
    const value = JSON.parse(item.body ? item.body.toString('utf8') : readFileSync(item.path, 'utf8'));
    return {
      faults: (value.faults || []).map(safeEntry),
      exclusions: (value.exclusions || []).map(safeEntry),
      steps: (value.steps || []).map(row => ({
        index: number(row.index), status: ['RUNNING', 'PASSED', 'FAILED'].includes(row.status) ? row.status : 'FAILED',
        durationMs: number(row.durationMs), actionMs: number(row.actionMs), observationMs: number(row.observationMs),
      })),
    };
  } catch {
    return { faults: [{ category: 'evidence-unreadable' }], exclusions: [], steps: [] };
  }
}

export default class StrictReporter {
  constructor(options = {}) { this.outputFile = options.outputFile; this.cases = []; }
  onTestEnd(test, result) {
    const network = safeNetwork(result);
    this.cases.push({
      caseId: createHash('sha256').update(test.id).digest('hex').slice(0, 16),
      status: result.status, expectedStatus: test.expectedStatus,
      retry: result.retry, durationMs: result.duration,
      errorCount: result.errors.length,
      artifacts: {
        screenshots: result.attachments.filter(item => item.contentType === 'image/png').length,
        traces: result.attachments.filter(item => item.name === 'trace').length,
      },
      network,
    });
  }
  // 测试的 stdout/stderr 不进入终端摘要，避免页面数据或错误文本泄漏。
  onStdOut() {}
  onStdErr() {}
  onError() { this.runnerError = true; }
  onEnd(result) {
    const counts = { passed: 0, failed: 0, skipped: 0 };
    for (const item of this.cases) {
      if (item.status === 'passed' && item.expectedStatus === 'passed') counts.passed++;
      else if (item.status === 'skipped') counts.skipped++;
      else counts.failed++;
    }
    const summary = {
      status: result.status, durationMs: result.duration, counts,
      runnerError: Boolean(this.runnerError), cases: this.cases,
      privacy: '精简摘要只保留允许字段；原始HTML、trace和截图可能含敏感数据，仅本地保存，共享前审核。',
    };
    mkdirSync(dirname(this.outputFile), { recursive: true });
    writeFileSync(this.outputFile, JSON.stringify(summary, null, 2));
  }
}
