'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReviewCaps as Caps } from '@/lib/server/review/service.mjs';

const fields=[['vocabulary','Vocabulary per day'],['kanji','Kanji per day'],['grammar','Grammar per day']] as const;
export function ReviewCaps({configured}:{configured:Caps}){
 const [values,setValues]=useState(configured),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');const router=useRouter();
 async function save(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'caps',values})});
   const data=await r.json();if(!r.ok)throw new Error(data.error);
   setMessage('Daily review caps saved.');router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Could not save. Retry.');}finally{setBusy(false);}
 }
 return <details className="activation-controls"><summary>Daily review caps</summary>
  <p>Caps are ceilings, not targets: up to 70% newly studied items and at least 30% older due cards, most likely forgotten first. Anything over the cap waits for tomorrow.</p>
  <form onSubmit={e=>{e.preventDefault();void save();}}><div className="allowance-inputs">{fields.map(([key,label])=><label key={key}>{label}<input type="number" required min={0} max={300} value={values[key]} onChange={e=>setValues({...values,[key]:Number(e.target.value)})}/></label>)}</div><button className="secondary" disabled={busy}>Save daily caps</button></form>
  <p role="status">{message}</p>{error&&<p role="alert" className="notice">{error}</p>}
 </details>;
}
