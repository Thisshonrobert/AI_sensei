import { z } from 'zod';
import { db } from '@/lib/server/db';
import { LOCAL_USER_ID } from '@/lib/server/review/service.mjs';
import { assessmentView,currentAssessment,assessmentAvailability } from '@/lib/server/assessment/service.mjs';
import { Assessment } from '@/components/assessment';
export default async function Weekly({searchParams}:{searchParams:Promise<{session?:string}>}){
 const {session}=await searchParams;
 const initial=session?await assessmentView(db,LOCAL_USER_ID,z.string().uuid().parse(session)):await currentAssessment(db,LOCAL_USER_ID);
 const availability=initial?null:await assessmentAvailability(db,LOCAL_USER_ID);
 return <><p className="eyebrow">Weekly · cumulative recall</p><h1>A sample of what you’ve learned.</h1><p className="lead">Replace a new-content block with this test. Recent, weak, older and enabled baseline targets can appear together.</p><Assessment initial={initial} availability={availability}/></>;
}
