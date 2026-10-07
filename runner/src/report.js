import { trendFor } from './history.js';
import { formatDuration } from './util.js';

const STATUS_TEXT = { passed: 'Passed', failed: 'Failed', error: "Didn't run", warned: 'Warning', skipped: 'Skipped' };

/** A self-contained HTML report; screenshots and video are linked from the run folder beside it. */
export function renderReport(run, history = []) {
  const s = run.summary;
  const verdict = run.status === 'passed'
    ? `All ${plural(s.flows, 'flow')} passed`
    : `${s.failed + s.errors} of ${plural(s.flows, 'flow')} ${s.failed + s.errors === 1 ? 'needs' : 'need'} attention`;
  const tiles = [
    tile(`${s.passed}/${s.flows}`, 'flows passed'),
    s.cases.total ? tile(`${s.cases.passed}/${s.cases.total}`, 'agent questions passed') : '',
    tile(`${s.steps.passed}/${s.steps.total}`, 'steps passed'),
    tile(formatDuration(run.durationMs), 'duration'),
    s.costUsd != null ? tile(`$${s.costUsd.toFixed(2)}`, 'agent cost') : '',
  ].join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TestSphere · ${esc(run.id)} · ${run.status === 'passed' ? 'Passed' : 'Failed'}</title>
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <span class="brand"><span class="mark" aria-hidden="true"></span>TestSphere</span>
  <span class="muted">Run ${esc(run.id)} · ${esc(formatDate(run.startedAt))}</span>
</header>
<main>
  <section class="hero ${run.status}">
    <h1><span class="icon" aria-hidden="true">${run.status === 'passed' ? '✓' : '✕'}</span>${esc(verdict)}</h1>
    <div class="tiles">${tiles}</div>
  </section>
  <section class="flows">
    ${run.flows.map((flow, i) => renderFlow(flow, i, trendFor(history, flow))).join('\n')}
  </section>
  <footer class="muted">TestSphere ${esc(run.environment.testsphere)} · Node ${esc(run.environment.node)} · ${esc(run.environment.os)} · ${esc(run.environment.host)}${run.environment.config ? ` · ${esc(run.environment.config)}` : ''}</footer>
</main>
<dialog id="viewer" aria-label="Screenshot">
  <figure><img alt=""><figcaption></figcaption></figure>
  <div class="viewer-bar">
    <button type="button" data-go="-1" aria-label="Previous screenshot">←</button>
    <span class="viewer-count"></span>
    <button type="button" data-go="1" aria-label="Next screenshot">→</button>
    <button type="button" data-close aria-label="Close">Close</button>
  </div>
</dialog>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

function renderFlow(flow, i, trend) {
  const open = flow.status !== 'passed' ? ' open' : '';
  const where = [flow.target, flow.platform].filter(Boolean).join(' · ');
  const failedCases = flow.cases.filter((c) => c.status === 'failed');
  return `<details class="flow ${flow.status}"${open} id="flow-${i + 1}">
  <summary>
    ${badge(flow.status)}
    <span class="flow-name">${esc(flow.name)}</span>
    ${where ? `<span class="chip">${esc(where)}</span>` : ''}
    ${flow.cases.length ? `<span class="chip">${flow.cases.filter((c) => c.status === 'passed').length}/${flow.cases.length} questions</span>` : ''}
    ${renderTrend(trend)}
    <span class="dur">${formatDuration(flow.durationMs)}</span>
  </summary>
  <div class="flow-body">
    <p class="meta"><code>${esc(flow.file)}</code>${flow.tags.length ? ` · ${flow.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}` : ''}</p>
    ${flow.description ? `<p class="desc">${esc(flow.description)}</p>` : ''}
    ${flow.device ? `<p class="meta">${renderDevice(flow.device)}</p>` : ''}
    ${renderProblem(flow, failedCases, i)}
    ${flow.warnings.map((w) => `<p class="warning">${esc(w)}</p>`).join('')}
    ${flow.cases.length ? renderCases(flow, i) : `<ol class="steps">${flow.steps.map((step) => renderStep(step, i)).join('')}</ol>`}
    ${flow.video ? `<div class="evidence"><h3>Screen recording</h3><video controls preload="metadata" src="${attr(flow.video)}"></video></div>` : ''}
    ${flow.pageSource ? `<p class="meta">Screen at the moment of failure: <a href="${attr(flow.pageSource)}">page source</a></p>` : ''}
  </div>
</details>`;
}

function renderProblem(flow, failedCases, i) {
  if (flow.status === 'error') return `<div class="callout error"><strong>This flow didn't run.</strong> ${esc(flow.error)}</div>`;
  if (flow.status !== 'failed') return '';
  if (flow.cases.length) {
    const links = failedCases.map((c) => `<li><a href="#flow-${i + 1}-case-${c.index + 1}">${esc(c.name)}</a></li>`).join('');
    return `<div class="callout failed"><strong>${failedCases.length} of ${plural(flow.cases.length, 'question')} failed.</strong><ul>${links}</ul></div>`;
  }
  const step = flow.steps.find((s) => s.status === 'failed');
  return `<div class="callout failed">
    <strong>Failed at step ${step.index}: ${esc(step.label)}</strong>
    <p class="error-text">${esc(step.error)}</p>
    ${step.screenshot ? `<button type="button" class="shot large" data-group="${i}" data-src="${attr(step.screenshot)}" data-caption="${attr(`Step ${step.index}: ${step.label}`)}"><img src="${attr(step.screenshot)}" alt="Screen when step ${step.index} failed"></button>` : ''}
  </div>`;
}

function renderCases(flow, i) {
  return flow.cases.map((c) => {
    const steps = flow.steps.filter((s) => s.case === c.index);
    return `<div class="case ${c.status}" id="flow-${i + 1}-case-${c.index + 1}">
      <div class="case-head">${badge(c.status)}<span>${esc(c.name)}</span></div>
      <ol class="steps">${steps.map((step) => renderStep(step, i)).join('')}</ol>
    </div>`;
  }).join('');
}

function renderStep(step, group) {
  const notes = [
    step.from ? `<span class="via">via ${esc(step.from)}</span>` : '',
    step.optional ? '<span class="via">optional</span>' : '',
  ].join('');
  const shot = step.screenshot
    ? `<button type="button" class="shot" data-group="${group}" data-src="${attr(step.screenshot)}" data-caption="${attr(`Step ${step.index}: ${step.label}`)}"><img src="${attr(step.screenshot)}" alt="Screen after step ${step.index}" loading="lazy"></button>`
    : '';
  return `<li class="step ${step.status}">
    <span class="dot" title="${attr(STATUS_TEXT[step.status])}"></span>
    <div class="step-main">
      <div class="step-label">${esc(step.label)}${notes}</div>
      ${step.error ? `<div class="error-text">${esc(step.error)}</div>` : ''}
      ${step.answer ? renderAnswer(step.answer) : ''}
    </div>
    <span class="dur">${step.status === 'skipped' ? '—' : formatDuration(step.durationMs)}</span>
    ${shot}
  </li>`;
}

function renderAnswer(a) {
  const meta = [
    a.status !== 'complete' ? `status: ${a.status}` : '',
    a.model,
    a.latencyMs != null ? formatDuration(a.latencyMs) : '',
    a.costUsd != null ? `$${a.costUsd.toFixed(3)}` : '',
    `${plural(a.retrieved, 'passage')} retrieved`,
  ].filter(Boolean).map(esc).join(' · ');
  const page = (p) => (/^\d+$/.test(String(p)) ? `p. ${p}` : p);
  const cites = a.citations.length
    ? `<ol class="cites">${a.citations.map((c) => `<li><span class="n">${c.n}</span><span><strong>${esc(c.title)}</strong>${c.page && !c.title.includes(c.page) ? ` · ${esc(page(c.page))}` : ''}${c.kind === 'web' ? ' · web' : ''}${c.quotes.length ? `<q>${esc(c.quotes[0])}</q>` : ''}</span></li>`).join('')}</ol>`
    : '<p class="muted small">No citations.</p>';
  return `<div class="answer">
    <div class="answer-text">${a.answer ? emphasis(esc(a.answer)) : '<em class="muted">No answer text.</em>'}</div>
    ${cites}
    ${a.notices.map((n) => `<p class="muted small">${esc(n)}</p>`).join('')}
    <p class="muted small">${meta}</p>
  </div>`;
}

function renderTrend(trend) {
  if (trend.length < 2) return '';
  const passed = trend.filter((t) => t.status === 'passed').length;
  const title = `Last ${trend.length} runs: ${passed} passed (${Math.round((passed / trend.length) * 100)}%)`;
  return `<span class="trend" title="${attr(title)}" aria-label="${attr(title)}">${trend.map((t) => `<i class="${t.status}"></i>`).join('')}</span>`;
}

function renderDevice(device) {
  const labels = {
    browser: 'Browser', version: 'Version', viewport: 'Viewport', emulating: 'Emulating', device: 'Device', os: 'OS', app: 'App',
    udid: 'UDID', organization: 'Organization', knowledgeBase: 'Knowledge base', documents: 'Documents', signedInAs: 'Signed in as', mode: 'Answer mode',
  };
  return Object.entries(device)
    .filter(([key, value]) => labels[key] && value != null && value !== '')
    .map(([key, value]) => `${labels[key]}: <strong>${esc(value)}</strong>`)
    .join(' · ');
}

// ------------------------------------------------------------------ JUnit

/** JUnit XML for CI: one suite per flow; each question (or the whole flow) is a test case. */
export function renderJunit(run) {
  const seconds = (ms) => (ms / 1000).toFixed(3);
  const suites = run.flows.map((flow) => {
    const cases = flow.cases.length
      ? flow.cases.map((c) => {
          const steps = flow.steps.filter((s) => s.case === c.index);
          return { name: c.name, status: flow.status === 'error' ? 'error' : c.status, steps, time: steps.reduce((t, s) => t + s.durationMs, 0) };
        })
      : [{ name: flow.name, status: flow.status, steps: flow.steps, time: flow.durationMs }];
    const body = cases.map((c) => {
      const failed = c.steps.find((s) => s.status === 'failed');
      let inner = '';
      if (c.status === 'error') inner = `<error message="${xml(flow.error ?? 'Did not run')}"/>`;
      else if (c.status === 'failed') inner = `<failure message="${xml(failed?.error ?? 'Failed')}">${xml(c.steps.map((s) => `[${s.status}] ${s.label}${s.error ? ` — ${s.error}` : ''}`).join('\n'))}</failure>`;
      else if (c.status === 'skipped') inner = '<skipped/>';
      return `    <testcase classname="${xml(`${flow.target}.${flow.name}`)}" name="${xml(c.name)}" time="${seconds(c.time)}">${inner}</testcase>`;
    });
    const failures = cases.filter((c) => c.status === 'failed').length;
    const errors = cases.filter((c) => c.status === 'error').length;
    return `  <testsuite name="${xml(flow.name)}" file="${xml(flow.file)}" tests="${cases.length}" failures="${failures}" errors="${errors}" time="${seconds(flow.durationMs)}">\n${body.join('\n')}\n  </testsuite>`;
  });
  const all = run.flows.length;
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="TestSphere" tests="${all}" failures="${run.summary.failed}" errors="${run.summary.errors}" time="${seconds(run.durationMs)}" timestamp="${run.startedAt}">
${suites.join('\n')}
</testsuites>
`;
}

// ------------------------------------------------------------------ helpers

function badge(status) {
  return `<span class="badge ${status}">${STATUS_TEXT[status] ?? status}</span>`;
}

function tile(value, label) {
  return `<div class="tile"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function attr(value) {
  return esc(value);
}

/** Answers are Markdown; show **bold** and *italic* as such. Runs on already-escaped text. */
function emphasis(html) {
  return html.replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*(\S(?:.*?\S)?)\*(?=[\s).,;:!?]|$)/gm, '$1<em>$2</em>');
}

function xml(value) {
  // eslint-disable-next-line no-control-regex
  return esc(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

const CSS = `
:root{--bg:#f5f6f8;--surface:#fff;--text:#1a1e23;--muted:#5d6672;--border:#e2e5e9;--accent:#0f5fae;
--pass:#1a7f37;--pass-bg:#e7f4eb;--fail:#c42b2b;--fail-bg:#fcebeb;--warn:#946200;--warn-bg:#fdf3d7;--skip:#8b939d;--skip-bg:#eef0f2;
--mono:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#0e1115;--surface:#161a20;--text:#e5e8ec;--muted:#9aa3ae;--border:#2a3038;--accent:#6aaef0;
--pass:#56c271;--pass-bg:rgba(86,194,113,.13);--fail:#ff7070;--fail-bg:rgba(255,112,112,.13);--warn:#e2b340;--warn-bg:rgba(226,179,64,.13);--skip:#6f7883;--skip-bg:rgba(111,120,131,.15);color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent)}
code{font-family:var(--mono);font-size:.86em}
.muted{color:var(--muted)}.small{font-size:.85em;margin:.3em 0 0}
.top{display:flex;flex-wrap:wrap;gap:.25rem 1rem;align-items:center;justify-content:space-between;padding:14px max(16px,calc((100vw - 1080px)/2));border-bottom:1px solid var(--border);background:var(--surface)}
.brand{font-weight:650;letter-spacing:.01em;display:inline-flex;align-items:center;gap:.5rem}
.mark{width:18px;height:18px;border-radius:50%;background:conic-gradient(var(--accent) 0 25%,var(--pass) 0 50%,var(--accent) 0 75%,var(--pass) 0);display:inline-block}
main{max-width:1080px;margin:0 auto;padding:20px 16px 48px}
.hero{background:var(--surface);border:1px solid var(--border);border-left:5px solid var(--pass);border-radius:10px;padding:18px 20px;margin-bottom:20px}
.hero.failed{border-left-color:var(--fail)}
.hero h1{font-size:1.35rem;margin:0 0 14px;display:flex;gap:.6rem;align-items:center}
.hero .icon{display:inline-grid;place-items:center;width:1.7rem;height:1.7rem;border-radius:50%;font-size:1rem;background:var(--pass-bg);color:var(--pass)}
.hero.failed .icon{background:var(--fail-bg);color:var(--fail)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.tile{border:1px solid var(--border);border-radius:8px;padding:10px 12px}
.tile strong{display:block;font-size:1.3rem;font-variant-numeric:tabular-nums}
.tile span{color:var(--muted);font-size:.85rem}
.flow{background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden}
.flow>summary{display:flex;flex-wrap:wrap;gap:.4rem .75rem;align-items:center;padding:12px 16px;cursor:pointer;list-style:none}
.flow>summary::-webkit-details-marker{display:none}
.flow>summary::before{content:"›";color:var(--muted);transition:transform .15s;display:inline-block;width:.6rem}
.flow[open]>summary::before{transform:rotate(90deg)}
.flow-name{font-weight:600;flex:1 1 220px;min-width:0}
.flow-body{padding:4px 16px 16px;border-top:1px solid var(--border)}
.meta{color:var(--muted);font-size:.88rem;margin:.6rem 0}
.desc{margin:.4rem 0}
.chip,.tag{font-size:.78rem;border:1px solid var(--border);border-radius:999px;padding:1px 8px;color:var(--muted);white-space:nowrap}
.badge{font-size:.75rem;font-weight:600;border-radius:5px;padding:2px 7px;white-space:nowrap}
.badge.passed{background:var(--pass-bg);color:var(--pass)}.badge.failed{background:var(--fail-bg);color:var(--fail)}
.badge.error{background:var(--warn-bg);color:var(--warn)}.badge.skipped{background:var(--skip-bg);color:var(--skip)}.badge.warned{background:var(--warn-bg);color:var(--warn)}
.dur{color:var(--muted);font-size:.85rem;font-variant-numeric:tabular-nums;white-space:nowrap}
.trend{display:inline-flex;gap:2px;align-items:center}
.trend i{width:7px;height:14px;border-radius:2px;background:var(--pass)}
.trend i.failed{background:var(--fail)}.trend i.error{background:var(--warn)}
.callout{border-radius:8px;padding:12px 14px;margin:12px 0}
.callout.failed{background:var(--fail-bg)}.callout.error{background:var(--warn-bg)}
.callout ul{margin:.4rem 0 0;padding-left:1.2rem}
.warning{background:var(--warn-bg);border-radius:8px;padding:8px 12px;font-size:.9rem}
.error-text{font-family:var(--mono);font-size:.84rem;color:var(--fail);margin:.3rem 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.steps{list-style:none;margin:8px 0 0;padding:0}
.step{display:grid;grid-template-columns:14px 1fr auto auto;gap:4px 10px;align-items:start;padding:8px 0;border-top:1px solid var(--border)}
.step:first-child{border-top:0}
.dot{width:10px;height:10px;border-radius:50%;margin-top:6px;background:var(--skip)}
.step.passed .dot{background:var(--pass)}.step.failed .dot{background:var(--fail)}.step.warned .dot{background:var(--warn)}
.step.skipped .step-label{color:var(--muted)}
.step-main{min-width:0}
.step-label{overflow-wrap:anywhere}
.via{margin-left:.5rem;font-size:.75rem;color:var(--muted);border:1px solid var(--border);border-radius:4px;padding:0 5px}
.step .dur{padding-top:2px}
.shot{border:1px solid var(--border);border-radius:6px;padding:0;background:var(--bg);cursor:zoom-in;overflow:hidden;line-height:0}
.shot img{height:58px;width:auto;max-width:110px;object-fit:cover;object-position:top}
.shot.large{display:block;margin-top:10px}
.shot.large img{height:auto;max-height:360px;max-width:100%;object-fit:contain}
.case{border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin:10px 0}
.case.failed{border-color:var(--fail)}
.case-head{display:flex;gap:.6rem;align-items:center;font-weight:600}
.answer{margin-top:8px;border-left:3px solid var(--border);padding:2px 0 2px 12px}
.answer-text{white-space:pre-wrap;max-height:16em;overflow:auto;font-size:.92rem}
.cites{list-style:none;padding:0;margin:8px 0 0;font-size:.86rem}
.cites li{display:flex;gap:8px;margin-top:4px}
.cites .n{flex:none;display:inline-grid;place-items:center;width:1.3rem;height:1.3rem;border-radius:4px;background:var(--bg);border:1px solid var(--border);font-size:.75rem}
.cites q{display:block;color:var(--muted);font-style:italic}
.evidence h3{font-size:.95rem;margin:16px 0 8px}
.evidence video{max-width:100%;max-height:520px;border-radius:8px;border:1px solid var(--border);background:#000}
footer{margin-top:28px;font-size:.8rem}
dialog{border:0;border-radius:12px;padding:12px;max-width:min(96vw,1200px);background:var(--surface);color:var(--text)}
dialog::backdrop{background:rgba(0,0,0,.7)}
dialog figure{margin:0;text-align:center}
dialog img{max-width:100%;max-height:78vh;border-radius:6px}
dialog figcaption{margin-top:8px;font-size:.9rem}
.viewer-bar{display:flex;gap:8px;justify-content:center;align-items:center;margin-top:8px}
.viewer-bar button{font:inherit;border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:6px;padding:4px 12px;cursor:pointer}
.viewer-count{color:var(--muted);font-size:.85rem;min-width:4rem;text-align:center}
@media (max-width:600px){.step{grid-template-columns:14px 1fr auto}.step .shot{grid-column:2/4;justify-self:start}}
`;

const SCRIPT = `
(() => {
  const viewer = document.getElementById('viewer');
  const img = viewer.querySelector('img');
  const caption = viewer.querySelector('figcaption');
  const count = viewer.querySelector('.viewer-count');
  let list = [], at = 0;
  const show = (i) => {
    at = (i + list.length) % list.length;
    img.src = list[at].dataset.src;
    img.alt = list[at].dataset.caption;
    caption.textContent = list[at].dataset.caption;
    count.textContent = (at + 1) + ' / ' + list.length;
  };
  document.addEventListener('click', (e) => {
    const shot = e.target.closest('.shot');
    if (shot) {
      list = [...document.querySelectorAll('.step .shot[data-group="' + shot.dataset.group + '"]')];
      const index = list.findIndex((s) => s.dataset.src === shot.dataset.src);
      if (index < 0) list.unshift(shot);
      show(Math.max(index, 0));
      viewer.showModal();
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go) show(at + Number(go.dataset.go));
    if (e.target.closest('[data-close]') || e.target === viewer) viewer.close();
  });
  document.addEventListener('keydown', (e) => {
    if (!viewer.open) return;
    if (e.key === 'ArrowRight') show(at + 1);
    if (e.key === 'ArrowLeft') show(at - 1);
  });
})();
`;
