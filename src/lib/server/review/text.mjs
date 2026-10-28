export const normalizeReading = value => value.normalize('NFKC').replace(/\s+/gu,'').replace(/[ァ-ヶ]/gu,char=>String.fromCodePoint(char.codePointAt(0)-0x60));
const STOP = new Set(['the','and','for','with','from','this','that','someone','something','thing','things']);
export function glossTokens(value) {
  return new Set((String(value).toLowerCase().match(/[a-z]+/g)||[]).filter(word=>word.length>2&&!STOP.has(word)));
}
export function glossOverlap(a,b) {
  const left=glossTokens(a);
  return [...glossTokens(b)].some(word=>left.has(word));
}
