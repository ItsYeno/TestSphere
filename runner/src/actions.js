import { describeLocator, toSelector } from './locators.js';
import { formatDuration, sleep } from './util.js';

/** A check that ran and didn't hold, worded for the person reading the report. */
export class CheckFailed extends Error {}

/**
 * One handler per action. Each receives the run context
 * ({ platform, target, driver | agent, timeout, lastAnswer }) and the step's
 * parsed arguments. Throwing fails the step.
 */
export const handlers = {
  async open(ctx, { url, path }) {
    if (!url && !ctx.target.baseUrl) throw new CheckFailed(`"${path}" is a path, so target "${ctx.target.name}" needs a baseUrl.`);
    await ctx.driver.url(url ?? `${ctx.target.baseUrl}${path}`);
  },

  async tap(ctx, { locator }) {
    await (await find(ctx, locator)).click();
  },

  async type(ctx, { locator, text, clear }) {
    const element = await find(ctx, locator);
    if (clear) {
      // Some Android text fields reject clearValue; typing still works, and a
      // following expect will catch a field that kept its old text.
      await element.clearValue().catch(() => {});
    }
    await element.addValue(text);
  },

  async clear(ctx, { locator }) {
    await (await find(ctx, locator)).clearValue();
  },

  async select(ctx, { locator, option }) {
    await (await find(ctx, locator)).selectByVisibleText(option);
  },

  async scrollTo(ctx, { locator }) {
    const selector = toSelector(locator.value, ctx.platform);
    if (ctx.platform === 'web') {
      const ok = await waitFor(ctx, async () => (await ctx.driver.$(selector)).isExisting(), ctx.timeout);
      if (!ok) throw new CheckFailed(notFound(locator, selector, ctx.timeout));
      await (await ctx.driver.$(selector)).scrollIntoView({ block: 'center' });
    } else {
      const element = await ctx.driver.$(selector);
      // On a device WebdriverIO swipes until the element shows up.
      await element.scrollIntoView({ maxScrolls: 10 });
      await element.waitForDisplayed({ timeout: ctx.timeout, timeoutMsg: notFound(locator, selector, ctx.timeout) });
    }
  },

  async swipe(ctx, { direction }) {
    await ctx.driver.swipe({ direction });
  },

  async back(ctx) {
    await ctx.driver.back();
  },

  async press(ctx, { key }) {
    const { Key } = await import('webdriverio');
    const named = Object.keys(Key).find((name) => name.toLowerCase() === key.toLowerCase());
    await ctx.driver.keys(named ? Key[named] : key);
  },

  async hideKeyboard(ctx) {
    if (await ctx.driver.isKeyboardShown()) await ctx.driver.hideKeyboard();
  },

  async screenshot() {
    // The runner captures the named screenshot after every screenshot step.
  },

  async wait(ctx, { ms }) {
    await sleep(ms);
  },

  async ask(ctx, { question, followUp, mode }) {
    ctx.lastAnswer = await ctx.agent.ask(question, { followUp, mode });
    return { answer: ctx.lastAnswer };
  },

  async expect(ctx, { family, checks }) {
    if (family === 'agent') return checkAnswer(ctx.lastAnswer, checks);
    const deadline = Date.now() + ctx.timeout;
    for (const check of checks) await checkScreen(ctx, check, () => Math.max(deadline - Date.now(), 1000));
  },
};

// ------------------------------------------------------------------ screens

/**
 * Wait for an element to be visible and return it. The element is looked up
 * again on every poll: pages that re-render (a search filter, a streaming
 * answer) replace their elements, and an old reference never becomes visible.
 */
async function find(ctx, locator, timeout = ctx.timeout) {
  const selector = toSelector(locator.value, ctx.platform);
  let found = null;
  const ok = await waitFor(ctx, async () => Boolean((found = await firstShown(ctx, selector))), timeout);
  if (!ok) throw new CheckFailed(notFound(locator, selector, timeout));
  return found;
}

/**
 * The first match that is actually on screen. Text often appears first in
 * something hidden (a closed dropdown's options, a collapsed menu), so the
 * first match in the page isn't necessarily the one a person sees.
 */
async function firstShown(ctx, selector) {
  const elements = await ctx.driver.$$(selector);
  for (const element of [...elements].slice(0, 25)) {
    if (await shown(element)) return element;
  }
  return null;
}

async function shown(element) {
  try {
    return await element.isDisplayed();
  } catch {
    return false;
  }
}

async function checkScreen(ctx, check, remaining) {
  const subject = check.locator ? describeLocator(check.locator) : null;
  switch (check.kind) {
    case 'visible':
      await find(ctx, check.locator, remaining());
      return;
    case 'hidden': {
      const selector = toSelector(check.locator.value, ctx.platform);
      const timeout = remaining();
      const ok = await waitFor(ctx, async () => !(await firstShown(ctx, selector)), timeout);
      if (!ok) throw new CheckFailed(`${subject} was still visible after ${formatDuration(timeout)}.`);
      return;
    }
    case 'text': {
      await find(ctx, check.locator, remaining());
      const selector = toSelector(check.locator.value, ctx.platform);
      let actual = '';
      const ok = await waitFor(ctx, async () => {
        const element = await firstShown(ctx, selector);
        if (!element) return false;
        actual = normalize(await element.getText().catch(() => actual));
        return check.equals != null ? actual === normalize(check.equals) : actual.includes(normalize(check.contains));
      }, remaining());
      if (!ok) {
        const wanted = check.equals != null ? `be "${check.equals}"` : `contain "${check.contains}"`;
        throw new CheckFailed(`Expected ${subject} text to ${wanted}, but it was "${actual}".`);
      }
      return;
    }
    case 'url': {
      let actual = '';
      const ok = await waitFor(ctx, async () => (actual = await ctx.driver.getUrl()).includes(check.contains), remaining());
      if (!ok) throw new CheckFailed(`Expected the URL to contain "${check.contains}", but it was ${actual}.`);
      return;
    }
    default:
      throw new Error(`Unknown screen check ${check.kind}`);
  }
}

async function waitFor(ctx, condition, timeout) {
  try {
    await ctx.driver.waitUntil(condition, { timeout, interval: 250 });
    return true;
  } catch {
    return false;
  }
}

function notFound(locator, selector, timeout) {
  const name = describeLocator(locator);
  return `${name} wasn't visible after ${formatDuration(timeout)}${name === selector ? '' : ` (selector: ${selector})`}.`;
}

function normalize(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------------------------ answers

/**
 * Phrases an agent uses when its documents don't cover a question. BuildAI is
 * told to "say so plainly", so declining is detected from the wording, and
 * from BuildAI's own refusal status.
 */
const DECLINE_PATTERNS = [
  /\b(documents?|knowledge base|sources?|records?|procedures?|materials?)\b[^.]{0,80}?\b(do(es)?n['’]?t|do(es)? not|did not|didn['’]?t)\b[^.]{0,40}?\b(cover|contain|include|mention|address|say|have|specify|provide)/i,
  /\b(couldn['’]?t|could not|can['’]?t|cannot|unable to|wasn['’]?t able to|was not able to)\b[^.]{0,40}?\b(find|locate)\b/i,
  /\bno (matching |relevant )?(information|mention|reference|details?|documents?|guidance|records?|passages?|results?)\b[^.]{0,60}?\b(in|within|from|among)\b/i,
  /\bnot (covered|found|mentioned|included|addressed|available) (in|within|by)\b/i,
  /\boutside (of )?(the |my )?(scope|knowledge base)/i,
];

export function checkAnswer(answer, checks) {
  if (!answer) throw new CheckFailed('There is no answer to check yet: put an ask step before this expect.');
  const text = plain(answer.answer);
  const has = (phrase) => text.includes(plain(phrase));
  const quoted = (items) => items.map((i) => `"${i}"`).join(', ');
  const docs = answer.citations.filter((c) => c.kind !== 'web');
  const web = answer.citations.filter((c) => c.kind === 'web');
  const cited = docs.map((c) => c.title);
  const failures = [];

  for (const check of checks) {
    switch (check.kind) {
      case 'mentions': {
        const missing = check.items.filter((i) => !has(i));
        if (missing.length) failures.push(`The answer doesn't mention ${quoted(missing)}.`);
        break;
      }
      case 'mentionsAny':
        if (!check.items.some(has)) failures.push(`The answer mentions none of ${quoted(check.items)}.`);
        break;
      case 'excludes': {
        const found = check.items.filter(has);
        if (found.length) failures.push(`The answer mentions ${quoted(found)}, which it shouldn't.`);
        break;
      }
      case 'cites': {
        const missing = check.items.filter((i) => !cited.some((title) => title.toLowerCase().includes(i.toLowerCase())));
        if (missing.length) failures.push(`The answer doesn't cite ${quoted(missing)}. It cites ${cited.length ? quoted(cited) : 'nothing'}.`);
        break;
      }
      case 'grounded':
        if (answer.status === 'refused') failures.push('BuildAI declined to answer, so the answer is not grounded.');
        else if (!docs.length) failures.push('The answer cites nothing from the knowledge base.');
        if (web.length) failures.push(`The answer cites web pages: ${quoted(web.map((c) => c.url ?? c.title))}.`);
        break;
      case 'declines':
        if (docs.length) failures.push(`Expected the agent to say its documents don't cover this, but it cited ${quoted(cited)}.`);
        else if (answer.status !== 'refused' && !DECLINE_PATTERNS.some((p) => p.test(text))) {
          failures.push(`Expected the agent to say its documents don't cover this, but it answered: "${excerpt(answer.answer)}"`);
        }
        break;
      case 'latencyUnder':
        if (answer.latencyMs > check.ms) failures.push(`The answer took ${formatDuration(answer.latencyMs)}, over the ${formatDuration(check.ms)} limit.`);
        break;
      default:
        throw new Error(`Unknown answer check ${check.kind}`);
    }
  }
  if (failures.length) throw new CheckFailed(failures.join(' '));
}

/** Lowercased, Markdown emphasis removed, whitespace collapsed: how phrases are matched. */
function plain(text) {
  return String(text ?? '').toLowerCase().replace(/[*_`]/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

function excerpt(text, max = 160) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
