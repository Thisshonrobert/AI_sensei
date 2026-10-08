import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { localDatabaseUrl } from './canonical-import.mjs';
import { parseBank, bankHash, publishBank } from '../src/lib/server/assessment/bank.mjs';
async function run(){
 const args=process.argv.slice(2),[mode,...rest]=args;
 if(!['preview','publish'].includes(mode)||rest.length%2)throw new Error('Use preview|publish --file private-data/... [--confirm hash --reviewer name]');
 const opts={};for(let i=0;i<rest.length;i+=2){if(!['--file','--confirm','--reviewer'].includes(rest[i])||opts[rest[i]])throw new Error('Invalid option');opts[rest[i]]=rest[i+1];}
 if(!opts['--file'])throw new Error('Private bank file required');
 const rel=relative(resolve('private-data'),resolve(opts['--file']));if(rel.startsWith('..')||resolve(opts['--file'])===resolve('private-data'))throw new Error('Bank must be under private-data');
 const bank=parseBank(JSON.parse(await readFile(opts['--file'],'utf8')));
 if(mode==='preview'){console.log(JSON.stringify({hash:bankHash(bank),questions:bank.questions.length,passages:bank.passages.length,origin:'user',requiresHumanReview:true}));return;}
 const db=new PrismaClient({datasourceUrl:await localDatabaseUrl(),errorFormat:'minimal'});
 try{console.log(JSON.stringify(await publishBank(db,bank,{confirmation:opts['--confirm'],reviewer:opts['--reviewer']})));}finally{await db.$disconnect();}
}
run().catch(()=>{console.error('Bank operation failed. Check the reviewed schema, exact hash, target IDs and private connection; no partial publication.');process.exitCode=1;});
