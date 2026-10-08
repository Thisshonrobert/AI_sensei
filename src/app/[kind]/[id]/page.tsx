import Link from 'next/link';
import { notFound } from 'next/navigation';
import { itemDetail, itemNeighbors } from '@/lib/server/content/catalog';
import { parseKind, titles } from '@/lib/server/content/catalog-input';
import { Citations, ContentBlock, name, object } from '@/components/reference';
import { ItemFacts } from '@/components/item-facts';
import { grammarComparisons } from '@/lib/server/content/study.mjs';
import { db } from '@/lib/server/db';
import { Comparisons } from '@/components/study-content';
import { Dictionary } from '@/components/dictionary';
import { referencePresentation } from '@/lib/server/content/reference-presentation.mjs';
import { EntryNavigation } from '@/components/entry-navigation';

export default async function Detail({params}: {params: Promise<{kind: string; id: string}>}) {
  const {kind: value, id} = await params;const kind = parseKind(value);if (!kind) notFound();
  const item = await itemDetail(kind, id);if (!item) notFound();
  const neighbors=await itemNeighbors(kind,id,item.createdAt);
  const comparisons=kind==='grammar'?await grammarComparisons(db,id):[];
  const english = item.contentLinks.find(({content}) => content.kind === 'explanation' && content.status === 'approved' && object(content.payloadJson).kind === 'generatedEnglishExplanation')?.content;
  const otherReferences = item.contentLinks.filter(({content}) => content.id !== english?.id);
  const questions=otherReferences.filter(({content}) => content.kind==='question');
  const references=referencePresentation(otherReferences.filter(({content}) => content.kind!=='question').map(link=>link.content));
  return <><Link className="back" href={`/${kind}`}>← {titles[kind]}</Link><EntryNavigation kind={kind} {...neighbors}><h1 lang="ja" className="japanese item-title">{name(item)}</h1></EntryNavigation>
    <ItemFacts item={item}/>
    <details className="source-disclosure"><summary>Sources &amp; evidence</summary><p className="status">Content revision {item.revision}</p><Citations citations={item.sourceEntries}/></details>
    <Comparisons comparisons={comparisons}/>
    <section><h2>Examples &amp; study notes</h2>{references.length ? references.map(({content,reading,supplement}) => <ContentBlock key={content.id} content={content} targetMeanings={item.kanji?.meaningsJson} meaningSupplement={supplement} displayReading={reading} showEvidence={false}/>) : <p className="empty">No examples supplied.</p>}{item.contentLinks.length===120 && <p className="notice">Showing the first 120 linked references. Browse sources for more.</p>}</section>
    {questions.length>0 && <details><summary>Reference questions · {questions.length}</summary>{questions.map(({content}) => <ContentBlock key={content.id} content={content}/>)}</details>}
    <Dictionary itemId={id}/>
  </>;
}
