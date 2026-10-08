'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ActivationLimits } from '@/lib/server/review/service.mjs';

const fields=[['vocabulary','Vocabulary'],['kanji','Kanji objectives'],['grammar','Grammar'],['total','Total']] as const;
export function ActivationControls({configured}:{configured:ActivationLimits}){
 const [values,setValues]=useState(configured),[extra,setExtra]=useState<ActivationLimits>({vocabulary:5,kanji:2,grammar:1,total:8});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');const router=useRouter();
 async function save(action:'activationLimits'|'extraBatch',counts:ActivationLimits){
  setBusy(true);setError('');
  try{
   let clientEventId;
   if(action==='extraBatch'){
    const pending=sessionStorage.getItem('activation-batch-retry');
    const old=pending?JSON.parse(pending):null;
    clientEventId=old&&JSON.stringify(old.values)===JSON.stringify(counts)?old.clientEventId:crypto.randomUUID();
    sessionStorage.setItem('activation-batch-retry',JSON.stringify({clientEventId,values:counts}));
   }
   const r=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,values:counts,...(clientEventId?{clientEventId}:{})})});
   const data=await r.json();if(!r.ok)throw new Error(data.error);
   if(action==='extraBatch')sessionStorage.removeItem('activation-batch-retry');
   setMessage(action==='extraBatch'?(data.appliedDay!==data.studyDay?'That saved batch belongs to a previous study day. Today’s allowance is unchanged.':'Today’s allowance increased. Continue learning to study and activate eligible objectives.'):'Default activation allowances saved. Today’s consumed allowance is retained.');router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Could not save. Retry.');}finally{setBusy(false);}
 }
 function inputs(counts:ActivationLimits,change:(v:ActivationLimits)=>void,prefix:string){return <div className="allowance-inputs">{fields.map(([key,label])=><label key={key}>{prefix} {label}<input type="number" required min={0} max={key==='total'?300:100} value={counts[key]} onChange={e=>change({...counts,[key]:Number(e.target.value)})}/></label>)}</div>;}
 return <details className="activation-controls"><summary>Adjust review activations</summary>
  <p>Allowances are ceilings, not targets. Studying has no daily cap. New review batches contain at most 20 objectives and retain backlog and sibling pauses.</p>
  <form onSubmit={e=>{e.preventDefault();void save('activationLimits',values);}}>{inputs(values,setValues,'Default')}<button className="secondary" disabled={busy}>Save activation allowances</button></form>
  <form onSubmit={e=>{e.preventDefault();void save('extraBatch',extra);}}><h3>Add another batch</h3>{inputs(extra,setExtra,'Extra today')}<p>Proposed increase: {extra.vocabulary} vocabulary, {extra.kanji} kanji objectives, {extra.grammar} grammar; up to {Math.min(extra.total,extra.vocabulary+extra.kanji+extra.grammar)} additional activations today. Only eligible cards can activate, after due reviews. This increase expires at the next study day.</p><button className="secondary" disabled={busy||extra.total===0||extra.vocabulary+extra.kanji+extra.grammar===0}>Add another batch</button></form>
  <p role="status">{message}</p>{error&&<p role="alert" className="notice">{error}</p>}
 </details>;
}
