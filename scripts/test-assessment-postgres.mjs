import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';
import { databaseConnection } from './backup.mjs';
async function run(){
 const remote=process.argv.includes('--neon');
 const base=remote?databaseConnection(await localDatabaseUrl('POSTGRES_DATABASE_URL')):new URL(await localDatabaseUrl('LOCAL_DATABASE_URL'));
 if(remote?!base.hostname.endsWith('.neon.tech'):!['127.0.0.1','localhost'].includes(base.hostname))throw new Error('Explicit isolated target required');
 const name=`ai_sensei_assessment_test_${randomUUID().replaceAll('-','')}`,adminUrl=new URL(base);adminUrl.pathname='/postgres';
 const admin=new PrismaClient({datasourceUrl:adminUrl.toString(),errorFormat:'minimal'});
 try{await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);}finally{await admin.$disconnect();}
 base.pathname=`/${name}`;base.searchParams.delete('schema');
 const browser=process.argv.includes('--browser');if(remote&&browser)throw new Error('Browser fixtures use local targets');
 const env={...process.env,DATABASE_URL:base.toString(),ASSESSMENT_TEST_URL:base.toString(),...(browser?{ASSESSMENT_BROWSER_TEST:'1',PLAYWRIGHT_PORT:'3101'}:{})};
 await mkdir('.local',{recursive:true});
 const command=(file,args)=>spawnSync(process.execPath,[file,...args],{env,encoding:'utf8'});
 const migration=command('node_modules/prisma/build/index.js',['migrate','deploy']);await writeFile('.local/assessment-migration.log',migration.stdout+ migration.stderr);
 if(migration.status!==0)throw new Error('Isolated migration failed');
 const result=command('--test',['tests/assessment-postgres.test.mjs']);await writeFile('.local/assessment-results.log',result.stdout+result.stderr);
 // Only synthetic fixture stdout is shown; private diagnostics stay in ignored files.
 console.log(result.stdout);await writeFile('.local/assessment-test-target.json',JSON.stringify({database:name,testExit:result.status}));
 if(result.status!==0){process.exitCode=1;return;}
 if(browser){const checked=command('node_modules/@playwright/test/cli.js',['test','tests/browser/assessment.spec.ts']);await writeFile('.local/assessment-browser.log',checked.stdout+checked.stderr);console.log(checked.stdout);process.exitCode=checked.status||0;}
}
run().catch(()=>{console.error('Assessment isolated verification failed; see ignored .local logs. No real study database was reset.');process.exitCode=1;});
