import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { loadFlow } from '../src/flow.js';
import { runFlows } from '../src/runner.js';
import { fakeAgent, fakeDriver, openWith, workspace } from './fakes.js';

const CONFIG = `
defaults:
  target: chrome
  timeout: 1s
targets:
  phone:
    platform: android
    capabilities: { appium:deviceName: emulator-5554 }
  maintenance:
    platform: buildai
    url: http://buildai.test
    knowledgeBase: Maintenance
    email: tester@example.com
    password: not-a-real-password
`;

function setup(flows) {
  const ws = workspace({ 'testsphere.config.yaml': CONFIG, ...flows });
  const config = loadConfig(ws.path('testsphere.config.yaml'));
  return { ws, config, load: (name) => loadFlow(ws.path(name)) };
}

const signIn = `
name: Sign in
steps:
  - open: https://app.example.com/login
  - type: { into: "#email", text: ada@example.com }
  - tap: "#submit"
  - expect: { text: "#greeting", contains: Welcome }
`;

test('a passing web flow writes the report, results, JUnit and screenshots', async () => {
  const { config, load } = setup({ 'sign-in.yaml': signIn });
  const driver = fakeDriver({
    '#email': { visible: true },
    '#submit': { visible: true, onClick: (screen) => (screen['#greeting'] = { visible: true, text: 'Welcome back, Ada' }) },
  });
  const { run, runDir, files } = await runFlows([load('sign-in.yaml')], { config, open: openWith(driver) });

  assert.equal(run.status, 'passed');
  assert.deepEqual(run.flows[0].steps.map((s) => s.status), ['passed', 'passed', 'passed', 'passed']);
  for (const step of run.flows[0].steps) assert.ok(fs.existsSync(path.join(runDir, step.screenshot)), step.screenshot);
  assert.deepEqual(driver.calls.filter(([c]) => c !== '$'), [
    ['url', 'https://app.example.com/login'],
    ['clear', '#email'],
    ['type', '#email', 'ada@example.com'],
    ['click', '#submit'],
    ['quit'],
  ]);
  const html = fs.readFileSync(files.report, 'utf8');
  assert.match(html, /All 1 flow passed/);
  assert.match(fs.readFileSync(files.junit, 'utf8'), /tests="1" failures="0" errors="0"/);
  assert.equal(JSON.parse(fs.readFileSync(files.result, 'utf8')).flows[0].name, 'Sign in');
  assert.ok(fs.existsSync(path.join(config.defaults.output, 'history.jsonl')));
});

test('a failing step skips the rest, captures the screen and page source', async () => {
  const { config, load } = setup({ 'sign-in.yaml': signIn });
  const driver = fakeDriver({ '#email': { visible: true } });
  const { run, runDir, files } = await runFlows([load('sign-in.yaml')], { config, open: openWith(driver) });
  const flow = run.flows[0];

  assert.equal(run.status, 'failed');
  assert.equal(flow.status, 'failed');
  assert.deepEqual(flow.steps.map((s) => s.status), ['passed', 'passed', 'failed', 'skipped']);
  assert.equal(flow.steps[2].error, "#submit wasn't visible after 1.0s.");
  assert.ok(fs.existsSync(path.join(runDir, flow.pageSource)));
  assert.match(fs.readFileSync(files.report, 'utf8'), /Failed at step 3: Tap #submit/);
  assert.match(fs.readFileSync(files.junit, 'utf8'), /<failure message="#submit wasn&#39;t visible after 1\.0s\."/);
});

test('an optional step can fail without failing the flow', async () => {
  const { config, load } = setup({ 'f.yaml': 'steps:\n  - tap: "#cookie-banner"\n    optional: true\n  - tap: "#go"\n' });
  const driver = fakeDriver({ '#go': { visible: true } });
  const { run } = await runFlows([load('f.yaml')], { config, open: openWith(driver) });
  assert.deepEqual(run.flows[0].steps.map((s) => s.status), ['warned', 'passed']);
  assert.equal(run.status, 'passed');
});

test("a flow that can't start is reported, and the next flow still runs", async () => {
  const { config, load } = setup({ 'a.yaml': 'steps:\n  - back\n', 'b.yaml': 'target: nowhere\nsteps:\n  - back\n' });
  const { run } = await runFlows([load('a.yaml'), load('b.yaml')], {
    config,
    open: openWith(new Error("Can't reach Appium at http://localhost:4723.")),
  });
  assert.deepEqual(run.flows.map((f) => f.status), ['error', 'error']);
  assert.match(run.flows[0].error, /Can't reach Appium/);
  assert.match(run.flows[1].error, /Unknown target "nowhere"/);
  assert.equal(run.flows[0].steps[0].status, 'skipped');
});

test('mobile flows record the screen to video', async () => {
  const { config, load } = setup({ 'm.yaml': 'target: phone\nsteps:\n  - tap: Buy Airtime\n  - swipe: up\n' });
  const driver = fakeDriver({ '~Buy Airtime': { visible: true } }, { platform: 'android' });
  const { run, runDir } = await runFlows([load('m.yaml')], { config, open: openWith(driver) });
  assert.equal(run.flows[0].status, 'passed');
  assert.ok(driver.calls.some(([c]) => c === 'record'));
  assert.equal(fs.readFileSync(path.join(runDir, run.flows[0].video), 'utf8'), 'fake video');
});

test('agent cases are scored independently: one failure does not skip the others', async () => {
  const { config, load } = setup({
    'agent.yaml': `
name: Maintenance agent
target: maintenance
cases:
  - name: Alarm limit
    ask: Vibration alarm limit for P-101?
    expect: { mentions: ["7.1 mm/s"], cites: Pump Vibration }
  - name: Out of scope
    ask: Share price today?
    expect: { declines: true }
  - name: Trip limit
    ask: Trip limit for P-101?
    expect: { mentions: ["11 mm/s"] }
`,
  });
  const vibration = { kind: 'document', title: 'Pump Vibration Monitoring', n: 1, quotes: ['Alarm at 7.1 mm/s RMS'] };
  const agent = fakeAgent({
    'Vibration alarm limit for P-101?': { answer: 'The alarm limit is **7.1 mm/s** RMS [1].', citations: [vibration], costUsd: 0.02 },
    'Share price today?': { answer: 'The share price is about ₦300 according to recent news.', costUsd: 0.01 },
    'Trip limit for P-101?': { answer: 'Trip the pump at 11 mm/s.', citations: [vibration], costUsd: 0.03 },
  });
  const { run, files } = await runFlows([load('agent.yaml')], { config, open: openWith(agent) });
  const flow = run.flows[0];

  assert.equal(flow.status, 'failed');
  assert.deepEqual(flow.cases.map((c) => c.status), ['passed', 'failed', 'passed']);
  assert.equal(agent.asked.length, 3);
  assert.match(flow.steps[3].error, /Expected the agent to say its documents don't cover this, but it answered/);
  assert.equal(flow.steps[0].answer.citations[0].title, 'Pump Vibration Monitoring');
  assert.ok(Math.abs(flow.costUsd - 0.06) < 1e-9);
  assert.deepEqual(run.summary.cases, { total: 3, passed: 2 });
  assert.match(fs.readFileSync(files.junit, 'utf8'), /tests="3" failures="1"/);
});

test('history builds up across runs and shows in the report', async () => {
  const { config, load } = setup({ 'f.yaml': 'steps:\n  - tap: "#go"\n' });
  const flow = load('f.yaml');
  await runFlows([flow], { config, open: openWith(fakeDriver({ '#go': { visible: true } })) });
  await runFlows([flow], { config, open: openWith(fakeDriver({})) });
  const { files } = await runFlows([flow], { config, open: openWith(fakeDriver({ '#go': { visible: true } })) });
  assert.match(fs.readFileSync(files.report, 'utf8'), /Last 3 runs: 2 passed \(67%\)/);
});
