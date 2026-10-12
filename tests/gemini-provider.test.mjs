import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { geminiRequest,providerConfiguration,GeminiError } from '../src/lib/server/generation/gemini.mjs';
test('configuration requires explicit free-tier attestation and never returns the key',()=>{
 const env={GEMINI_API_KEY:'synthetic-secret',GEMINI_MODEL:'gemini-3.1-flash-lite'};
 assert.equal(providerConfiguration(env).enabled,false);
 const c=providerConfiguration({...env,GEMINI_FREE_TIER_CONFIRMED:'true'});assert.equal(c.enabled,true);assert.ok(!JSON.stringify(c).includes(env.GEMINI_API_KEY));
 assert.equal(providerConfiguration({...env,GEMINI_MODEL:'other-model',GEMINI_FREE_TIER_CONFIRMED:'true'}).enabled,false);
});
async function endpoint(handler,work){const server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');try{await work(`http://127.0.0.1:${server.address().port}`);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
test('REST transport sends key only in a header and enforces structured response',async()=>{
 await endpoint(async(req,res)=>{assert.equal(req.headers['x-goog-api-key'],'synthetic-secret');assert.ok(!req.url.includes('synthetic-secret'));let raw='';for await(const b of req)raw+=b;const input=JSON.parse(raw);assert.equal(input.generationConfig.responseMimeType,'application/json');res.end(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]}));},async url=>{
  assert.deepEqual(await geminiRequest({key:'synthetic-secret',model:'gemini-3.1-flash-lite',prompt:'synthetic',schema:{type:'object'},endpoint:url}),{ok:true});
 });
});
test('quota errors are sanitized and make only one request, with no retry or fallback',async()=>{
 let calls=0;await endpoint((req,res)=>{calls++;res.statusCode=429;res.end('synthetic-secret quota error');},async url=>{await assert.rejects(()=>geminiRequest({key:'synthetic-secret',model:'gemini-3.1-flash-lite',prompt:'x',schema:{type:'object'},endpoint:url}),e=>e instanceof GeminiError&&e.code==='quota'&&!e.message.includes('synthetic-secret'));});assert.equal(calls,1);
});
test('blocked/truncated output is rejected rather than parsed as reusable content',async()=>{
 await endpoint((req,res)=>res.end(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]})),async url=>{await assert.rejects(()=>geminiRequest({key:'synthetic-secret',model:'gemini-3.1-flash-lite',prompt:'x',schema:{type:'object'},endpoint:url}),e=>e.code==='output');});
});
