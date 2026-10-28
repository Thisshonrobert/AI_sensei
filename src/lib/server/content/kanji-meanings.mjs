// Approved English glosses are stored as field supplements so the canonical book
// wording in Item fields stays untouched. Resolution is presentation only.
// A printed English book meaning is authoritative; a supplement fills only a
// missing meaning or replaces Japanese-only book wording with an English gloss.
export const KANJI_MEANING_FIELD_PATHS = ['meaning_en', 'meanings_en', 'meaning', 'meanings'];

const strings = value => Array.isArray(value)
  ? value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
  : typeof value === 'string' && value.trim() ? [value.trim()] : [];
// Import placeholders such as "Meaning not supplied by source" are not printed meanings.
const placeholder = value => /^(?:meaning )?not supplied\b/i.test(value) || /^not_supplied$/i.test(value);
const hasEnglishText = value => /[A-Za-z]/.test(value) && !placeholder(value);
const fieldRank = path => {
  const rank = KANJI_MEANING_FIELD_PATHS.indexOf(path);
  return rank === -1 ? KANJI_MEANING_FIELD_PATHS.length : rank;
};
// Dictionary-backed glosses outrank AI wording. Newer revisions win within a source.
const provenanceRank = content => content.origin === 'user' && content.payloadJson?.addedBy === 'dictionary' ? 0
  : content.origin === 'user' ? 1 : 2;
const time = value => value instanceof Date ? value.getTime() : Date.parse(value ?? '') || 0;
const compare = (a, b) => provenanceRank(a) - provenanceRank(b)
  || fieldRank(a.payloadJson.fieldPath) - fieldRank(b.payloadJson.fieldPath)
  || (b.revision ?? 0) - (a.revision ?? 0)
  || time(b.createdAt) - time(a.createdAt)
  || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);

export function isKanjiMeaningSupplement(content) {
  const payload = content?.payloadJson;
  if (!content || content.kind !== 'explanation' || content.status !== 'approved' || content.successor) return false;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  return payload.kind === 'dictionaryFieldSupplement'
    && fieldRank(payload.fieldPath) < KANJI_MEANING_FIELD_PATHS.length
    && strings(payload.selectedMeanings).length > 0;
}

// Vocabulary and kanji share the same field-supplement rule; the name predates vocabulary use.
export function resolveKanjiMeanings(contents, fallback = []) {
  const original = strings(fallback).filter(value => !placeholder(value));
  const printedEnglish = original.filter(hasEnglishText);
  if (printedEnglish.length) return { meanings: printedEnglish, text: printedEnglish.join(' · '), source: 'book', supplement: null, original };
  const supplement = (contents ?? []).filter(isKanjiMeaningSupplement).sort(compare)[0] ?? null;
  if (!supplement) return { meanings: original, text: original.join(' · '), source: 'book', supplement: null, original };
  const meanings = strings(supplement.payloadJson.selectedMeanings);
  return { meanings, text: meanings.join(' · '), source: 'supplement', supplement, original };
}
