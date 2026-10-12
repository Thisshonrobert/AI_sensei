import { mkdir,writeFile,rename } from 'node:fs/promises';
import { createHash,randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseJmdict,DICTIONARY_ROOT,JMDICT_URL } from '../src/lib/server/generation/dictionary.mjs';

export async function updateDictionary(){
 const response=await fetch(JMDICT_URL,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error('Official download failed');
 const compressed=Buffer.from(await response.arrayBuffer());if(compressed.length>40*1024*1024)throw new Error('Unexpected dictionary size');
 const source=gunzipSync(compressed,{maxOutputLength:180*1024*1024}),sha256=createHash('sha256').update(source).digest('hex');
 const entries=parseJmdict(source.toString('utf8'));if(entries.length<100000)throw new Error('Incomplete official dictionary');
 const licence=await fetch('https://www.edrdg.org/edrdg/licence.html',{signal:AbortSignal.timeout(30000)});if(!licence.ok)throw new Error('Official licence download failed');
 const licenceText=await licence.text();if(!licenceText.includes('Updating Dictionary Versions'))throw new Error('Unexpected licence document');
 const metadata={version:1,sha256,updatedAt:new Date().toISOString(),source:JMDICT_URL,sourceLastModified:response.headers.get('last-modified'),entries:entries.length,licence:'CC BY-SA 4.0',transform:'English lookup index retaining reading and sense restrictions; not contextual verification'};
 await installDictionary(entries,metadata,licenceText);
 console.log(`Local JMdict installed: ${entries.length} entries; updated ${metadata.updatedAt.slice(0,10)}. No application database writes.`);
}
export async function installDictionary(entries,metadata,licenceText,root=DICTIONARY_ROOT){
 const index=Object.create(null),lines=[];let offset=0;
 for(const entry of entries){const line=JSON.stringify(entry),length=Buffer.byteLength(line);lines.push(line);for(const form of new Set([...entry.spellings,...entry.readings.map(r=>r.text)]))(index[form]??=[]).push([offset,length]);offset+=length+1;}
 const edition=`${metadata.sha256}-${randomUUID()}`,directory=join(root,`.pending-${randomUUID()}`);await mkdir(directory,{recursive:true});
 // Immutable edition plus atomic pointer: a failed update preserves the last edition.
 await writeFile(join(directory,'entries.jsonl'),lines.join('\n')+'\n');await writeFile(join(directory,'index.json'),JSON.stringify(index));
 metadata={...metadata,edition};
 await writeFile(join(directory,'metadata.json'),JSON.stringify(metadata,null,2));
 await writeFile(join(directory,'EDRDG-licence.html'),licenceText);
 await writeFile(join(directory,'ATTRIBUTION.txt'),'JMdict © James William Breen and the Electronic Dictionary Research and Development Group. English lookup index derived from JMdict, CC BY-SA 4.0.\nProject: https://www.edrdg.org/jmdict/j_jmdict.html\nLicence: https://www.edrdg.org/edrdg/licence.html\nhttps://creativecommons.org/licenses/by-sa/4.0/\nUpdate monthly using: rtk proxy node scripts/update-reader-dictionary.mjs\n');
 await rename(directory,join(root,edition));
 const pointer=join(root,`current-${randomUUID()}.json`);await writeFile(pointer,JSON.stringify(metadata));await rename(pointer,join(root,'current.json'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)updateDictionary().catch(()=>{console.error('JMdict update failed. Previous edition retained; no application database writes.');process.exitCode=1;});
