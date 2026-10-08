import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonSchema } from '../src/lib/server/content/study.mjs';
test('grammar comparison requires distinct patterns and one example for each',()=>{
 const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
 const good={explanationType:'grammar_comparison',grammarItemIds:ids,difference:'Different attachments',examples:ids.map((grammarItemId,i)=>({grammarItemId,contentId:`00000000-0000-4000-8000-00000000000${i+3}`}))};
 assert.equal(comparisonSchema.safeParse(good).success,true);
 assert.equal(comparisonSchema.safeParse({...good,grammarItemIds:[ids[0],ids[0]]}).success,false);
 assert.equal(comparisonSchema.safeParse({...good,examples:[good.examples[0],good.examples[0]]}).success,false);
 assert.equal(comparisonSchema.safeParse({...good,difference:''}).success,false);
});
