import {readFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {localDatabaseUrl} from './canonical-import.mjs';
import {backupDatabase,restoreDatabase,restoreEmptyNeon,inventory} from './backup.mjs';

// One-time, explicitly requested host migration. Refuses nonempty targets.
async function run(){
 if(process.argv[2]!=='transfer-and-switch'||process.argv[3]!=='--confirm-local-writers-stopped'||process.argv.length!==4)throw new Error('Stop the local app and import writers first, then use transfer-and-switch --confirm-local-writers-stopped');
 const source=await localDatabaseUrl(),target=await localDatabaseUrl('POSTGRES_DATABASE_URL');
 if(!['localhost','127.0.0.1'].includes(new URL(source).hostname))throw new Error('Migration source must be the local database');
 const guard=new PrismaClient({datasourceUrl:source,errorFormat:'minimal'});
 try{
  const [writers]=await guard.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'`;
  if(writers.count!==0)throw new Error('Local database clients remain connected; stop writers before migration');
 }finally{await guard.$disconnect();}
 const directory=`private-data/backups/neon-transfer-${randomUUID()}`;
 await backupDatabase(source,directory);
 const restored=await restoreDatabase(source,directory,`ai_sensei_restore_${randomUUID().replaceAll('-','')}`);
 if(!restored.allTablesMatch)throw new Error('Local backup restore failed');
 const transferred=await restoreEmptyNeon(target,directory);
 const db=new PrismaClient({datasourceUrl:source,errorFormat:'minimal'});
 try{
  const manifest=JSON.parse(await readFile(`${directory}/manifest.json`,'utf8'));
  if(JSON.stringify(await inventory(db))!==JSON.stringify(manifest.tables))throw new Error('Local data changed during transfer; connection not switched');
 }finally{await db.$disconnect();}
 // Preserve the local connection for isolated tests and independent restores.
 const env=await readFile('.env','utf8');
 let updated=env.replace(/^\s*DATABASE_URL\s*=.*$/m,()=>`DATABASE_URL=${JSON.stringify(target)}`);
 if(/^\s*LOCAL_DATABASE_URL\s*=/m.test(updated))throw new Error('Existing LOCAL_DATABASE_URL requires explicit reconciliation; connection not switched');
 updated+=`\n# Retained local PostgreSQL for isolated tests and restore verification.\nLOCAL_DATABASE_URL=${JSON.stringify(source)}\n`;
 const temporary='.env.neon-switch.tmp';await writeFile(temporary,updated,{flag:'wx'});await rename(temporary,'.env');
 console.log(JSON.stringify({...transferred,localRestoreVerified:true,connectionSwitched:true,restartRequired:true,privateBackup:directory}));
}
run().catch(async error=>{await writeFile('.local/neon-transfer-error.txt',String(error.stack)+'\n'+JSON.stringify(error.privateDiagnostic||{}));console.error(JSON.stringify({migrationFailed:true,code:error.code||error.name,privateDiagnostic:'.local/neon-transfer-error.txt'}));process.exitCode=1;});
