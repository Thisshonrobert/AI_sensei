import { notFound } from 'next/navigation';
import Link from 'next/link';
import { listItems, listKanjiMeanings, studiedIds } from '@/lib/server/content/catalog';
import { LOCAL_USER_ID } from '@/lib/server/review/service.mjs';
import { parseKind, titles } from '@/lib/server/content/catalog-input';
import { ItemLink, Pagination } from '@/components/reference';

export default async function Catalog({params, searchParams}: {params: Promise<{kind: string}>; searchParams: Promise<{page?: string; query?: string}>}) {
  const kind = parseKind((await params).kind);if (!kind) notFound();
  const result = await listItems(kind, await searchParams);
  const kanjiMeanings = kind !== 'grammar' ? await listKanjiMeanings(result.items) : null;
  const studied = await studiedIds(LOCAL_USER_ID, result.items.map(item => item.id));
  const firstCard=(result.page-1)*50+1;
  const flashcardParams=new URLSearchParams({card:String(firstCard),...(result.query?{query:result.query}:{})});
  return <><h1>{titles[kind]}</h1><div className="catalog-actions"><p className="muted">{result.count} entries{result.contextCount>0 && <> · {result.count-result.contextCount} textbook vocabulary + {result.contextCount} kanji context words</>}</p>{kind!=='grammar' ? <Link className="button-link" href={`/${kind}/flashcards?${flashcardParams}`}>Browse flashcards</Link> : <Link className="button-link" href="/grammar/exercises">Lesson exercises · ungraded</Link>}</div>
    <form className="search" method="get"><label htmlFor="query">Find an entry</label><div className="flex gap-2"><input id="query" name="query" maxLength={100} defaultValue={result.query} placeholder={kind === 'vocabulary' ? 'Japanese, reading or meaning' : 'Japanese pattern or character'} /><button>Search</button></div></form>
    {result.items.length ? <ol className="entry-list" start={firstCard}>{result.items.map(item => <li key={item.id} id={`item-${item.id}`}><ItemLink item={item} meaning={kanjiMeanings?.get(item.id)} studied={studied.has(item.id)} /></li>)}</ol> : <p className="empty">No matching entries.</p>}
    <Pagination path={`/${kind}`} {...result} />
  </>;
}
