import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createConsole } from '../src/console.js';
import { fakeAgent, fakeDriver, workspace } from './fakes.js';

const ws = workspace({
  'testsphere.config.yaml': `
defaults: { target: chrome, timeout: 1s }
suites:
  agents: { name: BuildAI agents, description: Golden questions per department }
theEye: { kpi: BuildAI answers passing TestSphere checks, department: Digital & Technology, target: 95 }
targets:
  maintenance: { platform: buildai, url: "http://127.0.0.1:9", knowledgeBase: Maintenance, email: t@example.com, password: x }
`,
  'agents/maintenance.yaml': `
name: Maintenance agent
target: maintenance
cases:
  - name: Alarm limit
    ask: Alarm limit?
    expect: { mentions: ["7 mm/s"] }
  - name: Trip limit
    ask: Trip limit?
    expect: { mentions: ["11 mm/s"] }
`,
  'web/sign-in.yaml': 'name: Sign in\nsteps:\n  - tap: "#go"\n',
  'web/_partial.yaml': 'steps:\n  - back\n',
});

const agent = fakeAgent({ 'Alarm limit?': { answer: 'Alarm at 7 mm/s.' }, 'Trip limit?': { answer: 'Trip at 12 mm/s.' } });
const slowAsk = agent.ask.bind(agent);
agent.ask = async (...args) => {
  await new Promise((r) => setTimeout(r, 150));
  return slowAsk(...args);
};
const open = async (target) =>
  target.platform === 'buildai'
    ? { kind: 'agent', agent, device: { platform: 'buildai' }, close: async () => {} }
    : { kind: 'ui', driver: fakeDriver({ '#go': { visible: true } }), device: { platform: 'web' }, close: async () => {} };

let app;
let base;
before(async () => {
  app = createConsole({ config: loadConfig(ws.path('testsphere.config.yaml')), project: ws.dir, open });
  base = await app.listen(0);
});
after(() => app.close());

const get = async (path) => (await fetch(base + path)).json();
const post = (path, body, headers = {}) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('suites come from folders of flows, named from the config', async () => {
  const { suites, score } = await get('/api/overview');
  assert.deepEqual(suites.map((s) => [s.id, s.name, s.flows.map((f) => f.id)]), [
    ['agents', 'BuildAI agents', ['agents/maintenance.yaml']],
    ['web', 'Web', ['web/sign-in.yaml']],
  ]);
  assert.equal(suites[0].flows[0].cases, 2);
  assert.equal(suites[0].flows[0].platform, 'buildai');
  assert.equal(score, null);
});

test('a run streams live, then appears in history, results and the THE EYE export', async () => {
  const events = collect('/api/live', 'done');
  const res = await post('/api/runs', { flows: ['agents/maintenance.yaml', 'web/sign-in.yaml'] });
  assert.equal(res.status, 202);
  const { id } = await res.json();

  const busy = await post('/api/runs', { flows: ['web/sign-in.yaml'] });
  assert.equal(busy.status, 409);

  const seen = await events;
  assert.deepEqual([...new Set(seen.map((e) => e.event))], ['run', 'flow', 'step-start', 'step', 'flow-done', 'done']);
  assert.equal(seen[0].data.id, id);
  assert.equal(seen[0].data.flows[0].steps.length, 4);
  const done = seen.at(-1).data;
  assert.equal(done.status, 'failed');
  assert.deepEqual(done.summary.cases, { total: 2, passed: 1 });

  const { runs } = await get('/api/runs');
  assert.equal(runs[0].id, id);
  const run = await get(`/api/runs/${id}`);
  const shot = run.flows[1].steps[0].screenshot;
  assert.match(shot, new RegExp(`^/runs/${id}/02-sign-in/01-`));
  const image = await fetch(base + shot);
  assert.equal(image.headers.get('content-type'), 'image/png');

  const { score } = await get('/api/overview');
  assert.deepEqual([score.passed, score.total, score.percent], [1, 2, 50]);
  const csv = await (await fetch(`${base}/api/the-eye.csv`)).text();
  assert.equal(csv, `KPI,Month,Actual,Department,Comment\r\nBuildAI answers passing TestSphere checks,${id.slice(0, 7)},50,Digital & Technology,1 of 2 agent questions passed in TestSphere run ${id}\r\n`);
});

test('the console refuses other sites, paths outside its folders, and unknown flows', async () => {
  assert.equal((await post('/api/runs', { flows: ['web/sign-in.yaml'] }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/api/runs', { flows: ['../outside.yaml'] })).status, 400);
  assert.equal((await fetch(`${base}/runs/..%2f..%2ftestsphere.config.yaml`)).status, 404);
  assert.equal((await fetch(`${base}/..%2fsrc%2fconsole.js`)).status, 404);
  const page = await fetch(`${base}/`);
  assert.match(await page.text(), /<title>TestSphere Console<\/title>/);
});

async function collect(path, until) {
  const res = await fetch(base + path);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return events;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (!event) continue;
      events.push({ event, data: JSON.parse(data) });
      if (event === until) {
        await reader.cancel();
        return events;
      }
    }
  }
}
