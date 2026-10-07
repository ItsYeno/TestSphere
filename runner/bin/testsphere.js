#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { findConfig, loadConfig, targetPlatform } from '../src/config.js';
import { discoverFlows, incompatibleSteps, loadFlow } from '../src/flow.js';
import { c, consoleReporter, printSummary } from '../src/output.js';
import { VERSION, runFlows } from '../src/runner.js';
import { TestSphereError } from '../src/util.js';

const HELP = `TestSphere ${VERSION}: assurance testing for apps and AI agents

Usage
  testsphere run <flows or folders...>    Run flows and write a report
  testsphere console [folder]             Open the console: run suites and watch them live
  testsphere validate <flows or folders>  Check flows without opening anything
  testsphere init                         Start a test project in this folder

Options for console
  -p, --port <number>     Port to serve on (default 4600)
      --no-open           Don't open a browser window

Options for run and validate
  -t, --target <name>     Run against this target instead of each flow's own
      --var <name=value>  Set a flow variable (repeatable)
      --tag <tag>         Only flows with this tag (repeatable)
  -c, --config <file>     Config file (default: nearest testsphere.config.yaml)
      --headed            Show the browser while it runs
      --out <folder>      Where runs are written (default: runs/ beside the config)

Exit codes: 0 all passed, 1 something failed, 2 the flows or config need fixing.
Docs: README.md next to this tool.`;

const OPTIONS = {
  target: { type: 'string', short: 't' },
  var: { type: 'string', multiple: true },
  tag: { type: 'string', multiple: true },
  config: { type: 'string', short: 'c' },
  headed: { type: 'boolean' },
  out: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
};

async function main(argv) {
  const [command, ...args] = argv;
  if (!command || ['help', '-h', '--help'].includes(command)) return print(HELP, 0);
  if (['-v', '--version', 'version'].includes(command)) return print(VERSION, 0);
  if (command === 'run') return run(args);
  if (command === 'validate') return validate(args);
  if (command === 'console') return openConsole(args);
  if (command === 'init') return init();
  throw new TestSphereError(`Unknown command "${command}". Try: testsphere run flows/`);
}

async function openConsole(args) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { config: { type: 'string', short: 'c' }, port: { type: 'string', short: 'p' }, var: { type: 'string', multiple: true }, 'no-open': { type: 'boolean' } },
  });
  const project = path.resolve(positionals[0] ?? '.');
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) throw new TestSphereError(`No such folder: ${positionals[0]}`);
  const config = loadConfig(values.config ?? findConfig([project]), { cwd: project });
  loadEnv(config);

  const { createConsole } = await import('../src/console.js');
  const app = createConsole({ config, project, vars: parseVars(values.var) });
  const url = await app.listen(Number(values.port ?? 4600));
  console.log(`${c.bold('TestSphere Console')} is running at ${c.cyan(url)}`);
  console.log(c.dim(`Suites from ${project}. Press Ctrl+C to stop.`));
  if (!values['no-open']) openBrowser(url);

  await new Promise((resolve) => process.once('SIGINT', resolve));
  console.log(c.dim('\nStopping…'));
  await app.close();
  return 0;
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  import('node:child_process').then(({ spawn }) => {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  });
}

async function run(args) {
  const { values, flows, config } = prepare(args);
  let stopping = false;
  process.on('SIGINT', () => {
    if (stopping) process.exit(130);
    stopping = true;
    console.error(c.yellow('\nStopping after the current step. Press Ctrl+C again to quit now.'));
  });

  console.log(c.dim(`TestSphere ${VERSION} · ${flows.length} flow${flows.length === 1 ? '' : 's'}${config.file ? ` · ${path.relative(process.cwd(), config.file) || config.file}` : ''}`));
  const { run: result, files } = await runFlows(flows, {
    config,
    target: values.target,
    headed: values.headed,
    output: values.out,
    reporter: consoleReporter(),
    shouldStop: () => stopping,
  });
  printSummary(result, files);
  return result.status === 'passed' ? 0 : 1;
}

async function validate(args) {
  const { values, flows, config } = prepare(args);
  let problems = 0;
  for (const flow of flows) {
    const name = values.target ?? flow.target ?? config.defaults.target;
    const issues = [];
    try {
      issues.push(...incompatibleSteps(flow, targetPlatform(config, name)));
    } catch (err) {
      issues.push(err.message);
    }
    problems += issues.length ? 1 : 0;
    const counts = flow.cases.length ? `${flow.cases.length} questions` : `${flow.steps.length} steps`;
    console.log(`${issues.length ? c.red('✗') : c.green('✓')} ${flow.name} ${c.dim(`· ${counts} · ${name}`)}`);
    for (const issue of issues) console.log(`    ${c.red(issue)}`);
  }
  console.log(problems ? c.red(`\n${problems} of ${flows.length} flows need fixing.`) : c.green(`\nAll ${flows.length} flows are valid.`));
  return problems ? 2 : 0;
}

/** Parse options, find and load every flow; any load error stops before anything runs. */
function prepare(args) {
  const { values, positionals } = parseArgs({ args, options: OPTIONS, allowPositionals: true });
  if (values.help) {
    print(HELP, 0);
    process.exit(0);
  }
  if (!positionals.length) throw new TestSphereError('Which flows? For example: testsphere run flows/');

  const vars = parseVars(values.var);
  const files = discoverFlows(positionals);
  if (!files.length) throw new TestSphereError(`No flows found in ${positionals.join(', ')}.`);
  const configFile = values.config ?? findConfig([path.dirname(files[0]), process.cwd()]);
  const config = loadConfig(configFile);
  loadEnv(config);

  const flows = [];
  const errors = [];
  for (const file of files) {
    try {
      flows.push(loadFlow(file, { vars }));
    } catch (err) {
      if (!(err instanceof TestSphereError)) throw err;
      errors.push(err.message);
    }
  }
  if (errors.length) {
    for (const message of errors) console.error(`${c.red('✗')} ${message}`);
    throw new TestSphereError(`${errors.length} flow${errors.length === 1 ? '' : 's'} couldn't be read. Nothing was run.`);
  }

  const tags = values.tag ?? [];
  const selected = tags.length ? flows.filter((f) => f.tags.some((t) => tags.includes(t))) : flows;
  if (!selected.length) throw new TestSphereError(`No flows are tagged ${tags.join(' or ')}.`);
  return { values, flows: selected, config };
}

function parseVars(pairs = []) {
  const vars = {};
  for (const pair of pairs) {
    const at = pair.indexOf('=');
    if (at < 1) throw new TestSphereError(`--var ${pair} should look like name=value.`);
    vars[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return vars;
}

/** Secrets for targets (BuildAI passwords, tokens) can live in a .env beside the config; real environment variables win. */
function loadEnv(config) {
  const envFile = path.join(config.dir, '.env');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
}

function init() {
  const files = {
    'testsphere.config.yaml': `# TestSphere project settings. Targets are where flows run.
defaults:
  target: chrome
  timeout: 10s              # how long to wait for an element or a check
  screenshots: every-step   # every-step | on-failure | off

targets:
  chrome:
    platform: web
    browser: chrome         # chrome | edge | firefox
    headless: true

  # android:
  #   platform: android
  #   server: http://localhost:4723
  #   capabilities:
  #     appium:automationName: UiAutomator2
  #     appium:deviceName: YOUR_DEVICE_ID      # from: adb devices
  #     appium:appPackage: com.example.app
  #     appium:appActivity: com.example.app.MainActivity
  #     appium:noReset: true

  # maintenance-agent:
  #   platform: buildai
  #   url: http://localhost:3000
  #   knowledgeBase: Maintenance
  #   email: \${env.BUILDAI_EMAIL}
  #   password: \${env.BUILDAI_PASSWORD}
`,
    'flows/smoke.yaml': `name: First flow
tags: [smoke]
steps:
  - open: ./hello.html
  - type: { into: "#name", text: Ada }
  - tap: { text: Say hello }
  - expect: { text: "#greeting", equals: "Hello, Ada" }
`,
    'flows/hello.html': `<!doctype html>
<title>Hello</title>
<label>Name <input id="name"></label>
<button onclick="greeting.textContent = 'Hello, ' + document.getElementById('name').value">Say hello</button>
<p id="greeting"></p>
`,
  };
  for (const [name, content] of Object.entries(files)) {
    if (fs.existsSync(name)) {
      console.log(c.dim(`kept ${name} (already exists)`));
      continue;
    }
    fs.mkdirSync(path.dirname(path.resolve(name)), { recursive: true });
    fs.writeFileSync(name, content);
    console.log(`${c.green('created')} ${name}`);
  }
  console.log(`\nNext: ${c.cyan('testsphere run flows/')}`);
  return 0;
}

function print(text, code) {
  console.log(text);
  return code;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    if (err instanceof TestSphereError || err?.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
      console.error(`${c.red('✗')} ${err.message}`);
      process.exitCode = 2;
    } else {
      console.error(err);
      process.exitCode = 1;
    }
  },
);
