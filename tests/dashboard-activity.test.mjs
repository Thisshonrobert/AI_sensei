import test from 'node:test';
import assert from 'node:assert/strict';
import * as review from '../src/lib/server/review/service.mjs';

test('study activity merges days, preserves yesterday streak and uses the learner timezone',()=>{
 assert.equal(typeof review.summarizeActivity,'function');
 const events=[
  {day:'2026-10-08',kind:'study',count:3},
  {day:'2026-10-09',kind:'review',count:4},
  {day:'2026-10-09',kind:'reading',count:1},
  {day:'2026-10-11',kind:'weekly',count:1},
  {day:'2026-10-12',kind:'review',count:2},
  {day:'2026-10-12',kind:'reading',count:1},
 ];
 // 18:45 UTC is already October 13 in India: yesterday keeps the streak alive.
 const a=review.summarizeActivity(events,new Date('2026-10-12T18:45:00Z'),'Asia/Calcutta');
 assert.equal(a.streak,2);assert.equal(a.bestStreak,2);
 assert.equal(a.reviewsToday,0);assert.equal(a.reviewsYesterday,2);assert.equal(a.reviewsTotal,6);
 assert.equal(a.readingsTotal,2);assert.equal(a.weeklyTotal,1);assert.equal(a.weeklyThisWeek,0);
 assert.equal(a.days.length,7);assert.equal(a.days.at(-1).day,'2026-10-13');assert.equal(a.days.at(-1).active,false);
 assert.equal(a.days.find(d=>d.day==='2026-10-09').active,true);
 const b=review.summarizeActivity(events,new Date('2026-10-14T06:00:00Z'),'Asia/Calcutta');
 assert.equal(b.streak,0);assert.equal(b.bestStreak,2);
 const empty=review.summarizeActivity([],new Date('2026-10-12T12:00:00Z'),'Asia/Calcutta');
 assert.equal(empty.streak,0);assert.equal(empty.bestStreak,0);assert.equal(empty.reviewsTotal,0);
});
