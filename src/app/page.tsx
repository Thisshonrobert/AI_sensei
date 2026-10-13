import Link from 'next/link';
import { db } from '@/lib/server/db';
import { kinds, titles } from '@/lib/server/content/catalog-input';
import { dashboard } from '@/lib/server/review/service.mjs';
import { DailyBudget } from '@/components/daily-budget';
import { Dictionary } from '@/components/dictionary';
import { ActivationControls } from '@/components/activation-controls';
import { DashboardActivity } from '@/components/dashboard-activity';
import Image from 'next/image';

export default async function Home() {
  const daily=await dashboard(db);
  return <div className="study-dashboard"><p className="eyebrow">Your study dashboard</p><h1>A little Japanese, every day.</h1><p className="lead">Every word, every page, every return. Your progress starts here.</p>
    <div className="dashboard-start"><section className="daily-start dashboard-card dashboard-review" aria-label="Today's study"><Image src="/illustrations/study-companion.svg" width={340} height={250} alt="" className="study-companion" priority/><div><p className="eyebrow">Today’s recall</p><h2>{daily.sessionId?'Your saved block is ready':'Ready for today'}</h2><p className="stat-number">{daily.reviewCount}<span>cards in the {daily.sessionId?'saved':'next review'} block</span></p>{daily.reviewCount>0&&<p className="muted">Approximately {Math.ceil(daily.reviewCount/2)} minutes</p>}<div className="review-actions">{daily.reviewCount?<Link className="button-link" href="/review?start=reviews">{daily.sessionId?'Resume reviews':'Start due reviews'} →</Link>:<p className="review-clear">✓ All clear for this block</p>}</div>
    {!daily.reviewCount&&<p className="muted">No eligible cards in this review block. Check a small new batch if capacity remains.</p>}
    <p className="muted">{daily.actionableDue} eligible due · {daily.buriedDue} separated until the next study day{daily.deferred?` · ${daily.deferred} selected cards deferred`:''}</p></div></section>
    <section className="dashboard-card dashboard-learning"><span className="learning-symbol" aria-hidden="true">学</span><h2>Continue learning</h2><p>{daily.studiedToday} items studied today</p><p className="muted">{Math.max(0,daily.limits.total-daily.used.total)} new review activations remaining</p><Link className="button-link secondary" href="/review?start=learning">Continue learning →</Link>{daily.introductionsPaused&&<p className="notice">New review activations are paused while due work remains. You can still mark items as studied.</p>}</section></div>
    <DashboardActivity activity={daily.activity}/>
    <section aria-label="Study completion" className="dashboard-progress"><div className="dashboard-section-heading"><h2>Your studies, taking shape</h2><p className="muted">First study completed · imported core items</p></div>
    <div className="shelf">{kinds.map((kind, i) => <Link href={`/${kind}`} key={kind} className={`shelf-section progress-${kind}`}><span lang="ja" className="shelf-japanese">{['語彙','漢字','文法'][i]}</span><h3>{titles[kind]}</h3><p className="stat-number">{daily.progress[kind].introduced}<span>studied / {daily.progress[kind].total} imported</span></p><progress max={Math.max(1,daily.progress[kind].total)} value={daily.progress[kind].introduced} aria-label={`${titles[kind]} first study completed`}/><span>Browse reference →</span></Link>)}</div></section>
    <details className="dashboard-settings"><summary>Study pool &amp; review settings</summary>
    <p className="status">Studied today: {daily.studiedToday} items · Waiting for first review: {daily.waitingObjectives} objectives across {daily.waitingItems} items{daily.partialItems?` · ${daily.partialItems} partially activated items`:''}</p>
    {daily.blockedItems>0&&<p className="notice">{daily.blockedItems} studied items have unavailable or optional review content · {daily.missingObjectives} missing objectives. Study completion is retained.</p>}
    <p className="status">New review activations: {daily.used.total}/{daily.limits.total} · vocabulary {daily.used.vocabulary}/{daily.limits.vocabulary} · kanji objectives {daily.used.kanji}/{daily.limits.kanji} · grammar {daily.used.grammar}/{daily.limits.grammar}</p>{daily.contentGaps>0&&<p className="muted">{daily.contentGaps} grammar or contextual-kanji objectives await approved content.</p>}<ActivationControls configured={daily.configuredLimits}/><DailyBudget minutes={daily.timeBudgetMinutes}/></details>
    <p><a href="https://japanesetest4you.com/category/jlpt-n2/jlpt-n2-listening-test/" target="_blank" rel="noopener noreferrer">External N2 listening practice →</a></p>
    <details><summary>How study progress is counted</summary><p>Studied items are counted once; this is first study completion, not a measure of mastery. A streak day needs an item studied, a rated review, or a reading or weekly practice completed. Days use {daily.activity.timezone}; weeks start on Monday. Listening practice is external and does not record completion.</p><p>Reading counts completed passages, not generated drafts or page views. Weekly counts submitted cumulative tests. Review counts include every saved rating, including Again.</p></details>
    <Dictionary/>
  </div>;
}
