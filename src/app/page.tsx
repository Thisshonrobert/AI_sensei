import Link from 'next/link';
import { db } from '@/lib/server/db';
import { kinds, titles } from '@/lib/server/content/catalog-input';

export default async function Home() {
  const counts = await Promise.all(kinds.map(kind => db.item.count({ where: { kind, status: 'approved' } })));
  return <><div className="eyebrow">日本語の森 / JLPT N2</div><h1>Your Japanese reference shelf</h1>
    <p className="lead">Words, characters and patterns, with their sources close at hand.</p>
    <div className="shelf">{kinds.map((kind, i) => <Link href={`/${kind}`} key={kind} className="shelf-section"><span className="shelf-number">0{i + 1}</span><span lang="ja" className="shelf-japanese">{['語彙','漢字','文法'][i]}</span><h2>{titles[kind]}</h2><p>{counts[i]} canonical entries</p><span>Browse reference →</span></Link>)}</div>
    <aside className="notice"><strong>Evidence stays visible.</strong> These extraction batches were accepted without PDF comparison. Dictionary additions and generated assistance retain their own labels. Uncertain readings and question answers remain unresolved drafts.</aside>
    <p><Link href="/sources">Explore source editions and citations →</Link></p>
  </>;
}
