import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';
import { backupDatabase, restoreDatabase } from './backup.mjs';
import { createUser, syncCards, LOCAL_USER_ID } from '../src/lib/server/review/service.mjs';

const base=new URL(await localDatabaseUrl('LOCAL_DATABASE_URL'));
if(!['127.0.0.1','localhost'].includes(base.hostname))throw new Error('Review tests require localhost');
const name=`ai_sensei_review_test_${randomUUID().replaceAll('-','')}`;
const adminUrl=new URL(base);adminUrl.pathname='/postgres';
const admin=new PrismaClient({datasourceUrl:adminUrl.toString(),errorFormat:'minimal'});
try {await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);} catch(e){console.error('Isolated test database unavailable:',e.code||e.name);process.exitCode=1;} finally {await admin.$disconnect();}
if(!process.exitCode){
 base.pathname=`/${name}`;base.searchParams.delete('schema');
 const env={...process.env,DATABASE_URL:base.toString(),REVIEW_TEST_URL:base.toString()};
 const run=(file,args)=>spawnSync(process.execPath,[file,...args],{env,encoding:'utf8'});
 await mkdir('.local',{recursive:true});
 const migration=run('node_modules/prisma/build/index.js',['migrate','deploy']);
 await writeFile('.local/review-test-migration.log',migration.stdout+ migration.stderr);
 if(migration.status!==0){console.error('Review migration failed; see ignored .local/review-test-migration.log');process.exitCode=1;}
 else {
  const browserMode=process.argv.includes('--browser');
  const filter=process.argv.find(a=>a.startsWith('--filter='));
  const result=browserMode?run('--test',['--test-name-pattern=pool is dormant|approved grammar comparisons|source-complete core creates','tests/review-postgres.test.mjs']):filter?run('--test',[`--test-name-pattern=${filter.slice(9)}`,'tests/review-postgres.test.mjs']):run('tests/review-postgres.test.mjs',[]);
  await writeFile('.local/review-test-results.log',result.stdout+result.stderr);
  // Test fixtures are synthetic; do not print database errors or connection URLs.
  console.log(result.stdout);process.exitCode=result.status||0;
  await writeFile('.local/review-test-target.json',JSON.stringify({database:name,testExit:result.status},null,2));
  console.log(JSON.stringify({migrationExit:migration.status,testExit:result.status,retainedForInspection:true}));
  if(result.status===0&&process.argv.includes('--recovery')){
   const output=`private-data/backups/synthetic-${randomUUID()}`;
   await backupDatabase(base.toString(),output);
   const restore=await restoreDatabase(base.toString(),output,`ai_sensei_restore_${randomUUID().replaceAll('-','')}`);
   if(!restore.historyRows)throw new Error('Synthetic recovery must contain review history');
   console.log(JSON.stringify({syntheticRecovery:restore.allTablesMatch,historyPresent:true,tableCount:restore.tableCount}));
  }
  if(result.status===0&&process.argv.includes('--browser')){
   const seed=new PrismaClient({datasourceUrl:base.toString(),errorFormat:'minimal'});
   try{await createUser(seed);const user=await seed.user.findUnique({where:{id:LOCAL_USER_ID}});await seed.user.update({where:{id:LOCAL_USER_ID},data:{settingsJson:{...user.settingsJson,newCardLimits:{vocabulary:5,kanji:0,grammar:0,total:8}}}});await syncCards(seed,LOCAL_USER_ID);}finally{await seed.$disconnect();}
   env.REVIEW_BROWSER_TEST='1';
   env.PLAYWRIGHT_PORT='3100';
   const browser=run('node_modules/@playwright/test/cli.js',['test','tests/browser/review.spec.ts','tests/browser/browse.spec.ts',...(process.argv.includes('--browse-only')?['--grep=read-only flashcards']:[])]);
   await writeFile('.local/review-browser-results.log',browser.stdout+browser.stderr);
   console.log(browser.stdout);process.exitCode=browser.status||0;
  }
 }
}
