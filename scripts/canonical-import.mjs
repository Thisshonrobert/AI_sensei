import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { previewPromotion, previewBatch, confirmEdition, recordApproval, promote } from '../src/lib/server/content/canonical-import.mjs';

export async function localDatabaseUrl(name='DATABASE_URL'){
 if(!['DATABASE_URL','LOCAL_DATABASE_URL','POSTGRES_DATABASE_URL'].includes(name))throw new Error('Unsupported connection setting');
 if(process.env[name])return process.env[name];
 const env=await readFile('.env','utf8');
 const match=new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`,'m').exec(env);
 if(!match&&name==='LOCAL_DATABASE_URL')return localDatabaseUrl();
 if(!match)throw new Error('Database connection setting missing');
 return match[1].replace(/^['"]|['"]$/g,'');
}
export async function run(args=process.argv.slice(2)){
 const [mode,...rest]=args;
 if(!['inventory','edition','preview','approve','promote'].includes(mode)||rest.length%2)throw new Error('Usage: canonical-import.mjs inventory|edition|preview|approve|promote with explicit named options; see docs/database-import.md');
 const opts={};
 for(let i=0;i<rest.length;i+=2){
  if(!['--selection','--output','--record','--confirm','--reviewer','--batch','--source','--edition'].includes(rest[i])||opts[rest[i]])throw new Error('Unknown or duplicate option');
  opts[rest[i]]=rest[i+1];
 }
 if(!['inventory','edition'].includes(mode)&&!opts['--selection'])throw new Error('Explicit private selection path required');
 const selection=opts['--selection']?JSON.parse(await readFile(opts['--selection'],'utf8')):null;
 const db=new PrismaClient({datasourceUrl:await localDatabaseUrl(),errorFormat:'minimal'});
 try{
  if(mode==='edition')console.log(JSON.stringify(await confirmEdition(db,opts['--source'],opts['--edition'],opts['--confirm'],opts['--reviewer'])));
  else if(mode==='preview'||mode==='inventory'){
   const result=mode==='inventory'?await previewBatch(db,opts['--batch']):await previewPromotion(db,selection);
   if(!opts['--output']||!resolve(opts['--output']).startsWith(resolve('private-data')+'\\'))throw new Error('Preview output must be under ignored private-data');
   await writeFile(opts['--output'],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
   console.log(JSON.stringify({batchId:result.batchId,records:result.records.length,alreadyApproved:result.records.filter(r=>r.approved).length,output:opts['--output']}));
  }else if(mode==='approve'){
   const result=await recordApproval(db,selection,opts['--record'],opts['--confirm'],opts['--reviewer']);
   console.log(JSON.stringify(result));
  }else console.log(JSON.stringify(await promote(db,selection)));
 }finally{await db.$disconnect();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)run().catch(error=>{
 // Database error objects may include payloads, URLs and SQL; print safe classification only.
 console.error(error.code?`Canonical import failed (${error.code}); no transaction committed.`:error.message.startsWith('Invalid `')?'Canonical import failed; inspect privately.':error.message);
 process.exitCode=1;
});
