import test from 'node:test';
import assert from 'node:assert/strict';
import { sentenceUnits } from '../src/lib/server/generation/reading.mjs';
test('sentence translations bind to exact UTF-16 ranges; absent translations stay unavailable',()=>{
 const draft={kind:'passage',japanese:'😀食べる。次です。',translation:'A whole passage translation',sentences:[{start:0,end:6,translation:'Eat.'}]};
 const units=sentenceUnits(draft);assert.equal(units.length,2);assert.equal(units[0].japanese,'😀食べる。');assert.equal(units[0].translation,'Eat.');assert.equal(units[1].translation,null);
 assert.equal(units.map(s=>s.japanese).join(''),draft.japanese);
});
test('whole translation is usable for a single sentence only',()=>{
 assert.equal(sentenceUnits({kind:'sentence',japanese:'食べる。',translation:'Eat.'})[0].translation,'Eat.');
 assert.equal(sentenceUnits({kind:'sentence',japanese:'食べる。次です。',translation:'Eat. Next.'})[0].translation,null);
});
test('a quoted sentence translation can omit only surrounding line whitespace',()=>{
 const draft={kind:'passage',japanese:'食べる。\n次です。',sentences:[{start:0,end:4,translation:'Eat.'},{start:5,end:9,translation:'Next.'}]};
 assert.deepEqual(sentenceUnits(draft).filter(s=>s.japanese.trim()).map(s=>s.translation),['Eat.','Next.']);
 assert.equal(sentenceUnits({...draft,sentences:[{start:1,end:4,translation:'Wrong substring'}]})[0].translation,null);
});
