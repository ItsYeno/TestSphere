/**
 * Prepare a local BuildAI for the example agent and web flows:
 * create the organization (first run only), the Maintenance and HSE knowledge
 * bases, upload the sample procedures in ./documents, and wait until they are
 * indexed. Then write ../.env so `testsphere run` can sign in.
 *
 * Start BuildAI in mock mode first (no API key, no spend), from the BuildAI folder:
 *   MOCK_LLM=true SETUP_TOKEN=<a long random string> npm run dev
 *
 * Then, from the runner folder:
 *   BUILDAI_SETUP_CODE=<the same string> node examples/local/seed.mjs
 *
 * Environment:
 *   BUILDAI_URL         API address (default http://localhost:3000)
 *   BUILDAI_WEB_URL     web app address (default http://localhost:5173)
 *   BUILDAI_SETUP_CODE  setup code, needed only the first time
 *   BUILDAI_EMAIL       account to create or sign in with (default tester@testsphere.local)
 *   BUILDAI_PASSWORD    its password (generated on first setup when unset)
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const BASE = (process.env.BUILDAI_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const WEB = (process.env.BUILDAI_WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const email = process.env.BUILDAI_EMAIL ?? 'tester@testsphere.local';
let password = process.env.BUILDAI_PASSWORD;

const KNOWLEDGE_BASES = {
  Maintenance: {
    description: 'Rotating equipment and maintenance procedures (sample).',
    instructions:
      'Answer only from the documents in this knowledge base and cite them. If they do not cover a question, say so plainly and stop: do not add general knowledge.',
  },
  HSE: {
    description: 'Health, safety and environment procedures (sample).',
    instructions:
      'Answer only from the documents in this knowledge base and cite them. If they do not cover a question, say so plainly and stop: do not add general knowledge.',
  },
};

let cookie = '';

async function api(method, route, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${BASE}/api${route}`, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  }).catch((err) => {
    throw new Error(`Can't reach BuildAI at ${BASE} (${err.cause?.code ?? err.message}). Start it first; see the top of this file.`);
  });
  const session = res.headers.getSetCookie().find((c) => c.startsWith('buildai_session='));
  if (session) cookie = session.split(';')[0];
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) throw new Error(`${method} ${route}: ${data.error?.message ?? res.status}`);
  return data;
}

async function signIn() {
  const state = await api('GET', '/auth/state');
  if (state.needsSetup) {
    const code = process.env.BUILDAI_SETUP_CODE;
    if (!code) throw new Error('This BuildAI has no organization yet. Set BUILDAI_SETUP_CODE to its setup code.');
    password ??= randomBytes(18).toString('base64url');
    await api('POST', '/auth/setup', { code, orgName: 'TestSphere Demo', name: 'TestSphere', email, password });
    console.log(`Created the organization with owner ${email}`);
  } else {
    if (!password) throw new Error('Set BUILDAI_EMAIL and BUILDAI_PASSWORD for an admin of this BuildAI.');
    await api('POST', '/auth/login', { email, password });
    console.log(`Signed in as ${email}`);
  }
}

async function ensureKnowledgeBase(name, fields) {
  const { workspaces } = await api('GET', '/workspaces');
  const existing = workspaces.find((w) => w.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    await api('PATCH', `/workspaces/${existing.id}`, { instructions: fields.instructions });
    return existing.id;
  }
  const { workspace } = await api('POST', '/workspaces', { name, ...fields });
  console.log(`Created knowledge base ${name}`);
  return workspace.id;
}

async function upload(workspaceId, folder) {
  const form = new FormData();
  for (const file of fs.readdirSync(folder)) {
    form.append('files', new Blob([fs.readFileSync(path.join(folder, file))], { type: 'text/markdown' }), file);
  }
  const { accepted = [], rejected = [] } = await api('POST', `/workspaces/${workspaceId}/documents`, form);
  for (const a of accepted) console.log(`  uploaded ${a.filename}`);
  for (const r of rejected) console.log(`  skipped ${r.filename}: ${r.error}`);
}

async function waitUntilIndexed(workspaceId, name) {
  const deadline = Date.now() + 180_000;
  for (;;) {
    const { documents } = await api('GET', `/workspaces/${workspaceId}/documents`);
    const pending = documents.filter((d) => d.status === 'queued' || d.status === 'processing');
    const failed = documents.filter((d) => d.status === 'failed');
    if (failed.length) throw new Error(`${name}: ${failed.map((d) => `${d.title}: ${d.error}`).join('; ')}`);
    if (!pending.length) return console.log(`${name}: ${documents.length} documents ready`);
    if (Date.now() > deadline) throw new Error(`${name}: documents still indexing after 3 minutes`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

function writeEnv() {
  const values = { BUILDAI_URL: BASE, BUILDAI_WEB_URL: WEB, BUILDAI_EMAIL: email, BUILDAI_PASSWORD: password };
  const kept = fs.existsSync(envFile)
    ? fs.readFileSync(envFile, 'utf8').split('\n').filter((line) => line.trim() && !Object.keys(values).some((k) => line.startsWith(`${k}=`)))
    : ['# Local test account for the example flows. Keep this file out of git.'];
  fs.writeFileSync(envFile, `${[...kept, ...Object.entries(values).map(([k, v]) => `${k}=${v}`)].join('\n')}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), envFile)}`);
}

await signIn();
for (const [name, fields] of Object.entries(KNOWLEDGE_BASES)) {
  const id = await ensureKnowledgeBase(name, fields);
  await upload(id, path.join(here, 'documents', name));
  await waitUntilIndexed(id, name);
}
writeEnv();
console.log('\nReady. Try: node bin/testsphere.js run examples/agents');
