'use client';
import { useEffect, useState } from 'react';
import type { MatchKind, MatchPair } from '@/lib/server/practice/match.mjs';

type Tile={key:string;pairId:string;side:'jp'|'en';text:string};
const PENALTY_MS=1000;
const shuffle=<T,>(list:T[])=>{const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
const bestKey=(kind:MatchKind)=>`match-best-${kind}`;
function readBest(kind:MatchKind){try{const v=Number(localStorage.getItem(bestKey(kind)));return v>0?v:null;}catch{return null;}}
function saveBest(kind:MatchKind,ms:number){try{localStorage.setItem(bestKey(kind),String(ms));}catch{/* storage unavailable: best time is a convenience only */}}
async function loadPairs(kind:MatchKind):Promise<{pairs?:MatchPair[];error?:string}>{
 try{const r=await fetch(`/api/practice/match?kind=${kind}`,{cache:'no-store'});const data=await r.json();return r.ok?{pairs:data.pairs}:{error:data.error||'Could not load pairs. Retry.'};}
 catch{return {error:'Could not load pairs. Retry.'};}
}
const seconds=(ms:number)=>`${(ms/1000).toFixed(1)} s`;

// Quizlet-style match: tap a Japanese tile, then its meaning. Pure practice; nothing is sent back.
export function MatchGame(){
 const [kind,setKind]=useState<MatchKind>('vocabulary');
 const [tiles,setTiles]=useState<Tile[]>([]),[matched,setMatched]=useState<Set<string>>(new Set());
 const [selected,setSelected]=useState<Tile|null>(null),[shake,setShake]=useState<string[]>([]);
 const [startedAt,setStartedAt]=useState<number|null>(null),[penalty,setPenalty]=useState(0),[misses,setMisses]=useState(0);
 const [finished,setFinished]=useState<number|null>(null),[best,setBest]=useState<number|null>(null),[now,setNow]=useState(0);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 // State changes only after the fetch resolves, so the loading effect never sets state synchronously.
 function apply(next:MatchKind,result:{pairs?:MatchPair[];error?:string}){
  setLoading(false);setError(result.error||'');
  setTiles(shuffle((result.pairs||[]).flatMap(p=>[{key:`${p.id}:jp`,pairId:p.id,side:'jp' as const,text:p.prompt},{key:`${p.id}:en`,pairId:p.id,side:'en' as const,text:p.answer}])));
  setMatched(new Set());setSelected(null);setStartedAt(null);setPenalty(0);setMisses(0);setFinished(null);setBest(readBest(next));
 }
 useEffect(()=>{let live=true;void loadPairs(kind).then(result=>{if(live)apply(kind,result);});return()=>{live=false;};},[kind]);
 function deal(){setLoading(true);void loadPairs(kind).then(result=>apply(kind,result));}
 function choose(next:MatchKind){if(next!==kind){setLoading(true);setKind(next);}}
 // One clock for the whole round: event and interval timestamps share the performance timeline.
 useEffect(()=>{if(startedAt===null||finished!==null)return;const t=setInterval(()=>setNow(performance.now()),100);return()=>clearInterval(t);},[startedAt,finished]);
 function tap(tile:Tile,at:number){
  if(finished!==null||matched.has(tile.pairId))return;
  const start=startedAt??at;if(startedAt===null){setStartedAt(start);setNow(start);}
  if(tile.side==='jp'){setSelected(selected?.key===tile.key?null:tile);return;}
  if(!selected)return;
  if(selected.pairId===tile.pairId){
   const done=new Set(matched).add(tile.pairId);setMatched(done);setSelected(null);
   if(done.size*2===tiles.length){const total=at-start+penalty;setFinished(total);if(!best||total<best){saveBest(kind,total);setBest(total);}}
  }else{
   setPenalty(p=>p+PENALTY_MS);setMisses(m=>m+1);setShake([selected.key,tile.key]);setSelected(null);setTimeout(()=>setShake([]),400);
  }
 }
 const elapsed=finished??(startedAt===null?0:now-startedAt+penalty);
 return <section className="match-game" aria-label="Match game">
  <div className="review-actions" role="group" aria-label="Match type">{(['vocabulary','kanji'] as const).map(k=><button key={k} className={k===kind?'':'secondary'} aria-pressed={k===kind} onClick={()=>choose(k)}>{k==='vocabulary'?'Vocabulary':'Kanji'}</button>)}</div>
  <p className="status" aria-live="off">Time {seconds(elapsed)} · misses {misses}{best?` · best ${seconds(best)}`:''}</p>
  {loading&&<p role="status">Dealing tiles…</p>}
  {error&&<p role="alert" className="notice">{error} <button className="secondary" onClick={deal}>Retry</button></p>}
  {!loading&&!error&&!tiles.length&&<p className="empty">Mark at least three items studied first. Match draws from your studied items.</p>}
  {!!tiles.length&&finished===null&&<div className="match-grid">{tiles.map(tile=><button key={tile.key} type="button" lang={tile.side==='jp'?'ja':undefined} data-pair={tile.pairId} data-side={tile.side} className={`match-tile ${tile.side==='jp'?'japanese':''} ${shake.includes(tile.key)?'shake':''}`} aria-pressed={selected?.key===tile.key} disabled={matched.has(tile.pairId)} onClick={e=>tap(tile,e.timeStamp)}>{tile.text}</button>)}</div>}
  <p role="status" aria-live="polite">{finished!==null?`Board cleared in ${seconds(finished)} with ${misses} ${misses===1?'miss':'misses'}.`:''}</p>
  {finished!==null&&<button onClick={deal}>Play again</button>}
 </section>;
}
