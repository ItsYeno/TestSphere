import path from 'node:path';
import { formatDuration } from './util.js';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : String(text));
export const c = { green: paint(32), red: paint(31), yellow: paint(33), dim: paint(2), bold: paint(1), cyan: paint(36) };

const ICON = { passed: c.green('✓'), failed: c.red('✗'), warned: c.yellow('!'), skipped: c.dim('-'), error: c.yellow('!') };

/** Live progress in the terminal, wired to the runner's callbacks. */
export function consoleReporter(write = (line) => console.log(line)) {
  let lastCase = null;
  return {
    flowStarted(flow) {
      lastCase = null;
      write('');
      write(`${c.bold(flow.name)}  ${c.dim(`${flow.file} · ${flow.target}${flow.platform ? ` (${flow.platform})` : ''}`)}`);
    },
    stepFinished(step, flow) {
      let indent = '  ';
      if (step.case != null) {
        indent = '    ';
        if (step.case !== lastCase) {
          lastCase = step.case;
          write(`  ${c.cyan(flow.cases.find((x) => x.index === step.case)?.name ?? `Case ${step.case + 1}`)}`);
        }
      }
      const label = step.status === 'skipped' ? c.dim(step.label) : step.label;
      const time = step.status === 'skipped' ? '' : `  ${c.dim(formatDuration(step.durationMs))}`;
      write(`${indent}${ICON[step.status]} ${label}${time}`);
      if (step.error) write(`${indent}    ${step.status === 'warned' ? c.yellow(step.error) : c.red(step.error)}`);
    },
    flowFinished(flow) {
      if (flow.status === 'error') write(`  ${ICON.error} ${c.yellow(flow.error)}`);
      for (const warning of flow.warnings) write(`  ${c.yellow(warning)}`);
      const cases = flow.cases.length ? `${flow.cases.filter((x) => x.status === 'passed').length}/${flow.cases.length} questions passed · ` : '';
      const status = { passed: c.green('Passed'), failed: c.red('Failed'), error: c.yellow("Didn't run") }[flow.status];
      write(`  ${status} ${c.dim(`· ${cases}${formatDuration(flow.durationMs)}`)}`);
    },
  };
}

export function printSummary(run, files, write = (line) => console.log(line)) {
  const s = run.summary;
  const parts = [`${s.passed} passed`];
  if (s.failed) parts.push(c.red(`${s.failed} failed`));
  if (s.errors) parts.push(c.yellow(`${s.errors} didn't run`));
  const extra = [s.cases.total ? `${s.cases.passed}/${s.cases.total} agent questions passed` : '', s.costUsd != null ? `agent cost $${s.costUsd.toFixed(2)}` : '']
    .filter(Boolean)
    .join(' · ');
  write('');
  write(`${c.bold(`${s.flows} flow${s.flows === 1 ? '' : 's'}:`)} ${parts.join(', ')} ${c.dim(`· ${formatDuration(run.durationMs)}`)}`);
  if (extra) write(c.dim(extra));
  write(`Report: ${c.cyan(relative(files.report))}`);
}

function relative(file) {
  const rel = path.relative(process.cwd(), file);
  return rel && !rel.startsWith('..') ? rel : file;
}
