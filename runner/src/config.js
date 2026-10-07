import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { TestSphereError, didYouMean, parseBoolean, parseDuration } from './util.js';
import { interpolateDeep } from './vars.js';

export const CONFIG_NAMES = ['testsphere.config.yaml', 'testsphere.config.yml', 'testsphere.config.json'];
export const PLATFORMS = ['web', 'android', 'ios', 'buildai'];
export const MOBILE = new Set(['android', 'ios']);

// Always available, so a web flow runs with no config file at all.
const BUILT_IN_TARGETS = {
  chrome: { platform: 'web', browser: 'chrome' },
  edge: { platform: 'web', browser: 'edge' },
  firefox: { platform: 'web', browser: 'firefox' },
};

const BROWSERS = ['chrome', 'edge', 'firefox'];
const SCREENSHOT_MODES = ['every-step', 'on-failure', 'off'];
const BUILDAI_MODES = ['fast', 'best', 'deep'];

/** The nearest config file, searching upward from each starting directory in turn. */
export function findConfig(startDirs) {
  for (const start of startDirs) {
    let dir = path.resolve(start);
    for (;;) {
      for (const name of CONFIG_NAMES) {
        const file = path.join(dir, name);
        if (fs.existsSync(file)) return file;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

export function loadConfig(file, { cwd = process.cwd() } = {}) {
  const dir = file ? path.dirname(path.resolve(file)) : path.resolve(cwd);
  let raw = {};
  if (file) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      throw new TestSphereError(`Config file not found: ${file}`);
    }
    try {
      // merge: lets targets share settings through YAML anchors (<<: *buildai).
      raw = (file.endsWith('.json') ? JSON.parse(text) : YAML.parse(text, { merge: true })) ?? {};
    } catch (err) {
      throw new TestSphereError(`Couldn't read ${file}: ${err.message}`);
    }
  }

  const defaults = raw.defaults ?? {};
  return {
    file: file ? path.resolve(file) : null,
    dir,
    defaults: {
      target: defaults.target ?? 'chrome',
      timeout: parseDuration(defaults.timeout ?? 10_000, 'defaults.timeout'),
      screenshots: oneOf(defaults.screenshots ?? 'every-step', SCREENSHOT_MODES, 'defaults.screenshots'),
      video: parseBoolean(defaults.video, 'defaults.video') ?? true,
      output: path.resolve(dir, defaults.output ?? 'runs'),
    },
    // Targets stay raw until one is used, so a missing ${env.X} for the BuildAI
    // target doesn't stop a web-only run.
    targets: { ...BUILT_IN_TARGETS, ...(raw.targets ?? {}) },
    // Optional names and descriptions for the console's suites (one per folder of flows).
    suites: raw.suites ?? {},
    // The KPI THE EYE tracks for TestSphere: { kpi, department, target }.
    theEye: raw.theEye ?? null,
  };
}

/** A target's platform without filling in its secrets, for checking flows before a run. */
export function targetPlatform(config, name) {
  const raw = config.targets[name];
  if (!raw) {
    throw new TestSphereError(
      `Unknown target "${name}".${didYouMean(name, Object.keys(config.targets))} Available: ${Object.keys(config.targets).join(', ')}.`,
    );
  }
  return oneOf(raw.platform, PLATFORMS, `target "${name}" platform`);
}

/** A named target with environment variables filled in and defaults applied. */
export function resolveTarget(config, name) {
  const raw = config.targets[name];
  if (!raw) {
    throw new TestSphereError(
      `Unknown target "${name}".${didYouMean(name, Object.keys(config.targets))} Available: ${Object.keys(config.targets).join(', ')}.`,
    );
  }
  const where = `target "${name}"`;
  const t = interpolateDeep(raw, {}, { where });
  const platform = oneOf(t.platform, PLATFORMS, `${where} platform`);

  if (platform === 'web') {
    return {
      name,
      platform,
      browser: oneOf(t.browser ?? 'chrome', BROWSERS, `${where} browser`),
      headless: parseBoolean(t.headless, `${where} headless`) ?? true,
      viewport: { width: Number(t.viewport?.width ?? 1280), height: Number(t.viewport?.height ?? 800) },
      baseUrl: t.baseUrl ? String(t.baseUrl).replace(/\/$/, '') : null,
      emulate: t.emulate ?? null,
    };
  }

  if (MOBILE.has(platform)) {
    return {
      name,
      platform,
      server: t.server ?? 'http://localhost:4723',
      capabilities: t.capabilities ?? {},
    };
  }

  // BuildAI: one knowledge base is one department agent.
  for (const field of ['url', 'email', 'password']) {
    if (!t[field]) throw new TestSphereError(`${where} needs ${field}:.`);
  }
  return {
    name,
    platform,
    url: String(t.url).replace(/\/$/, ''),
    knowledgeBase: t.knowledgeBase ?? null,
    mode: t.mode ? oneOf(t.mode, BUILDAI_MODES, `${where} mode`) : null,
    email: String(t.email),
    password: String(t.password),
    answerTimeout: parseDuration(t.answerTimeout ?? '3m', `${where} answerTimeout`),
    keepConversations: parseBoolean(t.keepConversations, `${where} keepConversations`) ?? false,
  };
}

function oneOf(value, allowed, what) {
  const text = String(value ?? '');
  if (allowed.includes(text)) return text;
  throw new TestSphereError(`${what} should be one of ${allowed.join(', ')}, not "${text}".${didYouMean(text, allowed)}`);
}
