import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, lstat, realpath, open } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';

const historyTables=new Set(['users','user_items','cards','study_sessions','session_items','attempts','review_logs']);
export function privateOutput(value){const root=resolve('private-data/backups'),path=resolve(value);const rel=relative(root,path);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw new Error('Output must be a new directory under private-data/backups');return path;}
export function restoreName(name,source){if(name===source||!/^ai_sensei_restore_[a-z0-9_]{1,64}$/.test(name))throw new Error('Restore requires a distinct ai_sensei_restore_ target');return name;}
function local(url){const u=new URL(url);if(!['localhost','127.0.0.1'].includes(u.hostname)||!/^\/[a-zA-Z0-9_]+$/.test(u.pathname))throw new Error('Recovery requires a local database');return u;}
export function databaseConnection(url){
 const u=new URL(url);
 if(['localhost','127.0.0.1'].includes(u.hostname))return local(url);
 if(!u.hostname.endsWith('.neon.tech')||u.protocol!=='postgresql:'||u.searchParams.get('sslmode')!=='require'||!/^\/[a-zA-Z0-9_]+$/.test(u.pathname))throw new Error('Remote recovery requires a Neon PostgreSQL connection with TLS');
 u.hostname=u.hostname.replace('-pooler.','.');return u;
}
async function guardedDirectory(value,create=false){
 const path=privateOutput(value),root=resolve('private-data/backups');
 if(create)await mkdir(root,{recursive:true});
 // Resolve existing ancestors; refuse junctions/symlinks that could expose private output.
 let at=root;for(const segment of relative(resolve('private-data'),path).split(/[\\/]/).slice(1)){try{if((await lstat(at)).isSymbolicLink())throw new Error('Linked backup directories are not supported');}catch(e){if(e.code!=='ENOENT')throw e;}at=resolve(at,segment);}
 const resolvedRoot=await realpath(root);if(resolvedRoot!==root)throw new Error('Backup root must not be redirected');
 if(create)await mkdir(path,{recursive:false});else if((await lstat(path)).isSymbolicLink())throw new Error('Linked backup directories are not supported');
 return path;
}
function containerFor(url){
 const id=spawnSync('docker',['compose','ps','--quiet','postgres'],{encoding:'utf8',windowsHide:true});
 if(id.status!==0||!/^[a-f0-9]{12,64}$/.test(id.stdout.trim()))throw new Error('Local PostgreSQL container unavailable');
 if(!['localhost','127.0.0.1'].includes(url.hostname))return id.stdout.trim();
 const port=spawnSync('docker',['compose','port','postgres','5432'],{encoding:'utf8',windowsHide:true});
 if(port.status!==0||!port.stdout.trim().endsWith(`:${url.port||'5432'}`))throw new Error('Configured database does not match the local container port');
 return id.stdout.trim();
}
async function pgStream(container,tool,args,file,url){
 const remote=url&&!['localhost','127.0.0.1'].includes(url.hostname);
 const connection=remote?{PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'require'}:{};
 const envArgs=Object.keys(connection).flatMap(key=>['--env',key]);
 const command=remote?`exec ${tool} "$@"`:`exec ${tool} --username="$POSTGRES_USER" "$@"`;
 const child=spawn('docker',['exec','-i',...envArgs,container,'sh','-c',command,'pg-tool',...args],{env:{...process.env,...connection},stdio:['pipe','pipe','pipe'],windowsHide:true});
 let diagnostic='';child.stderr.on('data',chunk=>{diagnostic+=chunk.toString();});
 const complete=new Promise((resolve,reject)=>{child.on('error',()=>reject(new Error('PostgreSQL tool unavailable')));child.on('close',code=>{if(code===0&&!diagnostic.trim())resolve();else{const error=new Error('PostgreSQL tool failed or reported warnings; no recovery success claimed');error.privateDiagnostic={tool,code,diagnostic};reject(error);}});});
 if(tool==='pg_dump'){child.stdin.end();await Promise.all([pipeline(child.stdout,createWriteStream(file,{flags:'wx'})),complete]);}
 else if(tool==='pg_restore'&&args.includes('--file=-')){await Promise.all([pipeline(createReadStream(file),child.stdin),pipeline(child.stdout,createWriteStream(file+'.sql',{flags:'wx'})),complete]);}
 else {child.stdout.resume();await Promise.all([pipeline(createReadStream(file),child.stdin),complete]);}
}
async function hashFile(path){const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);return hash.digest('hex');}
export async function inventory(db,exportFile){
 const tables=await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
 const output=exportFile?await open(exportFile,'wx'):null;const summary={};
 try{if(output)await output.write(JSON.stringify({format:'ai-sensei-history',version:1,recoveryArtifact:false})+'\n');
 for(const {tablename:table} of tables){
  if(!/^[a-z_]+$/.test(table))throw new Error('Unsupported table name');
  const hash=createHash('sha256');let count=0;
  while(true){
   const rows=await db.$queryRawUnsafe(`SELECT to_jsonb(t)::text AS row FROM "${table}" t ORDER BY to_jsonb(t)::text LIMIT $1 OFFSET $2`,500,count);
   for(const {row} of rows){hash.update(row+'\n');if(output&&historyTables.has(table))await output.write(JSON.stringify({table,record:JSON.parse(row)})+'\n');}
   count+=rows.length;if(rows.length<500)break;
  }
  summary[table]={count,sha256:hash.digest('hex')};
 }
 }finally{await output?.close();}
 return summary;
}
export async function backupDatabase(sourceUrl,output){
 const source=databaseConnection(sourceUrl),container=containerFor(source),directory=await guardedDirectory(output,true);
 const db=new PrismaClient({datasourceUrl:source.toString(),errorFormat:'minimal'});
 try{
  const tables=await db.$transaction(async tx=>{
   const [snapshot]=await tx.$queryRaw`SELECT pg_export_snapshot() AS id`;
   await pgStream(container,'pg_dump',['--format=custom','--no-acl',`--snapshot=${snapshot.id}`,'--dbname',source.pathname.slice(1)],resolve(directory,'database.dump'),source);
   return inventory(tx,resolve(directory,'history.jsonl'));
  },{isolationLevel:'RepeatableRead',timeout:180000});
  const manifest={format:'ai-sensei-backup',version:1,createdAt:new Date().toISOString(),sourceDatabase:source.pathname.slice(1),tables,dumpSha256:await hashFile(resolve(directory,'database.dump')),exportSha256:await hashFile(resolve(directory,'history.jsonl'))};
  await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return {directory,tableCount:Object.keys(tables).length};
 }finally{await db.$disconnect();}
}
export async function restoreDatabase(sourceUrl,input,target){
 const original=databaseConnection(sourceUrl),source=local(['localhost','127.0.0.1'].includes(original.hostname)?sourceUrl:await localDatabaseUrl('LOCAL_DATABASE_URL')),name=restoreName(target,original.pathname.slice(1)),container=containerFor(source),directory=await guardedDirectory(input);
 for(const file of ['manifest.json','database.dump','history.jsonl'])if((await lstat(resolve(directory,file))).isSymbolicLink())throw new Error('Linked recovery files are not supported');
 const manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
 if(manifest.format!=='ai-sensei-backup'||manifest.version!==1||manifest.sourceDatabase===name)throw new Error('Invalid recovery manifest or source target');
 if(await hashFile(resolve(directory,'database.dump'))!==manifest.dumpSha256||await hashFile(resolve(directory,'history.jsonl'))!==manifest.exportSha256)throw new Error('Recovery artifact hash mismatch');
 const adminUrl=new URL(source);adminUrl.pathname='/postgres';const admin=new PrismaClient({datasourceUrl:adminUrl.toString(),errorFormat:'minimal'});
 try{const exists=await admin.$queryRaw`SELECT 1 FROM pg_database WHERE datname=${name}`;if(exists.length)throw new Error('Restore target already exists; refusing overwrite');await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);}finally{await admin.$disconnect();}
 await pgStream(container,'pg_restore',['--no-owner','--no-acl','--exit-on-error','--single-transaction','--dbname',name],resolve(directory,'database.dump'));
 const targetUrl=new URL(source);targetUrl.pathname=`/${name}`;targetUrl.searchParams.delete('schema');const db=new PrismaClient({datasourceUrl:targetUrl.toString(),errorFormat:'minimal'});
 try{
  const actual=await inventory(db);
  if(JSON.stringify(actual)!==JSON.stringify(manifest.tables))throw new Error('Restored records do not match the snapshot');
  const report={verifiedAt:new Date().toISOString(),targetDatabase:name,allTablesMatch:true,tableCount:Object.keys(actual).length,historyRows:actual.review_logs?.count||0};
  await writeFile(resolve(directory,`restore-${name}.json`),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return report;
 }finally{await db.$disconnect();}
}
export async function restoreEmptyNeon(targetUrl,input){
 const target=databaseConnection(targetUrl);if(!target.hostname.endsWith('.neon.tech'))throw new Error('Expected a Neon target');
 const directory=await guardedDirectory(input),manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
 if(manifest.format!=='ai-sensei-backup'||manifest.version!==1||await hashFile(resolve(directory,'database.dump'))!==manifest.dumpSha256)throw new Error('Invalid migration backup');
 const db=new PrismaClient({datasourceUrl:target.toString(),errorFormat:'minimal'});
 try{
  const [objects]=await db.$queryRaw`SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') AS count`;
  if(Number(objects.count)!==0)throw new Error('Neon target is not empty; refusing overwrite');
  const container=containerFor(target),dump=resolve(directory,'database.dump');
  const [version]=await db.$queryRaw`SELECT current_setting('server_version_num')::int AS version`;
  if(version.version<170000){
   // PostgreSQL 17 pg_restore emits this setting even for older target versions.
   // Remove only that unsupported header statement; restore all records/guards.
   await pgStream(container,'pg_restore',['--no-owner','--no-acl','--file=-'],dump);
   const sql=await readFile(dump+'.sql','utf8'),setting='SET transaction_timeout = 0;';
   const position=sql.indexOf(setting);if(position<0||position>3000)throw new Error('Unexpected restore SQL header');
   await writeFile(dump+'.compatible.sql',sql.slice(0,position)+sql.slice(position+setting.length),{flag:'wx'});
   await pgStream(container,'psql',['--no-psqlrc','--set','ON_ERROR_STOP=on','--single-transaction','--dbname',target.pathname.slice(1)],dump+'.compatible.sql',target);
  }else await pgStream(container,'pg_restore',['--no-owner','--no-acl','--exit-on-error','--single-transaction','--dbname',target.pathname.slice(1)],dump,target);
  const actual=await inventory(db);if(JSON.stringify(actual)!==JSON.stringify(manifest.tables))throw new Error('Neon records do not match the backup');
  await writeFile(resolve(directory,'neon-transfer-verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),allTablesMatch:true,tableCount:Object.keys(actual).length}),{flag:'wx'});
  return {allTablesMatch:true,tableCount:Object.keys(actual).length};
 }finally{await db.$disconnect();}
}
export async function run(args=process.argv.slice(2)){
 const [action,directory,target]=args;
 if(action==='backup'&&directory&&!target){const result=await backupDatabase(await localDatabaseUrl(),directory);console.log(JSON.stringify({backupCreated:true,tableCount:result.tableCount,privateOutput:directory}));}
 else if(action==='restore'&&directory&&target)console.log(JSON.stringify(await restoreDatabase(await localDatabaseUrl(),directory,target)));
 else if(action==='verify'){const directory=`private-data/backups/check-${randomUUID()}`;await backupDatabase(await localDatabaseUrl(),directory);const result=await restoreDatabase(await localDatabaseUrl(),directory,`ai_sensei_restore_${randomUUID().replaceAll('-','')}`);console.log(JSON.stringify({...result,privateOutput:directory}));}
 else throw new Error('Usage: backup <private-directory> | restore <private-directory> <new-ai_sensei_restore_name> | verify');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)run().catch(error=>{console.error(error.message==='Restore target already exists; refusing overwrite'?'Restore target already exists; refusing overwrite. No database was replaced.':'Recovery failed. The study database was not replaced. Inspect private artifacts; do not rely on an unverified restore.');process.exitCode=1;});
