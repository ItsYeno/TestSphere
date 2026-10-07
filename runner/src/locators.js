import fs from 'node:fs';
import YAML from 'yaml';
import { TestSphereError, didYouMean } from './util.js';

/**
 * Locator files map readable names to selectors, nested by screen:
 *
 *   HomePage:
 *     buyAirtime: Buy Airtime            # mobile: accessibility id
 *   login:
 *     email: "#email"                    # web: CSS
 *
 * A group may carry its own `selector` next to its children, which is how the
 * existing myMTN locator map is laid out, so it loads unchanged.
 */
export function loadLocatorFile(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    throw new TestSphereError(`Locator file not found: ${file}`);
  }
  let data;
  try {
    data = file.endsWith('.json') ? JSON.parse(text) : YAML.parse(text, { schema: 'failsafe' });
  } catch (err) {
    throw new TestSphereError(`Couldn't read locator file ${file}: ${err.message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TestSphereError(`Locator file ${file} should contain named locators (a map of names to selectors).`);
  }
  return data;
}

export function mergeLocators(maps) {
  const merged = {};
  for (const map of maps) deepMerge(merged, map);
  return merged;
}

function deepMerge(into, from) {
  for (const [key, value] of Object.entries(from)) {
    if (isPlainObject(value) && isPlainObject(into[key])) deepMerge(into[key], value);
    else into[key] = value;
  }
}

/**
 * Turn what a step names ("login.email", "#email", { text: "Sign in" }) into a
 * locator: { name?, value } where value is a selector string or a text match.
 */
export function resolveLocator(input, map, where) {
  if (isPlainObject(input)) {
    if (input.text != null) return { value: { text: String(input.text) } };
    if (input.textContains != null) return { value: { textContains: String(input.textContains) } };
    throw new TestSphereError(`${where}: an element given as an object needs text: or textContains:.`);
  }
  const name = input == null ? '' : String(input).trim();
  if (!name) throw new TestSphereError(`${where}: say which element to use.`);

  if (map) {
    const node = walk(map, name);
    if (typeof node === 'string') return { name, value: node };
    if (isPlainObject(node)) {
      if (typeof node.selector === 'string') return { name, value: node.selector };
      const children = Object.keys(node).slice(0, 6).join(', ');
      throw new TestSphereError(`${where}: "${name}" is a group of locators, not one element. Pick one of: ${children}.`);
    }
    // A dotted name that starts with one of the map's screens is meant for the
    // map, so a typo should fail now rather than become a CSS selector.
    if (/^[A-Za-z_$][\w$-]*(\.[\w$-]+)+$/.test(name) && Object.hasOwn(map, name.split('.')[0])) {
      throw new TestSphereError(`${where}: no locator named "${name}".${didYouMean(name, leafNames(map))}`);
    }
  }
  return { value: name };
}

/**
 * The WebdriverIO selector for a locator on a platform.
 *
 * Mobile strings are read the way the old myMTN scripts used them:
 * XPath and UiSelector as written, anything else as an accessibility id.
 * On the web a string is a CSS selector (or XPath, which WebdriverIO detects).
 */
export function toSelector(value, platform) {
  if (isPlainObject(value)) {
    const exact = value.text != null;
    return textSelector(exact ? value.text : value.textContains, platform, exact);
  }
  const selector = String(value).trim();
  if (platform === 'web') return selector;
  if (/^new Ui(Selector|Scrollable)\(/.test(selector)) return `android=${selector}`;
  if (/^(\/\/|\(\/\/|\.\/\/|~|id=|android=|ios=|-ios |-android )/.test(selector)) return selector;
  return `~${selector}`;
}

export function describeLocator(locator) {
  if (locator.name) return locator.name;
  const { value } = locator;
  if (isPlainObject(value)) return value.text != null ? `"${value.text}"` : `text containing "${value.textContains}"`;
  return value;
}

function textSelector(text, platform, exact) {
  if (platform === 'android') return `android=new UiSelector().${exact ? 'text' : 'textContains'}(${JSON.stringify(text)})`;
  if (platform === 'ios') return `-ios predicate string:label ${exact ? '==' : 'CONTAINS'} ${JSON.stringify(text)}`;
  // The innermost element whose visible text matches, so nested markup like
  // <button><span>Sign in</span></button> still resolves to one element.
  const literal = xpathLiteral(text);
  const test = exact ? `normalize-space(.)=${literal}` : `contains(normalize-space(.), ${literal})`;
  return `//*[${test}][not(.//*[${test}])]`;
}

export function xpathLiteral(text) {
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;
  return `concat(${text.split("'").map((part) => `'${part}'`).join(`, "'", `)})`;
}

function walk(map, name) {
  let node = map;
  for (const part of name.split('.')) {
    if (!isPlainObject(node) || !Object.hasOwn(node, part)) return undefined;
    node = node[part];
  }
  return node;
}

function leafNames(map, prefix = '') {
  const names = [];
  for (const [key, value] of Object.entries(map)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') names.push(prefix && key === 'selector' ? prefix : name);
    else if (isPlainObject(value)) names.push(...leafNames(value, name));
  }
  return names;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
