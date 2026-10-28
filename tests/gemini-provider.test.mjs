import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { geminiRequest,geminiFallbackRequest,availableModels,providerConfiguration,normalizeModelId,GeminiError } from '../src/lib/server/generation/gemini.mjs';
test('configuration requires explicit free-tier attestation and never returns the key',()=>{
 const env={GEMINI_API_KEY:'synthetic-secret',GEMINI_MODEL:'gemini-2.5-flash'};
 assert.equal(providerConfiguration(env).enabled,false);
 const c=providerConfiguration({...env,GEMINI_FREE_TIER_CONFIRMED:'true'});assert.equal(c.enabled,true);assert.ok(!JSON.stringify(c).includes(env.GEMINI_API_KEY));
 assert.equal(providerConfiguration({...env,GEMINI_MODEL:'invalid model id',GEMINI_FREE_TIER_CONFIRMED:'true'}).enabled,false);
});
test('any Google model ID is accepted, including models/ prefixes and newer releases',()=>{
 const env={GEMINI_API_KEY:'synthetic-secret',GEMINI_FREE_TIER_CONFIRMED:'true'};
 for(const model of ['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-3.1-flash-lite','gemini-2.5-pro-exp-03-25','models/gemini-2.5-flash','GEMINI-2.5-FLASH']){
  assert.equal(providerConfiguration({...env,GEMINI_MODEL:model}).enabled,true,model);
 }
 assert.equal(providerConfiguration({...env,GEMINI_MODEL:'models/gemini-2.5-flash'}).model,'gemini-2.5-flash');
 assert.equal(providerConfiguration({...env,GEMINI_MODEL:''}).model,'gemini-2.5-flash');
 assert.equal(providerConfiguration(env).reason,null);
 for(const model of ['../gemini-2.5-flash','gemini-2.5-flash/../../v1/keys','gemini 2.5 flash','-gemini','']){
  assert.equal(normalizeModelId(model),null,model);
 }
 assert.equal(normalizeModelId(undefined),null);
 assert.equal(normalizeModelId('gemini-2.5-flash\n'),'gemini-2.5-flash');
});
test('invalid model configuration blocks requests before any network call',async()=>{
 await assert.rejects(()=>geminiRequest({key:'synthetic-secret',model:'../other',prompt:'x',schema:{type:'object'}}),e=>e instanceof GeminiError);
});
async function endpoint(handler,work){const server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');try{await work(`http://127.0.0.1:${server.address().port}`);}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
async function body(req){let raw='';for await(const b of req)raw+=b;return JSON.parse(raw);}
test('REST transport sends key only in a header, uses the configured model and disables 2.5 Flash thinking',async()=>{
 await endpoint(async(req,res)=>{assert.equal(req.headers['x-goog-api-key'],'synthetic-secret');assert.ok(!req.url.includes('synthetic-secret'));assert.equal(req.url,'/v1beta/models/gemini-2.5-flash:generateContent');const input=await body(req);assert.equal(input.generationConfig.responseMimeType,'application/json');assert.deepEqual(input.generationConfig.thinkingConfig,{thinkingBudget:0});res.end(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]}));},async url=>{
  assert.deepEqual(await geminiRequest({key:'synthetic-secret',model:'models/gemini-2.5-flash',prompt:'synthetic',schema:{type:'object'},endpoint:url}),{ok:true});
 });
});
test('thinking control follows the model family',async()=>{
 const seen=[];
 await endpoint(async(req,res)=>{seen.push((await body(req)).generationConfig);res.end(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]}));},async url=>{
  await geminiRequest({key:'synthetic-secret',model:'gemini-2.5-pro',prompt:'x',schema:{type:'object'},endpoint:url});
  await geminiRequest({key:'synthetic-secret',model:'gemini-2.0-flash',prompt:'x',schema:{type:'object'},endpoint:url});
  await geminiRequest({key:'synthetic-secret',model:'gemini-3.8-flash',prompt:'x',schema:{type:'object'},endpoint:url});
 });
 assert.deepEqual(seen[0].thinkingConfig,{thinkingBudget:128});
 assert.equal('thinkingConfig' in seen[1],false);
 assert.deepEqual(seen[2].thinkingConfig,{thinkingLevel:'low'});
});
test('a rejected thinking level falls back to the next supported setting',async()=>{
 let calls=0;
 await endpoint(async(req,res)=>{calls++;const input=await body(req);if(calls===1){assert.deepEqual(input.generationConfig.thinkingConfig,{thinkingLevel:'low'});res.statusCode=400;res.end(JSON.stringify({error:{code:400,message:'Thinking level is not supported for this model.'}}));return;}assert.deepEqual(input.generationConfig.thinkingConfig,{thinkingLevel:'minimal'});res.end(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]}));},async url=>{
  assert.deepEqual(await geminiRequest({key:'synthetic-secret',model:'gemini-3.1-flash-lite-image',prompt:'x',schema:{type:'object'},endpoint:url}),{ok:true});
 });
 assert.equal(calls,2);
});
test('a non-thinking 400 is reported once without retrying',async()=>{
 let calls=0;
 await endpoint((req,res)=>{calls++;res.statusCode=400;res.end(JSON.stringify({error:{code:400,message:'Invalid JSON schema.'}}));},async url=>{
  await assert.rejects(()=>geminiRequest({key:'synthetic-secret',model:'gemini-2.5-flash',prompt:'x',schema:{type:'object'},endpoint:url}),e=>e instanceof GeminiError&&e.code==='provider');
 });
 assert.equal(calls,1);
});
test('a transient provider outage is retried, then succeeds',async()=>{
 let calls=0;
 await endpoint((req,res)=>{calls++;if(calls<3){res.statusCode=503;res.end('{"error":{"code":503,"status":"UNAVAILABLE"}}');return;}res.end(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]}));},async url=>{
  assert.deepEqual(await geminiRequest({key:'synthetic-secret',model:'gemini-2.5-flash',prompt:'x',schema:{type:'object'},endpoint:url}),{ok:true});
 });
 assert.equal(calls,3);
});
test('a persistent provider outage is reported after bounded retries',async()=>{
 let calls=0;
 await endpoint((req,res)=>{calls++;res.statusCode=503;res.end('{"error":{"code":503,"status":"UNAVAILABLE"}}');},async url=>{
  await assert.rejects(()=>geminiRequest({key:'synthetic-secret',model:'gemini-2.5-flash',prompt:'x',schema:{type:'object'},endpoint:url}),e=>e instanceof GeminiError&&e.code==='provider'&&e.providerStatus===503);
 });
 assert.equal(calls,3);
});
test('an unknown model ID is reported without exposing the provider body',async()=>{
 await endpoint((req,res)=>{res.statusCode=404;res.end('synthetic-secret model not found');},async url=>{
  await assert.rejects(()=>geminiRequest({key:'synthetic-secret',model:'gemini-9.9-missing',prompt:'x',schema:{type:'object'},endpoint:url}),e=>e instanceof GeminiError&&/GEMINI_MODEL/.test(e.message)&&!e.message.includes('synthetic-secret'));
 });
});
test('quota errors are sanitized and make only one request, with no retry or fallback',async()=>{
 let calls=0;await endpoint((req,res)=>{calls++;res.statusCode=429;res.end('synthetic-secret quota error');},async url=>{await assert.rejects(()=>geminiRequest({key:'synthetic-secret',model:'gemini-2.5-flash',prompt:'x',schema:{type:'object'},endpoint:url}),e=>e instanceof GeminiError&&e.code==='quota'&&!e.message.includes('synthetic-secret'));});assert.equal(calls,1);
});
test('blocked/truncated output is rejected rather than parsed as reusable content',async()=>{
 await endpoint((req,res)=>res.end(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]})),async url=>{await assert.rejects(()=>geminiRequest({key:'synthetic-secret',model:'gemini-3.1-flash-lite',prompt:'x',schema:{type:'object'},endpoint:url}),e=>e.code==='output');});
});
test('GEMINI_MODELS is an ordered fallback list and rejects any invalid entry',()=>{
 const env={GEMINI_API_KEY:'synthetic-secret',GEMINI_FREE_TIER_CONFIRMED:'true'};
 const c=providerConfiguration({...env,GEMINI_MODEL:'gemini-2.5-flash',GEMINI_MODELS:' models/gemini-3.5-flash , gemini-2.5-flash,gemini-3.5-flash'});
 assert.deepEqual(c.models,['gemini-3.5-flash','gemini-2.5-flash']);assert.equal(c.model,'gemini-3.5-flash');
 assert.deepEqual(providerConfiguration({...env,GEMINI_MODEL:'gemini-2.5-flash'}).models,['gemini-2.5-flash']);
 assert.equal(providerConfiguration({...env,GEMINI_MODELS:'gemini-2.5-flash,../x'}).enabled,false);
});
test('a quota-limited model rests until its retry delay or Pacific midnight while the next model answers',async()=>{
 const seen=[];
 await endpoint(async(req,res)=>{const model=req.url.match(/models\/([^:]+)/)[1];seen.push(model);await body(req);
  if(model==='quota-a'){res.statusCode=429;res.end(JSON.stringify({error:{status:'RESOURCE_EXHAUSTED',details:[{violations:[{quotaId:'GenerateRequestsPerMinutePerProjectPerModel-FreeTier'}]},{retryDelay:'30s'}]}}));return;}
  if(model==='daily-b'){res.statusCode=429;res.end(JSON.stringify({error:{status:'RESOURCE_EXHAUSTED',details:[{violations:[{quotaId:'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}]}}));return;}
  res.end(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"ok":true}'}]}}]}));},async url=>{
  const now=Date.UTC(2026,9,26,8,0,0),request={key:'synthetic-secret',prompt:'x',schema:{type:'object'},endpoint:url},models=['quota-a','daily-b','spare-c'];
  assert.deepEqual(await geminiFallbackRequest({...request,models},()=>now),{model:'spare-c',output:{ok:true}});
  assert.deepEqual(availableModels(models,now+29000),['spare-c']);
  assert.deepEqual(availableModels(models,now+31000),['quota-a','spare-c']);
  assert.deepEqual(availableModels(models,Date.UTC(2026,9,27,7,0,1)),models);
  await assert.rejects(()=>geminiFallbackRequest({...request,models:['daily-b']},()=>now),e=>e instanceof GeminiError&&e.code==='quota');
 });
 assert.deepEqual(seen,['quota-a','daily-b','spare-c']);
});
test('non-quota provider errors do not switch models',async()=>{
 await endpoint((req,res)=>{res.statusCode=400;res.end('{}');},async url=>{
  await assert.rejects(()=>geminiFallbackRequest({key:'synthetic-secret',prompt:'x',schema:{type:'object'},endpoint:url,models:['bad-a','never-b']}),e=>e.providerStatus===400);
 });
});
