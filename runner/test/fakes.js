import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A valid 1×1 PNG, so saved screenshots are real image files.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/**
 * Just enough of WebdriverIO's browser/element API for the runner.
 * `screen` maps selectors to { visible, text, value, onClick(screen) }.
 * Waits resolve immediately: an element is either there or it isn't.
 */
export function fakeDriver(screen = {}, { platform = 'web' } = {}) {
  const calls = [];
  const state = { url: 'about:blank', screen };
  const element = (selector) => {
    const get = () => state.screen[selector];
    return {
      async waitForDisplayed({ reverse = false, timeoutMsg } = {}) {
        if (Boolean(get()?.visible) === reverse) throw new Error(timeoutMsg ?? `element ("${selector}") still not displayed`);
        return true;
      },
      async waitForExist({ timeoutMsg } = {}) {
        if (!get()) throw new Error(timeoutMsg);
        return true;
      },
      async click() {
        calls.push(['click', selector]);
        get()?.onClick?.(state.screen);
      },
      async clearValue() {
        calls.push(['clear', selector]);
        if (get()) get().value = '';
      },
      async addValue(value) {
        calls.push(['type', selector, value]);
        if (get()) get().value = (get().value ?? '') + value;
      },
      async getText() {
        return get()?.text ?? '';
      },
      async selectByVisibleText(option) {
        calls.push(['select', selector, option]);
      },
      async scrollIntoView() {
        calls.push(['scroll', selector]);
      },
    };
  };

  return {
    calls,
    state,
    capabilities: platform === 'web' ? { browserName: 'chrome', browserVersion: '154.0' } : { deviceName: 'emulator-5554', platformVersion: '14' },
    async $(selector) {
      calls.push(['$', selector]);
      return element(selector);
    },
    async url(url) {
      calls.push(['url', url]);
      state.url = url;
    },
    async getUrl() {
      return state.url;
    },
    async waitUntil(condition, { timeoutMsg } = {}) {
      for (let i = 0; i < 3; i += 1) if (await condition()) return true;
      throw new Error(timeoutMsg ?? 'waitUntil condition timed out');
    },
    async saveScreenshot(file) {
      fs.writeFileSync(file, PNG);
    },
    async getPageSource() {
      return '<html><body>source at failure</body></html>';
    },
    async startRecordingScreen() {
      calls.push(['record']);
    },
    async stopRecordingScreen() {
      return Buffer.from('fake video').toString('base64');
    },
    async back() {
      calls.push(['back']);
    },
    async keys(key) {
      calls.push(['keys', key]);
    },
    async swipe({ direction }) {
      calls.push(['swipe', direction]);
    },
    async isKeyboardShown() {
      return false;
    },
    async hideKeyboard() {},
    async deleteSession() {
      calls.push(['quit']);
    },
  };
}

/** A stand-in BuildAI agent: `answers` maps each question to what comes back. */
export function fakeAgent(answers) {
  return {
    asked: [],
    async ask(question, options) {
      this.asked.push({ question, ...options });
      const a = answers[question];
      if (!a) throw new Error(`Unexpected question: ${question}`);
      return {
        question,
        answer: a.answer ?? '',
        citations: a.citations ?? [],
        sources: a.sources ?? a.citations ?? [],
        status: a.status ?? 'complete',
        latencyMs: a.latencyMs ?? 1200,
        model: 'mock-model',
        costUsd: a.costUsd ?? 0.01,
        notices: [],
      };
    },
    async close() {},
  };
}

export function openWith(session) {
  return async (target) => {
    if (session instanceof Error) throw session;
    if (session.ask) return { kind: 'agent', agent: session, device: { platform: 'buildai', knowledgeBase: 'Maintenance' }, close: async () => {} };
    return { kind: 'ui', driver: session, device: { platform: target.platform, browser: 'chrome' }, close: () => session.deleteSession() };
  };
}

/** A temporary folder with the given files written into it. */
export function workspace(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testsphere-'));
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return { dir, path: (name) => path.join(dir, name) };
}
