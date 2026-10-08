import type { itemDetail } from '@/lib/server/content/catalog';
import { Fact, object, text } from './reference';
import { VocabularyComponents } from './vocabulary-components';
import { exampleMeaning } from './example-meaning';

type DetailItem = NonNullable<Awaited<ReturnType<typeof itemDetail>>>;
export function FlashcardFacts({item}:{item:DetailItem}) {
  const examples=item.contentLinks.map(({content})=>content).filter(content=>content.status==='approved' && content.kind==='sentence');
  const words=examples.filter(content=>object(content.payloadJson).sourceWord===true).slice(0,2);
  const selected=words[0] && object(words[0].payloadJson);
  return <>
    {item.vocabulary && <><p className="browse-reading" lang="ja">{item.vocabulary.reading}</p><p>{item.vocabulary.meaningEn}</p><VocabularyComponents item={item} compact/>
      {examples.slice(0,1).map(content=>{const p=object(content.payloadJson);return <div className="browse-example" key={content.id}><p lang="ja" className="japanese">{text(p.japanese)}</p>{p.translation && <p>{text(p.translation)}</p>}</div>;})}
    </>}
    {item.kanji && <><p>{text(item.kanji.meaningsJson)}</p><dl className="facts">
      {selected && text(selected.reading) && <Fact label={`Reading in ${text(selected.japanese)}`} value={text(selected.reading)}/>}
      <Fact label="On’yomi" value={text(item.kanji.onReadingsJson)}/><Fact label="Kun’yomi" value={text(item.kanji.kunReadingsJson)}/>
    </dl>{words.map(content=>{const p=object(content.payloadJson),supplement=exampleMeaning(content,item.contentLinks.map(link=>link.content));const meaning=text(p.translation)||text(p.meanings)||text(supplement && object(supplement.payloadJson).selectedMeanings);return <div className="browse-example" key={content.id}><p className="japanese" lang="ja">{text(p.japanese)}{text(p.reading) && `（${text(p.reading)}）`}</p>{meaning && <p>{meaning}</p>}</div>;})}</>}
  </>;
}
