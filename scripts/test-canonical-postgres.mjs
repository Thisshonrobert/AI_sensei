import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';

// Create a fresh database, never reset/truncate or run synthetic writes in staging.
const base=new URL(await localDatabaseUrl());
if(!['127.0.0.1','localhost'].includes(base.hostname))throw new Error('Tests require localhost PostgreSQL');
const name=`ai_sensei_canonical_test_${randomUUID().replaceAll('-','')}`;
if(!/^ai_sensei_canonical_test_[a-f0-9]{32}$/.test(name))throw new Error('Invalid isolated test name');
const admin=new URL(base);admin.pathname='/postgres';
const db=new PrismaClient({datasourceUrl:admin.toString(),errorFormat:'minimal'});
try{await db.$executeRawUnsafe(`CREATE DATABASE "${name}"`);}catch(e){console.error('Cannot create isolated test database',e.code||e.name);process.exit(1);}finally{await db.$disconnect();}
base.pathname=`/${name}`;base.searchParams.delete('schema');
const env={...process.env,DATABASE_URL:base.toString(),CANONICAL_TEST_URL:base.toString()};
const run=(file,args)=>spawnSync(process.execPath,[file,...args],{env,encoding:'utf8'});
const migration=run('node_modules/prisma/build/index.js',['migrate','deploy']);
await writeFile('.local/canonical-test-migration.log',(migration.stdout+ migration.stderr).replaceAll(base.toString(),'<isolated-test-url>'));
if(migration.status!==0){console.error('Isolated migration failed; see private .local/canonical-test-migration.log');process.exit(1);}
const tests=run('tests/canonical-postgres.test.mjs',[]); // node:test executes when file is run
console.log(tests.stdout);
if(tests.status!==0)console.error('Isolated PostgreSQL tests failed; diagnostics retained privately.');
await writeFile('.local/canonical-test-results.log',tests.stdout+tests.stderr);
await writeFile('.local/canonical-test-target.json',JSON.stringify({database:name,createdAt:new Date().toISOString(),migrationExit:migration.status,testExit:tests.status},null,2));
console.log(JSON.stringify({isolatedDatabase:name,migrationExit:migration.status,testExit:tests.status,retainedForInspection:true}));
process.exitCode=tests.status||0;
