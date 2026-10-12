import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDictionary, JMDICT_URL } from '../src/lib/server/generation/dictionary.mjs';
import { validateDraft, readJson, writeFreshJson, privateOutput, hashBytes } from './pdf-batch.mjs';

// Retrieval and contextual decisions have different identities. Never reuse a
// sense merely because another source occurrence shares its spelling.
export function createLookupCache(input = { version: 1, retrievals: {}, selections: {} }) {
  if (input.version !== 1 || !input.retrievals || !input.selections) throw new Error('Unsupported cache');
  const data = structuredClone(input);
  return {
    data,
    selectionKey: (edition, r) => JSON.stringify([edition, r.form, r.reading, r.meanings, r.context]),
    async lookup(dictionary, form) {
      if (dictionary.metadata.status !== 'ready') return { candidates: [], unavailable: true };
      const edition = dictionary.metadata.edition || dictionary.metadata.sha256;
      if (!edition) throw new Error('Dictionary edition missing');
      const key = JSON.stringify([edition, form]);
      if (!Object.hasOwn(data.retrievals, key)) {
        const candidates = await dictionary.lookup(form);
        data.retrievals[key] = { candidates: structuredClone([...candidates]), truncated: Boolean(candidates.truncated) };
      }
      return structuredClone(data.retrievals[key]);
    },
  };
}

const normalizeGloss = text => text.toLowerCase().replace(/\s+/g, ' ').trim();
const kana = text => /^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s]+$/u.test(text);
// Exact gloss alignment is deliberately conservative. Translation similarity
// is a review task; lookup success alone never selects a contextual sense.
export function resolveCandidates(candidates, request, truncated = candidates.truncated) {
  if (truncated) return { reason: 'truncated-candidates' };
  if (!candidates.length) return { reason: 'missing-match' };
  let options = candidates.flatMap(c => c.senses.flatMap((sense, index) => (sense.readings || c.readings).filter(r => c.readings.includes(r) && (!request.reading || r === request.reading)).map(reading => ({ dictionary_entry: c.id, sense_index: index, reading, meanings: sense.meanings, pos: sense.pos || [], notes: sense.notes || [] }))));
  if (!options.length) return { reason: 'reading-mismatch' };
  if (request.meanings?.length) {
    options = options.filter(o => request.meanings.every(m => o.meanings.some(g => normalizeGloss(g) === normalizeGloss(m))));
    if (!options.length) return { reason: 'sense-context-mismatch' };
  }
  if (new Set(options.map(o => o.reading)).size > 1) return { reason: 'ambiguous-reading' };
  if (options.length !== 1) return { reason: 'ambiguous-sense' };
  if (!kana(options[0].reading) || !options[0].meanings.length) return { reason: 'invalid-dictionary-fields' };
  return { selection: options[0] };
}

export function collectRequests(batch) {
  const requests = [];
  for (const e of batch.entries) {
    const add = (form, reading, meanings, field, context, componentIndex = null) => {
      if (typeof form === 'string' && form.trim()) requests.push({ source_record_key: e.source_record_key, form, reading: reading || null, meanings: meanings || [], field, context, component_index: componentIndex, source_pdf_pages: e.source_pdf_pages });
    };
    if (batch.content_type === 'vocabulary') {
      add(e.word, e.reading, e.meanings, '', e.examples || []);
      (e.kanji_components || []).forEach((c, i) => add(c.text, c.reading, c.meanings, `kanji_components[${i}]`, { parent_word: e.word, parent_reading: e.reading, source: c }, i));
    }
    if (batch.content_type === 'kanji') {
      (e.example_words || []).forEach((w, i) => add(w.word, w.reading, w.meanings, `example_words[${i}]`, { character: e.character, source: w }));
      (e.component_breakdown || []).forEach((c, i) => {
        // JMdict is a word dictionary, not a kanji/radical etymology source.
        if (typeof c.text === 'string' && [...c.text].length > 1) add(c.text, c.reading, c.meanings, `component_breakdown[${i}]`, { character: e.character, source: c });
      });
    }
  }
  return requests;
}

function preparePacket(batch, batchId, existing) {
  const identities = new Map(batch.entries.map(e => [e.source_record_key, { written_form: e.word || e.character || e.pattern, reading: e.reading || null }]));
  if (existing && (existing.schema_version !== 1 || existing.packet_type !== 'study_enrichment_review' || existing.book_id !== batch.source.book_id || existing.batch_id !== batchId)) throw new Error('Existing packet identity mismatch');
  const packet = existing ? structuredClone(existing) : { schema_version: 1, packet_type: 'study_enrichment_review', book_id: batch.source.book_id, batch_id: batchId, records: [], unresolved: [] };
  if (!Array.isArray(packet.records) || !Array.isArray(packet.unresolved)) throw new Error('Malformed packet');
  const seen = new Set();
  for (const r of packet.records) {
    const expected = identities.get(r.source_record_key);
    if (seen.has(r.source_record_key)) throw new Error('Duplicate packet identity');
    seen.add(r.source_record_key);
    if (!expected || r.identity?.written_form !== expected.written_form || (r.identity.reading || null) !== expected.reading) throw new Error('Existing record identity mismatch');
    for (const field of ['field_enrichments', 'component_aids', 'study_aids', 'issues']) if (!Array.isArray(r[field])) throw new Error('Malformed packet collection');
    if (new Set(r.field_enrichments.map(f => f.field)).size !== r.field_enrichments.length) throw new Error('Duplicate enrichment fields');
  }
  for (const [key, identity] of identities) if (!seen.has(key)) packet.records.push({ source_record_key: key, identity, field_enrichments: [], component_aids: [], study_aids: [], issues: [] });
  return packet;
}

export async function enrichBatch(batch, { batchId, dictionary, cache = createLookupCache(), existing } = {}) {
  const validation = validateDraft(batch);
  if (!['vocabulary', 'kanji'].includes(batch.content_type) || typeof batchId !== 'string' || !batchId.trim()) throw new Error('Vocabulary/kanji and stable batch ID required');
  const packet = preparePacket(batch, batchId, existing);
  dictionary ||= await localDictionary();
  const records = new Map(packet.records.map(r => [r.source_record_key, r]));
  const cases = [], requests = collectRequests(batch);
  let resolved = 0, proposed = 0, preserved = 0;
  for (const request of requests) {
    const retrieved = await cache.lookup(dictionary, request.form);
    const edition = dictionary.metadata.edition || dictionary.metadata.sha256 || null;
    const key = cache.selectionKey(edition, request);
    // Recompute from edition-bound evidence even if a selection is cached:
    // cached model/human decisions cannot silently become automatic approval.
    const outcome = retrieved.unavailable ? { reason: 'dictionary-unavailable' } : resolveCandidates(retrieved.candidates, request, retrieved.truncated);
    if (!retrieved.unavailable) cache.data.selections[key] = structuredClone(outcome);
    if (!outcome.selection) { cases.push({ ...request, reason: outcome.reason, candidates: retrieved.candidates, truncated: Boolean(retrieved.truncated), dictionary_edition: edition }); continue; }
    resolved++;
    const s = outcome.selection, record = records.get(request.source_record_key);
    const sources = [{ url: dictionary.metadata.source || JMDICT_URL, title: `EDRDG JMdict ${edition}; entry ${s.dictionary_entry}`, selected_sense: `candidate-filtered sense ${s.sense_index + 1}: ${s.meanings.join('; ')}`, dictionary_entry: s.dictionary_entry, dictionary_edition: edition, reading: s.reading, meanings: s.meanings, pos: s.pos, notes: s.notes, evidence_sha256: hashBytes(JSON.stringify(retrieved.candidates)), licence: dictionary.metadata.licence || 'CC BY-SA 4.0' }];
    for (const [name, value] of [['reading', s.reading], ['meanings', s.meanings]]) {
      const field = request.field ? `${request.field}.${name}` : name;
      const previous = record.field_enrichments.find(f => f.field === field);
      if (previous && (previous.value != null || previous.review_status !== 'unreviewed')) { preserved++; continue; }
      const proposal = { field, value, origin: 'dictionary', sources: structuredClone(sources), issues: [], review_status: 'unreviewed' };
      if (previous) Object.assign(previous, proposal); else record.field_enrichments.push(proposal);
      proposed++;
    }
    if (batch.content_type === 'vocabulary' && request.component_index !== null) {
      const i = request.component_index;
      const aid = record.component_aids.find(a => a.component_index === i);
      const entry = batch.entries.find(e => e.source_record_key === request.source_record_key);
      const values = { vocabulary_source_record_key: entry.source_record_key, word: entry.word, vocabulary_reading: entry.reading, source_pdf_pages: entry.kanji_components[i].source_pdf_pages, component_index: i, component_text: request.form, suggested_reading: s.reading, japanese_word: request.form, japanese_word_reading: s.reading, japanese_word_meaning: s.meanings.join('; '), origin: 'dictionary', sources, review_status: 'unreviewed', issues: ['Whole-word dictionary aid; not a claim about this component pronunciation inside the parent word.'] };
      // Existing component aids can mix reviewed corrections and generated
      // values; preserve every nonempty value and leave their origin intact.
      if (!aid) record.component_aids.push(values);
      else if (aid.review_status === 'unreviewed' && !aid.suggested_reading && !aid.japanese_word && !aid.japanese_word_reading && !aid.japanese_word_meaning) Object.assign(aid, values);
    }
  }
  const metrics = { ...validation.counts, word_occurrences: requests.length, distinct_forms: new Set(requests.map(r => r.form)).size, dictionary_matches: requests.length - cases.filter(c => ['missing-match', 'dictionary-unavailable'].includes(c.reason)).length, dictionary_resolved: resolved, dictionary_unresolved: cases.length, fields_proposed: proposed, existing_fields_preserved: preserved, mnemonics_completed: packet.records.reduce((n, r) => n + r.study_aids.filter(a => a.aid_type === 'meaning_mnemonic' && typeof a.text === 'string' && a.text.trim()).length, 0), mnemonics_generated_by_command: 0, human_approval: 'pending' };
  return { packet, queue: { version: 1, batch_id: batchId, dictionary: dictionary.metadata, cases, metrics, historical_unresolved_retained_in_packet: true }, metrics };
}

async function requireAbsent(path) {
  try { await access(path); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
  throw new Error('Output already exists; choose a new revision');
}

// One job per source occurrence batch. This also supports an explicit backlog
// plan, so callers need no new helper for each chat or batch.
export async function runEnrichmentPlan(plan) {
  if (!Array.isArray(plan.jobs) || !plan.jobs.length) throw new Error('Plan needs jobs');
  const outputs = [...plan.jobs.flatMap(j => [j.output, j.queue_output]), plan.cache_output, plan.summary_output];
  if (outputs.some(p => typeof p !== 'string') || new Set(outputs.map(p => resolve(p))).size !== outputs.length) throw new Error('Distinct explicit outputs required');
  for (const output of outputs) { await privateOutput(output); await requireAbsent(output); }
  const dictionary = await localDictionary();
  const cache = createLookupCache(plan.cache_input ? await readJson(plan.cache_input) : undefined);
  const jobs = [], seen = new Set();
  for (const job of plan.jobs) {
    const bytes = await readFile(job.source), sourceHash = hashBytes(bytes);
    if (!/^[a-f0-9]{64}$/.test(job.source_sha256) || sourceHash !== job.source_sha256) throw new Error('Source hash differs or is absent');
    const source = await readJson(job.source);
    validateDraft(source);
    for (const e of source.entries) {
      const key = JSON.stringify([source.source.book_id, e.source_record_key]);
      if (seen.has(key)) throw new Error('Duplicate source identity across jobs'); seen.add(key);
    }
    let existing;
    if (job.existing) {
      if (!/^[a-f0-9]{64}$/.test(job.existing_sha256) || hashBytes(await readFile(job.existing)) !== job.existing_sha256) throw new Error('Existing packet hash differs or is absent');
      existing = await readJson(job.existing);
    }
    jobs.push({ job, source, sourceHash, existing });
  }
  const started = Date.now(), results = [], inputHashes = [];
  for (const { job, source, sourceHash, existing } of jobs) {
    const result = await enrichBatch(source, { batchId: job.batch_id, dictionary, cache, existing });
    await writeFreshJson(job.output, result.packet);
    await writeFreshJson(job.queue_output, { ...result.queue, source_path: resolve(job.source), source_sha256: sourceHash });
    if (hashBytes(await readFile(job.source)) !== sourceHash || (job.existing && hashBytes(await readFile(job.existing)) !== job.existing_sha256)) throw new Error('Input changed during enrichment; reconcile new outputs');
    inputHashes.push({ path: resolve(job.source), sha256: sourceHash }, ...(job.existing ? [{ path: resolve(job.existing), sha256: job.existing_sha256 }] : []));
    results.push({ batch_id: job.batch_id, output: resolve(job.output), queue_output: resolve(job.queue_output), metrics: result.metrics });
  }
  await writeFreshJson(plan.cache_output, cache.data);
  const summary = { version: 1, elapsed_ms: Date.now() - started, dictionary: dictionary.metadata, distinct_forms: new Set(jobs.flatMap(({ source }) => collectRequests(source).map(r => r.form))).size, results, input_hashes: inputHashes, source_preservation: 'hashes unchanged', source_comparison: 'not performed; no PDFs re-extracted', usage_change: 'unavailable; account activity may be concurrent', human_approval: 'pending' };
  await writeFreshJson(plan.summary_output, summary);
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  (async () => {
    if (args.length !== 2 || args[0] !== 'run') throw new Error('Usage: enrich-study-batch.mjs run <private-plan.json>');
    const result = await runEnrichmentPlan(await readJson(args[1]));
    console.log(JSON.stringify({ batches: result.results.length, distinct_forms: result.distinct_forms, elapsed_ms: result.elapsed_ms, dictionary_status: result.dictionary.status, resolved: result.results.reduce((n, r) => n + r.metrics.dictionary_resolved, 0), unresolved: result.results.reduce((n, r) => n + r.metrics.dictionary_unresolved, 0), human_approval: 'pending' }));
  })().catch(() => { console.error('Enrichment failed; check private paths, fresh outputs, stable identities, input hashes and dictionary/cache metadata. Prior source and reviewed packets are retained.'); process.exitCode = 1; });
}
