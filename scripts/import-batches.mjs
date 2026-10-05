import { createHash } from 'node:crypto';
import { mkdir, readFile, copyFile, writeFile } from 'node:fs/promises';
import { dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXTRACTOR_VERSION = 'batch-sanitizer-2';
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_RECORDS = 10_000;
const pages = z.array(z.number().int().positive()).max(1000);
const strings = z.array(z.string().max(100_000)).max(10_000);
const stringOrNull = z.string().max(100_000).nullable();
const example = z.object({ japanese: stringOrNull, reading: stringOrNull.optional(), translation: stringOrNull.optional(), source_pdf_pages: pages }).passthrough();
const exampleWord = z.object({ word: z.string().min(1), reading: stringOrNull, meanings: strings, source_pdf_pages: pages }).passthrough();
const commonEntry = { source_record_key: z.string().min(1).max(300).optional(), source_pdf_pages: pages, source_printed_pages: strings, review_status: z.literal('unreviewed'), issues: strings };
const schemas = {
  vocabulary: z.object({ ...commonEntry, word: z.string().min(1).max(100_000), reading: stringOrNull, meanings: strings, parts_of_speech: z.union([z.array(stringOrNull), stringOrNull]), jlpt_level: z.enum(['N1', 'N2', 'N3', 'N4', 'N5']).nullable(), chapter: stringOrNull, examples: z.array(example).max(10_000), notes: stringOrNull }).passthrough(),
  kanji: z.object({ ...commonEntry, character: z.string().min(1).max(100), meanings: strings, on_readings: strings, kun_readings: strings, stroke_count: z.number().int().positive().nullable(), radical: stringOrNull, jlpt_level: z.enum(['N1', 'N2', 'N3', 'N4', 'N5']).nullable(), chapter: stringOrNull, example_words: z.array(exampleWord).max(10_000), notes: stringOrNull }).passthrough(),
  grammar: z.object({ ...commonEntry, source_record_key: z.string().min(1).max(300), pattern: z.string().min(1).max(100_000), meanings: strings, formation: strings, explanation: stringOrNull, usage_notes: z.union([stringOrNull, strings]), jlpt_level: z.enum(['N1', 'N2', 'N3', 'N4', 'N5']).nullable(), chapter: stringOrNull, examples: z.array(example).max(10_000) }).passthrough(),
};
const sourceSchema = z.object({ book_id: z.string().min(1).max(300), book_title: z.string().min(1).max(1000), file_name: z.string().min(1).max(1000) }).passthrough();
const answerSchema = z.object({ source_answer_text: stringOrNull, correct_option_labels: strings, acceptable_answers: strings, ordered_option_labels: strings, target_position: z.number().int().nonnegative().nullable(), rationale: stringOrNull, scoring_rubric: stringOrNull, source_pdf_pages: pages, source_printed_pages: strings, origin: z.literal('book'), verification_status: z.literal('unreviewed') }).passthrough();
const questionSchema = z.object({ source_record_key: z.string().min(1).max(300), question_number: z.string().min(1).max(100), exercise_section: z.string().min(1).max(1000), origin: z.literal('book'), instructions: stringOrNull, prompt: z.string().min(1).max(100_000), format: z.enum(['multiple_choice', 'fill_in_blank', 'sentence_ordering', 'short_answer', 'other']), options: z.array(z.object({ label: z.string(), text: z.string() }).passthrough()).max(100), parent_passage_key: stringOrNull, target_grammar_keys: z.array(z.string().min(1).max(300)).max(100), answer_specification: answerSchema.nullable(), source_pdf_pages: pages, source_printed_pages: strings, review_status: z.literal('unreviewed'), issues: strings }).passthrough();
const passageSchema = z.object({ source_record_key: z.string().min(1).max(300), title: stringOrNull, japanese: z.string().min(1).max(100_000), translation: stringOrNull, source_pdf_pages: pages, source_printed_pages: strings, origin: z.literal('book'), review_status: z.literal('unreviewed'), issues: strings }).passthrough();
const batchSchemas = {
  vocabulary: z.object({ schema_version: z.literal(1), content_type: z.literal('vocabulary'), source: sourceSchema, pdf_pages_processed: pages, unreadable_pdf_pages: pages, entries: z.array(schemas.vocabulary).min(1).max(MAX_RECORDS) }).passthrough(),
  kanji: z.object({ schema_version: z.literal(1), content_type: z.literal('kanji'), source: sourceSchema, pdf_pages_processed: pages, unreadable_pdf_pages: pages, entries: z.array(schemas.kanji).min(1).max(MAX_RECORDS) }).passthrough(),
  grammar: z.object({ schema_version: z.literal(2), content_type: z.literal('grammar'), source: sourceSchema, batch: z.object({ batch_id: z.string().min(1), lesson_key: z.string().min(1), lesson_number: z.number().int().positive(), lesson_title: stringOrNull, expected_grammar_count: z.number().int().nonnegative().nullable(), expected_question_count: z.number().int().nonnegative().nullable() }).passthrough(), pdf_pages_processed: pages, unreadable_pdf_pages: pages, entries: z.array(schemas.grammar).min(1).max(MAX_RECORDS), exercise_passages: z.array(passageSchema).max(MAX_RECORDS), lesson_questions: z.array(questionSchema).max(MAX_RECORDS) }).passthrough(),
};

export function sanitizeBatch(input, label = 'batch.json') {
  const schema = batchSchemas[input?.content_type];
  if (!schema) throw new Error(`${label}: unsupported or missing content_type`);
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const detail = parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
    throw new Error(`${label}: malformed structure; ${detail}`);
  }

  const batch = structuredClone(parsed.data);
  const issues = [];
  const warn = (code, message, recordKey = null) => issues.push({ code, message, record_key: recordKey });
  const records = [
    ...batch.entries.map((record, index) => ({ record, index, family: 'entry' })),
    ...(batch.exercise_passages || []).map((record, index) => ({ record, index, family: 'passage' })),
    ...(batch.lesson_questions || []).map((record, index) => ({ record, index, family: 'question' })),
  ];
  if (records.length > MAX_RECORDS) throw new Error(`${label}: total record limit ${MAX_RECORDS} exceeded`);

  const checkNestedPages = (value, key, recordKey = null) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const child of value) checkNestedPages(child, key, recordKey); return; }
    const currentKey = value.source_record_key || recordKey;
    if (Array.isArray(value.source_pdf_pages)) for (const page of value.source_pdf_pages) {
      if (!batch.pdf_pages_processed.includes(page)) warn('page-not-processed', `Nested source PDF page ${page} is not listed in pdf_pages_processed.`, currentKey);
    }
    for (const [childKey, child] of Object.entries(value)) if (childKey !== 'source_pdf_pages') checkNestedPages(child, childKey, currentKey);
  };

  const pageOrder = new Map();
  for (const { record, index, family } of records) {
    const firstPage = record.source_pdf_pages[0];
    if (firstPage === undefined) warn('missing-source-page', 'Record has no source_pdf_pages; preserved without guessing a page.', record.source_record_key ?? null);
    checkNestedPages(record, family, record.source_record_key ?? null);
    if (!record.source_record_key) {
      const keyPage = firstPage ?? 0;
      const counterKey = `${family}:${keyPage}`;
      const order = (pageOrder.get(counterKey) || 0) + 1;
      pageOrder.set(counterKey, order);
      record.source_record_key = `${batch.content_type}/page_${keyPage}/record_${String(order).padStart(3, '0')}`;
      record.issues.push('Provisional source_record_key generated from source page and order because schema v1 has no stable source key. Human review required.');
      warn('provisional-source-key', 'Schema v1 supplied no source_record_key; generated a page-and-order locator, not a canonical content identity.', record.source_record_key);
    }
    const sourceRecord = batch.entries.includes(record);
    if (sourceRecord && batch.content_type === 'vocabulary' && !record.reading) warn('missing-critical-field', 'Vocabulary reading is missing; record is preserved but needs source review.', record.source_record_key);
    if (sourceRecord && batch.content_type === 'vocabulary' && !record.meanings.length) warn('missing-critical-field', 'Vocabulary meanings are empty; record is preserved but needs source review.', record.source_record_key);
    if (sourceRecord && batch.content_type === 'kanji' && !record.meanings.length) warn('missing-critical-field', 'Kanji meanings are empty; record is preserved but needs source review.', record.source_record_key);
    if (sourceRecord && batch.content_type === 'kanji' && !record.on_readings.length && !record.kun_readings.length) warn('missing-critical-field', 'Both kanji reading collections are empty; record is preserved but needs source review.', record.source_record_key);
    if (sourceRecord && batch.content_type === 'grammar' && !record.meanings.length) warn('missing-critical-field', 'Grammar meanings are empty; record is preserved but needs source review.', record.source_record_key);
    if (sourceRecord && batch.content_type === 'grammar' && !record.formation.length) warn('missing-critical-field', 'Grammar formation is empty; record is preserved but needs source review.', record.source_record_key);
  }

  if (batch.content_type === 'grammar') {
    const entryKeys = new Set(batch.entries.map(({ source_record_key }) => source_record_key));
    const passageKeys = new Set(batch.exercise_passages.map(({ source_record_key }) => source_record_key));
    const questionKeys = new Set(batch.lesson_questions.map(({ source_record_key }) => source_record_key));
    for (const passage of batch.exercise_passages) if (questionKeys.has(passage.source_record_key)) warn('duplicate-source-key', 'Passage and question use the same source_record_key.', passage.source_record_key);
    for (const question of batch.lesson_questions) {
      if (entryKeys.has(question.source_record_key) || passageKeys.has(question.source_record_key)) warn('duplicate-source-key', 'Question source_record_key is already used by another record.', question.source_record_key);
      if (question.parent_passage_key && !passageKeys.has(question.parent_passage_key)) warn('unresolved-passage-reference', `parent_passage_key ${question.parent_passage_key} has no passage in this batch.`, question.source_record_key);
      for (const key of question.target_grammar_keys) if (!entryKeys.has(key)) warn('unresolved-grammar-reference', `target_grammar_key ${key} is not present in this batch; it was preserved without inferring a replacement.`, question.source_record_key);
      if (!question.target_grammar_keys.length) warn('unlinked-question', 'No target_grammar_keys were supplied; grammar links were not inferred from order.', question.source_record_key);
      const optionLabels = question.options.map(({ label: optionLabel }) => optionLabel);
      if (new Set(optionLabels).size !== optionLabels.length) warn('duplicate-option-label', 'Question has duplicate option labels.', question.source_record_key);
      if (!question.answer_specification) warn('missing-answer-key', 'No source answer key was supplied; question remains unscored.', question.source_record_key);
      if (question.answer_specification) {
        const answer = question.answer_specification;
        const invalidLabels = [...answer.correct_option_labels, ...answer.ordered_option_labels].filter((optionLabel) => !optionLabels.includes(optionLabel));
        if (invalidLabels.length) throw new Error(`${label}: ${question.source_record_key} answer_specification references an option label not present in options`);
        if (answer.verification_status !== 'unreviewed') throw new Error(`${label}: ${question.source_record_key} has non-unreviewed answer verification status`);
        warn('answer-key-unreviewed', 'Source answer is retained as unreviewed and is not approved for scored testing.', question.source_record_key);
      }
    }
    const expectedEntries = batch.batch.expected_grammar_count;
    const expectedQuestions = batch.batch.expected_question_count;
    if (expectedEntries !== null && expectedEntries !== batch.entries.length) warn('count-mismatch', `Expected ${expectedEntries} grammar entries but found ${batch.entries.length}.`);
    if (expectedQuestions !== null && expectedQuestions !== batch.lesson_questions.length) warn('count-mismatch', `Expected ${expectedQuestions} questions but found ${batch.lesson_questions.length}.`);
  }

  const keys = new Set();
  for (const { record } of records) {
    if (keys.has(record.source_record_key)) warn('duplicate-source-key', 'Duplicate source_record_key appears in this batch.', record.source_record_key);
    keys.add(record.source_record_key);
  }
  return { batch, issues };
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  return value;
}

function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function sourceId(bookId) {
  const bytes = Buffer.from(sha256(Buffer.from(`ai-sensei:source:${bookId}`, 'utf8')).slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function writeEvidence(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, contents, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = await readFile(path, 'utf8');
    if (existing !== contents) throw new Error(`Refusing to overwrite different sanitized evidence at ${path}; bump EXTRACTOR_VERSION to preserve both.`);
  }
}

export async function sanitizeFile(file, outputRoot = resolve(ROOT, 'private-data/imports')) {
  const absolute = resolve(file);
  const raw = await readFile(absolute);
  if (raw.length > MAX_FILE_BYTES) throw new Error(`${absolute}: file exceeds ${MAX_FILE_BYTES} byte limit`);
  let parsed;
  try { parsed = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, '')); }
  catch (error) { throw new Error(`${absolute}: invalid JSON (${error.message})`); }
  const result = sanitizeBatch(parsed, basename(absolute));
  const hash = sha256(raw);
  const id = sourceId(result.batch.source.book_id);
  const safeName = basename(absolute).replace(/[^a-zA-Z0-9._-]/g, '_');
  const versionRoot = resolve(outputRoot, id, hash);
  const rawPath = resolve(versionRoot, 'raw', safeName);
  const sanitizedPath = resolve(versionRoot, EXTRACTOR_VERSION, 'sanitized', safeName);
  const reportPath = resolve(versionRoot, EXTRACTOR_VERSION, `${safeName}.report.json`);
  await mkdir(dirname(rawPath), { recursive: true });
  try { await copyFile(absolute, rawPath, 1); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const sanitized = `${JSON.stringify(stableJson(result.batch), null, 2)}\n`;
  await writeEvidence(sanitizedPath, sanitized);
  const report = {
    file: basename(absolute), source_id: id, book_id: result.batch.source.book_id,
    raw_sha256: hash, schema_version: result.batch.schema_version, content_type: result.batch.content_type,
    pages_processed: result.batch.pdf_pages_processed.length,
    counts: { entries: result.batch.entries.length, exercise_passages: result.batch.exercise_passages?.length || 0, lesson_questions: result.batch.lesson_questions?.length || 0 },
    issue_count: result.issues.length, issues: result.issues,
  };
  await writeEvidence(reportPath, `${JSON.stringify(stableJson(report), null, 2)}\n`);
  return { ...report, sanitized_path: sanitizedPath, raw_copy_path: rawPath, report_path: reportPath, staged: result.batch };
}

function loadLocalEnv() {
  const path = resolve(ROOT, '.env');
  return readFile(path, 'utf8').then((contents) => {
    for (const line of contents.split(/\r?\n/)) {
      const match = /^\s*DATABASE_URL\s*=\s*(.*?)\s*$/.exec(line);
      if (match && !process.env.DATABASE_URL) process.env.DATABASE_URL = match[1].replace(/^(?:"(.*)"|'(.*)')$/, '$1$2');
    }
  }).catch((error) => { if (error.code !== 'ENOENT') throw error; });
}

async function loadStaged(result) {
  await loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing; set it in the environment or ignored .env file.');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  const batch = result.staged;
  const id = result.source_id;
  const sourceData = {
    id, title: batch.source.book_title, edition: null, sourceType: 'book', language: 'ja',
    fileReference: batch.source.file_name, levelLabel: null, levelAuthority: null,
    notes: `Stable source identity from extraction book_id ${batch.source.book_id}; edition/level authority were not supplied.`,
  };
  try {
    const loaded = await prisma.$transaction(async (tx) => {
      await tx.source.upsert({ where: { id }, create: sourceData, update: {} });
      const prior = await tx.importBatch.findUnique({ where: { sourceId_fileHash: { sourceId: id, fileHash: result.raw_sha256 } }, select: { id: true } });
      if (prior) return { inserted: false, batchId: prior.id };
      const inserted = await tx.importBatch.create({ data: {
        sourceId: id,
        fileHash: result.raw_sha256,
        pageRangeJson: { processed: batch.pdf_pages_processed, unreadable: batch.unreadable_pdf_pages },
        extractorVersion: EXTRACTOR_VERSION,
        schemaVersion: batch.schema_version,
        status: 'draft',
        stagedJson: batch,
        validationErrorsJson: result.issues,
      }, select: { id: true } });
      return { inserted: true, batchId: inserted.id };
    });
    return loaded;
  } finally { await prisma.$disconnect(); }
}

export async function run(argv = process.argv.slice(2)) {
  const { sanitizeOnly, files } = parseArgs(argv);
  for (const file of files) {
    const result = await sanitizeFile(file);
    const loaded = sanitizeOnly ? null : await loadStaged(result);
    console.log(JSON.stringify({ file: basename(file), type: result.content_type, ...result.counts, issue_count: result.issue_count, raw_sha256: result.raw_sha256, sanitized_path: result.sanitized_path, report_path: result.report_path, ...(loaded || {}) }));
  }
}

export function parseArgs(argv) {
  let sanitizeOnly = false;
  let files = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--sanitize-only') sanitizeOnly = true;
    else if (argv[i] === '--files') {
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) files.push(argv[++i]);
    } else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!files.length) throw new Error('No input files supplied. Pass explicit paths with --files <path...>.');
  return { sanitizeOnly, files };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
