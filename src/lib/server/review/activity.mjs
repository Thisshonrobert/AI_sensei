import { studyDay } from './scheduler.mjs';

const shiftDay=(day,offset)=>new Date(Date.parse(`${day}T12:00:00Z`)+offset*86400000).toISOString().slice(0,10);

export function summarizeActivity(events,now=new Date(),timezone='Asia/Calcutta') {
 const today=studyDay(now,timezone),yesterday=shiftDay(today,-1);
 const active=new Set(events.filter(e=>Number(e.count)>0&&e.day<=today).map(e=>e.day));
 const count=(kind,day)=>events.filter(e=>e.kind===kind&&e.day<=today&&(!day||e.day===day)).reduce((n,e)=>n+Number(e.count),0);
 let streak=0,cursor=active.has(today)?today:yesterday;
 while(active.has(cursor)){streak++;cursor=shiftDay(cursor,-1);}
 let bestStreak=0,run=0,previous=null;
 for(const day of [...active].sort()){run=previous&&shiftDay(previous,1)===day?run+1:1;bestStreak=Math.max(bestStreak,run);previous=day;}
 const weekday=new Date(`${today}T12:00:00Z`).getUTCDay(),weekStart=shiftDay(today,-((weekday+6)%7));
 return {streak,bestStreak,reviewsToday:count('review',today),reviewsYesterday:count('review',yesterday),reviewsTotal:count('review'),readingsTotal:count('reading'),weeklyTotal:count('weekly'),weeklyThisWeek:events.filter(e=>e.kind==='weekly'&&e.day>=weekStart&&e.day<=today).reduce((n,e)=>n+Number(e.count),0),timezone,
  days:Array.from({length:7},(_,i)=>{const day=shiftDay(today,i-6);return {day,label:new Intl.DateTimeFormat('en',{weekday:'short',timeZone:'UTC'}).format(new Date(`${day}T12:00:00Z`)),active:active.has(day),today:day===today};})};
}

export async function activitySummary(db,user,now) {
 const events=await db.$queryRaw`
  WITH events AS (
   SELECT "introducedAt" AS at,'study' AS kind FROM user_items WHERE "userId"=${user.id}::uuid AND "introducedAt" IS NOT NULL
   UNION ALL SELECT "reviewedAt",'review' FROM review_logs WHERE "userId"=${user.id}::uuid
   UNION ALL SELECT "endedAt",'weekly' FROM study_sessions WHERE "userId"=${user.id}::uuid AND mode='weekly' AND status='completed'
   UNION ALL SELECT "endedAt",'reading' FROM study_sessions WHERE "userId"=${user.id}::uuid AND mode='practice' AND status='completed'
    AND ("selectionSnapshotJson"->>'kind'='reading_completion' OR jsonb_array_length(COALESCE("selectionSnapshotJson"->'passages','[]'::jsonb))>0)
  ) SELECT to_char(at AT TIME ZONE ${user.timezone},'YYYY-MM-DD') AS day,kind,count(*)::int AS count
    FROM events WHERE at<=${now} GROUP BY day,kind ORDER BY day`;
 return summarizeActivity(events,now,user.timezone);
}
