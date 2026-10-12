import { readFile,open } from 'node:fs/promises';
import { join } from 'node:path';

export const DICTIONARY_ROOT=join(process.cwd(),'private-data','dictionary');
export const JMDICT_URL='https://www.edrdg.org/pub/Nihongo/JMdict_e.gz';
let currentIndex;

// Read only the documented JMdict entry format. No external entity resolution,
// network access, general XML evaluation, or Japanese parsing occurs here.
export function parseJmdict(input){
 if(/<!ENTITY\s+[^>]*(?:SYSTEM|PUBLIC)|<!DOCTYPE\s+[^\[]*(?:SYSTEM|PUBLIC)/i.test(input))throw new Error('External XML entities are forbidden');
 const xml=input.replace(/<!--[\s\S]*?-->/g,'');
 if(!xml.includes('<JMdict>')||!xml.includes('</JMdict>'))throw new Error('Invalid JMdict document');
 const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",...Object.fromEntries([...xml.matchAll(/<!ENTITY\s+([\w-]+)\s+"([^"]*)"\s*>/g)].map(m=>[m[1],m[2]]))};
 const decode=value=>value.replace(/&(#x[0-9a-f]+|#\d+|[\w-]+);/gi,(_,key)=>{if(key.startsWith('#'))return String.fromCodePoint(key[1]==='x'?parseInt(key.slice(2),16):Number(key.slice(1)));if(!(key in entities))throw new Error('Unknown XML entity');return entities[key];});
 const tags=(body,tag)=>[...body.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`,'g'))].map(m=>decode(m[1].replace(/<pri>([\s\S]*?)<\/pri>/g,'$1')));
 const entries=[];
 for(const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)){
  const body=match[1],id=tags(body,'ent_seq')[0],spellings=tags(body,'keb');
  const readings=[...body.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)].map(m=>({text:tags(m[1],'reb')[0],restrict:tags(m[1],'re_restr'),noKanji:/<re_nokanji\s*\/?\s*>/.test(m[1]),info:tags(m[1],'re_inf')}));
  let pos=[];const senses=[...body.matchAll(/<sense>([\s\S]*?)<\/sense>/g)].map(m=>{
   const next=tags(m[1],'pos');if(next.length)pos=next;
   const meanings=[...m[1].matchAll(/<gloss([^>]*)>([\s\S]*?)<\/gloss>/g)].filter(g=>!g[1].includes('xml:lang=')||/xml:lang="eng"/.test(g[1])).map(g=>decode(g[2].replace(/<pri>([\s\S]*?)<\/pri>/g,'$1')));
   return {meanings,pos:[...pos],spellings:tags(m[1],'stagk'),readings:tags(m[1],'stagr'),notes:[...tags(m[1],'s_inf'),...tags(m[1],'misc'),...tags(m[1],'field'),...tags(m[1],'dial')]};
  });
  if(!/^\d+$/.test(id)||!readings.length||readings.some(r=>!r.text)||!senses.length)throw new Error('Malformed JMdict entry');
  entries.push({id,spellings,readings,senses});
 }
 if(!entries.length||entries.length!==(xml.match(/<entry>/g)||[]).length)throw new Error('Incomplete JMdict entries');
 return entries;
}

export function dictionaryCandidates(entries,form){
 return entries.flatMap(e=>{
  const isSpelling=e.spellings.includes(form);
  if(!isSpelling&&!e.readings.some(r=>r.text===form))return [];
  const readings=e.readings.filter(r=>isSpelling?!r.noKanji&&(!r.restrict.length||r.restrict.includes(form)):r.text===form).map(r=>r.text);
  const senses=e.senses.filter(s=>(!isSpelling||!s.spellings.length||s.spellings.includes(form))&&(!s.readings.length||s.readings.some(r=>readings.includes(r)))).map(s=>({...s,readings:s.readings.length?s.readings.filter(r=>readings.includes(r)):readings}));
  return readings.length&&senses.length?[{id:e.id,form,readings,senses}]:[];
 });
}

export async function localDictionary(){
 try{
  const metadata=JSON.parse(await readFile(join(DICTIONARY_ROOT,'current.json'),'utf8'));
  if(metadata.version!==1||! /^[a-f0-9]{64}$/.test(metadata.sha256)||!Number.isFinite(Date.parse(metadata.updatedAt)))throw new Error('Invalid dictionary metadata');
  const edition=metadata.edition||metadata.sha256;if(!/^[a-f0-9]{64}(?:-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})?$/.test(edition))throw new Error('Invalid dictionary edition');
  if(currentIndex?.edition!==edition)currentIndex={edition,forms:JSON.parse(await readFile(join(DICTIONARY_ROOT,edition,'index.json'),'utf8'))};
  const index=currentIndex.forms;
  return {metadata:{...metadata,status:'ready',stale:Date.now()-Date.parse(metadata.updatedAt)>30*86400000},lookup:async form=>{
   if(typeof form!=='string'||form.length>80)return [];
   const refs=Object.hasOwn(index,form)?index[form]:[];if(!refs.length)return [];
   const file=await open(join(DICTIONARY_ROOT,edition,'entries.jsonl'),'r');
   try{
    const entries=[];for(const [position,length] of refs.slice(0,16)){
     if(!Number.isSafeInteger(position)||position<0||!Number.isSafeInteger(length)||length<1||length>200000)throw new Error('Invalid dictionary offset');
     const buffer=Buffer.alloc(length),result=await file.read(buffer,0,length,position);if(result.bytesRead!==length)throw new Error('Incomplete dictionary record');entries.push(JSON.parse(buffer.toString('utf8')));
    }
    const candidates=dictionaryCandidates(entries,form);candidates.truncated=refs.length>16;return candidates;
   }finally{await file.close();}
  }};
 }catch{return {metadata:{status:'unavailable'},lookup:async()=>[]};}
}
