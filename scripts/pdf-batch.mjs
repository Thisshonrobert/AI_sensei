import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, lstat, stat } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { sanitizeBatch } from './import-batches.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
export async function readJson(path) {
  if ((await stat(path)).size > 50 * 1024 * 1024) throw new Error('JSON input exceeds 50 MiB');
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
}
export async function writeFreshJson(path, value) {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', encoding: 'utf8' });
}

// All CLI outputs must be ignored and inside private-data. Reject link/junction
// ancestors rather than resolving them (realpath can fail in Windows sandboxes).
export async function privateOutput(path) {
  const root = resolve(ROOT, 'private-data');
  const target = resolve(path);
  const inside = candidate => { const p = relative(root, candidate); return p !== '' && !isAbsolute(p) && p !== '..' && !p.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`); };
  if (!inside(target)) throw new Error('Output must be inside private-data');
  let ancestor = dirname(target);
  while (true) {
    try { const info = await lstat(ancestor); if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Output ancestor must be a directory without symlinks/junctions'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (relative(ROOT, ancestor) === '') break;
    const parent = dirname(ancestor);
    if (parent === ancestor) throw new Error('Output ancestor did not reach workspace root');
    ancestor = parent;
  }
  execFileSync('rtk', ['proxy', 'git', 'check-ignore', '--quiet', '--', relative(ROOT, target)], { cwd: ROOT, stdio: 'ignore' });
  return target;
}

const sameSet = (a, b) => a.length === new Set(a).size && b.length === new Set(b).size && a.length === b.length && a.every(v => b.includes(v));
export function validateDraft(input, { expectedPages, expectedRecordKeys } = {}) {
  const records = [...(input?.entries || []), ...(input?.exercise_passages || []), ...(input?.lesson_questions || [])];
  const keys = records.map(r => r.source_record_key);
  if (keys.some(k => typeof k !== 'string' || !k.trim())) throw new Error('Missing stable source identity');
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate source identities');
  const { issues } = sanitizeBatch(input);
  if (expectedPages && !sameSet(input.pdf_pages_processed, expectedPages)) throw new Error('Declared page coverage differs from expected coverage');
  if (expectedRecordKeys && !sameSet(keys, expectedRecordKeys)) throw new Error('Record coverage differs from expected identities');
  if (new Set(input.pdf_pages_processed).size !== input.pdf_pages_processed.length) throw new Error('Duplicate processed pages');
  if (input.unreadable_pdf_pages.some(p => !input.pdf_pages_processed.includes(p))) throw new Error('Unreadable page is outside declared coverage');
  const fatal = issues.filter(i => ['page-not-processed', 'duplicate-option-label', 'duplicate-source-key'].includes(i.code));
  if (fatal.length) throw new Error(`Invalid source page or identity checks (${fatal.length})`);
  for (const entry of input.entries) {
    for (const field of ['kanji_components', 'component_breakdown']) {
      if (entry[field] === undefined) continue; // Legacy source omissions stay omitted.
      if (!Array.isArray(entry[field])) throw new Error('Malformed component collection');
      for (const c of entry[field]) {
        if ((c.text !== null && (typeof c.text !== 'string' || !c.text.length)) || !Array.isArray(c.meanings) || c.meanings.some(m => typeof m !== 'string') || !Array.isArray(c.source_pdf_pages) || c.source_pdf_pages.some(p => !Number.isInteger(p) || !input.pdf_pages_processed.includes(p)) || (c.reading !== undefined && c.reading !== null && typeof c.reading !== 'string')) throw new Error('Malformed component or source page');
        if (c.text === null) issues.push({ code: 'unreadable-component', message: 'Printed component text is unreadable; null retained.', record_key: entry.source_record_key });
      }
    }
  }
  return { version: 1, automated_validation: 'passed', source_comparison: 'not established by this command', human_approval: 'pending', counts: { entries: input.entries.length, questions: input.lesson_questions?.length || 0, examples: input.entries.reduce((n, e) => n + (e.examples?.length || 0) + (e.example_words?.length || 0), 0), components: input.entries.reduce((n, e) => n + (e.kanji_components?.length || 0) + (e.component_breakdown?.length || 0), 0) }, pages: input.pdf_pages_processed, warnings: issues };
}

export function assembleDrafts(parts, options = {}) {
  if (!parts.length) throw new Error('No assembly parts');
  parts.forEach(p => validateDraft(p));
  const first = parts[0];
  for (const part of parts) if (JSON.stringify([part.schema_version, part.content_type, part.source, part.batch]) !== JSON.stringify([first.schema_version, first.content_type, first.source, first.batch])) throw new Error('Incompatible source/lesson metadata');
  const result = structuredClone(first);
  for (const field of ['entries', 'exercise_passages', 'lesson_questions', 'component_aids']) if (parts.some(p => p[field] !== undefined)) result[field] = parts.flatMap(p => structuredClone(p[field] || []));
  for (const field of ['pdf_pages_processed', 'unreadable_pdf_pages']) result[field] = [...new Set(parts.flatMap(p => p[field]))].sort((a, b) => a - b);
  validateDraft(result, options);
  return result;
}

function validateAttempts(attempts) {
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(attempts)) throw new Error('Explicit attempt map required; missing historical counts are unknown');
  for (const value of Object.values(attempts)) {
    if (!object(value) || !Object.keys(value).length) throw new Error('Malformed attempt counters');
    for (const [kind, count] of Object.entries(value)) {
      if (!['lookups', 'repairs'].includes(kind) || !Number.isInteger(count) || count < 0 || count > 2) throw new Error('Invalid attempt counter; limit is two');
    }
  }
}

export async function saveCheckpoint(spec, output) {
  if (!Array.isArray(spec.artifacts) || !spec.artifacts.length) throw new Error('Checkpoint needs artifacts');
  validateAttempts(spec.attempts);
  const artifacts = [];
  for (const item of spec.artifacts) {
    const path = resolve(item.path), sha256 = hashBytes(await readFile(path));
    if (item.sha256 && item.sha256 !== sha256) throw new Error('Expected artifact hash differs');
    if (item.role === 'source-draft') validateDraft(await readJson(path));
    artifacts.push({ role: item.role || 'evidence', path, sha256 });
  }
  const checkpoint = { ...spec, version: 1, created_at: new Date().toISOString(), artifacts, attempts: spec.attempts, attempt_history: spec.attempt_history || 'explicit map; reconcile any older unknown counters before targeted retries', human_approval: 'pending' };
  await writeFreshJson(output, checkpoint);
  return checkpoint;
}

export async function resumeCheckpoint(path) {
  const checkpoint = await readJson(path);
  if (checkpoint.version !== 1 || !Array.isArray(checkpoint.artifacts) || !checkpoint.artifacts.length) throw new Error('Unsupported checkpoint; create a hash-bound snapshot');
  validateAttempts(checkpoint.attempts);
  for (const item of checkpoint.artifacts) {
    if (hashBytes(await readFile(item.path)) !== item.sha256) throw new Error('Checkpoint artifact changed; reconcile instead of resuming');
    if (item.role === 'source-draft') validateDraft(await readJson(item.path));
  }
  return { artifact_count: checkpoint.artifacts.length, attempts: checkpoint.attempts, attempt_history: checkpoint.attempt_history, metrics: checkpoint.metrics || {}, next_batch: checkpoint.next_batch || null, next_action: checkpoint.next_action || null, human_approval: 'pending', continuation_prompt: `Resume from ${resolve(path)} using docs/extraction-templates/batch-workflow.md. Run the resume command to check hashes. Load only the next batch and unresolved cases required by next_action. Reconcile unknown historical attempts before targeted retries. Preserve source/corrections, retry limits and the three-new-production-batch limit; keep enrichment and human approval separate. Next: ${JSON.stringify(checkpoint.next_action || checkpoint.next_batch || 'inspect saved pending work')}` };
}

async function main(args) {
  const [mode, input, output, expected] = args;
  if (mode === 'resume' && input && args.length === 2) { console.log(JSON.stringify(await resumeCheckpoint(input))); return; }
  if (!input || !output || !['validate', 'assemble', 'checkpoint'].includes(mode) || args.length > (mode === 'validate' ? 4 : 3)) throw new Error('Usage: pdf-batch.mjs validate <source> <new-report> [expectations-json] | assemble <parts-spec> <new-source> | checkpoint <spec> <new-checkpoint> | resume <checkpoint>');
  const target = await privateOutput(output), spec = await readJson(input);
  if (mode === 'validate') {
    const report = validateDraft(spec, expected ? await readJson(expected) : {});
    await writeFreshJson(target, report); console.log(JSON.stringify({ status: 'validated', counts: report.counts, warning_count: report.warnings.length }));
  } else if (mode === 'checkpoint') {
    const checkpoint = await saveCheckpoint(spec, target); console.log(JSON.stringify({ status: 'checkpointed', artifacts: checkpoint.artifacts.length }));
  } else {
    const parts = [];
    for (const item of spec.parts || []) {
      if (!/^[a-f0-9]{64}$/.test(item.sha256) || hashBytes(await readFile(item.path)) !== item.sha256) throw new Error('Assembly part hash differs or is absent');
      parts.push(await readJson(item.path));
    }
    const batch = assembleDrafts(parts, spec); await writeFreshJson(target, batch);
    console.log(JSON.stringify({ status: 'assembled', counts: validateDraft(batch).counts }));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(() => { console.error('PDF batch command failed; check arguments, private paths, schema, expected identities/pages and artifact hashes. Prior files are retained.'); process.exitCode = 1; });
