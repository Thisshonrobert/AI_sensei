'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function BrowseFlashcard({front,back,position,count,kind,query,itemId}:{front:string;back:ReactNode;position:number;count:number;kind:string;query:string;itemId:string}) {
  const [face,setFace]=useState({itemId,flipped:false});
  const flipped=face.itemId===itemId && face.flipped;
  const previous=useRef<HTMLButtonElement>(null), next=useRef<HTMLButtonElement>(null), flip=useRef<HTMLButtonElement>(null), pendingFocus=useRef<'previous'|'next'|null>(null);
  const router=useRouter();
  useEffect(()=>{if(pendingFocus.current){const button=pendingFocus.current==='previous'?previous.current:next.current;(button?.disabled?flip.current:button)?.focus();pendingFocus.current=null;}},[itemId]);
  function navigate(card:number) { pendingFocus.current=card<position?'previous':'next';setFace({itemId,flipped:false});router.push(`/${kind}/flashcards?${new URLSearchParams({card:String(card),...(query?{query}:{})})}`,{scroll:false}); }
  return <section className="browse-study" aria-label="Flashcard browsing">
    <div className="browse-meta"><p role="status" aria-live="polite">Card {position} of {count}</p><Link href={`/${kind}/${itemId}`}>Entry details</Link></div>
    <div className="browse-stage">
    <button ref={previous} className="secondary browse-arrow" aria-label="Previous card" disabled={position<=1} onClick={()=>navigate(position-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button>
    <div className={`browse-card ${flipped?'is-back':''}`} onClick={()=>{if(!window.getSelection()?.toString().trim())setFace({itemId,flipped:!flipped});}}>
      <button ref={flip} className="card-flip-keyboard" aria-label="Flip card" aria-describedby={`face-${itemId}`} aria-pressed={flipped} onClick={event=>{event.stopPropagation();setFace({itemId,flipped:!flipped});}}>Flip card</button>
      <div id={`face-${itemId}`} key={`${itemId}-${flipped?'back':'front'}`} className="browse-face" role="region" aria-label={flipped?'Card back':'Card front'}>
        <span className="card-side">{flipped?'Back':'Front'}</span>
        {flipped ? <><h2 className="japanese browse-back-title" lang="ja">{front}</h2>{back}</> : <h2 className="japanese browse-word" lang="ja">{front}</h2>}
      </div>
    </div>
    <button ref={next} className="secondary browse-arrow" aria-label="Next card" disabled={position>=count} onClick={()=>navigate(position+1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
    </div>
    <p className="status browse-help">Click the card or press Enter / Space to flip.</p>
  </section>;
}
