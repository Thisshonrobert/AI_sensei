'use client';
import { useRef, useState } from 'react';

export function Dictionary({itemId,disabled=false}:{itemId?:string;disabled?:boolean}) {
  const trigger=useRef<HTMLButtonElement>(null), input=useRef<HTMLInputElement>(null), fallbackLink=useRef<HTMLAnchorElement>(null), selection=useRef('');
  const [query,setQuery]=useState(''), [fallback,setFallback]=useState(false), [message,setMessage]=useState(''), [busy,setBusy]=useState(false), [lookupUrl,setLookupUrl]=useState('');
  const urlFor=(term:string)=>`https://takoboto.jp/?q=${encodeURIComponent(term.trim().slice(0,500))}`;
  function showFallback(message:string) { setMessage(message); setFallback(true); requestAnimationFrame(()=>(input.current || fallbackLink.current)?.focus()); }
  function openTerm(term:string) {
    const url=urlFor(term);
    const mobile=window.matchMedia('(max-width: 650px)').matches;
    const popup=window.open(url,mobile?'_blank':'ai-sensei-takoboto',mobile?'':'popup,width=700,height=700');
    if(popup) { popup.opener=null; setFallback(false); setMessage(''); }
    else { setLookupUrl(url); showFallback('Popup blocked. Open the lookup below.'); }
  }
  async function lookup() {
    if(disabled || busy) return;
    setLookupUrl('');
    const selected=window.getSelection()?.toString().trim() || selection.current;
    selection.current='';
    if(selected) { openTerm(selected); return; }
    if(!navigator.clipboard?.readText) { showFallback('Select a word, or enter it here.'); return; }
    // Reserve a window during the click so a clipboard prompt cannot lose user activation.
    const popup=window.open('about:blank','_blank',window.matchMedia('(max-width: 650px)').matches?'':'popup,width=700,height=700');
    if(popup) popup.opener=null;
    setBusy(true);
    try {
      const copied=(await navigator.clipboard.readText()).trim().slice(0,500);
      if(!copied) { popup?.close(); showFallback('Select a word, or enter it here.'); return; }
      const url=urlFor(copied);
      if(popup) { popup.location.href=url; setFallback(false); setMessage(''); }
      else { setQuery(copied); setLookupUrl(url); showFallback('Popup blocked. Open the lookup below.'); }
    } catch { popup?.close(); showFallback('Clipboard unavailable. Select a word, or enter it here.'); }
    finally { setBusy(false); }
  }
  async function attention() {
    setBusy(true);
    try { const r=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'attention',itemId})}); if(!r.ok)throw new Error(); setMessage('Flagged for attention. Scheduling is unchanged.'); }
    catch { setMessage('Could not save the flag. Retry when the local database is available.'); }
    finally { setBusy(false); }
  }
  function close() { setFallback(false); setMessage(''); trigger.current?.focus(); }
  return <>
    {itemId && !disabled && <div className="attention-action"><button className="secondary" disabled={busy} onClick={attention}>Mark this item unfamiliar</button>{!fallback && message && <p role="status">{message}</p>}</div>}
    <button className="dictionary-trigger secondary" ref={trigger} disabled={disabled || busy} onPointerDown={()=>{selection.current=window.getSelection()?.toString().trim()||'';}} onClick={lookup} aria-expanded={fallback} aria-controls={fallback?'dictionary-fallback':undefined} title={disabled?'Lookup is available after recall commitment':'Look up selected or copied text'}>Dictionary</button>
    {fallback && <section className="dictionary-fallback" id="dictionary-fallback" aria-label="Dictionary lookup" onKeyDown={e=>{if(e.key==='Escape')close();}}>
      <p role="status">{message}</p>
      {lookupUrl ? <a className="button-link" ref={fallbackLink} href={lookupUrl} target="_blank" rel="noopener noreferrer">Open Takoboto</a> : <form onSubmit={e=>{e.preventDefault();if(query.trim())openTerm(query);}}><label htmlFor="dictionary-query">Word or phrase</label><input id="dictionary-query" ref={input} maxLength={500} value={query} onChange={e=>setQuery(e.target.value)} lang="ja"/><button disabled={!query.trim()}>Open Takoboto</button></form>}
      <button className="secondary" onClick={close}>Close lookup</button>
    </section>}
  </>;
}
