import Link from 'next/link';
import { notFound } from 'next/navigation';
import { itemDetail, listItems } from '@/lib/server/content/catalog';
import { parseKind, titles } from '@/lib/server/content/catalog-input';
import { name } from '@/components/reference';
import { FlashcardFacts } from '@/components/flashcard-facts';
import { BrowseFlashcard } from '@/components/browse-flashcard';
import { Dictionary } from '@/components/dictionary';

export default async function Flashcards({params,searchParams}:{params:Promise<{kind:string}>;searchParams:Promise<{query?:string;card?:string}>}) {
  const kind=parseKind((await params).kind); if(!kind || kind==='grammar') notFound();
  const input=await searchParams;
  const requested=Number(input.card || 1);
  const position=Number.isSafeInteger(requested) && requested>=1 && requested<=500000 ? requested : 1;
  const result=await listItems(kind,{query:input.query,page:String(Math.ceil(position/50))});
  const selected=result.items[(position-1)%50];
  const item=selected ? await itemDetail(kind,selected.id) : null;
  return <><Link className="back" href={`/${kind}${result.query?`?${new URLSearchParams({query:result.query})}`:''}`}>← {titles[kind]}</Link><h1>{titles[kind]} flashcards</h1>
    {item ? <BrowseFlashcard front={name(item)} kind={kind} itemId={item.id} position={position} count={result.count} query={result.query} back={<>
      <FlashcardFacts item={item}/>
    </>}/> : <p className="empty">No cards at this position. <Link href={`/${kind}/flashcards`}>Return to the first card</Link>.</p>}
    <Dictionary itemId={item?.id}/>
  </>;
}
