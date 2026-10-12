import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'node:net';
import { localDatabaseUrl } from './canonical-import.mjs';
async function run(){
 const base=new URL(await localDatabaseUrl('LOCAL_DATABASE_URL'));
 if(!['127.0.0.1','localhost'].includes(base.hostname))throw new Error('Isolated local target required');
 const name=`ai_sensei_generation_test_${randomUUID().replaceAll('-','')}`,adminUrl=new URL(base);adminUrl.pathname='/postgres';
 const admin=new PrismaClient({datasourceUrl:adminUrl.toString(),errorFormat:'minimal'});
 try{await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);}finally{await admin.$disconnect();}
 base.pathname=`/${name}`;base.searchParams.delete('schema');const browser=process.argv.includes('--browser');
 const port=browser?await new Promise((accept,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>accept(String(p)));});}):null;
 const env={...process.env,DATABASE_URL:base.toString(),GENERATION_TEST_URL:base.toString(),...(browser?{GENERATION_BROWSER_TEST:'1',PLAYWRIGHT_PORT:port}:{})};
 await mkdir('.local',{recursive:true});const command=(file,args)=>spawnSync(process.execPath,[file,...args],{env,encoding:'utf8'});
 const migration=command('node_modules/prisma/build/index.js',['migrate','deploy']);await writeFile('.local/generation-migration.log',migration.stdout+migration.stderr);
 if(migration.status!==0)throw new Error('Isolated migration failed');
 const result=command('--test',['tests/generation-postgres.test.mjs']);await writeFile('.local/generation-results.log',result.stdout+result.stderr);console.log(result.stdout);
 await writeFile('.local/generation-test-target.json',JSON.stringify({database:name,testExit:result.status}));
 if(result.status!==0){process.exitCode=1;return;}
 if(browser){const checked=command('node_modules/@playwright/test/cli.js',['test','tests/browser/generation.spec.ts']);await writeFile('.local/generation-browser.log',checked.stdout+checked.stderr);console.log(checked.stdout);process.exitCode=checked.status||0;}
}
run().catch(()=>{console.error('Generation verification failed; diagnostics are in ignored .local logs. No real library was reset.');process.exitCode=1;});
