import { db } from '@/lib/server/db';
import { LOCAL_USER_ID } from '@/lib/server/review/service.mjs';
import { generationPoolCount,generationList } from '@/lib/server/generation/service.mjs';
import { Practice } from '@/components/practice';
import { providerConfiguration } from '@/lib/server/generation/gemini.mjs';
export default async function PracticePage(){
 const [poolCount,runs]=await Promise.all([generationPoolCount(db,LOCAL_USER_ID),generationList(db,LOCAL_USER_ID)]);
 return <><h1>Use what you’ve studied.</h1><p className="lead">Read something new. Revisit words you know. Build recall through connected Japanese.</p><Practice poolCount={poolCount} initialRuns={runs} provider={providerConfiguration()}/></>;
}
