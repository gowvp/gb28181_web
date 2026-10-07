// runner 配置 retries: 0、maxFailures: 0、trace: 'retain-on-failure'。
// 每个 step 回调只放一个 Playwright 动作或断言；关闭 context 能取消浏览器工作，
// 不能取消任意 JavaScript 代码。截图和 trace 保持原样、仅存本地，可能含敏感数据。
// test.use({ networkWaitMs: 5000 }) 设置网络收尾和业务谓词的等待上限；
// 它不是产品业务等待规则，异步业务是否完成仍须用独立断言判断。
import { test as base, expect } from '@playwright/test';

const categories = new Set(['requestfailed', 'http-error', 'business-error']);
const validId = value => typeof value === 'string' && /^[a-z][a-z0-9_.:-]{0,63}$/.test(value);
const fixedError = () => new Error('Strict network guard configuration is invalid.');
function normalizeRules(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fixedError();
  const result = {};
  for (const group of ['expected', 'ignore', 'business']) {
    const list = value[group] ?? [];
    if (!Array.isArray(list)) throw fixedError();
    result[group] = Object.freeze(list.map(rule => {
      if (!rule || !validId(rule.id) || typeof rule.match !== 'function' ||
          (rule.routeLabel !== undefined && !validId(rule.routeLabel))) throw fixedError();
      if (group === 'business') {
        if (typeof rule.predicate !== 'function') throw fixedError();
      } else {
        if (!(rule.statuses?.length || rule.categories?.length)) throw fixedError();
        if (rule.statuses !== undefined && (!Array.isArray(rule.statuses) ||
            rule.statuses.some(s => !Number.isInteger(s) || s < 100 || s > 599))) throw fixedError();
        if (rule.categories !== undefined && (!Array.isArray(rule.categories) ||
            rule.categories.some(c => !categories.has(c)))) throw fixedError();
        if (rule.ruleIds !== undefined && (!Array.isArray(rule.ruleIds) ||
            rule.ruleIds.some(id => !validId(id)))) throw fixedError();
      }
      return Object.freeze({ ...rule, statuses: rule.statuses && Object.freeze([...rule.statuses]),
        categories: rule.categories && Object.freeze([...rule.categories]),
        ruleIds: rule.ruleIds && Object.freeze([...rule.ruleIds]) });
    }));
  }
  return Object.freeze(result);
}

// 摘要不收集 query、hash、账号、密码、pathname、header、body 和原始错误文本。
function safeRequest(request, number, stepIndex) {
  let origin = 'unavailable';
  try {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol)) origin = url.origin;
  } catch {}
  const method = request.method();
  const type = request.resourceType();
  return { requestNumber: number, stepIndex, method: /^[A-Z]+$/.test(method) ? method : 'OTHER',
    origin, resourceType: /^[a-z]+$/.test(type) ? type : 'other' };
}

function deadline(promise, timeoutMs) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Strict network observation timed out.')), timeoutMs);
  })]).finally(() => clearTimeout(timer));
}

export { expect };
export const test = base.extend({
  networkWaitMs: [5000, { option: true }],
  networkGuard: [async ({ context, page, networkWaitMs }, use, testInfo) => {
    if (!Number.isFinite(networkWaitMs) || networkWaitMs <= 0) throw fixedError();
    let rules = normalizeRules(), activeStep = null, requestNumber = 0;
    let firstFault, stepFailed = false, closing = false, stopped = false;
    const faults = [], exclusions = [], steps = [], pending = new Set(), inFlight = new Map();
    const entries = new WeakMap(), dedup = new Set();
    let resolveFault;
    // 事件只唤醒等待方，不能在监听器里异步抛错或制造未处理的拒绝。
    const faultSignal = new Promise(resolve => { resolveFault = resolve; });
    const faultError = () => new Error(`Strict network fault: ${firstFault.category} [${firstFault.ruleId}].`);
    function fail(entry, category, ruleId = 'guard.network') {
      if (closing) return;
      const key = `${entry.meta.requestNumber}:${category}:${ruleId}`;
      if (dedup.has(key)) return;
      dedup.add(key);
      const fault = { ...entry.meta, category, ruleId, disposition: 'failed' };
      faults.push(fault);
      if (!firstFault) { firstFault = fault; resolveFault(fault); }
    }
    function matches(rule, request, entry) {
      try {
        const result = rule.match(request);
        if (typeof result !== 'boolean') {
          if (result?.then) Promise.resolve(result).catch(() => {});
          fail(entry, 'rule-match-error', rule.id); return false;
        }
        return result;
      } catch { fail(entry, 'rule-match-error', rule.id); return false; }
    }
    function selectedRule(list, request, entry, category, ruleId) {
      return list.find(rule => (category !== 'requestfailed' || rule.categories?.includes('requestfailed')) &&
        (!rule.statuses || rule.statuses.includes(entry.meta.status)) &&
        (!rule.categories || rule.categories.includes(category)) &&
        (!rule.ruleIds || rule.ruleIds.includes(ruleId)) && matches(rule, request, entry));
    }
    function classify(request, entry, category, ruleId = 'guard.network') {
      const ignored = selectedRule(entry.rules.ignore, request, entry, category, ruleId);
      const expected = ignored ? undefined : selectedRule(entry.rules.expected, request, entry, category, ruleId);
      const allowed = ignored || expected;
      if (allowed) {
        exclusions.push({ ...entry.meta, category, ruleId: allowed.id,
          ...(allowed.routeLabel ? { routeLabel: allowed.routeLabel } : {}),
          disposition: ignored ? 'ignored' : 'expected' });
      } else fail(entry, category, ruleId);
    }
    function entryFor(request) {
      let entry = entries.get(request);
      if (!entry) {
        let finish;
        entry = { meta: safeRequest(request, ++requestNumber, activeStep), rules,
          finished: new Promise(resolve => { finish = resolve; }), finish: () => finish() };
        entries.set(request, entry); inFlight.set(request, entry);
      }
      return entry;
    }
    const onRequest = request => { if (!closing) entryFor(request); };
    const onFinished = request => {
      const entry = entries.get(request);
      if (entry) { inFlight.delete(request); entry.finish(); }
    };
    const onFailed = request => {
      if (!closing) classify(request, entryFor(request), 'requestfailed');
      onFinished(request);
    };
    const onResponse = response => {
      if (closing) return;
      const request = response.request(), entry = entryFor(request);
      entry.meta.status = response.status();
      const task = (async () => {
        if (entry.meta.status >= 400 && entry.meta.status <= 599) {
          classify(request, entry, 'http-error'); return;
        }
        // 只运行显式配置的业务谓词；body 不进报告，谓词出错必须使测试失败。
        if (entry.meta.status === 200) {
          for (const rule of entry.rules.business) {
            if (!matches(rule, request, entry)) continue;
            let result;
            try { result = await deadline(Promise.resolve().then(() => rule.predicate(response)), networkWaitMs); }
            catch { fail(entry, 'business-predicate-error', rule.id); continue; }
            if (typeof result !== 'boolean') { fail(entry, 'business-predicate-error', rule.id); continue; }
            if (result) classify(request, entry, 'business-error', rule.id);
          }
        }
        // 健康响应命中显式排除规则也留下记录。
        const ignored = selectedRule(entry.rules.ignore, request, entry, 'response', 'guard.network');
        if (ignored) exclusions.push({ ...entry.meta, category: 'response', ruleId: ignored.id,
          ...(ignored.routeLabel ? { routeLabel: ignored.routeLabel } : {}), disposition: 'ignored' });
      })().catch(() => { fail(entry, 'guard-observation-error', 'guard.observation'); });
      pending.add(task);
      task.finally(() => pending.delete(task)).catch(() => {});
    };
    context.on('request', onRequest); context.on('requestfinished', onFinished);
    context.on('requestfailed', onFailed); context.on('response', onResponse);
    function detach() {
      context.off('request', onRequest); context.off('requestfinished', onFinished);
      context.off('requestfailed', onFailed); context.off('response', onResponse);
    }
    async function settle() {
      await new Promise(resolve => setImmediate(resolve));
      const until = performance.now() + networkWaitMs;
      while (!firstFault && (pending.size || inFlight.size)) {
        const work = Promise.all([...pending, ...[...inFlight.values()].map(e => e.finished)]);
        try { await deadline(Promise.race([work, faultSignal]), Math.max(1, until - performance.now())); }
        catch {
          for (const entry of inFlight.values()) fail(entry, 'unfinished-request', 'guard.unfinished');
          if (!firstFault) fail({ meta: { stepIndex: activeStep } }, 'guard-observation-timeout', 'guard.observation');
        }
      }
    }
    async function stopContext() {
      if (stopped) return;
      stopped = true;
      testInfo.annotations.push({ type: 'local-sensitive-artifacts',
        description: 'Raw screenshots and traces stay local and may contain sensitive data.' });
      try {
        const screenshot = await page.screenshot({ timeout: 250 });
        await testInfo.attach('strict-network-fault', { body: screenshot, contentType: 'image/png' });
      } catch {}
      closing = true; detach();
      await context.close().catch(() => {});
    }
    const guard = {
      get rules() { return rules; },
      setRules(value) {
        if (firstFault || stepFailed) throw new Error('Strict guard failure cannot be cleared.');
        rules = normalizeRules(value);
      },
      async step(_title, atomic) {
        if (typeof atomic !== 'function' || activeStep !== null) throw fixedError();
        if (firstFault) { await stopContext(); throw faultError(); }
        if (stepFailed) throw new Error('Strict step already failed.');
        const row = { index: steps.length + 1, status: 'RUNNING', actionMs: null, observationMs: null }, started = performance.now();
        steps.push(row); activeStep = row.index;
        try {
          const work = Promise.resolve().then(async () => {
            const actionStarted = performance.now();
            const result = await atomic();
            row.actionMs = performance.now() - actionStarted;
            const observationStarted = performance.now();
            try { await settle(); }
            finally { row.observationMs = performance.now() - observationStarted; }
            return result;
          });
          const result = await Promise.race([work, faultSignal.then(() => { throw faultError(); })]);
          if (firstFault) throw faultError();
          row.status = 'PASSED'; return result;
        } catch (error) {
          row.status = 'FAILED'; stepFailed = true;
          if (firstFault) { await stopContext(); throw faultError(); }
          throw error;
        } finally { row.durationMs = performance.now() - started; activeStep = null; }
      },
    };
    try { await use(guard); }
    finally {
      try {
        if (!closing) await settle();
        if (firstFault) await stopContext();
      } finally {
        closing = true; detach();
        await testInfo.attach('strict-network', { body: Buffer.from(JSON.stringify({ faults, exclusions, steps })),
          contentType: 'application/json' });
      }
      // 即使调用方捕获了 step 错误，或故障发生在 step 之外，收尾也必须失败。
      if (firstFault) throw faultError();
      if (stepFailed) throw new Error('Strict step failed; failure cannot be cleared.');
    }
  }, { auto: true }],
});
