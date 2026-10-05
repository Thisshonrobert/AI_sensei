import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, sanitizeBatch, sanitizeFile } from '../scripts/import-batches.mjs';

test('parses options after explicit files without turning sanitation into a database load', () => {
  assert.deepEqual(parseArgs(['--files', 'one.json', '--sanitize-only']), { files: ['one.json'], sanitizeOnly: true });
  assert.throws(() => parseArgs(['--files', 'one.json', '--unrecognized']), /Unknown argument/);
});

function grammarBatch() {
  return {
    schema_version: 2,
    content_type: 'grammar',
    source: { book_id: 'book-a', book_title: 'Book A', file_name: 'source.pdf' },
    batch: { batch_id: 'lesson-1', lesson_key: 'lesson_01', lesson_number: 1, lesson_title: 'Lesson', expected_grammar_count: 1, expected_question_count: 1 },
    pdf_pages_processed: [1], unreadable_pdf_pages: [],
    entries: [{ source_record_key: 'lesson_01/grammar/1', pattern: '〜もの', meanings: ['meaning'], formation: [], explanation: null, usage_notes: null, jlpt_level: null, chapter: null, source_pdf_pages: [1], source_printed_pages: [], examples: [], review_status: 'unreviewed', issues: [] }],
    exercise_passages: [],
    lesson_questions: [{ source_record_key: 'lesson_01/question/1', question_number: '1', exercise_section: 'Section', origin: 'book', instructions: 'Choose.', prompt: 'Prompt', format: 'multiple_choice', options: [{ label: '1', text: 'A' }], parent_passage_key: null, target_grammar_keys: [], answer_specification: null, source_pdf_pages: [1], source_printed_pages: [], review_status: 'unreviewed', issues: [] }],
  };
}

test('keeps all schema v2 grammar records and warns when answer keys are unreviewed', () => {
  const input = grammarBatch();
  const result = sanitizeBatch(input, 'grammar.json');
  assert.equal(result.batch.entries.length, 1);
  assert.equal(result.batch.lesson_questions.length, 1);
  assert.equal(result.batch.lesson_questions[0].answer_specification, null);
  assert.equal(result.issues.filter((issue) => issue.code === 'unlinked-question').length, 1);
  assert.equal(result.issues.filter((issue) => issue.code === 'answer-key-unreviewed').length, 0);
});

test('fails malformed structure instead of dropping a record', () => {
  const input = { schema_version: 1, content_type: 'vocabulary', source: { book_id: 'book-a', book_title: 'Book A', file_name: 'source.pdf' }, pdf_pages_processed: [1], unreadable_pdf_pages: [], entries: [{ word: '語', reading: null, meanings: [], parts_of_speech: null, jlpt_level: null, chapter: null, source_pdf_pages: [1], source_printed_pages: [], examples: [], notes: null, review_status: 'unreviewed', issues: [] }] };
  input.entries.push({ word: 'lost', reading: 12 });
  assert.throws(() => sanitizeBatch(input, 'bad.json'), /entries/);
});

test('flags source page references outside processed pages while preserving records', () => {
  const input = { schema_version: 1, content_type: 'kanji', source: { book_id: 'book-a', book_title: 'Book A', file_name: 'source.pdf' }, pdf_pages_processed: [1], unreadable_pdf_pages: [], entries: [{ character: '漢', meanings: ['Chinese character'], on_readings: [], kun_readings: [], stroke_count: null, radical: null, jlpt_level: null, chapter: null, source_pdf_pages: [2], source_printed_pages: [], example_words: [], notes: null, review_status: 'unreviewed', issues: [] }] };
  const result = sanitizeBatch(input, 'kanji.json');
  assert.equal(result.batch.entries.length, 1);
  assert.match(result.issues[0].message, /not listed in pdf_pages_processed/);
});

test('rejects malformed answer specification without treating it as absent', () => {
  const input = grammarBatch();
  input.lesson_questions[0].answer_specification = { source_answer_text: 1 };
  assert.throws(() => sanitizeBatch(input), /answer_specification/);
});

test('retains changed same-name source files as separate private raw versions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-sensei-import-'));
  try {
    const inputDir = join(root, 'input');
    const outputDir = join(root, 'private');
    await mkdir(inputDir);
    const file = join(inputDir, 'same.json');
    await writeFile(file, `\uFEFF${JSON.stringify(grammarBatch())}`, 'utf8');
    const first = await sanitizeFile(file, outputDir);
    const changed = grammarBatch();
    changed.entries[0].meanings[0] = 'changed';
    await writeFile(file, JSON.stringify(changed), 'utf8');
    const second = await sanitizeFile(file, outputDir);
    assert.notEqual(first.raw_sha256, second.raw_sha256);
    assert.notEqual(first.raw_copy_path, second.raw_copy_path);
    assert.match((await readFile(first.raw_copy_path, 'utf8')).charCodeAt(0).toString(), /^65279$/);
    assert.equal(JSON.parse(await readFile(second.sanitized_path, 'utf8')).entries[0].meanings[0], 'changed');
  } finally { await rm(root, { recursive: true, force: true }); }
});
