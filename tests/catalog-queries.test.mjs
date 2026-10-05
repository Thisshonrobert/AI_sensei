import test from 'node:test';
import assert from 'node:assert/strict';

test('catalog kind and paging input are bounded before SQL retrieval', async()=>{
 const {parseKind,pageInput}=await import('../src/lib/server/content/catalog-input.ts');
 assert.equal(parseKind('kanji'),'kanji');assert.equal(parseKind('sources'),null);
 assert.deepEqual(pageInput({page:'-1',query:'  test  '}),{page:1,skip:0,query:'test'});
 assert.equal(pageInput({page:'999999',query:'a'.repeat(300)}).query.length,100);
 assert.equal(pageInput({page:'999999'}).page,1);
 assert.equal(pageInput({page:'2'}).skip,50);
 assert.equal(pageInput({query:['one','two']}).query,'');
});
