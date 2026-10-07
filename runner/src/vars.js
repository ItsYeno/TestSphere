import { TestSphereError, didYouMean } from './util.js';

// ${name} reads a flow variable, ${env.NAME} an environment variable
// (${env.NAME:-fallback} when it may be unset), and $${ is a literal "${".
const PATTERN = /\$\$\{|\$\{\s*([^}]+?)\s*\}/g;

/**
 * Substitute variables into one string.
 *
 * Values from the environment are treated as secrets (passwords, tokens), and
 * so are flow variables listed in `secrets` because they were filled from the
 * environment. `onSecret` is called whenever one is used, so reports can mask it.
 */
export function interpolate(text, vars, { where = 'value', secrets, onSecret } = {}) {
  return String(text).replace(PATTERN, (match, key) => {
    if (match === '$${') return '${';
    if (key.startsWith('env.')) {
      const [name, fallback] = splitFallback(key.slice(4));
      const value = process.env[name] ?? fallback;
      if (value === undefined) throw new TestSphereError(`${where}: environment variable ${name} is not set.`);
      if (process.env[name] !== undefined) onSecret?.(key);
      return value;
    }
    if (!Object.hasOwn(vars, key)) {
      throw new TestSphereError(
        `${where}: unknown variable \${${key}}.${didYouMean(key, Object.keys(vars))} Define it under vars: or pass --var ${key}=...`,
      );
    }
    if (secrets?.has(key)) onSecret?.(key);
    return String(vars[key]);
  });
}

function splitFallback(text) {
  const at = text.indexOf(':-');
  return at === -1 ? [text.trim(), undefined] : [text.slice(0, at).trim(), text.slice(at + 2)];
}

/** Substitute variables into every string inside a parsed YAML/JSON value. */
export function interpolateDeep(value, vars, opts) {
  if (typeof value === 'string') return interpolate(value, vars, opts);
  if (Array.isArray(value)) return value.map((item) => interpolateDeep(item, vars, opts));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolateDeep(v, vars, opts)]));
  }
  return value;
}
