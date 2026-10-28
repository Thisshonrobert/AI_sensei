import { notFound } from 'next/navigation';
import Link from 'next/link';
import { listItems, listKanjiMeanings } from '@/lib/server/content/catalog';
import { parseKind, titles } from '@/lib/server/content/catalog-input';
import { ItemLink, Pagination } from '@/components/reference';

export default async function Catalog({params, searchParams}: {params: Promise<{kind: string}>; searchParams: Promise<{page?: string; query?: string}>}) {
  const kind = parseKind((await params).kind);if (!kind) notFound();
  const result = await listItems(kind, await searchParams);
  const kanjiMeanings = kind !== 'grammar' ? await listKanjiMeanings(result.items) : null;
  return <><h1>{titles[kind]}</h1><div className="catalog-actions"><p className="muted">{result.count} entries{result.contextCount>0 && <> · {result.count-result.contextCount} textbook vocabulary + {result.contextCount} kanji context words</>}</p>{kind!=='grammar' ? <Link className="button-link" href={`/${kind}/flashcards${result.query?`?${new URLSearchParams({query:result.query})}`:''}`}>Browse flashcards</Link> : <Link className="button-link" href="/grammar/exercises">Lesson exercises · ungraded</Link>}</div>
    <form className="search" method="get"><label htmlFor="query">Find an entry</label><div className="flex gap-2"><input id="query" name="query" maxLength={100} defaultValue={result.query} placeholder={kind === 'vocabulary' ? 'Japanese, reading or meaning' : 'Japanese pattern or character'} /><button>Search</button></div></form>
    {result.items.length ? <ul className="entry-list">{result.items.map(item => <li key={item.id}><ItemLink item={item} meaning={kanjiMeanings?.get(item.id)} /></li>)}</ul> : <p className="empty">No matching entries.</p>}
    <Pagination path={`/${kind}`} {...result} />
  </>;
}
