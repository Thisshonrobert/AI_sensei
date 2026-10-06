import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';

const base=new URL(await localDatabaseUrl());
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
  const result=browserMode?run('--test',['--test-name-pattern=pool is dormant','tests/review-postgres.test.mjs']):run('tests/review-postgres.test.mjs',[]);
  await writeFile('.local/review-test-results.log',result.stdout+result.stderr);
  // Test fixtures are synthetic; do not print database errors or connection URLs.
  console.log(result.stdout);process.exitCode=result.status||0;
  await writeFile('.local/review-test-target.json',JSON.stringify({database:name,testExit:result.status},null,2));
  console.log(JSON.stringify({migrationExit:migration.status,testExit:result.status,retainedForInspection:true}));
  if(result.status===0&&process.argv.includes('--browser')){
   env.REVIEW_BROWSER_TEST='1';
   const browser=run('node_modules/@playwright/test/cli.js',['test','tests/browser/review.spec.ts']);
   await writeFile('.local/review-browser-results.log',browser.stdout+browser.stderr);
   console.log(browser.stdout);process.exitCode=browser.status||0;
  }
 }
}
