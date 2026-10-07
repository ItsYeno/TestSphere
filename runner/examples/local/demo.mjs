/**
 * One-click demo: BuildAI, THE EYE and the TestSphere Console, with the sample
 * procedures loaded and the browser tabs open. Double-click start-demo.cmd
 * beside this file, or run from the runner folder:
 *
 *   node examples/local/demo.mjs [--no-browser]
 *
 * Ctrl+C stops everything this script started; anything that was already
 * running is left alone.
 *
 * On first use it writes BuildAI's .env in simulation mode (no API key, no
 * spend), creates the demo organization and test account, and loads the
 * sample procedures. If BuildAI's .env already exists it is used as it is,
 * so with MOCK_LLM=false and an ANTHROPIC_API_KEY the demo gives real answers.
 *
 * Folders and ports, overridable in examples/.env:
 *   BUILDAI_DIR    default: a BuildAI folder beside the TestSphere folder
 *   THE_EYE_DIST   default: Downloads/THE_EYE_source/the-eye/dist
 *   THE_EYE_PORT   default: 8765
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { loadConfig } from '../../src/config.js';
import { createConsole } from '../../src/console.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.resolve(here, '..');
const repo = path.resolve(examples, '..', '..');
const baseEnv = { ...process.env }; // what BuildAI and the seed script start with
const envFile = path.join(examples, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const BUILDAI_DIR = path.resolve(process.env.BUILDAI_DIR ?? path.join(repo, '..', 'BuildAI'));
const THE_EYE_DIST = path.resolve(process.env.THE_EYE_DIST ?? path.join(os.homedir(), 'Downloads', 'THE_EYE_source', 'the-eye', 'dist'));
const API = 'http://localhost:3000';
const WEB = 'http://localhost:5173';
const EYE_PORT = Number(process.env.THE_EYE_PORT ?? 8765);
const EYE = `http://localhost:${EYE_PORT}`;
process.env.THE_EYE_URL ??= EYE; // the console's the-eye target follows
const CONSOLE_PORT = 4600;
const openBrowser = !process.argv.includes('--no-browser');
const logDir = path.join(examples, 'runs', 'demo-logs');
const cleanups = [];

const say = (text) => console.log(text);
const step = (text) => console.log(`\n▸ ${text}`);
const ok = (text) => console.log(`  ✓ ${text}`);
const warn = (text) => console.log(`  ! ${text}`);

async function main() {
  console.log('TestSphere demo: BuildAI, THE EYE and the TestSphere Console');
  fs.mkdirSync(logDir, { recursive: true });

  // ------------------------------------------------------------ BuildAI
  step('BuildAI');
  if (!fs.existsSync(path.join(BUILDAI_DIR, 'package.json'))) {
    throw new Error(`BuildAI isn't at ${BUILDAI_DIR}. Set BUILDAI_DIR in runner/examples/.env.`);
  }
  if (!fs.existsSync(path.join(BUILDAI_DIR, 'node_modules'))) {
    throw new Error(`BuildAI's packages aren't installed. Run "npm install" in ${BUILDAI_DIR} once, then start the demo again.`);
  }
  const buildaiEnv = ensureBuildAIEnv();
  ok(buildaiEnv.mock ? 'simulation mode: no API key, no spend' : 'live mode: answers come from Claude and use your API key');

  let setupCode = buildaiEnv.setupToken;
  if (await reachable(`${API}/api/auth/state`)) {
    ok('already running');
  } else {
    const log = fs.createWriteStream(path.join(logDir, 'buildai.log'));
    const child = spawn('npm run dev', { cwd: BUILDAI_DIR, shell: true, env: baseEnv, windowsHide: true });
    const watch = (chunk) => {
      log.write(chunk);
      const code = /enter the code\s+(\S+)/.exec(String(chunk))?.[1];
      if (code) setupCode ??= code;
    };
    child.stdout.on('data', watch);
    child.stderr.on('data', watch);
    cleanups.push(() => stopTree(child));
    say('  starting (about 10 seconds)…');
    const exited = new Promise((resolve) => child.once('exit', resolve));
    const up = await Promise.race([waitFor(`${API}/api/auth/state`, 120_000).then(() => waitFor(WEB, 60_000)), exited.then(() => false)]);
    if (!up) throw new Error(`BuildAI didn't start. See ${path.relative(process.cwd(), path.join(logDir, 'buildai.log'))}.`);
    ok(`running: app ${WEB}, API ${API}`);
  }

  step('Sample procedures and the demo account');
  const seeded = await run(process.execPath, [path.join(here, 'seed.mjs')], { ...baseEnv, ...(setupCode ? { BUILDAI_SETUP_CODE: setupCode } : {}) });
  if (seeded) {
    process.loadEnvFile(envFile); // the seed script may have just written the account
    ok(`ready. Sign in to BuildAI as ${process.env.BUILDAI_EMAIL}; the password is in runner/examples/.env`);
  } else {
    warn("Couldn't prepare BuildAI's demo data (see above). The agent suites will fail until it's fixed.");
  }

  // ------------------------------------------------------------ THE EYE
  step('THE EYE');
  let eyeReady = false;
  if (await reachable(`${EYE}/test.html`)) {
    ok('already being served');
    eyeReady = true;
  } else if (fs.existsSync(path.join(THE_EYE_DIST, 'test.html'))) {
    const server = serveFolder(THE_EYE_DIST, EYE_PORT);
    await new Promise((resolve, reject) => server.once('listening', resolve).once('error', reject));
    cleanups.push(() => new Promise((resolve) => server.close(resolve)));
    ok(`serving ${THE_EYE_DIST}`);
    eyeReady = true;
  } else {
    warn(`THE EYE isn't built at ${THE_EYE_DIST}. Run "python build.py" in THE EYE's folder, or set THE_EYE_DIST in runner/examples/.env.`);
  }

  // ------------------------------------------------------------ console
  step('TestSphere Console');
  const consoleUrl = `http://localhost:${CONSOLE_PORT}`;
  if (await reachable(`${consoleUrl}/api/overview`)) {
    ok('already running');
  } else {
    const app = createConsole({ config: loadConfig(path.join(examples, 'testsphere.config.yaml')), project: examples });
    await app.listen(CONSOLE_PORT);
    cleanups.push(() => app.close());
    ok('running');
  }

  // ------------------------------------------------------------ browser
  if (openBrowser) {
    if (eyeReady) openPrivate(`${EYE}/test.html#demo-nnpc`);
    open(WEB);
    open(consoleUrl);
  }

  say('\nThe demo is ready.');
  if (eyeReady) say(`  THE EYE   ${EYE}/test.html#demo-nnpc   (opens in a private window, so it starts fresh)`);
  say(`  BuildAI   ${WEB}   (sign in as ${process.env.BUILDAI_EMAIL ?? 'the demo account'})`);
  say(`  Console   ${consoleUrl}`);
  say('\nKeep this window open during the demo. Press Ctrl+C to stop everything.');
}

// ---------------------------------------------------------------- BuildAI setup

/** Write BuildAI's .env for simulation mode on first use; otherwise read the one that's there. */
function ensureBuildAIEnv() {
  const file = path.join(BUILDAI_DIR, '.env');
  if (!fs.existsSync(file)) {
    const token = randomBytes(18).toString('base64url');
    fs.writeFileSync(
      file,
      [
        '# Written by the TestSphere demo launcher: simulation mode, no API key and no spend.',
        '# For real answers, set MOCK_LLM=false and add ANTHROPIC_API_KEY (see .env.example).',
        'MOCK_LLM=true',
        `SETUP_TOKEN=${token}`,
        '',
      ].join('\n'),
    );
    ok('created BuildAI/.env');
    return { mock: true, setupToken: token };
  }
  const values = parseEnv(fs.readFileSync(file, 'utf8'));
  const mock = ['true', '1'].includes(String(baseEnv.MOCK_LLM ?? values.MOCK_LLM ?? '').toLowerCase());
  return { mock, setupToken: baseEnv.SETUP_TOKEN ?? values.SETUP_TOKEN ?? null };
}

// ---------------------------------------------------------------- helpers

async function reachable(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await reachable(url)) return true;
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

/** Run a Node script, showing its output indented; resolves to whether it succeeded. */
function run(cmd, args, env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, cwd: path.resolve(examples, '..') });
    const show = (chunk) => String(chunk).split(/\r?\n/).filter(Boolean).forEach((line) => say(`    ${line}`));
    child.stdout.on('data', show);
    child.stderr.on('data', show);
    child.on('exit', (code) => resolve(code === 0));
  });
}

/** A tiny static file server for THE EYE's built page. */
function serveFolder(root, port) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, rel);
    if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(port, '127.0.0.1');
  return server;
}

function open(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
}

/** A private window, so THE EYE starts from its demo data each time. Falls back to a normal tab. */
function openPrivate(url) {
  const candidates =
    process.platform === 'win32'
      ? [
          [path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'), '--incognito'],
          [path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'), '--incognito'],
          [path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'), '--inprivate'],
        ]
      : [];
  const found = candidates.find(([exe]) => fs.existsSync(exe));
  if (!found) return open(url);
  spawn(found[0], [found[1], '--new-window', url], { detached: true, stdio: 'ignore' }).on('error', () => open(url)).unref();
}

/** Stop a process and everything it started (npm runs BuildAI's API and web app as children). */
function stopTree(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).on('exit', resolve).on('error', resolve);
    } else {
      child.kill('SIGTERM');
      resolve();
    }
  });
}

let stopping = false;
async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  say('\nStopping the demo…');
  for (const cleanup of cleanups.reverse()) await Promise.resolve(cleanup()).catch(() => {});
  say('Stopped.');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
main().catch(async (err) => {
  console.error(`\n✗ ${err.message}`);
  await shutdown(1);
});
