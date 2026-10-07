// TestSphere Console: talks to the local console server (src/console.js).
// The current run streams in over /api/live; past runs load from /api/runs/:id.

const state = {
  overview: null,
  runs: [],
  view: null, // the run on screen: { id, live, status, flows: [...] }
  pinned: null, // a step the person clicked, shown on the stage instead of the latest
  current: null, // the step running now { flow, step }
};

// ---------------------------------------------------------------- helpers

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child != null && child !== false) node.append(child instanceof Node ? child : String(child));
  return node;
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

const duration = (ms) => (ms == null ? '' : ms < 1000 ? `${Math.round(ms)}ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`);
const runTime = (id) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})/.exec(id ?? '');
  if (!m) return id ?? '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]}, ${m[4]}:${m[5]}`;
};
const STATUS = { passed: 'Passed', failed: 'Failed', error: "Didn't run", warned: 'Warning', skipped: 'Skipped', running: 'Running', pending: 'Waiting' };
const done = (s) => !['pending', 'running'].includes(s.status);

function toast(message) {
  const box = document.getElementById('toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (box.hidden = true), 6000);
}

function emphasis(text) {
  // Answers are Markdown: show **bold** as bold, drop other markers. Built as nodes, never HTML.
  const out = [];
  for (const [i, part] of String(text ?? '').split(/\*\*(.+?)\*\*/g).entries()) {
    out.push(i % 2 ? h('strong', {}, part) : part.replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|[.,;:]|$)/g, '$1$2'));
  }
  return out;
}

// ---------------------------------------------------------------- data

async function loadOverview() {
  state.overview = await api('/api/overview');
  renderProject();
  renderScore();
  renderSuites();
}

async function loadRuns() {
  state.runs = (await api('/api/runs')).runs;
  renderRuns();
}

async function loadTargets() {
  try {
    const { targets } = await api('/api/targets');
    const list = document.getElementById('targets');
    list.replaceChildren(
      ...targets.map((t) =>
        h('li', { 'data-state': t.state, title: `${t.detail ?? ''}${t.state === 'down' ? ' · not reachable' : ''}` }, h('span', { class: 'dot' }), t.name),
      ),
    );
  } catch {
    // The top bar just keeps its last state.
  }
}

async function openRun(id) {
  try {
    const run = await api(`/api/runs/${encodeURIComponent(id)}`);
    state.view = { ...run, live: false, flows: run.flows.map((f) => ({ ...f, steps: f.steps })) };
    state.pinned = null;
    state.current = null;
    history.replaceState(null, '', `#${id}`);
    renderMain();
    renderRuns();
  } catch (err) {
    toast(err.message);
  }
}

async function startRun(flowIds) {
  try {
    await api('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flows: flowIds }) });
  } catch (err) {
    toast(err.message);
  }
}

// ---------------------------------------------------------------- live events

function connectLive() {
  const events = new EventSource('/api/live');
  const on = (name, fn) => events.addEventListener(name, (e) => fn(JSON.parse(e.data)));

  on('run', (run) => {
    state.view = {
      id: run.id,
      live: true,
      status: 'running',
      startedAt: run.startedAt,
      flows: run.flows.map((f) => ({
        ...f,
        status: 'pending',
        platform: null,
        cases: f.cases.map((c) => ({ ...c, status: 'pending' })),
        steps: f.steps.map((s) => ({ ...s, status: 'pending', durationMs: null, error: null, screenshot: null, answer: null })),
      })),
    };
    state.pinned = null;
    state.current = null;
    history.replaceState(null, '', `#${run.id}`);
    schedule();
    renderSuites();
  });
  on('flow', ({ index, platform }) => {
    const flow = state.view?.flows[index];
    if (!flow) return;
    Object.assign(flow, { status: 'running', platform });
    schedule();
  });
  on('step-start', ({ flow, step }) => {
    const s = state.view?.flows[flow]?.steps[step - 1];
    if (!s) return;
    s.status = 'running';
    state.current = { flow, step };
    schedule();
  });
  on('step', ({ flow, step }) => {
    const f = state.view?.flows[flow];
    if (!f) return;
    Object.assign(f.steps[step.index - 1], step);
    schedule();
  });
  on('flow-done', (result) => {
    const flow = state.view?.flows[result.index];
    if (!flow) return;
    Object.assign(flow, result);
    schedule();
  });
  on('done', (run) => {
    if (!state.view || state.view.id !== run.id) return;
    Object.assign(state.view, { live: false, status: run.status, summary: run.summary, durationMs: run.durationMs, report: run.report });
    state.current = null;
    schedule();
    loadOverview();
    loadRuns();
  });
  on('failed', ({ message }) => {
    toast(`The run stopped: ${message}`);
    loadOverview();
  });
}

let frame = 0;
function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    renderMain();
  });
}

// ---------------------------------------------------------------- sidebar

function renderProject() {
  const { project, version } = state.overview;
  document.getElementById('project').textContent = `${project.name} · TestSphere ${version}`;
  document.getElementById('project').title = project.config ?? project.dir;
}

function renderScore() {
  const box = document.getElementById('score');
  const s = state.overview.score;
  if (!s) {
    box.replaceChildren(h('p', { class: 'eyebrow' }, 'Agent answers passing checks'), h('p', { class: 'muted' }, 'Run an agent suite to see how many answers pass.'));
    return;
  }
  const ok = s.percent >= s.target;
  box.replaceChildren(
    h('p', { class: 'eyebrow' }, 'Agent answers passing checks'),
    h('div', { class: 'figure' }, h('strong', { class: ok ? 'ok' : 'below' }, `${s.percent}%`), h('span', { class: 'muted' }, `target ${s.target}%`)),
    h('div', { class: 'meter', role: 'img', 'aria-label': `${s.percent}% against a target of ${s.target}%` }, h('span', { class: ok ? '' : 'below', style: `width:${Math.min(s.percent, 100)}%` }), h('i', { style: `left:${Math.min(s.target, 100)}%` })),
    h('p', {}, `${s.passed} of ${s.total} questions passed · ${runTime(s.run)}`),
    h('div', {}, h('a', { class: 'btn ghost small', href: '/api/the-eye.csv', download: true }, 'Export for THE EYE')),
    h('p', { class: 'muted small' }, `THE EYE tracks this as "${s.kpi}". Import the file in THE EYE under Workspace settings, Import data, KPI actuals.`),
  );
}

function renderSuites() {
  const running = state.view?.live;
  const box = document.getElementById('suites');
  const suites = state.overview?.suites ?? [];
  document.getElementById('run-all').disabled = running || !suites.length;
  box.replaceChildren(
    ...suites.map((suite) => {
      const runnable = suite.flows.filter((f) => !f.error).map((f) => f.id);
      return h(
        'div',
        { class: 'suite' },
        h('div', { class: 'suite-h' }, h('h3', {}, suite.name), h('button', { type: 'button', class: 'btn small', disabled: running || !runnable.length, onclick: () => startRun(runnable) }, 'Run')),
        suite.description ? h('p', {}, suite.description) : null,
        h(
          'ul',
          {},
          suite.flows.map((flow) => {
            const last = flow.history?.at(-1);
            return h(
              'li',
              { title: flow.error ?? `${flow.name} · ${flow.target}` },
              h('span', { class: `status-dot ${flow.error ? 'error' : last?.status ?? ''}` }),
              h('span', { class: 'name' }, flow.name),
              h('span', { class: 'trend', 'aria-hidden': 'true' }, (flow.history ?? []).slice(-8).map((e) => h('i', { class: e.status }))),
              flow.error ? h('span', { class: 'err' }, flow.error) : null,
            );
          }),
        ),
      );
    }),
  );
}

function renderRuns() {
  const list = document.getElementById('runs');
  if (!state.runs.length) {
    list.replaceChildren(h('li', { class: 'muted small' }, 'No runs yet.'));
    return;
  }
  list.replaceChildren(
    ...state.runs.slice(0, 12).map((run) => {
      const s = run.summary;
      const what = `${s.flows} flow${s.flows === 1 ? '' : 's'} · ${s.passed} passed${s.failed ? ` · ${s.failed} failed` : ''}${s.errors ? ` · ${s.errors} didn't run` : ''}`;
      return h(
        'li',
        {},
        h(
          'button',
          { type: 'button', 'aria-current': String(state.view?.id === run.id), onclick: () => openRun(run.id) },
          h('span', { class: `status-dot ${run.status}` }),
          h('span', { class: 'what' }, what),
          h('span', { class: 'when small muted' }, runTime(run.id)),
        ),
      );
    }),
  );
}

// ---------------------------------------------------------------- run view

function renderMain() {
  const main = document.getElementById('main');
  const view = state.view;
  if (!view) {
    main.replaceChildren(
      h(
        'div',
        { class: 'welcome' },
        h('p', { class: 'eyebrow' }, 'TestSphere Console'),
        h('h1', {}, 'Pick a suite and press Run'),
        h('p', { class: 'muted' }, 'Each step appears here as it happens: the screen TestSphere sees, or the question it asked an agent and the answer it checked.'),
      ),
    );
    return;
  }

  const steps = view.flows.flatMap((f) => f.steps);
  const finished = steps.filter(done);
  const count = (status) => steps.filter((s) => s.status === status).length;
  const cases = view.flows.flatMap((f) => f.cases.map((c) => ({ ...c, status: caseStatus(f, c) })));
  const status = view.live ? 'running' : view.status;
  const total = steps.length || 1;
  const elapsed = view.live ? Date.now() - new Date(view.startedAt).getTime() : view.durationMs;

  main.replaceChildren(
    h(
      'div',
      { class: 'run-head' },
      h('div', {}, h('p', { class: 'eyebrow' }, `${view.live ? 'Live run' : 'Run'} · ${runTime(view.id)}`), h('h1', {}, runTitle(view))),
      h(
        'div',
        { class: 'run-actions' },
        h('span', { class: `pill ${status}` }, STATUS[status] ?? status),
        view.live ? h('button', { type: 'button', class: 'btn danger small', onclick: stopRun }, 'Stop') : null,
        !view.live ? h('button', { type: 'button', class: 'btn ghost small', disabled: state.overview?.live && !state.overview.live.finished, onclick: () => startRun(view.flows.map((f) => f.file)) }, 'Run again') : null,
        !view.live && view.report ? h('a', { class: 'btn small', href: view.report, target: '_blank', rel: 'noopener' }, 'Full report') : null,
      ),
    ),
    h(
      'div',
      { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(finished.length) },
      h('span', { class: 'p-ok', style: `width:${((count('passed') + count('warned')) / total) * 100}%` }),
      h('span', { class: 'p-bad', style: `width:${(count('failed') / total) * 100}%` }),
      h('span', { class: 'p-skip', style: `width:${(count('skipped') / total) * 100}%` }),
    ),
    h(
      'div',
      { class: 'stats' },
      h('span', {}, h('b', {}, `${finished.length} of ${steps.length}`), ' steps'),
      h('span', {}, h('b', {}, String(view.flows.filter((f) => f.status === 'passed').length)), ` of ${view.flows.length} flows passed`),
      cases.length ? h('span', {}, h('b', {}, `${cases.filter((c) => c.status === 'passed').length} of ${cases.length}`), ' agent questions passed') : null,
      h('span', { class: 'elapsed' }, h('b', {}, duration(elapsed)), view.live ? ' so far' : ''),
    ),
    h('div', { class: 'run-body' }, h('div', { class: 'flows' }, view.flows.map(renderFlow)), renderStage()),
  );
}

function runTitle(view) {
  const suites = state.overview?.suites ?? [];
  const names = [...new Set(view.flows.map((f) => suites.find((s) => s.flows.some((x) => x.id === f.file))?.name ?? f.name))];
  return names.length <= 2 ? names.join(' and ') : `${names.length} suites`;
}

function renderFlow(flow) {
  const where = [flow.target, flow.platform].filter(Boolean).join(' · ');
  const body = flow.cases.length
    ? flow.cases.map((c) => [c, caseStatus(flow, c)]).map(([c, status]) =>
        h(
          'div',
          { class: 'case' },
          h('div', { class: 'case-h' }, h('span', { class: `badge ${status}` }, STATUS[status] ?? status), c.name),
          h('ol', { class: 'steps' }, flow.steps.filter((s) => s.case === c.index).map((s) => renderStep(flow, s))),
        ),
      )
    : h('ol', { class: 'steps' }, flow.steps.map((s) => renderStep(flow, s)));
  return h(
    'article',
    { class: 'flow' },
    h('header', {}, h('span', { class: `badge ${flow.status}` }, STATUS[flow.status] ?? flow.status), h('h3', {}, flow.name), where ? h('span', { class: 'chip' }, where) : null, flow.durationMs ? h('span', { class: 'chip' }, duration(flow.durationMs)) : null),
    flow.error ? h('p', { class: 'flow-note' }, flow.error) : null,
    (flow.warnings ?? []).map((w) => h('p', { class: 'flow-note' }, w)),
    body,
  );
}

/** A question's status while its flow is still running comes from its own steps. */
function caseStatus(flow, c) {
  if (c.status !== 'pending') return c.status;
  const steps = flow.steps.filter((s) => s.case === c.index);
  if (steps.some((s) => s.status === 'failed')) return 'failed';
  if (steps.some((s) => s.status === 'running')) return 'running';
  if (steps.length && steps.every(done)) return 'passed';
  return 'pending';
}

function renderStep(flow, step) {
  const clickable = Boolean(step.screenshot || step.answer);
  const shown = stageStep();
  const isShown = shown && shown.flow === flow && shown.step === step;
  return h(
    'li',
    {
      class: `step${clickable ? ' clickable' : ''}`,
      'data-status': step.status,
      'aria-current': String(Boolean(isShown)),
      tabindex: clickable ? '0' : null,
      title: STATUS[step.status],
      onclick: clickable ? () => pin(flow, step) : null,
      onkeydown: clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pin(flow, step)) : null,
    },
    h('span', { class: 'dot' }),
    h('span', { class: 'label' }, step.label, step.from ? h('span', { class: 'via' }, `via ${step.from}`) : null),
    h('span', { class: 'dur' }, done(step) && step.status !== 'skipped' ? duration(step.durationMs) : ''),
    step.error ? h('span', { class: 'err' }, step.error) : null,
    step.answer?.answer ? h('span', { class: 'peek' }, step.answer.answer.replace(/\*\*|`/g, '').replace(/(^|\s)\*(\S[^*]*?)\*/g, '$1$2')) : null,
    step.answer?.citations?.length ? h('span', { class: 'cites' }, step.answer.citations.map((c) => h('span', {}, `${c.n} · ${shortTitle(c.title)}`))) : null,
  );
}

function pin(flow, step) {
  state.pinned = { flowIndex: flow.index, stepIndex: step.index };
  renderMain();
}

/** The step on the stage: the one clicked, else the latest with a screen or an answer. */
function stageStep() {
  const view = state.view;
  if (!view) return null;
  if (state.pinned) {
    const flow = view.flows[state.pinned.flowIndex];
    const step = flow?.steps[state.pinned.stepIndex - 1];
    if (flow && step) return { flow, step };
  }
  let latest = null;
  for (const flow of view.flows) for (const step of flow.steps) if (step.screenshot || step.answer) latest = { flow, step };
  return latest;
}

function renderStage() {
  const shown = stageStep();
  if (!shown) return h('section', { class: 'stage' }, h('div', { class: 'empty' }, 'Screens and answers appear here as the run goes.'));
  const { flow, step } = shown;
  const header = h(
    'div',
    { class: 'stage-h' },
    h('span', { class: 'title' }, `${flow.name} · step ${step.index}`),
    state.pinned && state.view.live ? h('button', { type: 'button', class: 'btn ghost small', onclick: () => ((state.pinned = null), renderMain()) }, 'Follow live') : null,
  );
  if (step.answer) {
    const a = step.answer;
    const check = flow.steps.find((s) => s.case === step.case && s.action === 'expect' && s.index > step.index);
    return h(
      'section',
      { class: 'stage' },
      header,
      h(
        'div',
        { class: 'qa' },
        h('p', { class: 'q' }, `“${a.question}”`),
        h('div', { class: 'a' }, a.answer ? emphasis(a.answer) : h('em', { class: 'muted' }, 'No answer text.')),
        a.citations.length
          ? h('ol', {}, a.citations.map((c) => h('li', {}, h('span', { class: 'n' }, String(c.n)), h('span', {}, h('strong', {}, shortTitle(c.title)), c.quotes?.[0] ? h('q', {}, c.quotes[0]) : null))))
          : h('p', { class: 'muted' }, 'No citations.'),
        check && done(check)
          ? h('div', { class: `verdict ${check.status === 'passed' ? 'passed' : 'failed'}` }, check.status === 'passed' ? `✓ ${check.label}` : `✕ ${check.error}`)
          : null,
        h('p', { class: 'meta' }, [a.model, duration(a.latencyMs), `${a.retrieved} passages retrieved`].filter(Boolean).join(' · ')),
      ),
    );
  }
  return h(
    'section',
    { class: 'stage' },
    header,
    h('a', { href: step.screenshot, target: '_blank', rel: 'noopener' }, h('img', { src: step.screenshot, alt: `Screen after step ${step.index}: ${step.label}` })),
    h('div', { class: 'stage-h' }, h('span', { class: 'title' }, step.label), h('span', { class: `badge ${step.status}` }, STATUS[step.status])),
  );
}

function shortTitle(title) {
  return String(title ?? '').replace(/ \(p\. [^)]*\)/, '').replace(/ — [^—]+$/, '');
}

async function stopRun() {
  try {
    await api('/api/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    toast('Stopping after the current step.');
  } catch (err) {
    toast(err.message);
  }
}

// ---------------------------------------------------------------- start

document.getElementById('run-all').addEventListener('click', () => {
  const ids = (state.overview?.suites ?? []).flatMap((s) => s.flows.filter((f) => !f.error).map((f) => f.id));
  startRun(ids);
});

setInterval(() => {
  if (state.view?.live) {
    const el = document.querySelector('.stats .elapsed b');
    if (el) el.textContent = duration(Date.now() - new Date(state.view.startedAt).getTime());
  }
}, 1000);

(async () => {
  renderMain();
  try {
    await Promise.all([loadOverview(), loadRuns()]);
  } catch (err) {
    toast(`Can't reach the console server: ${err.message}`);
    return;
  }
  loadTargets();
  setInterval(loadTargets, 20_000);
  connectLive();
  const wanted = location.hash.slice(1);
  const live = state.overview.live;
  if (live && !live.finished) return; // the live stream replays the run in progress
  if (wanted) openRun(wanted);
  else if (state.runs[0]) openRun(state.runs[0].id);
})();
