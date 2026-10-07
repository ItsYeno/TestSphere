import { BuildAIClient } from './buildai.js';
import { TestSphereError } from './util.js';

/**
 * Open whatever a target points at: a browser or an Appium device session
 * (both through WebdriverIO), or a signed-in BuildAI client.
 * Returns { kind, driver | agent, device, close() }.
 */
export async function openSession(target, { headed = false } = {}) {
  if (target.platform === 'buildai') {
    const key = `${target.url}|${target.email}`;
    const agent = new BuildAIClient(target, { cookie: buildaiSessions.get(key)?.cookie });
    const device = await agent.connect();
    buildaiSessions.set(key, agent);
    return { kind: 'agent', agent, device, close: () => agent.close({ signOut: false }) };
  }

  // Loaded on first use, so agent-only runs and `validate` don't pay for it.
  const { remote } = await import('webdriverio');
  let driver;
  try {
    driver = target.platform === 'web' ? await remote(webOptions(target, headed)) : await remote(appiumOptions(target));
  } catch (err) {
    throw explainSessionError(err, target);
  }
  return { kind: 'ui', driver, device: describeDevice(driver, target), close: () => driver.deleteSession() };
}

// One signed-in BuildAI session per account for the whole run.
const buildaiSessions = new Map();

/** Sign out of every BuildAI session the run opened. */
export async function endSessions() {
  const agents = [...buildaiSessions.values()];
  buildaiSessions.clear();
  await Promise.all(agents.map((agent) => agent.close().catch(() => {})));
}

function webOptions(target, headed) {
  const headless = target.headless && !headed;
  const { width, height } = target.viewport;
  let capabilities;
  if (target.browser === 'firefox') {
    const args = [`--width=${width}`, `--height=${height}`];
    if (headless) args.push('-headless');
    capabilities = { browserName: 'firefox', 'moz:firefoxOptions': { args } };
  } else {
    const args = [`--window-size=${width},${height}`];
    if (headless) args.push('--headless=new');
    const options = { args, ...(target.emulate ? { mobileEmulation: { deviceName: target.emulate } } : {}) };
    capabilities = target.browser === 'edge'
      ? { browserName: 'MicrosoftEdge', 'ms:edgeOptions': options }
      : { browserName: 'chrome', 'goog:chromeOptions': options };
  }
  return { logLevel: 'silent', capabilities };
}

function appiumOptions(target) {
  const server = new URL(target.server);
  return {
    // TestSphere reports session errors itself, in one line.
    logLevel: 'silent',
    protocol: server.protocol.replace(':', ''),
    hostname: server.hostname,
    port: Number(server.port) || (server.protocol === 'https:' ? 443 : 80),
    path: server.pathname || '/',
    // Fail fast when Appium isn't running instead of retrying for minutes.
    connectionRetryCount: 0,
    capabilities: { platformName: target.platform === 'android' ? 'Android' : 'iOS', ...target.capabilities },
  };
}

function describeDevice(driver, target) {
  const caps = driver.capabilities ?? {};
  if (target.platform === 'web') {
    return {
      platform: 'web',
      browser: caps.browserName ?? target.browser,
      version: caps.browserVersion ?? null,
      headless: target.headless,
      viewport: `${target.viewport.width}×${target.viewport.height}`,
      emulating: target.emulate,
    };
  }
  const model = [caps.deviceManufacturer, caps.deviceModel].filter(Boolean).join(' ');
  return {
    platform: target.platform,
    device: model || caps.deviceName || caps['appium:deviceName'] || null,
    os: `${target.platform === 'android' ? 'Android' : 'iOS'} ${caps.platformVersion ?? ''}`.trim(),
    app: caps.appPackage ?? caps.bundleId ?? caps['appium:appPackage'] ?? caps['appium:bundleId'] ?? null,
    udid: caps.deviceUDID ?? caps.udid ?? null,
  };
}

function explainSessionError(err, target) {
  const message = String(err?.message ?? err);
  if (target.platform !== 'web' && /ECONNREFUSED|fetch failed|connect/i.test(message)) {
    return new TestSphereError(
      `Can't reach Appium at ${target.server}. Start it with "appium", and check the device shows up in "${target.platform === 'android' ? 'adb devices' : 'xcrun xctrace list devices'}".`,
    );
  }
  return new TestSphereError(`Couldn't start a ${target.platform === 'web' ? target.browser : target.platform} session: ${firstLine(message)}`);
}

function firstLine(text) {
  return text.split('\n').find((line) => line.trim()) ?? text;
}
