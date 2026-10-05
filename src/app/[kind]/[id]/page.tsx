import Link from 'next/link';
import { notFound } from 'next/navigation';
import { itemDetail } from '@/lib/server/content/catalog';
import { parseKind, titles } from '@/lib/server/content/catalog-input';
import { Citations, ContentBlock, Fact, Origin, name, object, text } from '@/components/reference';

export default async function Detail({params}: {params: Promise<{kind: string; id: string}>}) {
  const {kind: value, id} = await params;const kind = parseKind(value);if (!kind) notFound();
  const item = await itemDetail(kind, id);if (!item) notFound();
  const origins = object(item.fieldOriginsJson);
  const english = item.contentLinks.find(({content}) => content.kind === 'explanation' && content.status === 'approved' && object(content.payloadJson).kind === 'generatedEnglishExplanation')?.content;
  const otherReferences = item.contentLinks.filter(({content}) => content.id !== english?.id);
  const fact = (label: string, value: string, field: string) => <Fact key={field} label={label} value={value} origins={[text(origins[field])]} citations={item.sourceEntries} />;
  return <><Link className="back" href={`/${kind}`}>← {titles[kind]}</Link><div className="eyebrow">{titles[kind]} / REFERENCE · REVISION {item.revision}</div><h1 lang="ja" className="japanese item-title">{name(item)}</h1>
    <dl className="facts">
      {item.vocabulary && <>{fact('Reading', item.vocabulary.reading, 'reading')}{fact('Selected meaning',item.vocabulary.meaningEn,'meaningEn')}{fact('Part of speech',item.vocabulary.partOfSpeech,'partOfSpeech')}<Fact label="Sense identity" value={item.vocabulary.senseKey} /></>}
      {item.kanji && <>{fact('Selected meanings',text(item.kanji.meaningsJson),'meaningsJson')}{fact('On readings',text(item.kanji.onReadingsJson),'onReadingsJson')}{fact('Kun readings',text(item.kanji.kunReadingsJson),'kunReadingsJson')}{item.kanji.notes && <Fact label="Content gap / notes" value={item.kanji.notes} />}</>}
      {item.grammar && <>{fact('Japanese explanation',item.grammar.explanationJa || '', 'explanationJa')}
        {item.grammar.explanationEn ? fact('English explanation',item.grammar.explanationEn,'explanationEn') : english ? <div className="fact" data-english-explanation><dt>English explanation</dt><dd><Origin origin={english.origin} /><p data-explanation-text>{text(object(english.payloadJson).translation)}</p><details><summary>Source citations</summary><Citations citations={english.sourceEntries} /></details></dd></div> : <Fact label="English explanation" value="" />}
        <Fact label="Formation · source wording" value={Array.isArray(item.grammar.formationRulesJson) ? item.grammar.formationRulesJson.map(r => text(object(r).label)).join('\n') : ''} /></>}
    </dl>
    <section><h2>Sources &amp; evidence</h2><Citations citations={item.sourceEntries} /></section>
    <section><h2>Examples &amp; supplementary reference</h2><p className="muted">Book examples retain their original wording. Each supplementary field has its own origin and approval status.</p>{otherReferences.length ? otherReferences.map(({content}) => <ContentBlock key={content.id} content={content} />) : <p className="empty">No examples supplied.</p>}{item.contentLinks.length === 120 && <p className="notice">Showing the first 120 linked references. Browse sources for more.</p>}</section>
  </>;
}
