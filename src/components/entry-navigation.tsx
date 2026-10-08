import Link from 'next/link';
import type { ReactNode } from 'react';

export function EntryNavigation({kind,previous,next,children}:{kind:string;previous:{id:string}|null;next:{id:string}|null;children:ReactNode}) {
  const arrow=(direction:'previous'|'next',item:{id:string}|null)=>{
    const label=direction==='previous'?'Previous entry':'Next entry';
    const glyph=<svg viewBox="0 0 24 24" aria-hidden="true"><path d={direction==='previous'?'m15 5-7 7 7 7':'m9 5 7 7-7 7'}/></svg>;
    return item?<Link className="browse-arrow entry-arrow" aria-label={label} href={`/${kind}/${item.id}`}>{glyph}</Link>:<button className="secondary browse-arrow" aria-label={label} disabled>{glyph}</button>;
  };
  return <nav className="entry-navigation" aria-label="Entry navigation">{arrow('previous',previous)}{children}{arrow('next',next)}</nav>;
}
