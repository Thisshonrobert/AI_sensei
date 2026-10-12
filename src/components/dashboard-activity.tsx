import Link from 'next/link';
import type { Activity } from '@/lib/server/review/service.mjs';

export function DashboardActivity({activity:a}:{activity:Activity}) {
 return <section className="dashboard-activity" aria-label="Study activity">
  <article className="dashboard-card streak-card">
   <div className="streak-heading"><div><h2>Daily streak</h2><p className="stat-number">{a.streak}<span>{a.streak===1?'day':'days'}</span></p></div><span className="streak-flower" aria-hidden="true">✿</span></div>
   <ol className="streak-week" aria-label="Activity over the last seven days">{a.days.map(d=><li key={d.day} className={`${d.active?'is-active':''} ${d.today?'is-today':''}`}><span>{d.today?'Today':d.label}</span><span className="streak-day" aria-hidden="true">{d.active?'✓':'·'}</span><span className="sr-only">{d.day}: {d.active?'study recorded':'no activity recorded'}</span></li>)}</ol>
   <p className="card-footnote">Best streak <strong>{a.bestStreak} {a.bestStreak===1?'day':'days'}</strong> · Study, recall, or finish a practice to keep growing.</p>
  </article>
  <article className="dashboard-card completed-reviews"><span className="activity-symbol" aria-hidden="true">復習</span><h2>Reviews completed</h2><p className="stat-number">{a.reviewsToday}<span>today</span></p><p className="card-footnote">Yesterday: <strong>{a.reviewsYesterday}</strong> · All time: <strong>{a.reviewsTotal}</strong></p></article>
  <article className="dashboard-card practice-stat"><span className="activity-symbol" aria-hidden="true">読む</span><div><h2>Reading practice</h2><p className="stat-number">{a.readingsTotal}<span>passages completed</span></p><Link href="/practice">Read a passage →</Link></div></article>
  <article className="dashboard-card practice-stat"><span className="activity-symbol weekly-symbol" aria-hidden="true">一週</span><div><h2>Weekly practice</h2><p className="stat-number">{a.weeklyTotal}<span>tests completed</span></p><p className="muted">{a.weeklyThisWeek} completed this week</p><Link href="/weekly">Weekly cumulative test →</Link></div></article>
 </section>;
}
