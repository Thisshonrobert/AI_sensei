import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateDraft, assembleDrafts, saveCheckpoint, resumeCheckpoint, writeFreshJson, privateOutput } from '../scripts/pdf-batch.mjs';

const template = JSON.parse(await readFile(new URL('../docs/extraction-templates/vocabulary.template.json', import.meta.url), 'utf8'));
function draft() { const x = structuredClone(template); x.component_aids = []; return x; }
async function temporary(t) { const root = await mkdtemp(join(tmpdir(), 'pdf-batch-')); t.after(() => rm(root, { recursive: true, force: true })); return root; }

test('validation preserves source including missing fields; duplicate identities fail', () => {
  const x = draft(); x.entries[0].reading = null; const original = JSON.stringify(x);
  const report = validateDraft(x, { expectedPages: [1] });
  assert.equal(JSON.stringify(x), original);
  assert.equal(report.counts.entries, 1);
  assert.ok(report.warnings.some(w => w.code === 'missing-critical-field'));
  x.entries.push(structuredClone(x.entries[0]));
  assert.throws(() => validateDraft(x), /Duplicate/);
});

test('page coverage, source identities and malformed nested components are checked', () => {
  const x = draft();
  assert.throws(() => validateDraft(x, { expectedPages: [1, 2] }), /coverage/);
  x.entries[0].kanji_components[0].source_pdf_pages = [2];
  assert.throws(() => validateDraft(x), /page/);
  x.entries[0].kanji_components[0].source_pdf_pages = [1];
  x.entries[0].kanji_components[0].reading = 12;
  assert.throws(() => validateDraft(x), /component/);
  delete x.entries[0].source_record_key;
  assert.throws(() => validateDraft(x), /identity/);
});

test('unreadable printed components retain null source text without fabrication', () => {
  const x = draft(); x.entries[0].kanji_components[0].text = null;
  const before = JSON.stringify(x);
  assert.ok(validateDraft(x).warnings.some(w => w.code === 'unreadable-component'));
  assert.equal(JSON.stringify(x), before);
});

test('assembly retains exact records and rejects incompatible metadata or duplicate parts', () => {
  const a = draft(), b = draft(); b.pdf_pages_processed = [2];
  b.entries[0].source_record_key = 'vocabulary/batch/entry_002';
  b.entries[0].source_pdf_pages = [2];
  for (const c of b.entries[0].kanji_components) c.source_pdf_pages = [2];
  for (const e of b.entries[0].examples) e.source_pdf_pages = [2];
  const result = assembleDrafts([a, b], { expectedPages: [1, 2] });
  assert.deepEqual(result.entries, [...a.entries, ...b.entries]);
  assert.throws(() => assembleDrafts([a, a]), /Duplicate/);
  b.source.book_id = 'another-book';
  assert.throws(() => assembleDrafts([a, b]), /metadata/);
});

test('checkpoints bind exact files and preserve attempts across safe resumption', async t => {
  const root = await temporary(t), source = join(root, 'source.json'), checkpoint = join(root, 'checkpoint.json');
  await writeFile(source, JSON.stringify(draft()));
  await saveCheckpoint({ artifacts: [{ role: 'source-draft', path: source }], attempts: { 'field-a': { lookups: 2, repairs: 1 } }, next_batch: { pages: [2, 3] } }, checkpoint);
  const resumed = await resumeCheckpoint(checkpoint);
  assert.deepEqual(resumed.attempts, { 'field-a': { lookups: 2, repairs: 1 } });
  assert.deepEqual(resumed.next_batch.pages, [2, 3]);
  await assert.rejects(saveCheckpoint({ artifacts: [{ path: source }], attempts: { a: { lookups: 3 } } }, join(root, 'bad.json')), /attempt/);
  await assert.rejects(saveCheckpoint({ artifacts: [{ path: source, sha256: '0'.repeat(64) }], attempts: {} }, join(root, 'bad-hash.json')), /hash/);
  for (const attempts of [3, [], { a: 3 }, { a: [] }, null, undefined]) {
    await assert.rejects(saveCheckpoint({ artifacts: [{ path: source }], attempts }, join(root, 'malformed-attempts.json')), /attempt/);
  }
  await writeFile(source, JSON.stringify({ changed: true }));
  await assert.rejects(resumeCheckpoint(checkpoint), /changed/);
});

test('fresh outputs refuse overwrite and leave prior reviewed corrections untouched', async t => {
  const root = await temporary(t), file = join(root, 'review.json');
  await writeFreshJson(file, { correction: 'human' });
  const before = await readFile(file);
  await assert.rejects(writeFreshJson(file, { correction: 'new' }), /EEXIST/);
  assert.deepEqual(await readFile(file), before);
});

test('private output preflight works in Windows sandbox and rejects workspace/public escapes', async () => {
  assert.equal(await privateOutput(join(process.cwd(), 'private-data', 'synthetic-output-test.json')), join(process.cwd(), 'private-data', 'synthetic-output-test.json'));
  await assert.rejects(privateOutput(join(process.cwd(), 'public', 'source.json')), /inside private-data/);
  await assert.rejects(privateOutput(join(process.cwd(), 'private-data', '..', 'source.json')), /inside private-data/);
});

test('Windows mixed-case private paths terminate preflight', { skip: process.platform !== 'win32' }, () => {
  const path = join(process.cwd().toLowerCase(), 'private-data', 'synthetic-mixed-case.json');
  const script = `import { privateOutput } from './scripts/pdf-batch.mjs'; await privateOutput(${JSON.stringify(path)});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { timeout: 3000, stdio: 'pipe' });
  assert.equal(result.status, 0, result.error?.code || result.stderr.toString());
});
