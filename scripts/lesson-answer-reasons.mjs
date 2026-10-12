import {readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PrismaClient} from '@prisma/client';
import {localDatabaseUrl} from './canonical-import.mjs';
import {verifiedOption,answerBinding,reasonFor,storeAnswerReason} from '../src/lib/server/content/lesson-answer-reasons.mjs';

function privatePath(path){
 const absolute=resolve(path);
 if(!['private-data','.local'].some(root=>absolute.startsWith(resolve(root)+sep)))throw new Error('Ignored private path required');
 return absolute;
}
export async function run(args=process.argv.slice(2)){
 const [mode,inputPath,outputPath]=args;
 if(!['inspect','import'].includes(mode)||!inputPath||args.length>3)throw new Error('Usage: inspect|import <private draft file> [private evidence output]');
 const bytes=await readFile(privatePath(inputPath),'utf8');if(bytes.length>1000000)throw new Error('Bounded input required');
 const drafts=JSON.parse(bytes);
 if(!Array.isArray(drafts)||!drafts.length||drafts.length>15||new Set(drafts.map(d=>d.question?.id)).size!==drafts.length||drafts.some(d=>typeof d.question?.id!=='string'))throw new Error('One to fifteen distinct question drafts required');
 const url=await localDatabaseUrl();const hostname=new URL(url).hostname;
 const target=['localhost','127.0.0.1'].includes(hostname)?'local':hostname.endsWith('.neon.tech')?'neon':'other';
 const db=new PrismaClient({datasourceUrl:url,errorFormat:'minimal'});
 try{
  const readQuestions=()=>db.content.findMany({where:{id:{in:drafts.map(d=>d.question.id)},kind:'question',successor:null},take:15,include:{children:{where:{kind:'explanation',successor:null,payloadJson:{path:['explanationType'],equals:'lesson_answer_reason'}},take:3}}});
  let questions=await readQuestions();
  if(questions.length!==drafts.length)throw new Error('Current bounded questions missing');
  if(drafts.some(d=>answerBinding(d.question)!==answerBinding(questions.find(q=>q.id===d.question.id))))throw new Error('Bound question snapshot changed');
  const writes=[];
  if(mode==='import')for(const draft of drafts)writes.push(await storeAnswerReason(db,draft.question,draft));
  if(mode==='import')questions=await readQuestions();
  const evidence={target,mode,questions:questions.length,verifiedUnambiguousAnswers:questions.filter(q=>verifiedOption(q)).length,exactGeneratedReasons:questions.filter(q=>reasonFor(q,q.children)).length,draftUngradedQuestions:questions.filter(q=>q.status==='draft'&&q.payloadJson.answerVerified===false&&q.payloadJson.targetsVerified===false).length,inserted:writes.filter(r=>r.inserted).length,alreadyStored:writes.filter(r=>!r.inserted).length};
  if(outputPath)await writeFile(privatePath(outputPath),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));return evidence;
 }finally{await db.$disconnect();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)run().catch(error=>{console.error('Answer reason command failed:',error.code||error.name);process.exitCode=1;});
