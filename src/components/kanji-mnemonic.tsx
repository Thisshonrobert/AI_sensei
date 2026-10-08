import type { Prisma } from '@prisma/client';

const object = (v: Prisma.JsonValue): Prisma.JsonObject => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const text = (v: Prisma.JsonValue | undefined) => typeof v === 'string' ? v : '';
const strings = (v: Prisma.JsonValue | undefined) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];

export function KanjiMnemonic({payload,targetMeanings}:{payload:Prisma.JsonObject;targetMeanings?:Prisma.JsonValue}) {
  const radicals = (Array.isArray(payload.radicalCombinations) ? payload.radicalCombinations : []).map(object).filter(r => text(r.glyph) || text(r.name));
  // Completeness comes from a dedicated stored field, never from guessing how an excerpt ends.
  const complete = text(payload.meaningMnemonic) || text(payload.meaningMnemonicText) || text(payload.meaningMnemonicFull);
  const excerpt = text(payload.meaningMnemonicExcerpt);
  const mnemonic = complete || excerpt;
  const meanings = strings(targetMeanings || payload.selectedMeanings || payload.meanings);
  const tokens = [...radicals.map((r,i) => ({word:text(r.name),className:`radical-tone-${i%3}`})), ...meanings.map(word => ({word,className:'meaning-highlight'}))].filter(t => t.word);
  const escaped = tokens.map(t => t.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).sort((a,b) => b.length-a.length);
  const parts = escaped.length ? mnemonic.split(new RegExp(`(\\b(?:${escaped.join('|')})(?:s)?\\b)`,'gi')) : [mnemonic];
  return <div data-wanikani-reference>
    {radicals.length > 0 && <><h3>Radical combination</h3><div className="radical-combination">{radicals.map((r,i) => <span className="radical-component" key={i}>
      {i>0 && <span className="radical-plus" aria-label="plus">+</span>}
      <span className={`radical-tile radical-tone-${i%3}`}><span className="japanese radical-glyph" lang="ja">{text(r.glyph)}</span><span>{text(r.name)}</span></span>
    </span>)}</div></>}
    <h3>{complete ? 'Meaning mnemonic' : 'Meaning mnemonic · excerpt'}</h3>
    {mnemonic ? <p className="mnemonic">{parts.map((part,i) => {
      const token = tokens.find(t => part.toLowerCase() === t.word.toLowerCase() || part.toLowerCase() === `${t.word.toLowerCase()}s`);
      return token ? <mark className={token.className} key={i}>{part}</mark> : part;
    })}</p> : <p className="muted">Mnemonic not supplied.</p>}
    {!complete && excerpt && <p className="muted">Only an excerpt is stored; the rest is unavailable locally.</p>}
    <p className="status">Learning mnemonic and component names, not historical etymology.</p>
    {payload.meaningMnemonicOrigin==='generated' && <p className="muted">Original generated memory aid.{text(payload.componentReferenceUrl).startsWith('https://www.wanikani.com/kanji/') && <> Components: <a href={text(payload.componentReferenceUrl)} target="_blank" rel="noopener noreferrer">WaniKani</a>.</>}</p>}
    {Array.isArray(payload.combinations) && payload.combinations.length>0 && <><h3>Word combinations</h3><ul>{payload.combinations.map((value,i) => {const w=object(value);return <li key={i}><span lang="ja">{text(w.term)}{text(w.reading)&&`（${text(w.reading)}）`}</span>{text(w.meaning)&&` · ${text(w.meaning)}`}</li>;})}</ul></>}
    {text(payload.meaningMnemonicUrl).startsWith('https://www.wanikani.com/kanji/') && <details><summary>Mnemonic attribution</summary><a href={text(payload.meaningMnemonicUrl)} target="_blank" rel="noopener noreferrer">Full mnemonic on WaniKani</a></details>}
  </div>;
}
