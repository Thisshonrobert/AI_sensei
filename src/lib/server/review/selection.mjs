import { fsrs } from 'ts-fsrs';

export const DEFAULT_CAPS = Object.freeze({ vocabulary: 100, kanji: 40, grammar: 10 });
export const category = card => card.objective.startsWith('vocab') ? 'vocabulary' : card.objective.startsWith('kanji') ? 'kanji' : 'grammar';

// 70% of the remaining cap for first recalls, 30% for due cards; a short tier's share flows to the other.
export function splitCap(remaining, waiting, due) {
  const r = Math.max(0, remaining);
  let first = Math.min(waiting, Math.floor(r * 7 / 10)), late = Math.min(due, r - Math.floor(r * 7 / 10));
  first += Math.min(r - first - late, waiting - first);
  late += Math.min(r - first - late, due - late);
  return { first, due: late };
}

export function retrievability(state, now, config) {
  if (state.state === 0) return 0;
  return fsrs(config.parameters).get_retrievability(state, now, false);
}

export function planQueue({ waiting, due, caps, used, now, config, siblings }) {
  const r = new Map(due.map(c => [c.id, retrievability(c.fsrsStateJson, now, config)]));
  const sorted = [...due].sort((a, b) => r.get(a.id) - r.get(b.id) || a.dueAt - b.dueAt || (a.id < b.id ? -1 : 1));
  const chosen = [], first = [], late = [];
  const take = (list, count, out) => {
    for (const c of list) {
      if (out.length >= count) break;
      if (!chosen.some(s => siblings(s, c))) { chosen.push(c); out.push(c); }
    }
  };
  for (const type of Object.keys(DEFAULT_CAPS)) {
    const w = waiting.filter(c => category(c) === type), d = sorted.filter(c => category(c) === type);
    const split = splitCap((caps[type] ?? DEFAULT_CAPS[type]) - (used[type] || 0), w.length, d.length);
    const f = [], l = [];
    take(w, split.first, f); take(d, split.due, l);
    first.push(...f); late.push(...l);
  }
  const order = new Map(waiting.map((c, i) => [c.id, i]));
  return [...first.sort((a, b) => order.get(a.id) - order.get(b.id)), ...late.sort((a, b) => sorted.indexOf(a) - sorted.indexOf(b))];
}
