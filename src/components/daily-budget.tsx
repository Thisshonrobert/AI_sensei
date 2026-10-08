'use client';
import { useState } from 'react';
export function DailyBudget({minutes}:{minutes:number}){
 const [value,setValue]=useState(minutes),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 return <form className="budget-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{const r=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'budget',minutes:value})});if(!r.ok)throw new Error();setMessage('Block budget saved. Daily card ceilings stay the same.');}catch{setMessage('Could not save. Retry when the local database is available.');}finally{setBusy(false);}}}><label>Default study block budget <input type="number" min={5} max={60} required value={value} onChange={e=>setValue(Number(e.target.value))}/> minutes</label><button className="secondary" disabled={busy}>Save budget</button><p role="status">{message}</p></form>;
}
