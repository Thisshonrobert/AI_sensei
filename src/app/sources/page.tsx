import Link from 'next/link';
import { sourceList } from '@/lib/server/content/catalog';
import { Origin, Pagination } from '@/components/reference';
export default async function Sources({searchParams}: {searchParams: Promise<{page?: string}>}) {
  const result = await sourceList(await searchParams);
  return <><div className="eyebrow">PROVENANCE / LOCAL LIBRARY</div><h1>Sources</h1><p className="lead">Follow a reference back to its book or dictionary evidence.</p>
    <ul className="source-list">{result.sources.map(source => <li key={source.id}><Origin origin={source.sourceType === 'book' ? 'book' : 'user'} dictionary={source.sourceType === 'dictionary'} /><h2><Link href={`/sources/${source.id}`}>{source.title}</Link></h2><p>{source.edition || 'Edition not supplied'} · {source._count.entries} citations</p></li>)}</ul>
    {!result.sources.length && <p className="empty">No sources registered.</p>}<Pagination path="/sources" {...result} />
  </>;
}
