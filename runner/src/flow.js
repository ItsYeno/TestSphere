import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { describeLocator, loadLocatorFile, mergeLocators, resolveLocator } from './locators.js';
import { TestSphereError, asList, didYouMean, formatDuration, parseBoolean, parseDuration } from './util.js';
import { interpolate, interpolateDeep } from './vars.js';

/**
 * Every action a step can take, which kinds of target it works on, and how
 * it reads its arguments. Load-time parsing turns each step into
 * { action, args, label, ... } so the runner never sees raw YAML.
 */
const UI = ['web', 'android', 'ios'];
const ACTIONS = {
  open: { on: ['web'], parse: parseOpen },
  tap: { on: UI, parse: (v, ctx, where) => ({ locator: resolveLocator(v, ctx.map, where) }) },
  type: { on: UI, parse: parseType },
  clear: { on: UI, parse: (v, ctx, where) => ({ locator: resolveLocator(v, ctx.map, where) }) },
  select: { on: ['web'], parse: parseSelect },
  scrollTo: { on: UI, parse: (v, ctx, where) => ({ locator: resolveLocator(v, ctx.map, where) }) },
  swipe: { on: ['android', 'ios'], parse: parseSwipe },
  back: { on: UI, parse: () => ({}) },
  press: { on: ['web'], parse: (v, ctx, where) => ({ key: required(v, `${where}: press needs a key, like press: Enter`) }) },
  hideKeyboard: { on: ['android', 'ios'], parse: () => ({}) },
  screenshot: { on: UI, parse: (v) => ({ name: String(v || 'screenshot') }) },
  wait: { on: [...UI, 'buildai'], parse: (v, ctx, where) => ({ ms: parseDuration(v, `${where} wait`) }) },
  ask: { on: ['buildai'], parse: parseAsk },
  expect: { on: [...UI, 'buildai'], parse: parseExpect },
};
const ALIASES = { click: 'tap' };
const ACTION_NAMES = [...Object.keys(ACTIONS), 'use', ...Object.keys(ALIASES)];
const STEP_MODIFIERS = ['name', 'timeout', 'optional', 'secret'];
const FLOW_KEYS = ['name', 'description', 'target', 'tags', 'locators', 'vars', 'steps', 'cases'];
const FLOW_EXTENSIONS = new Set(['.yaml', '.yml', '.json']);

const UI_CHECKS = ['visible', 'hidden', 'text', 'url'];
const AGENT_CHECKS = ['mentions', 'mentionsAny', 'excludes', 'cites', 'grounded', 'declines', 'latencyUnder'];

export function loadFlow(file, { vars = {} } = {}) {
  const abs = path.resolve(file);
  return buildFlow(abs, readFlowFile(abs), { cliVars: vars, inherited: {}, inheritedSecrets: new Set(), stack: [], from: null });
}

/** Flow files named on the command line, or found inside named directories. */
export function discoverFlows(inputs) {
  const files = [];
  for (const input of inputs) {
    const abs = path.resolve(input);
    if (!fs.existsSync(abs)) throw new TestSphereError(`No such file or folder: ${input}`);
    if (fs.statSync(abs).isDirectory()) {
      files.push(...walk(abs).filter((f) => isFlowDocument(readFlowFile(f, { quiet: true }))));
    } else {
      files.push(abs);
    }
  }
  return [...new Set(files)];
}

/** Which steps of a flow can't run on a platform, as messages. */
export function incompatibleSteps(flow, platform) {
  const problems = [];
  for (const step of flow.steps) {
    const on = step.action === 'expect' ? (step.args.family === 'agent' ? ['buildai'] : UI) : ACTIONS[step.action].on;
    if (!on.includes(platform)) problems.push(`"${step.label}" can't run on a ${platform} target (works on: ${on.join(', ')}).`);
  }
  return problems;
}

// ---------------------------------------------------------------- reading

function readFlowFile(file, { quiet = false } = {}) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw new TestSphereError(`Flow file not found: ${file}`);
  }
  try {
    // YAML is read as plain strings so values like 08032001111 keep their
    // leading zero; numbers and booleans are converted where a field needs one.
    const doc = file.endsWith('.json') ? JSON.parse(text) : YAML.parse(text, { schema: 'failsafe' });
    return doc ?? {};
  } catch (err) {
    if (quiet) return null;
    throw new TestSphereError(`Couldn't read ${shortPath(file)}: ${err.message}`);
  }
}

function isFlowDocument(doc) {
  return isPlainObject(doc) && (Array.isArray(doc.steps) || Array.isArray(doc.cases));
}

function walk(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_') || entry.name === 'node_modules' || entry.name === 'runs') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (FLOW_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.startsWith('testsphere.config.')) found.push(full);
  }
  return found;
}

// ---------------------------------------------------------------- building

function buildFlow(file, doc, { cliVars, inherited, inheritedSecrets, stack, from }) {
  const where = shortPath(file);
  if (!isPlainObject(doc)) throw new TestSphereError(`${where} should describe a flow (name:, target:, steps:).`);
  for (const key of Object.keys(doc)) {
    if (!FLOW_KEYS.includes(key)) throw new TestSphereError(`${where}: unknown field "${key}".${didYouMean(key, FLOW_KEYS)}`);
  }
  if (doc.steps && doc.cases) throw new TestSphereError(`${where}: use steps: or cases:, not both.`);
  if (!doc.steps && !doc.cases) throw new TestSphereError(`${where}: add steps: (or cases: for a set of questions).`);

  if (doc.vars != null && !isPlainObject(doc.vars)) throw new TestSphereError(`${where}: vars: should map names to values.`);

  // Precedence: the flow's own defaults < what a parent flow passes < --var.
  const vars = {};
  const secretVars = new Set(inheritedSecrets);
  for (const [key, value] of Object.entries(doc.vars ?? {})) {
    if (Object.hasOwn(inherited, key) || Object.hasOwn(cliVars, key)) continue;
    vars[key] = interpolate(String(value), {}, { where: `${where} vars.${key}`, onSecret: () => secretVars.add(key) });
  }
  Object.assign(vars, inherited, cliVars);

  const locatorFiles = asList(doc.locators).map((p) => path.resolve(path.dirname(file), p));
  const map = locatorFiles.length ? mergeLocators(locatorFiles.map(loadLocatorFile)) : null;

  const ctx = { file, dir: path.dirname(file), where, vars, secretVars, map, cliVars, stack: [...stack, file], from };
  const name = doc.name ? interpolate(String(doc.name), vars, { where }) : path.basename(file, path.extname(file));

  let steps;
  let cases = [];
  if (doc.cases) ({ steps, cases } = parseCases(doc.cases, ctx));
  else steps = parseSteps(doc.steps, ctx, where);

  return {
    file,
    name,
    description: doc.description ? String(doc.description) : null,
    target: doc.target ? String(doc.target) : null,
    tags: asList(doc.tags),
    cases,
    steps,
  };
}

function parseCases(list, ctx) {
  if (!Array.isArray(list) || list.length === 0) throw new TestSphereError(`${ctx.where}: cases: should be a list.`);
  const steps = [];
  const cases = [];
  list.forEach((raw, index) => {
    const where = `${ctx.where} case ${index + 1}`;
    if (!isPlainObject(raw)) throw new TestSphereError(`${where}: a case has name:, then ask: and expect: (or steps:).`);
    const { name, steps: caseSteps, ask, expect, ...extra } = raw;
    const unknown = Object.keys(extra)[0];
    if (unknown) throw new TestSphereError(`${where}: unknown field "${unknown}". A case has name:, then ask: and expect: (or steps:).`);

    const question = isPlainObject(ask) ? ask.question : ask;
    const info = { index, name: name ? interpolate(String(name), ctx.vars, { where }) : question ? truncate(String(question), 80) : `Case ${index + 1}` };
    cases.push(info);

    if (caseSteps) {
      if (ask != null || expect != null) throw new TestSphereError(`${where}: use ask:/expect: or steps:, not both.`);
      steps.push(...parseSteps(caseSteps, ctx, where, info));
    } else {
      if (ask == null) throw new TestSphereError(`${where}: needs ask: (or steps:).`);
      steps.push(...parseStep({ ask }, ctx, where, info));
      if (expect != null) steps.push(...parseStep({ expect }, ctx, `${where} expect`, info));
    }
  });
  return { steps, cases };
}

function parseSteps(list, ctx, where, caseInfo = null) {
  if (!Array.isArray(list) || list.length === 0) throw new TestSphereError(`${where}: steps: should be a list of actions.`);
  return list.flatMap((raw, i) => parseStep(raw, ctx, `${where} step ${i + 1}`, caseInfo));
}

function parseStep(raw, ctx, where, caseInfo) {
  if (typeof raw === 'string') raw = { [raw.trim()]: '' };
  if (!isPlainObject(raw)) throw new TestSphereError(`${where}: expected an action, like "tap: login.submit".`);

  const modifiers = {};
  const actions = {};
  for (const [key, value] of Object.entries(raw)) (STEP_MODIFIERS.includes(key) ? modifiers : actions)[key] = value;
  const keys = Object.keys(actions);
  if (keys.length === 0) throw new TestSphereError(`${where}: no action. Use one of: ${Object.keys(ACTIONS).join(', ')}.`);
  if (keys.length > 1) throw new TestSphereError(`${where}: one action per step, but found ${keys.join(' and ')}. Split them into separate steps.`);

  const written = keys[0];
  const action = ALIASES[written] ?? written;
  if (action === 'use') return expandUse(actions.use, ctx, where, caseInfo);
  if (!ACTIONS[action]) throw new TestSphereError(`${where}: unknown action "${written}".${didYouMean(written, ACTION_NAMES)}`);

  let secret = parseBoolean(modifiers.secret, `${where} secret`) ?? false;
  const interpolation = { where, secrets: ctx.secretVars, onSecret: () => (secret = true) };
  const value = interpolateDeep(actions[written], ctx.vars, interpolation);
  const step = {
    action,
    args: ACTIONS[action].parse(value, ctx, where),
    name: modifiers.name ? interpolate(String(modifiers.name), ctx.vars, { where }) : null,
    timeout: modifiers.timeout == null || modifiers.timeout === '' ? null : parseDuration(modifiers.timeout, `${where} timeout`),
    optional: parseBoolean(modifiers.optional, `${where} optional`) ?? false,
    secret,
    from: ctx.from,
    case: caseInfo?.index ?? null,
  };
  step.label = step.name ?? describeStep(step);
  return [step];
}

/** `use: ./sign-in.yaml` inlines another flow's steps, so shared journeys are written once. */
function expandUse(value, ctx, where, caseInfo) {
  const spec = isPlainObject(value) ? value : { flow: value };
  if (!spec.flow) throw new TestSphereError(`${where}: use needs a flow file, like use: ./sign-in.yaml`);
  const file = path.resolve(ctx.dir, interpolate(String(spec.flow), ctx.vars, { where }));
  if (ctx.stack.includes(file)) throw new TestSphereError(`${where}: ${shortPath(file)} ends up using itself.`);

  const doc = readFlowFile(file);
  if (isPlainObject(doc) && doc.cases) throw new TestSphereError(`${where}: ${shortPath(file)} has cases; only a flow with steps can be used inside another.`);

  if (spec.with != null && !isPlainObject(spec.with)) throw new TestSphereError(`${where}: with: should map variable names to values.`);
  const secrets = new Set(ctx.secretVars);
  const passed = {};
  for (const [key, raw] of Object.entries(spec.with ?? {})) {
    passed[key] = interpolate(String(raw), ctx.vars, { where, secrets: ctx.secretVars, onSecret: () => secrets.add(key) });
  }
  const sub = buildFlow(file, doc, {
    cliVars: ctx.cliVars,
    inherited: { ...ctx.vars, ...passed },
    inheritedSecrets: secrets,
    stack: ctx.stack,
    from: isPlainObject(doc) && doc.name ? String(doc.name) : path.basename(file, path.extname(file)),
  });
  return sub.steps.map((step) => ({ ...step, case: caseInfo?.index ?? null }));
}

// ---------------------------------------------------------------- actions

function parseOpen(value, ctx, where) {
  const text = String(value ?? '').trim();
  if (/^[a-z][a-z0-9+.-]+:/i.test(text)) return { url: text, display: text };
  if (text.startsWith('/')) return { path: text, display: text };
  if (text.startsWith('./') || text.startsWith('../')) {
    const file = path.resolve(ctx.dir, text);
    if (!fs.existsSync(file)) throw new TestSphereError(`${where}: no file at ${text}.`);
    return { url: pathToFileURL(file).href, display: text };
  }
  throw new TestSphereError(
    `${where}: open needs a full URL (https://…), a path starting with / (added to the target's baseUrl), or a local file starting with ./`,
  );
}

function parseType(value, ctx, where) {
  if (!isPlainObject(value) || value.into == null || value.text == null) {
    throw new TestSphereError(`${where}: type needs into: and text:, like type: { into: login.email, text: "ada@example.com" }`);
  }
  return {
    locator: resolveLocator(value.into, ctx.map, where),
    text: String(value.text),
    clear: parseBoolean(value.clear, `${where} clear`) ?? true,
  };
}

function parseSelect(value, ctx, where) {
  if (!isPlainObject(value) || value.in == null || value.option == null) {
    throw new TestSphereError(`${where}: select needs in: and option:, like select: { in: form.country, option: Nigeria }`);
  }
  return { locator: resolveLocator(value.in, ctx.map, where), option: String(value.option) };
}

function parseSwipe(value, ctx, where) {
  const direction = String(value).trim().toLowerCase();
  if (!['up', 'down', 'left', 'right'].includes(direction)) throw new TestSphereError(`${where}: swipe up, down, left or right.`);
  return { direction };
}

function parseAsk(value, ctx, where) {
  const spec = isPlainObject(value) ? value : { question: value };
  const question = String(spec.question ?? '').trim();
  if (!question) throw new TestSphereError(`${where}: ask needs a question.`);
  return {
    question,
    followUp: parseBoolean(spec.followUp, `${where} followUp`) ?? false,
    mode: spec.mode ? String(spec.mode) : null,
  };
}

function parseExpect(value, ctx, where) {
  if (typeof value === 'string') return { family: 'ui', checks: [{ kind: 'visible', locator: resolveLocator(value, ctx.map, where) }] };
  if (!isPlainObject(value)) throw new TestSphereError(`${where}: expect needs something to check, like expect: { visible: home.greeting }.`);

  const keys = Object.keys(value);
  const allowed = [...UI_CHECKS, 'equals', 'contains', ...AGENT_CHECKS];
  for (const key of keys) {
    if (!allowed.includes(key)) throw new TestSphereError(`${where}: expect doesn't know "${key}".${didYouMean(key, allowed)}`);
  }
  const ui = keys.some((k) => UI_CHECKS.includes(k));
  const agent = keys.some((k) => AGENT_CHECKS.includes(k));
  if (ui && agent) throw new TestSphereError(`${where}: screen checks and answer checks belong in separate expect steps.`);
  if (!ui && !agent) throw new TestSphereError(`${where}: expect needs something to check, like visible: or mentions:.`);

  const checks = [];
  if (ui) {
    if ((value.equals != null || value.contains != null) && value.text == null && value.url == null) {
      throw new TestSphereError(`${where}: equals:/contains: go with text: (the element whose text to check).`);
    }
    if (value.visible != null) checks.push({ kind: 'visible', locator: resolveLocator(value.visible, ctx.map, where) });
    if (value.hidden != null) checks.push({ kind: 'hidden', locator: resolveLocator(value.hidden, ctx.map, where) });
    if (value.text != null) {
      if (value.equals == null && value.contains == null) throw new TestSphereError(`${where}: expect text: needs equals: or contains:.`);
      checks.push({
        kind: 'text',
        locator: resolveLocator(value.text, ctx.map, where),
        ...(value.equals != null ? { equals: String(value.equals) } : {}),
        ...(value.contains != null ? { contains: String(value.contains) } : {}),
      });
    }
    if (value.url != null) checks.push({ kind: 'url', contains: String(value.url) });
    return { family: 'ui', checks };
  }

  for (const kind of ['mentions', 'mentionsAny', 'excludes', 'cites']) {
    if (value[kind] != null) {
      const items = asList(value[kind]).filter(Boolean);
      if (!items.length) throw new TestSphereError(`${where}: ${kind}: needs at least one phrase.`);
      checks.push({ kind, items });
    }
  }
  for (const kind of ['grounded', 'declines']) {
    if (value[kind] != null) {
      if (parseBoolean(value[kind], `${where} ${kind}`) !== true) throw new TestSphereError(`${where}: ${kind}: only takes true.`);
      checks.push({ kind });
    }
  }
  if (value.latencyUnder != null) checks.push({ kind: 'latencyUnder', ms: parseDuration(value.latencyUnder, `${where} latencyUnder`) });
  return { family: 'agent', checks };
}

// ---------------------------------------------------------------- labels

export function describeStep(step) {
  const a = step.args;
  const target = a.locator ? describeLocator(a.locator) : '';
  switch (step.action) {
    case 'open': return `Open ${a.display}`;
    case 'tap': return `Tap ${target}`;
    case 'type': return `Type "${step.secret ? '••••••' : truncate(a.text.trim().replace(/\s*\n\s*/g, ' ⏎ '), 90)}" into ${target}`;
    case 'clear': return `Clear ${target}`;
    case 'select': return `Select "${a.option}" in ${target}`;
    case 'scrollTo': return `Scroll to ${target}`;
    case 'swipe': return `Swipe ${a.direction}`;
    case 'back': return 'Go back';
    case 'press': return `Press ${a.key}`;
    case 'hideKeyboard': return 'Hide the keyboard';
    case 'screenshot': return `Screenshot "${a.name}"`;
    case 'wait': return `Wait ${formatDuration(a.ms)}`;
    case 'ask': return `Ask${a.followUp ? ' (follow-up)' : ''}: "${step.secret ? '••••••' : truncate(a.question, 120)}"`;
    case 'expect': return `Expect ${a.checks.map(describeCheck).join('; ')}`;
    default: return step.action;
  }
}

function describeCheck(check) {
  const quoted = (items) => items.map((i) => `"${i}"`).join(', ');
  switch (check.kind) {
    case 'visible': return `${describeLocator(check.locator)} to be visible`;
    case 'hidden': return `${describeLocator(check.locator)} to be hidden`;
    case 'text': {
      const subject = `${describeLocator(check.locator)} text`;
      return check.equals != null ? `${subject} to be "${check.equals}"` : `${subject} to contain "${check.contains}"`;
    }
    case 'url': return `URL to contain "${check.contains}"`;
    case 'mentions': return `answer to mention ${quoted(check.items)}`;
    case 'mentionsAny': return `answer to mention one of ${quoted(check.items)}`;
    case 'excludes': return `answer not to mention ${quoted(check.items)}`;
    case 'cites': return `answer to cite ${quoted(check.items)}`;
    case 'grounded': return 'answer to be grounded in the knowledge base';
    case 'declines': return 'agent to decline (no documents cover this)';
    case 'latencyUnder': return `answer within ${formatDuration(check.ms)}`;
    default: return check.kind;
  }
}

// ---------------------------------------------------------------- helpers

function required(value, message) {
  const text = String(value ?? '').trim();
  if (!text) throw new TestSphereError(message);
  return text;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function shortPath(file) {
  const rel = path.relative(process.cwd(), file);
  return rel && !rel.startsWith('..') ? rel.replaceAll('\\', '/') : file.replaceAll('\\', '/');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
