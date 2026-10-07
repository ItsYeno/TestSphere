import fs from 'node:fs';
import path from 'node:path';

const FILE = 'history.jsonl';

/**
 * Every run appends one line per flow to runs/history.jsonl, so the report
 * can show how each flow has done over time: trust measured, not assumed.
 */
export function appendHistory(outDir, run) {
  const lines = run.flows.map((flow) =>
    JSON.stringify({
      run: run.id,
      at: run.startedAt,
      flow: flow.name,
      file: flow.file,
      target: flow.target,
      status: flow.status,
      durationMs: flow.durationMs,
      ...(flow.cases.length ? { cases: { passed: flow.cases.filter((c) => c.status === 'passed').length, total: flow.cases.length } } : {}),
    }),
  );
  fs.mkdirSync(outDir, { recursive: true });
  fs.appendFileSync(path.join(outDir, FILE), `${lines.join('\n')}\n`);
}

export function readHistory(outDir) {
  let text;
  try {
    text = fs.readFileSync(path.join(outDir, FILE), 'utf8');
  } catch {
    return [];
  }
  return text
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

/** The most recent results for one flow on one target, oldest first. */
export function trendFor(history, flow, limit = 20) {
  return history.filter((entry) => entry.file === flow.file && entry.target === flow.target).slice(-limit);
}
