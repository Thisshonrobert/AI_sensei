import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sourceDetail } from '@/lib/server/content/catalog';
import { Citations, ContentBlock, ItemLink, Origin, Pagination } from '@/components/reference';
export default async function Source({params, searchParams}: {params: Promise<{id: string}>; searchParams: Promise<{page?: string; record?: string}>}) {
  const result = await sourceDetail((await params).id, await searchParams);if (!result) notFound();
  const {source} = result;
  return <><Link className="back" href="/sources">← Sources</Link><Origin origin={source.sourceType === 'book' ? 'book' : 'user'} dictionary={source.sourceType === 'dictionary'} /><h1>{source.title}</h1><p className="lead">{source.edition || 'Edition not supplied'}</p>
    {source.sourceType === 'book' && <p className="notice">PDF pages refer to the supplied excerpt. Printed labels are separate. Acceptance does not establish PDF transcription accuracy or a bibliographic year / ISBN. Original files remain private; no PDF preview is configured.</p>}
    <h2>Source records</h2>{result.focused && <p><Link href={`/sources/${source.id}`}>Browse all records in this source →</Link></p>}{result.entries.map(entry => <article className="source-record" id={`record-${entry.id}`} key={entry.id}>{entry.item ? <ItemLink item={entry.item} /> : entry.content ? <ContentBlock content={entry.content} /> : null}<Citations citations={[entry]} /></article>)}
    {!result.entries.length && <p className="empty">No promoted source records.</p>}{!result.focused && <Pagination path={`/sources/${source.id}`} {...result} />}
  </>;
}
