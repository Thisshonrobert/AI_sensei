import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {localDatabaseUrl} from './canonical-import.mjs';
import {backupDatabase,restoreDatabase,databaseConnection} from './backup.mjs';

const commands={load:'scripts/import-batches.mjs',canonical:'scripts/canonical-import.mjs',backup:'scripts/backup.mjs'};
export function validateTarget(target,value){
 const url=new URL(value);
 if(url.protocol!=='postgresql:'||!/^\/[a-zA-Z0-9_]+$/.test(url.pathname))throw new Error('Expected PostgreSQL database connection');
 if(target==='local'&&['localhost','127.0.0.1'].includes(url.hostname))return value;
 if(target==='neon'&&url.hostname.endsWith('.neon.tech')&&url.searchParams.get('sslmode')==='require')return value;
 throw new Error('Database does not match the explicit local or Neon target');
}
export async function refreshLocal(){
 const neon=validateTarget('neon',await localDatabaseUrl('POSTGRES_DATABASE_URL'));
 const local=validateTarget('local',await localDatabaseUrl('LOCAL_DATABASE_URL'));
 const directory=`private-data/backups/local-refresh-${randomUUID()}`;
 await backupDatabase(neon,directory);
 const name=`ai_sensei_restore_${randomUUID().replaceAll('-','')}`;
 const restored=await restoreDatabase(neon,directory,name);
 if(!restored.allTablesMatch)throw new Error('Local refresh verification failed');
 const next=new URL(local);next.pathname=`/${name}`;
 let env=await readFile('.env','utf8');
 for(const key of ['DATABASE_URL','LOCAL_DATABASE_URL']){
  const expression=new RegExp(`^\\s*${key}\\s*=.*$`,'m');
  if(!expression.test(env))throw new Error('Explicit local connection settings required');
  env=env.replace(expression,()=>`${key}=${JSON.stringify(next.toString())}`);
 }
 const temporary='.env.local-refresh.tmp';await writeFile(temporary,env,{flag:'wx'});await rename(temporary,'.env');
 return {localSnapshotVerified:true,tableCount:restored.tableCount,previousDatabasePreserved:true,restartRequired:true,privateBackup:directory};
}
export async function run(args=process.argv.slice(2)){
 const [target,command,...rest]=args;
 if(target==='refresh-local'&&args.length===1){console.log(JSON.stringify(await refreshLocal()));return;}
 if(!['local','neon'].includes(target)||!Object.hasOwn(commands,command))throw new Error('Usage: local|neon load|canonical|backup <existing command options> OR refresh-local');
 const selected=validateTarget(target,await localDatabaseUrl(target==='local'?'LOCAL_DATABASE_URL':'POSTGRES_DATABASE_URL'));
 const url=target==='neon'?databaseConnection(selected).toString():selected;
 // Child process receives credentials only through its environment, never arguments.
 const code=await new Promise((accept,reject)=>{
  const child=spawn(process.execPath,[commands[command],...rest],{env:{...process.env,DATABASE_URL:url},stdio:'inherit',windowsHide:true});
  child.on('error',()=>reject(new Error('Database command unavailable')));child.on('close',code=>accept(code??1));
 });
 if(code!==0)throw new Error('Database command failed; inspect its private artifacts');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)run().catch(()=>{console.error('Database operation failed. Existing databases were not replaced; inspect private artifacts.');process.exitCode=1;});
