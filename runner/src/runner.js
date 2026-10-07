import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CheckFailed, handlers } from './actions.js';
import { MOBILE, resolveTarget } from './config.js';
import { incompatibleSteps } from './flow.js';
import { appendHistory, readHistory } from './history.js';
import { renderJunit, renderReport } from './report.js';
import { endSessions, openSession } from './session.js';
import { TestSphereError, slugify, timestamp } from './util.js';

export const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/**
 * Run flows one after another, each in its own session, and write the run
 * folder: report.html, result.json, junit.xml and per-flow evidence.
 *
 * Options:
 *   config      from loadConfig()
 *   target      target name overriding each flow's own
 *   headed      show the browser
 *   output      runs folder (default: config.defaults.output)
 *   open        session factory (tests pass a fake)
 *   reporter    progress callbacks: runStarted, flowStarted, stepStarted, stepFinished, flowFinished
 *   shouldStop  () => true after Ctrl+C: finish the current step, skip the rest
 */
export async function runFlows(flows, options) {
  const { config, reporter = {}, shouldStop = () => false } = options;
  const outDir = path.resolve(options.output ?? config.defaults.output);
  const started = new Date();
  const runDir = uniqueDir(path.join(outDir, timestamp(started)));
  fs.mkdirSync(runDir, { recursive: true });

  const run = {
    id: path.basename(runDir),
    startedAt: started.toISOString(),
    finishedAt: null,
    durationMs: 0,
    status: 'passed',
    summary: null,
    environment: {
      testsphere: VERSION,
      node: process.version,
      os: `${os.type()} ${os.release()}`,
      host: os.hostname(),
      config: config.file ? relativeTo(config.dir, config.file) : null,
    },
    flows: [],
  };
  reporter.runStarted?.({ id: run.id, runDir, startedAt: run.startedAt, flows });

  for (const [index, flow] of flows.entries()) {
    if (shouldStop()) {
      run.flows.push(notRun(flow, options, config, 'Stopped before this flow started.'));
      continue;
    }
    run.flows.push(await runFlow(flow, { ...options, index, runDir, reporter, shouldStop }));
  }
  await endSessions();

  const finished = new Date();
  run.finishedAt = finished.toISOString();
  run.durationMs = finished - started;
  run.summary = summarize(run.flows);
  run.status = run.summary.failed + run.summary.errors === 0 && !shouldStop() ? 'passed' : 'failed';

  appendHistory(outDir, run);
  const files = {
    report: path.join(runDir, 'report.html'),
    result: path.join(runDir, 'result.json'),
    junit: path.join(runDir, 'junit.xml'),
  };
  fs.writeFileSync(files.result, JSON.stringify(run, null, 2));
  fs.writeFileSync(files.junit, renderJunit(run));
  fs.writeFileSync(files.report, renderReport(run, readHistory(outDir)));
  return { run, runDir, files };
}

async function runFlow(flow, options) {
  const { config, index, runDir, reporter, shouldStop } = options;
  const result = baseResult(flow, options, config);
  const flowDir = path.join(runDir, `${String(index + 1).padStart(2, '0')}-${slugify(flow.name)}`);
  const started = Date.now();
  result.index = index;
  const finish = () => {
    result.durationMs = Date.now() - started;
    reporter.flowFinished?.(result);
    return result;
  };

  let target;
  let session;
  let announced = false;
  try {
    target = resolveTarget(config, result.target);
    result.platform = target.platform;
    const problems = incompatibleSteps(flow, target.platform);
    if (problems.length) throw new TestSphereError(problems.slice(0, 3).join(' '));
    reporter.flowStarted?.(result);
    announced = true;
    session = await (options.open ?? openSession)(target, { headed: options.headed });
  } catch (err) {
    if (!announced) reporter.flowStarted?.(result);
    result.status = 'error';
    result.error = describeError(err);
    for (const step of flow.steps) result.steps.push(stepRecord(step, result.steps.length));
    markCases(result);
    return finish();
  }

  result.device = session.device;
  fs.mkdirSync(flowDir, { recursive: true });
  const ctx = { platform: target.platform, target, driver: session.driver, agent: session.agent, lastAnswer: null, timeout: config.defaults.timeout };
  const ui = session.kind === 'ui';
  const evidence = (name) => ({ abs: path.join(flowDir, name), rel: `${path.basename(flowDir)}/${name}` });

  let recording = false;
  if (ui && MOBILE.has(target.platform) && config.defaults.video) {
    try {
      await session.driver.startRecordingScreen({ timeLimit: 1800 });
      recording = true;
    } catch (err) {
      result.warnings.push(`Video wasn't recorded: ${describeError(err)}`);
    }
  }

  // A failure skips the rest of its case; a flow without cases is one case.
  const blocked = new Set();
  try {
    for (const step of flow.steps) {
      const record = stepRecord(step, result.steps.length);
      result.steps.push(record);
      const key = step.case ?? 'flow';
      if (blocked.has(key) || shouldStop()) {
        reporter.stepFinished?.(record, result);
        continue;
      }

      ctx.timeout = step.timeout ?? config.defaults.timeout;
      reporter.stepStarted?.(record, result);
      const began = Date.now();
      try {
        const output = await handlers[step.action](ctx, step.args);
        if (output?.answer) record.answer = summarizeAnswer(output.answer);
        record.status = 'passed';
      } catch (err) {
        record.status = step.optional ? 'warned' : 'failed';
        record.error = describeError(err);
        if (!step.optional) blocked.add(key);
      }
      record.durationMs = Date.now() - began;

      if (ui) {
        const wanted = step.action === 'screenshot' || wantsScreenshot(config.defaults.screenshots, record.status);
        if (wanted) record.screenshot = await saveScreenshot(session.driver, evidence(`${String(record.index).padStart(2, '0')}-${slugify(step.action === 'screenshot' ? step.args.name : step.label)}.png`));
        if (record.status === 'failed' && !result.pageSource) {
          result.pageSource = await savePageSource(session.driver, evidence(target.platform === 'web' ? 'page-source.html' : 'page-source.xml'));
        }
      }
      reporter.stepFinished?.(record, result);
    }
  } finally {
    if (recording) result.video = await saveVideo(session.driver, evidence('video.mp4'), result.warnings);
    await session.close().catch(() => {});
  }

  if (result.steps.some((s) => s.status === 'failed')) result.status = 'failed';
  else if (shouldStop() && result.steps.some((s) => s.status === 'skipped')) {
    result.status = 'error';
    result.error = 'Stopped before every step ran.';
  }
  result.costUsd = sumCost(result.steps);
  markCases(result);
  return finish();
}

// ------------------------------------------------------------------ records

function baseResult(flow, options, config) {
  return {
    name: flow.name,
    file: relativeTo(config.dir, flow.file),
    description: flow.description,
    tags: flow.tags,
    target: options.target ?? flow.target ?? config.defaults.target,
    platform: null,
    status: 'passed',
    durationMs: 0,
    device: null,
    error: null,
    warnings: [],
    video: null,
    pageSource: null,
    costUsd: null,
    cases: flow.cases.map((c) => ({ index: c.index, name: c.name, status: 'passed' })),
    steps: [],
  };
}

function notRun(flow, options, config, reason) {
  const result = baseResult(flow, options, config);
  result.status = 'error';
  result.error = reason;
  for (const step of flow.steps) result.steps.push(stepRecord(step, result.steps.length));
  markCases(result);
  return result;
}

function stepRecord(step, position) {
  return {
    index: position + 1,
    action: step.action,
    label: step.label,
    from: step.from,
    case: step.case,
    optional: step.optional,
    status: 'skipped',
    durationMs: 0,
    error: null,
    screenshot: null,
    answer: null,
  };
}

function markCases(result) {
  for (const c of result.cases) {
    const steps = result.steps.filter((s) => s.case === c.index);
    c.status = steps.some((s) => s.status === 'failed') ? 'failed' : steps.every((s) => s.status === 'skipped') ? 'skipped' : 'passed';
    if (result.status === 'error' && c.status === 'passed') c.status = 'skipped';
  }
}

function summarizeAnswer(answer) {
  return {
    question: answer.question,
    answer: answer.answer,
    status: answer.status,
    latencyMs: answer.latencyMs,
    model: answer.model,
    costUsd: answer.costUsd,
    notices: answer.notices,
    retrieved: answer.sources.length,
    citations: answer.citations.map((c) => ({
      n: c.n,
      kind: c.kind,
      title: c.title,
      page: c.page ?? null,
      url: c.url ?? null,
      quotes: (c.quotes ?? []).slice(0, 2).map((q) => (q.length > 300 ? `${q.slice(0, 299)}…` : q)),
    })),
  };
}

function summarize(flows) {
  const count = (status) => flows.filter((f) => f.status === status).length;
  const cases = flows.flatMap((f) => f.cases);
  const steps = flows.flatMap((f) => f.steps);
  const costs = flows.map((f) => f.costUsd).filter((c) => c != null);
  return {
    flows: flows.length,
    passed: count('passed'),
    failed: count('failed'),
    errors: count('error'),
    cases: { total: cases.length, passed: cases.filter((c) => c.status === 'passed').length },
    steps: { total: steps.length, passed: steps.filter((s) => s.status === 'passed').length, failed: steps.filter((s) => s.status === 'failed').length },
    costUsd: costs.length ? costs.reduce((a, b) => a + b, 0) : null,
  };
}

function sumCost(steps) {
  const costs = steps.map((s) => s.answer?.costUsd).filter((c) => typeof c === 'number');
  return costs.length ? costs.reduce((a, b) => a + b, 0) : null;
}

// ------------------------------------------------------------------ evidence

function wantsScreenshot(mode, status) {
  if (mode === 'every-step') return status !== 'skipped';
  if (mode === 'on-failure') return status === 'failed' || status === 'warned';
  return false;
}

async function saveScreenshot(driver, file) {
  try {
    await driver.saveScreenshot(file.abs);
    return file.rel;
  } catch {
    return null;
  }
}

async function savePageSource(driver, file) {
  try {
    fs.writeFileSync(file.abs, await driver.getPageSource());
    return file.rel;
  } catch {
    return null;
  }
}

async function saveVideo(driver, file, warnings) {
  try {
    fs.writeFileSync(file.abs, Buffer.from(await driver.stopRecordingScreen(), 'base64'));
    return file.rel;
  } catch (err) {
    warnings.push(`Video couldn't be saved: ${describeError(err)}`);
    return null;
  }
}

// ------------------------------------------------------------------ helpers

/** One readable line from whatever was thrown: our own messages as written, driver errors trimmed. */
export function describeError(err) {
  if (err instanceof TestSphereError || err instanceof CheckFailed) return err.message;
  const text = String(err?.message ?? err)
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return text ?? 'Unknown error';
}

function uniqueDir(dir) {
  let candidate = dir;
  for (let n = 2; fs.existsSync(candidate); n += 1) candidate = `${dir}-${n}`;
  return candidate;
}

/** A path relative to the project, or the full path for files outside it. */
function relativeTo(base, file) {
  const rel = path.relative(base, file);
  return (rel.startsWith('..') || path.isAbsolute(rel) ? file : rel).replaceAll('\\', '/');
}
