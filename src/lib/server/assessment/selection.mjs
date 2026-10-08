import { createHash } from 'node:crypto';
export const POLICY_VERSION='cumulative-v1';
const domains=['vocabulary','kanji','grammar','reading'];
const strata=['weak','recent','older','baseline'];
const stamp=v=>v?+new Date(v):0;
export function allocate(total,weights){
 const sum=weights.reduce((a,b)=>a+b,0);if(!sum)return weights.map(()=>0);
 const raw=weights.map(w=>total*w/sum),result=raw.map(Math.floor);
 const order=raw.map((n,i)=>({i,remainder:n-result[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
 for(let n=total-result.reduce((a,b)=>a+b,0),i=0;i<n;i++)result[order[i].i]++;
 return result;
}
export function selectAssessment({items,questions,now=new Date(),seed,size=20,domain='mixed'}){
 const cutoff=+now-7*86400000;
 const eligible=new Map(items.filter(i=>i.status==='approved'&&!i.excludedFromTests&&
  ((stamp(i.introducedAt)>0&&stamp(i.introducedAt)<+now)||['assumed','verified'].includes(i.baselineStatus))).map(i=>[i.id,i]));
 const bucket=i=>i.needsAttention||i.recentFailures>0?'weak':!i.introducedAt?'baseline':stamp(i.introducedAt)>=cutoff?'recent':'older';
 const candidates=questions.filter(q=>eligible.has(q.primaryTargetItemId)&&q.targetIds.length&&q.targetIds.every(id=>eligible.has(id))&&
  (q.domain==='reading'||q.domain===eligible.get(q.primaryTargetItemId).kind)).map(q=>({...q,stratum:bucket(eligible.get(q.primaryTargetItemId)),recentExposure:!!eligible.get(q.primaryTargetItemId).reviewedToday}));
 const tie=q=>createHash('sha256').update(`${seed}:${q.id}`).digest('hex');
 candidates.sort((a,b)=>{
  const ia=eligible.get(a.primaryTargetItemId),ib=eligible.get(b.primaryTargetItemId);
  return Number(a.recentExposure)-Number(b.recentExposure)||Number(stamp(a.lastQuestionAt)>=cutoff)-Number(stamp(b.lastQuestionAt)>=cutoff)||
   (a.stratum==='weak'&&b.stratum==='weak'?(stamp(ib.lastFailureAt)-stamp(ia.lastFailureAt)|| (ib.recentFailures||0)-(ia.recentFailures||0)):0)||
   stamp(ia.lastAssessedAt)-stamp(ib.lastAssessedAt)||tie(a).localeCompare(tie(b))||a.id.localeCompare(b.id);
 });
 const chosen=[],targets=new Set(),exposed=new Set(),ids=new Set();
 const fits=q=>!ids.has(q.id)&&q.targetIds.every(id=>!targets.has(id)&&!exposed.has(id))&&q.exposesItemIds.every(id=>!targets.has(id));
 const add=q=>{chosen.push(q);ids.add(q.id);q.targetIds.forEach(id=>targets.add(id));q.exposesItemIds.forEach(id=>exposed.add(id));};
 if(domain==='mixed'&&size>=2){
  const passages=[...new Set(candidates.filter(q=>q.domain==='reading'&&q.passageId).map(q=>q.passageId))];
  for(const p of passages){
   const group=candidates.filter(q=>q.domain==='reading'&&q.passageId===p);
   let pair;
   for(const a of group){pair=group.find(b=>b.id!==a.id&&!b.targetIds.some(id=>a.targetIds.includes(id)||a.exposesItemIds.includes(id))&&!b.exposesItemIds.some(id=>a.targetIds.includes(id)));if(pair){add(a);add(pair);break;}}
   if(pair)break;
  }
 }
 const shortDomains=domains.slice(0,3),counts=domain==='mixed'?allocate(size-chosen.length,[8,5,5]):shortDomains.map(d=>d===domain?size:0);
 for(let d=0;d<3;d++){
  const pool=candidates.filter(q=>q.domain===shortDomains[d]);
  const quotas=allocate(counts[d],[30,30,20,20]);
  const start=chosen.length;
  for(let s=0;s<4;s++)for(const q of pool.filter(q=>q.stratum===strata[s])){
   if(!quotas[s])break;if(fits(q)){add(q);quotas[s]--;}
  }
  for(const q of pool){if(chosen.length-start>=counts[d])break;if(fits(q))add(q);}
 }
 for(const q of candidates){if(chosen.length>=size)break;if(q.domain!=='reading'&&(domain==='mixed'||domain===q.domain)&&fits(q))add(q);}
 // Timed reading follows the short section; a single orphan comprehension question is never selected.
 chosen.sort((a,b)=>Number(a.domain==='reading')-Number(b.domain==='reading'));
 const coverage=Object.fromEntries(domains.map(d=>[d,chosen.filter(q=>q.domain===d).length]));
 const omissions=[];
 if(domain==='mixed'&&!coverage.reading)omissions.push('No approved eligible passage with two nonconflicting questions; reading slots redistributed.');
 if(chosen.length<size)omissions.push(`Only ${chosen.length} valid questions available for the requested ${size}.`);
 return {policyVersion:POLICY_VERSION,seed,requestedSize:size,domain,questions:chosen,coverage,omissions,eligibleTargets:eligible.size};
}
