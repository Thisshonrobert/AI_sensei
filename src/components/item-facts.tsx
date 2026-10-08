import { VocabularyComponents } from './vocabulary-components';
import type { itemDetail } from '@/lib/server/content/catalog';
import { Citations, Fact, Origin, object, text } from './reference';

type DetailItem = NonNullable<Awaited<ReturnType<typeof itemDetail>>>;
function supplied(value:string) { return value.trim() && !/^(?:not supplied|not_supplied)$/i.test(value.trim()); }
export function ItemFacts({item}:{item:DetailItem}) {
  const v=item.vocabulary,k=item.kanji,g=item.grammar;
  const english=item.contentLinks.find(({content}) => content.kind==='explanation' && content.status==='approved' && object(content.payloadJson).kind==='generatedEnglishExplanation')?.content;
  return <>
    <dl className="facts">
      {v && <><Fact label="Reading" value={v.reading}/><Fact label="Selected meaning" value={v.meaningEn}/>{supplied(v.partOfSpeech) && <Fact label="Part of speech" value={v.partOfSpeech}/>}</>}
      {k && <><Fact label="Selected meanings" value={text(k.meaningsJson)}/><Fact label="On’yomi" value={text(k.onReadingsJson)}/><Fact label="Kun’yomi" value={text(k.kunReadingsJson)}/>{k.notes && <Fact label="Notes" value={k.notes}/>}</>}
      {g && <>{g.explanationJa && <Fact label="Japanese explanation" value={g.explanationJa}/>}
        {g.explanationEn ? <Fact label="English explanation" value={g.explanationEn}/> : english ? <div className="fact" data-english-explanation><dt>English explanation</dt><dd><Origin origin={english.origin}/><p data-explanation-text>{text(object(english.payloadJson).translation)}</p><details><summary>Sources &amp; evidence</summary><Citations citations={english.sourceEntries}/></details></dd></div> : <Fact label="English explanation" value=""/>}
        <Fact label="Formation" value={Array.isArray(g.formationRulesJson) ? g.formationRulesJson.map(r => text(object(r).sourceWording) || text(object(r).label)).filter(Boolean).join('\n') : ''}/>
      </>}
    </dl>
    {v && <section aria-label="Kanji in this word"><h3>Kanji in this word</h3><VocabularyComponents item={item}/></section>}
  </>;
}
