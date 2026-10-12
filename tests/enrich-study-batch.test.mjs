import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { collectRequests, resolveCandidates, enrichBatch, createLookupCache, runEnrichmentPlan } from '../scripts/enrich-study-batch.mjs';
import { hashBytes } from '../scripts/pdf-batch.mjs';

const template = JSON.parse(await readFile(new URL('../docs/extraction-templates/vocabulary.template.json', import.meta.url), 'utf8'));
function draft() { const x = structuredClone(template); x.component_aids = []; return x; }
const candidate = (readings = ['がっこう'], senses = [{ meanings: ['school'], readings, spellings: [], pos: ['noun'], notes: [] }]) => [{ id: '1', form: '学校', readings, senses }];

test('reading and sense restrictions are applied together; ambiguity and missing matches remain unresolved', () => {
  const c = candidate(['せい', 'なま'], [
    { meanings: ['life'], readings: ['せい'], spellings: [], notes: [] },
    { meanings: ['raw'], readings: ['なま'], spellings: [], notes: [] },
  ]);
  assert.equal(resolveCandidates(c, { form: '生', reading: 'なま', meanings: [] }).selection.meanings[0], 'raw');
  assert.equal(resolveCandidates(c, { form: '生', reading: null, meanings: [] }).reason, 'ambiguous-reading');
  assert.equal(resolveCandidates(c, { form: '生', reading: 'せい', meanings: ['raw'] }).reason, 'sense-context-mismatch');
  assert.equal(resolveCandidates(c, { form: '生', reading: 'ふ', meanings: [] }).reason, 'reading-mismatch');
  assert.equal(resolveCandidates([], { form: 'missing', reading: null, meanings: [] }).reason, 'missing-match');
  assert.equal(resolveCandidates(candidate(['がっこう'], [
    { meanings: ['school'], readings: ['がっこう'], notes: [] },
    { meanings: ['school of thought'], readings: ['がっこう'], notes: [] },
  ]), { form: '学校', reading: 'がっこう', meanings: [] }).reason, 'ambiguous-sense');
  const truncated = candidate(); truncated.truncated = true;
  assert.equal(resolveCandidates(truncated, { form: '学校', reading: 'がっこう', meanings: [] }).reason, 'truncated-candidates');
});

test('whole words, printed components and all kanji examples keep source occurrence identities', () => {
  assert.equal(collectRequests(draft()).length, 3);
  const k = { content_type: 'kanji', entries: [{ source_record_key: 'k/1', character: '学', component_breakdown: [], example_words: [{ word: '学校', reading: 'がっこう', meanings: [] }, { word: '学校', reading: 'がっこう', meanings: [] }] }] };
  assert.equal(collectRequests(k).length, 2);
  assert.notEqual(collectRequests(k)[0].field, collectRequests(k)[1].field);
});

test('lookup cache retrieves once per edition/form; context selections never reuse spelling alone', async () => {
  let calls = 0; const cache = createLookupCache();
  const dictionary = { metadata: { status: 'ready', edition: 'edition-a' }, lookup: async () => { calls++; return candidate(); } };
  await cache.lookup(dictionary, '学校'); await cache.lookup(dictionary, '学校'); assert.equal(calls, 1);
  await cache.lookup({ ...dictionary, metadata: { status: 'ready', edition: 'edition-b' } }, '学校'); assert.equal(calls, 2);
  assert.notEqual(cache.selectionKey('edition-a', { form: '学校', reading: 'がっこう', meanings: ['school'], context: 'a' }), cache.selectionKey('edition-a', { form: '学校', reading: 'がっこう', meanings: ['school of thought'], context: 'b' }));
});

test('bulk proposals have useful fields and provenance without altering source or reviewed corrections', async () => {
  const source = draft(); source.entries[0].kanji_components = []; const before = JSON.stringify(source);
  let calls = 0; const dictionary = { metadata: { status: 'ready', edition: 'test-edition', source: 'https://www.edrdg.org/pub/Nihongo/JMdict_e.gz' }, lookup: async () => { calls++; return candidate(); } };
  const result = await enrichBatch(source, { batchId: 'batch', dictionary, cache: createLookupCache() });
  assert.equal(JSON.stringify(source), before);
  assert.equal(calls, 1);
  assert.equal(result.packet.records[0].field_enrichments[0].value, 'がっこう');
  assert.deepEqual(result.packet.records[0].field_enrichments[1].value, ['school']);
  assert.equal(result.packet.records[0].field_enrichments[1].review_status, 'unreviewed');
  assert.ok(result.packet.records[0].field_enrichments[1].sources[0].url.includes('edrdg.org'));
  const existing = structuredClone(result.packet);
  existing.records[0].field_enrichments[1] = { field: 'meanings', value: ['human correction'], origin: 'user', review_status: 'approved', sources: [], issues: [] };
  const old = JSON.stringify(existing);
  const rerun = await enrichBatch(source, { batchId: 'batch', dictionary, existing });
  assert.equal(JSON.stringify(existing), old);
  assert.deepEqual(rerun.packet.records[0].field_enrichments[1], existing.records[0].field_enrichments[1]);
});

test('duplicate or mismatched packet identities fail instead of dropping or merging records', async () => {
  const source = draft(); source.entries.push(structuredClone(source.entries[0]));
  await assert.rejects(enrichBatch(source, { batchId: 'batch' }), /Duplicate/);
  const good = draft(), bad = { schema_version: 1, packet_type: 'study_enrichment_review', book_id: good.source.book_id, batch_id: 'batch', records: [{ source_record_key: 'absent', identity: { written_form: 'wrong', reading: null }, field_enrichments: [], component_aids: [], study_aids: [], issues: [] }], unresolved: [] };
  await assert.rejects(enrichBatch(good, { batchId: 'batch', existing: bad }), /identity/);
});

test('unavailable dictionary is explicit and does not cache a false missing match', async () => {
  const source = draft(); source.entries[0].kanji_components = [];
  const cache = createLookupCache();
  const result = await enrichBatch(source, { batchId: 'batch', cache, dictionary: { metadata: { status: 'unavailable' }, lookup: async () => [] } });
  assert.equal(result.queue.cases[0].reason, 'dictionary-unavailable');
  assert.equal(Object.keys(cache.data.retrievals).length, 0);
});

test('cached truncation survives JSON round trip and remains a review case', async () => {
  const c = candidate(); c.truncated = true;
  const dictionary = { metadata: { status: 'ready', edition: 'edition-a' }, lookup: async () => c };
  const cache = createLookupCache(); await cache.lookup(dictionary, '学校');
  const restored = createLookupCache(JSON.parse(JSON.stringify(cache.data)));
  const result = await restored.lookup({ ...dictionary, lookup: async () => { throw new Error('should not re-query'); } }, '学校');
  assert.equal(resolveCandidates(result.candidates, { form: '学校', reading: null, meanings: [] }, result.truncated).reason, 'truncated-candidates');
});

test('real plan preflight refuses overwrite before processing and retains every input', async t => {
  const root = await mkdtemp(join(process.cwd(), 'private-data', 'synthetic-enrichment-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source.json'), output = join(root, 'output.json');
  const bytes = JSON.stringify(draft()); await writeFile(source, bytes); await writeFile(output, 'human reviewed output');
  const plan = { jobs: [{ batch_id: 'batch', source, source_sha256: hashBytes(bytes), output, queue_output: join(root, 'queue.json') }], cache_output: join(root, 'cache.json'), summary_output: join(root, 'summary.json') };
  await assert.rejects(runEnrichmentPlan(plan), /already exists/);
  assert.equal(await readFile(output, 'utf8'), 'human reviewed output');
  assert.equal(await readFile(source, 'utf8'), bytes);
});
