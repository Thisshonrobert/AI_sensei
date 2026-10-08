import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import type { CatalogContent, CatalogItem, Citation } from '@/lib/server/content/catalog';
import { KanjiMnemonic } from './kanji-mnemonic';

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
    <details className="inline-evidence"><summary>{c.source.title}{c.printedPage && ` · p. ${c.printedPage}`}</summary>
    <Origin origin={c.source.sourceType === 'book' ? 'book' : 'user'} dictionary={c.source.sourceType === 'dictionary'} />
    <p className="locator">{c.printedPage ? `Printed p. ${c.printedPage}` : 'Printed page not confirmed'}{c.pdfPageIndex !== null ? ` · excerpt PDF p. ${c.pdfPageIndex + 1}` : ' · PDF page not confirmed'}</p>
    {object(c.fieldPresenceJson).reviewBasis === 'user_accepted_without_pdf_comparison' && <p className="acceptance">Accepted without PDF comparison</p>}
    {c.successor && <p className="muted">Historical source evidence · revision {c.revision}</p>}
    <EvidenceRecord citation={c}/>
    <Link data-source-link href={`/sources/${c.source.id}?record=${c.id}#record-${c.id}`}>Open source page</Link>
    </details>
  </li>)}</ul>;
}
function EvidenceRecord({citation:c}:{citation:Citation}) {
  const item=c.item, p=object(c.content?.payloadJson ?? null);
  return <div className="evidence-record" data-evidence-record>
    {item && <><p className="field-label">Linked entry{c.successor ? ' · current reference' : ''}</p><p lang="ja" className="japanese sentence">{item.vocabulary?.writtenForm || item.kanji?.glyph || item.grammar?.pattern}</p>
      {item.vocabulary && <><p lang="ja">{item.vocabulary.reading}</p><p>{item.vocabulary.meaningEn}</p></>}
      {item.kanji && <><p>{text(item.kanji.meaningsJson)}</p><p lang="ja">{text(item.kanji.onReadingsJson)} · {text(item.kanji.kunReadingsJson)}</p></>}
      {item.grammar && <><p lang="ja">{item.grammar.explanationJa}</p><p>{item.grammar.explanationEn}</p></>}
    </>}
    {c.content && <><p className="field-label">Stored {c.content.kind} · {c.content.status}</p>
      {(p.japanese || p.originalJapanese || p.prompt) && <p className="japanese" lang="ja">{text(p.japanese || p.originalJapanese || p.prompt)}</p>}
      {p.reading && <p lang="ja">{text(p.reading)}</p>}{p.translation && <p>{text(p.translation)}</p>}{(p.meanings || p.selectedMeanings) && <p>{text(p.meanings || p.selectedMeanings)}</p>}
      {p.kind === 'dictionaryKanjiReference' && <KanjiMnemonic payload={p}/>}
    </>}
  </div>;
}
export function ContentBlock({content,targetMeanings,meaningSupplement,displayReading,showEvidence=true}: {content: CatalogContent;targetMeanings?:Prisma.JsonValue;meaningSupplement?:CatalogContent|null;displayReading?:string;showEvidence?:boolean}) {
  const p = object(content.payloadJson);
  const dictionary = content.origin === 'user' && content.sourceEntries.some(c => c.source.sourceType === 'dictionary');
  const uncertainty = text(p.uncertainty);
  const questionReview = object(p.questionReview ?? null);
  const deferred = content.kind === 'question' && questionReview.grammarConnections === 'intentionally_deferred';
  return <article data-content-id={content.id} className={`content-block ${content.status === 'draft' ? 'draft' : ''}`}>
    <div className="flex flex-wrap gap-2 items-center">{content.origin === 'generated' && <Origin origin={content.origin}/>} {p.addedBy === 'AI' && <span className="badge generated" data-ai-addition>Added by AI</span>}{(content.successor || deferred || content.status === 'draft') && <span className="status">{content.successor ? `Historical revision ${content.revision} · superseded` : deferred ? 'Reference only · connections deferred' : 'Unresolved draft · reference only'}</span>}</div>
    {deferred ? <p className="notice" data-question-deferral>{questionReview.sourceAnswerTextVerified === true ? 'Answer text checked by you. ' : 'Source answer text not yet checked. '}Grammar connections intentionally deferred. Reference only; excluded from scored and scheduled use.</p> : content.kind === 'question' && (p.answerVerified !== true || p.targetsVerified !== true) && <p className="notice">Answer key and grammar targets are unresolved. This question is excluded from scored use.</p>}
    {(p.japanese || p.originalJapanese || p.prompt) && <p className="japanese sentence" lang="ja">{text(p.japanese || p.originalJapanese || p.prompt)}</p>}
    {p.fieldPath && content.status === 'draft' && <p className="field-label">Supplement to {text(p.fieldPath)}</p>}
    {(displayReading || text(p.reading)) && <p lang="ja" className="reading">{displayReading || text(p.reading)}</p>}
    {p.translation && <p>{text(p.translation)}</p>}
    {['dictionaryKanjiReference','generatedKanjiMnemonic'].includes(text(p.kind)) && <KanjiMnemonic payload={p} targetMeanings={targetMeanings}/>}
    {showEvidence && p.kind === 'vocabularyComponentAid' && <p>Supplementary component readings and meanings, checked against dictionary references. These are study aids; the textbook fields remain separate.</p>}
    {meaningSupplement && <div data-example-meaning><Origin origin={meaningSupplement.origin} dictionary={meaningSupplement.sourceEntries.some(c=>c.source.sourceType==='dictionary')}/>{object(meaningSupplement.payloadJson).addedBy === 'AI' && <span className="badge generated" data-ai-addition>Added by AI</span>}{!p.translation && !text(p.meanings) && <p>{text(object(meaningSupplement.payloadJson).selectedMeanings)}</p>}{showEvidence && text(object(meaningSupplement.payloadJson).acceptedLimitations) && <p className="notice" data-ai-limitations>AI addition accepted by you. Source meaning or reading not independently verified: {text(object(meaningSupplement.payloadJson).acceptedLimitations)}</p>}{showEvidence && <details><summary>Meaning evidence</summary><Citations citations={meaningSupplement.sourceEntries}/></details>}</div>}
    {content.kind === 'sentence' && !p.translation && !text(p.meanings) && !meaningSupplement && <p className="muted">Translation / meaning not supplied by book.</p>}
    {(p.meanings || p.selectedMeanings) && <p>{text(p.meanings || p.selectedMeanings)}</p>}
    {Array.isArray(p.options) && <ol>{p.options.map((option, i) => <li key={i} lang="ja">{text(object(option).label)}. {text(object(option).text)}</li>)}</ol>}
    {deferred && <div><p className="field-label">{questionReview.sourceAnswerTextVerified === true ? 'Source answer text · checked by you' : 'Source answer text'}</p><p lang="ja" data-source-answer-text>{text(object(p.answer_specification ?? null).source_answer_text)}</p></div>}
    {showEvidence && text(p.acceptedLimitations) && <p className="notice" data-ai-limitations>AI addition accepted by you. Source meaning or reading not independently verified: {text(p.acceptedLimitations)}</p>}
    {uncertainty && <p className="notice">Unresolved: {uncertainty}</p>}
    {showEvidence && <details><summary>Sources &amp; evidence</summary><Origin origin={content.origin} dictionary={dictionary}/>{p.kind === 'vocabularyComponentAid' && <p className="muted">Dictionary extracts adapted from JMdict and KANJIDIC2, © EDRDG and Jim Breen, <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>. Contextual reading review and gloss selection by AI.</p>}<Citations citations={content.sourceEntries} /></details>}
  </article>;
}
export function Pagination({path, page, count, query = ''}: {path: string; page: number; count: number; query?: string}) {
  const url = (p: number) => `${path}?${new URLSearchParams({ page: String(p), ...(query ? { query } : {}) })}`;
  return <nav className="pagination" aria-label="Pagination">{page > 1 && <Link href={url(page - 1)}>← Previous</Link>}<span>Page {page} · {count} records</span>{page * 50 < count && <Link href={url(page + 1)}>Next →</Link>}</nav>;
}
export function Fact({label, value, origins, citations}: {label: string; value: string; origins?: string[]; citations?: Citation[]}) {
  const evidence = citations?.filter(c => origins?.includes(c.id)) || [];
  return <div className="fact"><dt>{label}</dt><dd>{value || <span className="muted">Not supplied</span>}{evidence.length > 0 && <details><summary>Field evidence</summary><Citations citations={evidence}/></details>}</dd></div>;
}
