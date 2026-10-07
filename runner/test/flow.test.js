import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoverFlows, incompatibleSteps, loadFlow } from '../src/flow.js';
import { workspace } from './fakes.js';

const locators = `
login:
  email: "#email"
  password: "#password"
  submit: button[type=submit]
home:
  greeting: "#greeting"
`;

test('a web flow parses into labelled steps, keeping leading zeros', () => {
  const ws = workspace({
    'app.html': '<html></html>',
    'locators.yaml': locators,
    'flow.yaml': `
name: Sign in
tags: [smoke, web]
locators: ./locators.yaml
steps:
  - open: ./app.html
  - type: { into: login.email, text: 08032001111 }
  - click: login.submit
  - expect: { text: home.greeting, contains: Welcome }
  - expect: home.greeting
  - wait: 1.5s
  - back
  - name: Accept cookies
    tap: { text: Accept }
    optional: true
    timeout: 2s
`,
  });
  const flow = loadFlow(ws.path('flow.yaml'));
  assert.equal(flow.name, 'Sign in');
  assert.deepEqual(flow.tags, ['smoke', 'web']);
  assert.deepEqual(flow.steps.map((s) => s.action), ['open', 'type', 'tap', 'expect', 'expect', 'wait', 'back', 'tap']);
  assert.match(flow.steps[0].args.url, /^file:\/\/.*app\.html$/);
  assert.equal(flow.steps[1].args.text, '08032001111');
  assert.equal(flow.steps[1].label, 'Type "08032001111" into login.email');
  assert.equal(flow.steps[2].label, 'Tap login.submit');
  assert.equal(flow.steps[3].label, 'Expect home.greeting text to contain "Welcome"');
  assert.equal(flow.steps[4].label, 'Expect home.greeting to be visible');
  assert.equal(flow.steps[5].args.ms, 1500);
  assert.equal(flow.steps[7].label, 'Accept cookies');
  assert.equal(flow.steps[7].optional, true);
  assert.equal(flow.steps[7].timeout, 2000);
});

test('mistakes are reported with the file, step and a suggestion', () => {
  const ws = workspace({
    'typo.yaml': 'steps:\n  - tapp: "#x"\n',
    'double.yaml': 'steps:\n  - tap: "#x"\n    wait: 1s\n',
    'field.yaml': 'name: x\nstep:\n  - tap: "#x"\n',
    'open.yaml': 'steps:\n  - open: example.com\n',
    'mixed.yaml': 'steps:\n  - expect: { visible: "#x", mentions: hello }\n',
  });
  assert.throws(() => loadFlow(ws.path('typo.yaml')), /step 1: unknown action "tapp"\. Did you mean "tap"\?/);
  assert.throws(() => loadFlow(ws.path('double.yaml')), /one action per step, but found tap and wait/);
  assert.throws(() => loadFlow(ws.path('field.yaml')), /unknown field "step"\. Did you mean "steps"\?/);
  assert.throws(() => loadFlow(ws.path('open.yaml')), /open needs a full URL/);
  assert.throws(() => loadFlow(ws.path('mixed.yaml')), /separate expect steps/);
});

test('variables come from the flow, then --var; environment values are masked', () => {
  process.env.TS_TEST_PASSWORD = 'hunter2';
  const ws = workspace({
    'flow.yaml': `
vars:
  email: ada@example.com
  password: \${env.TS_TEST_PASSWORD}
steps:
  - type: { into: "#email", text: "\${email}" }
  - type: { into: "#password", text: "\${password}" }
  - type: { into: "#note", text: "literal $\${price}" }
`,
    'missing.yaml': 'steps:\n  - type: { into: "#x", text: "${emial}" }\nvars: { email: a@b.c }\n',
  });
  assert.equal(loadFlow(ws.path('flow.yaml')).steps[0].args.text, 'ada@example.com');
  const flow = loadFlow(ws.path('flow.yaml'), { vars: { email: 'grace@example.com' } });
  assert.equal(flow.steps[0].args.text, 'grace@example.com');
  assert.equal(flow.steps[1].args.text, 'hunter2');
  assert.equal(flow.steps[1].label, 'Type "••••••" into #password');
  assert.equal(flow.steps[2].args.text, 'literal ${price}');
  assert.throws(() => loadFlow(ws.path('missing.yaml')), /unknown variable \$\{emial\}\. Did you mean "email"\?/);
});

test('use: inlines another flow, passing variables, and catches loops', () => {
  const ws = workspace({
    '_sign-in.yaml': `
name: Sign in
vars: { email: default@example.com }
steps:
  - type: { into: "#email", text: "\${email}" }
  - tap: "#go"
`,
    'buy.yaml': `
steps:
  - use: { flow: ./_sign-in.yaml, with: { email: buyer@example.com } }
  - tap: "#buy"
`,
    'a.yaml': 'steps:\n  - use: ./b.yaml\n',
    'b.yaml': 'steps:\n  - use: ./a.yaml\n',
  });
  const flow = loadFlow(ws.path('buy.yaml'));
  assert.deepEqual(flow.steps.map((s) => [s.label, s.from]), [
    ['Type "buyer@example.com" into #email', 'Sign in'],
    ['Tap #go', 'Sign in'],
    ['Tap #buy', null],
  ]);
  assert.throws(() => loadFlow(ws.path('a.yaml')), /ends up using itself/);
});

test('agent cases expand into ask and expect steps tagged with their case', () => {
  const ws = workspace({
    'agent.yaml': `
name: Maintenance agent
target: maintenance
cases:
  - name: Vibration alarm limit
    ask: What is the vibration alarm limit for P-101?
    expect:
      mentions: ["7.1 mm/s"]
      cites: Pump Vibration
      grounded: true
  - ask: What is the share price today?
    expect: { declines: true, latencyUnder: 30s }
  - name: Follow-up
    steps:
      - ask: Which pump?
      - ask: { question: And its trip limit?, followUp: true }
      - expect: { mentionsAny: [trip, shutdown] }
`,
  });
  const flow = loadFlow(ws.path('agent.yaml'));
  assert.deepEqual(flow.cases.map((c) => c.name), ['Vibration alarm limit', 'What is the share price today?', 'Follow-up']);
  assert.deepEqual(flow.steps.map((s) => [s.action, s.case]), [['ask', 0], ['expect', 0], ['ask', 1], ['expect', 1], ['ask', 2], ['ask', 2], ['expect', 2]]);
  assert.deepEqual(flow.steps[1].args.checks.map((c) => c.kind), ['mentions', 'cites', 'grounded']);
  assert.equal(flow.steps[3].args.checks[1].ms, 30_000);
  assert.equal(flow.steps[5].args.followUp, true);
  assert.equal(flow.steps[1].label, 'Expect answer to mention "7.1 mm/s"; answer to cite "Pump Vibration"; answer to be grounded in the knowledge base');
  assert.deepEqual(incompatibleSteps(flow, 'buildai'), []);
  assert.equal(incompatibleSteps(flow, 'web').length, 7);
});

test('steps that need another kind of target are flagged before running', () => {
  const ws = workspace({ 'f.yaml': 'steps:\n  - swipe: up\n  - open: https://example.com\n  - tap: "#x"\n' });
  const flow = loadFlow(ws.path('f.yaml'));
  assert.equal(incompatibleSteps(flow, 'web').length, 1);
  assert.equal(incompatibleSteps(flow, 'android').length, 1);
  assert.match(incompatibleSteps(flow, 'buildai')[0], /can't run on a buildai target/);
});

test('folders yield flow files only, skipping locator files and _partials', () => {
  const ws = workspace({
    'flows/a.yaml': 'steps:\n  - back\n',
    'flows/nested/b.json': JSON.stringify({ steps: ['back'] }),
    'flows/_partial.yaml': 'steps:\n  - back\n',
    'flows/locators.json': JSON.stringify({ home: { title: '#t' } }),
    'flows/testsphere.config.yaml': 'defaults: {}\n',
  });
  const found = discoverFlows([ws.path('flows')]).map((f) => f.slice(ws.dir.length + 1).replaceAll('\\', '/'));
  assert.deepEqual(found, ['flows/a.yaml', 'flows/nested/b.json']);
});
