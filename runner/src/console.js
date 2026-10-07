import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTarget, targetPlatform } from './config.js';
import { discoverFlows, loadFlow } from './flow.js';
import { readHistory } from './history.js';
import { VERSION, describeError, runFlows } from './runner.js';
import { TestSphereError } from './util.js';

const UI_DIR = fileURLToPath(new URL('../console/', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const DEFAULT_KPI = { kpi: 'BuildAI answers passing TestSphere checks', department: '', target: 95 };

/**
 * The TestSphere console: a local web app over the engine. It lists suites
 * (one per folder of flows), runs them one at a time while streaming progress
 * to the browser, and serves past runs, target health and the KPI value
 * THE EYE imports.
 *
 *   project  folder whose subfolders hold the flows
 *   open     session factory (tests pass a fake)
 */
export function createConsole({ config, project, vars = {}, open }) {
  const outDir = config.defaults.output;
  const kpi = { ...DEFAULT_KPI, ...(config.theEye ?? {}) };
  const live = { run: null, events: [], clients: new Set(), stopping: false, promise: null };

  // ------------------------------------------------------------ suites

  function listSuites() {
    const groups = new Map();
    for (const file of discoverFlows([project])) {
      const id = relative(project, file);
      const folder = id.includes('/') ? id.split('/')[0] : '.';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(describeFlow(file, id));
    }
    return [...groups].map(([folder, flows]) => {
      const meta = config.suites?.[folder] ?? {};
      return {
        id: folder,
        name: meta.name ?? (folder === '.' ? 'Flows' : titleCase(folder)),
        description: meta.description ?? null,
        flows,
      };
    });
  }

  function describeFlow(file, id) {
    const historyKey = relative(config.dir, file);
    try {
      const flow = loadFlow(file, { vars });
      const target = flow.target ?? config.defaults.target;
      let platform = null;
      try {
        platform = targetPlatform(config, target);
      } catch {
        // Shown as a problem when the flow runs.
      }
      return { id, historyKey, name: flow.name, description: flow.description, target, platform, tags: flow.tags, cases: flow.cases.length, steps: flow.steps.length };
    } catch (err) {
      return { id, historyKey, name: path.basename(file), error: err.message };
    }
  }

  // ------------------------------------------------------------ runs

  function emit(event, data) {
    live.events.push({ event, data });
    const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of live.clients) res.write(line);
  }

  async function startRun(ids) {
    if (live.run && !live.run.finished) throw new HttpError(409, 'A run is already in progress. Wait for it to finish or stop it.');
    if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'Choose at least one flow to run.');
    const files = ids.map((id) => {
      const file = inside(project, String(id));
      if (!file || !fs.existsSync(file)) throw new HttpError(400, `No flow at ${id}.`);
      return file;
    });
    let flows;
    try {
      flows = files.map((file) => loadFlow(file, { vars }));
    } catch (err) {
      throw new HttpError(400, err.message);
    }

    live.run = { id: null, finished: false };
    live.events = [];
    live.stopping = false;
    return new Promise((resolve, reject) => {
      const reporter = {
        runStarted({ id, startedAt }) {
          live.run.id = id;
          emit('run', {
            id,
            startedAt,
            flows: flows.map((flow, index) => ({
              index,
              name: flow.name,
              file: relative(project, flow.file),
              target: flow.target ?? config.defaults.target,
              cases: flow.cases,
              steps: flow.steps.map((step, i) => ({ index: i + 1, label: step.label, action: step.action, case: step.case, from: step.from })),
            })),
          });
          resolve({ id });
        },
        flowStarted: (flow) => emit('flow', { index: flow.index, platform: flow.platform, target: flow.target }),
        stepStarted: (step, flow) => emit('step-start', { flow: flow.index, step: step.index }),
        stepFinished: (step, flow) => emit('step', { flow: flow.index, step: stepView(live.run.id, step) }),
        flowFinished: (flow) => emit('flow-done', flowView(live.run.id, flow)),
      };
      live.promise = runFlows(flows, { config, reporter, open, shouldStop: () => live.stopping }).then(
        ({ run }) => {
          live.run.finished = true;
          emit('done', { id: run.id, status: run.status, summary: run.summary, durationMs: run.durationMs, report: `/runs/${run.id}/report.html` });
        },
        (err) => {
          live.run.finished = true;
          emit('failed', { message: describeError(err) });
          reject(new HttpError(500, describeError(err)));
        },
      );
    });
  }

  function listRuns() {
    if (!fs.existsSync(outDir)) return [];
    return fs
      .readdirSync(outDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(outDir, d.name, 'result.json')))
      .map((d) => d.name)
      .sort()
      .reverse()
      .slice(0, 40)
      .flatMap((id) => {
        try {
          const run = JSON.parse(fs.readFileSync(path.join(outDir, id, 'result.json'), 'utf8'));
          return [{ id, startedAt: run.startedAt, status: run.status, durationMs: run.durationMs, summary: run.summary, flows: run.flows.map((f) => ({ name: f.name, status: f.status })) }];
        } catch {
          return [];
        }
      });
  }

  function readRun(id) {
    const file = inside(outDir, path.join(id, 'result.json'));
    if (!file || !fs.existsSync(file)) throw new HttpError(404, 'No such run.');
    const run = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      id: run.id,
      startedAt: run.startedAt,
      status: run.status,
      durationMs: run.durationMs,
      summary: run.summary,
      report: `/runs/${run.id}/report.html`,
      flows: run.flows.map((flow, index) => ({ ...flowView(run.id, { ...flow, index }), name: flow.name, file: flow.file, target: flow.target, steps: flow.steps.map((s) => stepView(run.id, s)) })),
    };
  }

  /** The share of agent questions that passed in the most recent run that asked any. */
  function agentScore() {
    const history = readHistory(outDir).filter((entry) => entry.cases);
    const last = history.at(-1);
    if (!last) return null;
    const entries = history.filter((entry) => entry.run === last.run);
    const passed = entries.reduce((n, e) => n + e.cases.passed, 0);
    const total = entries.reduce((n, e) => n + e.cases.total, 0);
    return { run: last.run, at: last.at, passed, total, percent: total ? Math.round((passed / total) * 1000) / 10 : 0, ...kpi };
  }

  function overview() {
    const history = readHistory(outDir);
    const suites = listSuites().map((suite) => ({
      ...suite,
      flows: suite.flows.map((flow) => ({
        ...flow,
        history: history.filter((e) => e.file === flow.historyKey && e.target === flow.target).slice(-12).map((e) => ({ run: e.run, status: e.status })),
      })),
    }));
    return {
      version: VERSION,
      project: { name: path.basename(project), dir: project, config: config.file },
      suites,
      score: agentScore(),
      live: live.run ? { id: live.run.id, finished: live.run.finished } : null,
    };
  }

  async function targets() {
    const names = [...new Set(listSuites().flatMap((s) => s.flows.map((f) => f.target)).filter(Boolean))];
    return Promise.all(names.map(checkTarget));
  }

  async function checkTarget(name) {
    let target;
    try {
      targetPlatform(config, name);
      target = resolveTarget(config, name);
    } catch (err) {
      return { name, state: 'problem', detail: err.message };
    }
    const base = { name, platform: target.platform };
    if (target.platform === 'buildai') return { ...base, ...(await ping(`${target.url}/api/auth/state`)), detail: `BuildAI at ${target.url} · ${target.knowledgeBase ?? 'All knowledge'}` };
    if (target.platform === 'web') {
      if (!target.baseUrl) return { ...base, state: 'up', detail: `${target.browser} on this computer` };
      return { ...base, ...(await ping(target.baseUrl)), detail: `${target.browser} → ${target.baseUrl}` };
    }
    return { ...base, ...(await ping(`${target.server.replace(/\/$/, '')}/status`)), detail: `Appium at ${target.server}` };
  }

  function theEyeCsv() {
    const score = agentScore();
    if (!score) throw new HttpError(404, 'No agent questions have run yet.');
    const month = score.run.slice(0, 7);
    const note = `${score.passed} of ${score.total} agent questions passed in TestSphere run ${score.run}`;
    return `KPI,Month,Actual,Department,Comment\r\n${[score.kpi, month, score.percent, score.department, note].map(csvCell).join(',')}\r\n`;
  }

  // ------------------------------------------------------------ HTTP

  async function handle(req, res) {
    const url = new URL(req.url, 'http://console.local');
    const route = `${req.method} ${url.pathname}`;

    if (req.method === 'POST') checkSameOrigin(req);
    if (route === 'GET /api/overview') return json(res, overview());
    if (route === 'GET /api/targets') return json(res, { targets: await targets() });
    if (route === 'GET /api/runs') return json(res, { runs: listRuns() });
    if (route === 'POST /api/runs') return json(res, await startRun((await body(req)).flows), 202);
    if (route === 'POST /api/stop') {
      live.stopping = true;
      return json(res, { ok: true });
    }
    if (route === 'GET /api/live') return stream(req, res);
    if (route === 'GET /api/the-eye.csv') {
      const csv = theEyeCsv();
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="testsphere-for-the-eye-${agentScore().run.slice(0, 10)}.csv"`,
      });
      return res.end(csv);
    }
    let match;
    if (req.method === 'GET' && (match = /^\/api\/runs\/([\w.-]+)$/.exec(url.pathname))) return json(res, readRun(match[1]));
    if (req.method === 'GET' && url.pathname.startsWith('/runs/')) return file(res, inside(outDir, decodeURIComponent(url.pathname.slice(6))));
    if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
      return file(res, inside(UI_DIR, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1))));
    }
    throw new HttpError(404, 'Not found');
  }

  function stream(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    for (const { event, data } of live.events) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    live.clients.add(res);
    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 15_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      live.clients.delete(res);
    });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (!res.headersSent) json(res, { error: status === 500 ? describeError(err) : err.message }, status);
      else res.end();
    });
  });

  return {
    server,
    listen(port = 4600, host = '127.0.0.1') {
      return new Promise((resolve, reject) => {
        server.once('error', (err) => reject(err.code === 'EADDRINUSE' ? new TestSphereError(`Port ${port} is in use. Try --port ${port + 1}.`) : err));
        server.listen(port, host, () => resolve(`http://${host === '127.0.0.1' ? 'localhost' : host}:${server.address().port}`));
      });
    },
    /** Stop after the current step (up to 15s) so browser and device sessions close cleanly. */
    async close() {
      if (live.run && !live.run.finished) {
        live.stopping = true;
        await Promise.race([live.promise?.catch(() => {}), new Promise((r) => setTimeout(r, 15_000))]);
      }
      for (const res of live.clients) res.end();
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

// ------------------------------------------------------------ views

function stepView(runId, step) {
  return {
    index: step.index,
    label: step.label,
    action: step.action,
    case: step.case,
    from: step.from,
    status: step.status,
    durationMs: step.durationMs,
    error: step.error,
    screenshot: step.screenshot ? `/runs/${runId}/${step.screenshot}` : null,
    answer: step.answer,
  };
}

function flowView(runId, flow) {
  const asset = (rel) => (rel ? `/runs/${runId}/${rel}` : null);
  return {
    index: flow.index,
    status: flow.status,
    platform: flow.platform,
    durationMs: flow.durationMs,
    error: flow.error,
    warnings: flow.warnings,
    device: flow.device,
    video: asset(flow.video),
    pageSource: asset(flow.pageSource),
    cases: flow.cases,
  };
}

// ------------------------------------------------------------ helpers

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** POSTs from other websites can't start runs on this computer. */
function checkSameOrigin(req) {
  const origin = req.headers.origin;
  if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Requests from other sites are refused.');
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
}

async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 100_000) throw new HttpError(413, 'Request too large.');
  }
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON.');
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function file(res, abs) {
  if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new HttpError(404, 'Not found');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(abs).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(abs).pipe(res);
}

/** `rel` resolved under `base`, or null if it would escape it. */
function inside(base, rel) {
  const root = path.resolve(base);
  const abs = path.resolve(root, rel.replace(/^[\\/]+/, ''));
  return abs === root || abs.startsWith(root + path.sep) ? abs : null;
}

async function ping(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2500) });
    return { state: 'up' };
  } catch {
    return { state: 'down' };
  }
}

function relative(base, file) {
  return path.relative(base, file).replaceAll('\\', '/');
}

function titleCase(text) {
  return text.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
