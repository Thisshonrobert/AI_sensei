const MODEL='gemini-3.1-flash-lite';
export class GeminiError extends Error {constructor(message,code='unavailable'){super(message);this.code=code;}}
export function providerConfiguration(env=process.env){
 const configured=!!env.GEMINI_API_KEY?.trim(),model=env.GEMINI_MODEL?.trim()||'';
 return {configured,model,freeTierConfirmed:env.GEMINI_FREE_TIER_CONFIRMED==='true',enabled:configured&&model===MODEL&&env.GEMINI_FREE_TIER_CONFIRMED==='true',reason:!configured?'Gemini key is not configured':model!==MODEL?'Configured model has not been verified for this integration':env.GEMINI_FREE_TIER_CONFIRMED!=='true'?'Confirm the API project shows Free Tier before enabling requests':null};
}
export async function geminiRequest({key,model,prompt,schema,endpoint='https://generativelanguage.googleapis.com',timeoutMs=25000,maxOutputTokens=6000}){
 if(model!==MODEL||!key||prompt.length>40000)throw new GeminiError('Generation configuration unavailable');
 // The endpoint override is only a server argument for local HTTP tests, never request input.
 if(endpoint!=='https://generativelanguage.googleapis.com'&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint))throw new GeminiError('Invalid provider endpoint');
 let response;
 try{response=await fetch(`${endpoint}/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens,temperature:0.3}}),signal:AbortSignal.timeout(timeoutMs)});}catch{throw new GeminiError('Generation timed out or could not connect. Try again later; saved practice remains available.','network');}
 if(!response.ok){await response.body?.cancel();throw new GeminiError(response.status===429?'Gemini quota unavailable. Pause generation; no paid fallback.':response.status===401||response.status===403?'Gemini key or project access was rejected.':'Gemini request failed. Retain the draft or retry later.',response.status===429?'quota':'provider');}
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>100000){await response.body.cancel().catch(()=>{});throw new GeminiError('Gemini output exceeded the size limit','output');}chunks.push(chunk);}
 let result;try{result=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new GeminiError('Gemini returned malformed structured output','output');}
 const candidate=result.candidates?.[0];if(candidate?.finishReason!=='STOP')throw new GeminiError('Gemini output was blocked or truncated','output');
 const text=candidate.content?.parts?.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');
 if(!text||text.length>60000)throw new GeminiError('Gemini returned no bounded draft','output');
 try{return JSON.parse(text);}catch{throw new GeminiError('Gemini returned invalid JSON','output');}
}
