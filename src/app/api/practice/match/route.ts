import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { LOCAL_USER_ID } from '@/lib/server/review/service.mjs';
import { matchPairs } from '@/lib/server/practice/match.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const kind=z.enum(['vocabulary','kanji']);
function send(value:unknown,status=200){return NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});}
function local(request:NextRequest){return ['127.0.0.1','localhost'].includes(request.nextUrl.hostname)&&/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(request.headers.get('host')||'');}
// Read-only practice pairs; grading happens in the browser and nothing is stored.
export async function GET(request:NextRequest){
 if(!local(request)||request.headers.get('sec-fetch-site')==='cross-site')return send({error:'Local access only'},403);
 const parsed=kind.safeParse(request.nextUrl.searchParams.get('kind'));
 if(!parsed.success)return send({error:'Choose vocabulary or kanji'},400);
 try{return send(await matchPairs(db,LOCAL_USER_ID,parsed.data));}
 catch{return send({error:'Match pairs could not be loaded. Retry.'},500);}
}
