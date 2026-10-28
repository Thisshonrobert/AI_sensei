const DEFAULT_MODEL='gemini-2.5-flash';
// Any Google model ID is allowed; the shape check keeps the ID safe inside the request path.
const MODEL_ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export class GeminiError extends Error {constructor(message,code='unavailable'){super(message);this.code=code;}}
export function normalizeModelId(value){
 const model=typeof value==='string'?value.trim().replace(/^models\//i,''):'';
 return MODEL_ID.test(model)?model:null;
}
// Thinking models spend tokens and latency before the answer. The first supported setting is used;
// a setting the model rejects falls through to the next candidate, ending with the provider default.
function thinkingCandidates(model){
 if(/^gemini-2\.5-pro([.-]|$)/.test(model))return [{thinkingBudget:128},{}];
 if(/^gemini-2\.5-/.test(model))return [{thinkingBudget:0},{}];
 if(/^gemini-(?:3|4)(?:[.-]|$)/.test(model))return [{thinkingLevel:'low'},{thinkingLevel:'minimal'},{thinkingBudget:0},{}];
 return [{}];
}
function requestFailure(status){
 return new GeminiError(status===429?'Gemini quota unavailable. Pause generation; no paid fallback.':status===401||status===403?'Gemini key or project access was rejected.':status===404?'Gemini model is unavailable for this API key. Check GEMINI_MODEL.':'Gemini request failed. Retain the draft or retry later.',status===429?'quota':'provider');
}
// GEMINI_MODELS is an ordered, comma-separated fallback list; GEMINI_MODEL remains the single-model form.
export function providerConfiguration(env=process.env){
 const listed=(env.GEMINI_MODELS?.trim()||env.GEMINI_MODEL?.trim()||DEFAULT_MODEL).split(',').map(m=>m.trim()).filter(Boolean),normalized=listed.map(normalizeModelId);
 const models=normalized.every(Boolean)?[...new Set(normalized)]:[],model=models[0]||'',configured=!!env.GEMINI_API_KEY?.trim(),freeTierConfirmed=env.GEMINI_FREE_TIER_CONFIRMED==='true';
 return {configured,model,models,freeTierConfirmed,enabled:configured&&!!model&&freeTierConfirmed,reason:!configured?'Gemini key is not configured':!model?`GEMINI_MODEL and GEMINI_MODELS must hold Google model IDs such as ${DEFAULT_MODEL}`:!freeTierConfirmed?'Confirm the API project shows Free Tier before enabling requests':null};
}
// Free-tier quotas are per project and per model, so an exhausted or overloaded model rests while the next one answers.
// ponytail: in-memory cooldowns reset on server restart; the cost is one extra rejected call per model.
const cooldowns=new Map();
const nextPacificMidnight=now=>{const pacific=new Date(new Date(now).toLocaleString('en-US',{timeZone:'America/Los_Angeles'})),midnight=new Date(pacific);midnight.setHours(24,0,0,0);return now+(midnight-pacific);};
export function availableModels(models,now=Date.now()){return models.filter(m=>!(cooldowns.get(m)>now));}
export async function geminiFallbackRequest({models,...request},now=()=>Date.now()){
 let last;
 for(const model of availableModels(models,now())){
  try{return {model,output:await geminiRequest({...request,model})};}catch(e){
   if(!(e instanceof GeminiError)||![429,503,404].includes(e.providerStatus))throw e;
   cooldowns.set(model,e.daily?nextPacificMidnight(now()):now()+(e.retryAfterMs||60000));last=e;
  }
 }
 throw last||new GeminiError('Every configured Gemini model is resting after quota or availability limits. Try again later; saved practice remains available.','quota');
}
export async function geminiRequest({key,model,prompt,schema,endpoint='https://generativelanguage.googleapis.com',timeoutMs=45000,maxOutputTokens=6000}){
 const modelId=normalizeModelId(model);
 if(!modelId||!key||prompt.length>40000)throw new GeminiError('Generation configuration unavailable');
 // The endpoint override is only a server argument for local HTTP tests, never request input.
 if(endpoint!=='https://generativelanguage.googleapis.com'&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint))throw new GeminiError('Invalid provider endpoint');
 let response;
 for(const thinking of thinkingCandidates(modelId)){
  const generationConfig={responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens,temperature:0.3};
  if(Object.keys(thinking).length)generationConfig.thinkingConfig=thinking;
  // A 5xx means the provider did not answer; retry the same call briefly, then report.
  for(let transient=0;transient<=2;transient++){
   try{response=await fetch(`${endpoint}/v1beta/models/${modelId}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig}),signal:AbortSignal.timeout(timeoutMs)});}catch{throw new GeminiError('Generation timed out or could not connect. Try again later; saved practice remains available.','network');}
   if(response.ok)break;
   const status=response.status;
   if([500,502,503,504].includes(status)&&transient<2){await response.body?.cancel().catch(()=>{});response=null;await new Promise(r=>setTimeout(r,1000*(transient+1)));continue;}
   const rejection=await response.text().catch(()=>'');
   // Only a rejected thinking setting is retried; quota, auth, model and 4xx/5xx errors never are.
   if(status!==400||!/think/i.test(rejection)||!Object.keys(thinking).length){const error=requestFailure(status);error.providerStatus=status;try{const body=JSON.parse(rejection),details=body?.error?.details||[];if(body?.error?.status)error.providerCode=body.error.status;const delay=details.find(d=>d.retryDelay)?.retryDelay;if(delay)error.retryAfterMs=parseFloat(delay)*1000;error.daily=details.some(d=>d.violations?.some(v=>/PerDay/i.test(v.quotaId||'')));}catch{}throw error;}
   response=null;break;
  }
  if(response)break;
 }
 if(!response)throw new GeminiError('Gemini request failed. Retain the draft or retry later.','provider');
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>100000){await response.body.cancel().catch(()=>{});throw new GeminiError('Gemini output exceeded the size limit','output');}chunks.push(chunk);}
 let result;try{result=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new GeminiError('Gemini returned malformed structured output','output');}
 const candidate=result.candidates?.[0];if(candidate?.finishReason!=='STOP')throw new GeminiError('Gemini output was blocked or truncated','output');
 const text=candidate.content?.parts?.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');
 if(!text||text.length>60000)throw new GeminiError('Gemini returned no bounded draft','output');
 try{return JSON.parse(text);}catch{throw new GeminiError('Gemini returned invalid JSON','output');}
}
