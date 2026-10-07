import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderJunit, renderReport } from '../src/report.js';
import { interpolate } from '../src/vars.js';

const run = {
  id: 'r1',
  startedAt: '2026-10-07T14:00:00.000Z',
  durationMs: 1500,
  status: 'failed',
  environment: { testsphere: '2.0.0', node: 'v24', os: 'Windows', host: 'pc', config: null },
  summary: { flows: 1, passed: 0, failed: 1, errors: 0, cases: { total: 0, passed: 0 }, steps: { total: 1, passed: 0, failed: 1 }, costUsd: null },
  flows: [
    {
      name: '<script>alert(1)</script>',
      file: 'flows/x.yaml',
      description: null,
      tags: [],
      target: 'chrome',
      platform: 'web',
      status: 'failed',
      durationMs: 1500,
      device: null,
      error: null,
      warnings: [],
      video: null,
      pageSource: null,
      costUsd: null,
      cases: [],
      steps: [{ index: 1, action: 'tap', label: 'Tap "<b>"', from: null, case: null, optional: false, status: 'failed', durationMs: 10, error: 'a & b', screenshot: null, answer: null }],
    },
  ],
};

test('the report escapes everything that came from flows and apps', () => {
  const html = renderReport(run);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /Failed at step 1: Tap &quot;&lt;b&gt;&quot;/);
  assert.match(html, /a &amp; b/);
});

test('JUnit output is valid-looking XML with the failure', () => {
  const xml = renderJunit(run);
  assert.match(xml, /^<\?xml version="1\.0"/);
  assert.match(xml, /<testcase classname="chrome\.&lt;script&gt;alert\(1\)&lt;\/script&gt;"/);
  assert.match(xml, /<failure message="a &amp; b">/);
});

test('environment variables can have a fallback', () => {
  delete process.env.TS_UNSET_URL;
  assert.equal(interpolate('${env.TS_UNSET_URL:-http://localhost:3000}', {}), 'http://localhost:3000');
  process.env.TS_UNSET_URL = 'https://buildai.example';
  assert.equal(interpolate('${env.TS_UNSET_URL:-http://localhost:3000}', {}), 'https://buildai.example');
  delete process.env.TS_UNSET_URL;
  assert.throws(() => interpolate('${env.TS_UNSET_URL}', {}, { where: 'target' }), /target: environment variable TS_UNSET_URL is not set/);
});
