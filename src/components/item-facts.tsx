import { VocabularyComponents } from './vocabulary-components';
import type { itemDetail } from '@/lib/server/content/catalog';
import { resolveKanjiMeanings } from '@/lib/server/content/kanji-meanings.mjs';
import { Citations, Fact, Origin, object, text } from './reference';

type DetailItem = NonNullable<Awaited<ReturnType<typeof itemDetail>>>;
function supplied(value:string) { return value.trim() && !/^(?:not supplied|not_supplied)$/i.test(value.trim()); }
function KanjiMeanings({item}:{item:DetailItem}) {
  const resolved=resolveKanjiMeanings(item.contentLinks.map(({content})=>content),item.kanji?.meaningsJson);
  const supplement=resolved.supplement,p=object(supplement?.payloadJson ?? null);
  const dictionary=supplement?.sourceEntries.some(entry=>entry.source.sourceType==='dictionary') ?? false;
  const original=resolved.original.join(' · ');
  return <div className="fact" data-kanji-meanings data-meaning-source={resolved.source}><dt>Selected meanings</dt><dd>{resolved.text || <span className="muted">Not supplied</span>}
    {supplement && <>{' '}{dictionary ? <span className="badge" data-dictionary-gloss>Dictionary</span> : <Origin origin={supplement.origin}/>}{p.addedBy === 'AI' && <span className="badge generated" data-ai-addition>Added by AI</span>}
      {original && original !== resolved.text && <details data-book-wording><summary>Original book wording</summary><p lang="ja">{original}</p></details>}
      {p.addedBy === 'AI' && text(p.acceptedLimitations) && <p className="notice" data-ai-limitations>AI addition accepted by you. Source meaning not independently verified: {text(p.acceptedLimitations)}</p>}
      {p.addedBy !== 'AI' && text(p.acceptedLimitations) && <p className="notice" data-dictionary-limitations>{text(p.acceptedLimitations)}</p>}
      {supplement.sourceEntries.length > 0 && <details><summary>Meaning evidence</summary><Citations citations={supplement.sourceEntries}/></details>}</>}
  </dd></div>;
}
export function ItemFacts({item}:{item:DetailItem}) {
  const v=item.vocabulary,k=item.kanji,g=item.grammar;
  const english=item.contentLinks.find(({content}) => content.kind==='explanation' && content.status==='approved' && object(content.payloadJson).kind==='generatedEnglishExplanation')?.content;
  return <>
    <dl className="facts">
      {v && <><Fact label="Reading" value={v.reading}/><Fact label="Selected meaning" value={resolveKanjiMeanings(item.contentLinks.map(({content})=>content),v.meaningEn).text}/>{supplied(v.partOfSpeech) && <Fact label="Part of speech" value={v.partOfSpeech}/>}</>}
      {k && <><KanjiMeanings item={item}/><Fact label="On’yomi" value={text(k.onReadingsJson)}/><Fact label="Kun’yomi" value={text(k.kunReadingsJson)}/></>}
      {g && <>{g.explanationJa && <Fact label="Japanese explanation" value={g.explanationJa}/>}
        {g.explanationEn ? <Fact label="English explanation" value={g.explanationEn}/> : english ? <div className="fact" data-english-explanation><dt>English explanation</dt><dd><Origin origin={english.origin}/><p data-explanation-text>{text(object(english.payloadJson).translation)}</p></dd></div> : <Fact label="English explanation" value=""/>}
        <Fact label="Formation" value={Array.isArray(g.formationRulesJson) ? g.formationRulesJson.map(r => text(object(r).sourceWording) || text(object(r).label)).filter(Boolean).join('\n') : ''}/>
      </>}
    </dl>
    {v && <section aria-label="Kanji in this word"><h3>Kanji in this word</h3><VocabularyComponents item={item}/></section>}
  </>;
}
