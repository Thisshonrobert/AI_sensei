import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import type { CatalogContent, CatalogItem, Citation } from '@/lib/server/content/catalog';

export function object(value: Prisma.JsonValue): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export function text(value: Prisma.JsonValue | undefined) {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string').join(' · ');
  return typeof value === 'string' ? value : '';
}
export function name(item: CatalogItem) { return item.vocabulary?.writtenForm || item.kanji?.glyph || item.grammar?.pattern || 'Missing title'; }
export function summary(item: CatalogItem) { return item.vocabulary?.meaningEn || text(item.kanji?.meaningsJson) || item.grammar?.explanationJa || 'Not supplied'; }
export function ItemLink({item}: {item: CatalogItem}) {
  return <Link data-item-link href={`/${item.kind}/${item.id}`} className="entry-link"><span lang="ja" className="japanese">{name(item)}</span><span>{item.vocabulary?.reading && <span lang="ja" className="reading">{item.vocabulary.reading} · </span>}{summary(item)}</span></Link>;
}
export function Origin({origin, dictionary = false}: {origin: string; dictionary?: boolean}) {
  return <span className={`badge ${origin === 'generated' ? 'generated' : ''}`}>{dictionary ? 'Dictionary · curated' : origin === 'book' ? 'Book' : origin === 'generated' ? 'Generated' : 'User'}</span>;
}
export function Citations({citations}: {citations: Citation[]}) {
  return <ul className="citations">{citations.map(c => <li key={c.id}>
    <Origin origin={c.source.sourceType === 'book' ? 'book' : 'user'} dictionary={c.source.sourceType === 'dictionary'} />{' '}
    <Link data-source-link href={`/sources/${c.source.id}?record=${c.id}#record-${c.id}`}>{c.source.title}</Link>
    <span className="locator">{c.printedPage ? ` · printed p. ${c.printedPage}` : ' · printed page not confirmed'}{c.pdfPageIndex !== null ? ` · excerpt PDF p. ${c.pdfPageIndex + 1}` : ' · PDF page not confirmed'}</span>
    {object(c.fieldPresenceJson).reviewBasis === 'user_accepted_without_pdf_comparison' && <p className="acceptance">Accepted without PDF comparison</p>}
    {c.successor && <p className="muted">Historical source evidence · revision {c.revision}</p>}
  </li>)}</ul>;
}
export function ContentBlock({content}: {content: CatalogContent}) {
  const p = object(content.payloadJson);
  const dictionary = content.origin === 'user' && content.sourceEntries.some(c => c.source.sourceType === 'dictionary');
  const uncertainty = text(p.uncertainty);
  const questionReview = object(p.questionReview ?? null);
  const deferred = content.kind === 'question' && questionReview.grammarConnections === 'intentionally_deferred';
  return <article className={`content-block ${content.status === 'draft' ? 'draft' : ''}`}>
    <div className="flex flex-wrap gap-2 items-center"><Origin origin={content.origin} dictionary={dictionary} />{p.addedBy === 'AI' && <span className="badge generated" data-ai-addition>Added by AI</span>}<span className="status">{content.successor ? `Historical revision ${content.revision} · superseded` : deferred ? 'Reference only · connections deferred' : content.status === 'draft' ? 'Unresolved draft · reference only' : 'Approved reference'}</span></div>
    {deferred ? <p className="notice" data-question-deferral>{questionReview.sourceAnswerTextVerified === true ? 'Answer text checked by you. ' : 'Source answer text not yet checked. '}Grammar connections intentionally deferred. Reference only; excluded from scored and scheduled use.</p> : content.kind === 'question' && (p.answerVerified !== true || p.targetsVerified !== true) && <p className="notice">Answer key and grammar targets are unresolved. This question is excluded from scored use.</p>}
    {(p.japanese || p.originalJapanese || p.prompt) && <p className="japanese sentence" lang="ja">{text(p.japanese || p.originalJapanese || p.prompt)}</p>}
    {p.fieldPath && <p className="field-label">Supplement to {text(p.fieldPath)}</p>}
    {content.kind === 'sentence' && <p className="field-label">Reading: <span lang="ja">{text(p.reading) || 'Not supplied'}</span></p>}
    {content.kind !== 'sentence' && p.reading && <p lang="ja" className="reading">{text(p.reading)}</p>}
    {p.translation && <p>{text(p.translation)}</p>}
    {p.kind === 'dictionaryKanjiReference' && <div data-wanikani-reference>
      <p className="field-label">Radical combination</p>
      <p>{Array.isArray(p.radicalCombinations) && p.radicalCombinations.map((radical, i) => {
        const r = object(radical);
        return <span key={i}>{i > 0 && ' + '}<span lang="ja">{text(r.glyph)}</span> {text(r.name)}</span>;
      })}</p>
      <p className="muted">WaniKani learning labels; not historical etymology.</p>
      <p className="field-label">Meaning mnemonic · excerpt</p>
      <p>{text(p.meaningMnemonicExcerpt)}…</p>
      {text(p.meaningMnemonicUrl).startsWith('https://www.wanikani.com/kanji/') && <a href={text(p.meaningMnemonicUrl)} target="_blank" rel="noopener noreferrer">Full mnemonic on WaniKani</a>}
      <p className="field-label">Word combinations</p>
      <ul>{Array.isArray(p.combinations) && p.combinations.map((word, i) => {
        const w = object(word);
        return <li key={i}><span lang="ja">{text(w.term)}（{text(w.reading)}）</span> · {text(w.meaning)}</li>;
      })}</ul>
    </div>}
    {content.kind === 'sentence' && !p.translation && !text(p.meanings) && <p className="muted">Translation / meaning not supplied by book.</p>}
    {(p.meanings || p.selectedMeanings) && <p>{text(p.meanings || p.selectedMeanings)}</p>}
    {Array.isArray(p.options) && <ol>{p.options.map((option, i) => <li key={i} lang="ja">{text(object(option).label)}. {text(object(option).text)}</li>)}</ol>}
    {deferred && <div><p className="field-label">{questionReview.sourceAnswerTextVerified === true ? 'Source answer text · checked by you' : 'Source answer text'}</p><p lang="ja" data-source-answer-text>{text(object(p.answer_specification ?? null).source_answer_text)}</p></div>}
    {text(p.acceptedLimitations) && <p className="notice" data-ai-limitations>AI addition accepted by you. Source meaning or reading not independently verified: {text(p.acceptedLimitations)}</p>}
    {uncertainty && <p className="notice">Unresolved: {uncertainty}</p>}
    <details><summary>Source citations</summary><Citations citations={content.sourceEntries} /></details>
  </article>;
}
export function Pagination({path, page, count, query = ''}: {path: string; page: number; count: number; query?: string}) {
  const url = (p: number) => `${path}?${new URLSearchParams({ page: String(p), ...(query ? { query } : {}) })}`;
  return <nav className="pagination" aria-label="Pagination">{page > 1 && <Link href={url(page - 1)}>← Previous</Link>}<span>Page {page} · {count} records</span>{page * 50 < count && <Link href={url(page + 1)}>Next →</Link>}</nav>;
}
export function Fact({label, value, origins, citations}: {label: string; value: string; origins?: string[]; citations?: Citation[]}) {
  const evidence = citations?.filter(c => origins?.includes(c.id)) || [];
  return <div className="fact"><dt>{label}</dt><dd>{value || <span className="muted">Not supplied</span>}{evidence.length > 0 && <Citations citations={evidence} />}</dd></div>;
}
