import Link from 'next/link';
import { db } from '@/lib/server/db';
import { kinds, titles } from '@/lib/server/content/catalog-input';
import { dashboard } from '@/lib/server/review/service.mjs';
import { DailyBudget } from '@/components/daily-budget';
import { Dictionary } from '@/components/dictionary';

export default async function Home() {
  const daily=await dashboard(db);
  return <><h1>A little Japanese, every day.</h1><p className="lead">Begin with recall. Keep the next step small enough to return tomorrow.</p>
    <section className="daily-start" aria-label="Today's study"><h2>{daily.sessionId?'Your saved block is ready':'Ready for today'}</h2><p>{daily.reviewCount} cards in the {daily.sessionId?'saved':'next review'} block{daily.reviewCount?` · approximately ${Math.ceil(daily.reviewCount/2)} minutes`:''}</p><div className="review-actions">{daily.reviewCount?<Link className="button-link" href="/review?start=reviews">{daily.sessionId?'Resume reviews':'Start due reviews'} · {daily.reviewCount}</Link>:<button disabled>Start due reviews · 0</button>}<Link className="button-link secondary" href="/review?start=learning">Continue learning</Link></div>
    {!daily.reviewCount&&<p className="muted">No eligible cards in this review block. Check a small new batch if capacity remains.</p>}
    <p className="muted">{daily.actionableDue} eligible due · {daily.buriedDue} separated until the next study day{daily.deferred?` · ${daily.deferred} selected cards deferred`:''}</p>{daily.introductionsPaused&&<p className="notice">New introductions are paused while due work remains.</p>}
    <p className="status">New today: {daily.used.total}/{daily.limits.total} · vocabulary {daily.used.vocabulary}/{daily.limits.vocabulary} · kanji objectives {daily.used.kanji}/{daily.limits.kanji} · grammar {daily.used.grammar}/{daily.limits.grammar}</p>{daily.contentGaps>0&&<p className="muted">{daily.contentGaps} grammar or contextual-kanji objectives await approved content.</p>}<DailyBudget minutes={daily.timeBudgetMinutes}/></section>
    <p><Link href="/weekly">Weekly cumulative test →</Link> · Uses approved questions and eligible targets; limited content produces a shorter sample.</p>
    <h2>Your imported core pool</h2>
    <div className="shelf">{kinds.map((kind, i) => <Link href={`/${kind}`} key={kind} className="shelf-section"><span lang="ja" className="shelf-japanese">{['語彙','漢字','文法'][i]}</span><h2>{titles[kind]}</h2><p>{daily.progress[kind].introduced} introduced / {daily.progress[kind].total} imported core items</p><span>Browse reference →</span></Link>)}</div>
    <p><a href="https://japanesetest4you.com/category/jlpt-n2/jlpt-n2-listening-test/" target="_blank" rel="noopener noreferrer">External N2 listening practice →</a></p>
    <details><summary>Study &amp; source notes</summary><p>Introduced items are counted once; this is not a measure of mastery. Listening practice is external and does not record completion.</p><p>These batches were accepted without PDF comparison. Dictionary and generated additions retain their origins. Uncertain readings and question answers remain unresolved.</p></details>
    <p><Link href="/sources">Explore source editions and citations →</Link></p>
    <Dictionary/>
  </>;
}
