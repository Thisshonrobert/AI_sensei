import Link from 'next/link';
import type { itemDetail } from '@/lib/server/content/catalog';
import { object, text } from './reference';
import { vocabularyComponentAid } from '@/lib/server/content/vocabulary-components.mjs';

type DetailItem=NonNullable<Awaited<ReturnType<typeof itemDetail>>>;
export function VocabularyComponents({item,compact=false}:{item:DetailItem;compact?:boolean}) {
  const usage=object(item.vocabulary?.usageJson ?? null);
  const aid=vocabularyComponentAid(item,item.contentLinks.map(l=>l.content));
  const components=aid?aid.components:(Array.isArray(usage.kanji_components)?usage.kanji_components:[]).map(object).filter(p=>text(p.text));
  if(!components.length && !item.linkedKanji.length) return compact?null:<p className="muted">Source component meanings have not been extracted for this word.</p>;
  return <ul className="vocabulary-kanji-tiles">{components.length ? components.map((p,i)=><li key={i}><span className="japanese component-glyph" lang="ja">{text(p.text)}</span>{text(p.reading) && <span className="component-reading" lang="ja">{text(p.reading)}</span>}<span className="component-meaning">{text(p.meanings)||'Meaning not supplied'}</span></li>) : item.linkedKanji.map(k=><li key={k.itemId}>{compact?<span className="japanese component-glyph" lang="ja">{k.glyph}</span>:<Link className="japanese component-glyph" lang="ja" href={`/kanji/${k.itemId}`}>{k.glyph}</Link>}<span className="component-meaning">{text(k.meaningsJson)||'Meaning not supplied'}</span></li>)}</ul>;
}
