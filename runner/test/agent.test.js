import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAnswer } from '../src/actions.js';
import { BuildAIClient, readAnswer } from '../src/buildai.js';

const doc = (title, extra = {}) => ({ kind: 'document', title, n: 1, quotes: [], ...extra });
const answer = (text, extra = {}) => ({ answer: text, citations: [], sources: [], status: 'complete', latencyMs: 2000, ...extra });
const check = (a, checks) => () => checkAnswer(a, checks);

test('mentions and excludes match phrases regardless of case and Markdown emphasis', () => {
  const a = answer('Apply **Lock-Out/Tag-Out** before opening the casing.');
  assert.doesNotThrow(check(a, [{ kind: 'mentions', items: ['lock-out/tag-out', 'casing'] }]));
  assert.throws(check(a, [{ kind: 'mentions', items: ['permit to work', 'casing'] }]), /doesn't mention "permit to work"\.$/);
  assert.throws(check(a, [{ kind: 'excludes', items: ['casing'] }]), /mentions "casing", which it shouldn't/);
  assert.doesNotThrow(check(a, [{ kind: 'mentionsAny', items: ['LOTO', 'tag-out'] }]));
});

test('cites and grounded look at what the answer actually cited', () => {
  const a = answer('Alarm at 7.1 mm/s.', { citations: [doc('MNT-PRO-014 Pump Vibration Monitoring')] });
  assert.doesNotThrow(check(a, [{ kind: 'cites', items: ['pump vibration'] }, { kind: 'grounded' }]));
  assert.throws(check(a, [{ kind: 'cites', items: ['Isolation Procedure'] }]), /doesn't cite "Isolation Procedure"\. It cites "MNT-PRO-014 Pump Vibration Monitoring"/);
  assert.throws(check(answer('From memory: 7 mm/s.'), [{ kind: 'grounded' }]), /cites nothing from the knowledge base/);
  const web = answer('x', { citations: [doc('Policy'), { kind: 'web', title: 'News', url: 'https://news.example' }] });
  assert.throws(check(web, [{ kind: 'grounded' }]), /cites web pages: "https:\/\/news.example"/);
});

test('declines passes when the agent says its documents do not cover the question', () => {
  for (const text of [
    "The documents in this knowledge base don't cover share prices.",
    "I couldn't find anything about that in the Maintenance documents.",
    'There is no information about this in the available procedures.',
    'That is outside the scope of this knowledge base.',
  ]) {
    assert.doesNotThrow(check(answer(text), [{ kind: 'declines' }]), text);
  }
  assert.doesNotThrow(check(answer('', { status: 'refused' }), [{ kind: 'declines' }]));
  assert.throws(check(answer('It is ₦300.'), [{ kind: 'declines' }]), /but it answered: "It is ₦300\."/);
  assert.throws(check(answer("The documents don't cover it.", { citations: [doc('Old memo')] }), [{ kind: 'declines' }]), /but it cited "Old memo"/);
});

test('latencyUnder and a missing ask are reported plainly', () => {
  assert.throws(check(answer('x', { latencyMs: 45_000 }), [{ kind: 'latencyUnder', ms: 30_000 }]), /took 45\.0s, over the 30\.0s limit/);
  assert.throws(() => checkAnswer(null, [{ kind: 'mentions', items: ['x'] }]), /put an ask step before this expect/);
});

test("BuildAI's event stream is read into an answer, across chunk boundaries", async () => {
  const events = [
    'event: meta\ndata: {"conversationId":"c1"}\n\n',
    ': keep-alive\n\n',
    'event: sources\ndata: {"sources":[{"id":"s1","kind":"document","title":"Pump Vibration"}]}\r\n\r\n',
    'event: delta\ndata: {"text":"Alarm at "}\n\nevent: del',
    'ta\ndata: {"text":"7.1 mm/s."}\n\n',
    'event: citations\ndata: {"markers":"[[cite:1]]","citations":[{"n":1,"kind":"document","title":"Pump Vibration","quotes":["7.1 mm/s RMS"]}]}\n\n',
    'event: done\ndata: {"status":"complete","model":"claude-sonnet-5-5","costUsd":0.012,"latencyMs":3400}\n\n',
  ];
  const a = await readAnswer(streamOf(events));
  assert.equal(a.answer, 'Alarm at 7.1 mm/s.');
  assert.equal(a.citations[0].title, 'Pump Vibration');
  assert.equal(a.sources.length, 1);
  assert.deepEqual([a.status, a.model, a.costUsd, a.latencyMs], ['complete', 'claude-sonnet-5-5', 0.012, 3400]);

  const refused = await readAnswer(streamOf(['event: delta\ndata: {"text":"partial"}\n\n', 'event: error\ndata: {"code":"refused","message":"declined"}\n\n', 'event: done\ndata: {"status":"refused"}\n\n']));
  assert.deepEqual([refused.status, refused.answer], ['refused', '']);
  await assert.rejects(readAnswer(streamOf(['event: error\ndata: {"code":"failed","message":"Something went wrong"}\n\n'])), /couldn't answer: Something went wrong/);
});

test('the BuildAI client signs in, finds the knowledge base, asks, and cleans up', async () => {
  const calls = [];
  let limited = true;
  const fetch = async (url, init) => {
    const route = `${init.method} ${new URL(url).pathname}`;
    calls.push({ route, cookie: init.headers.Cookie ?? null, body: init.body ? JSON.parse(init.body) : null });
    switch (route) {
      case 'POST /api/auth/login':
        return json({ user: { email: 'tester@example.com' } }, 200, { 'set-cookie': 'buildai_session=abc123; Path=/; HttpOnly' });
      case 'GET /api/bootstrap':
        return json({ user: { email: 'tester@example.com' }, org: { name: 'NNPC (test)' }, workspaces: [{ id: 'w1', name: 'Maintenance', documents: 3, readyDocuments: 3 }] });
      case 'POST /api/conversations':
        return json({ conversation: { id: `c${calls.filter((c) => c.route === route).length}` } }, 201);
      case 'POST /api/conversations/c1/messages':
        if (limited) {
          limited = false;
          return json({ error: { code: 'rate_limited' } }, 429, { ratelimit: '"chat";r=0;t=0' });
        }
        return new Response(streamOf(['event: delta\ndata: {"text":"Seven."}\n\n', 'event: done\ndata: {"status":"complete","latencyMs":10}\n\n']), { status: 200 });
      default:
        return json({ ok: true });
    }
  };

  const client = new BuildAIClient(
    { url: 'http://buildai.test', knowledgeBase: 'maintenance', email: 'tester@example.com', password: 'x', mode: 'fast', answerTimeout: 5000, keepConversations: false },
    { fetch },
  );
  const device = await client.connect();
  assert.equal(device.knowledgeBase, 'Maintenance');
  assert.equal(device.organization, 'NNPC (test)');

  const a = await client.ask('Alarm limit?');
  assert.equal(a.answer, 'Seven.');
  const asks = calls.filter((c) => c.route.endsWith('/messages'));
  assert.equal(asks.length, 2, 'retried once after the rate limit');
  assert.deepEqual(asks[1].body, { text: 'Alarm limit?', mode: 'fast' });
  assert.equal(asks[1].cookie, 'buildai_session=abc123');
  assert.deepEqual(calls.find((c) => c.route === 'POST /api/conversations').body, { workspaceId: 'w1' });

  await client.close();
  assert.deepEqual(calls.slice(-2).map((c) => c.route), ['DELETE /api/conversations/c1', 'POST /api/auth/logout']);

  const lost = new BuildAIClient({ url: 'http://buildai.test', knowledgeBase: 'Finance', email: 'a', password: 'b', answerTimeout: 1000 }, { fetch });
  await assert.rejects(lost.connect(), /no knowledge base called "Finance".*Available to them: "Maintenance"/);

  // A later flow in the same run reuses the session instead of signing in again.
  calls.length = 0;
  const reused = new BuildAIClient({ url: 'http://buildai.test', knowledgeBase: 'Maintenance', email: 'a', password: 'b', answerTimeout: 1000 }, { fetch, cookie: 'buildai_session=abc123' });
  await reused.connect();
  assert.deepEqual(calls.map((c) => [c.route, c.cookie]), [['GET /api/bootstrap', 'buildai_session=abc123']]);
  await reused.close({ signOut: false });
  assert.equal(calls.length, 1, 'a shared session stays signed in');
});

function streamOf(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}
