import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonGroups, lessonExerciseView } from '../src/lib/server/lesson-exercises/service.mjs';
test('split batches unlock only after every distinct approved grammar point was explicitly studied',()=>{
 const rows=['a','b','a'].map(itemId=>({sourceId:'s',lessonKey:'lesson',lessonTitle:'Lesson',source:{title:'Book'},itemId,item:{grammar:{pattern:itemId}}}));
 assert.equal(lessonGroups(rows,[{itemId:'a',introducedAt:new Date()}])[0].unlocked,false);
 const group=lessonGroups(rows,['a','b'].map(itemId=>({itemId,introducedAt:new Date()})),[{sourceId:'s',lessonKey:'lesson',expected:2,missing:0}])[0];
 assert.equal(group.unlocked,true);assert.equal(group.total,2);
});
test('answer and generated rationale are absent until a response is committed',()=>{
 const s={id:'s',status:'active',selectionSnapshotJson:{kind:'lesson-exercises',lessonTitle:'Lesson',questions:[{id:'q',revision:2,prompt:'Choose',options:[],answer:'B',reason:{answer_reason:'secret',origin:'generated',status:'draft'}}]},assessmentResultJson:{responses:{}}};
 assert.ok(!JSON.stringify(lessonExerciseView(s)).includes('secret'));
 assert.equal(lessonExerciseView(s).questions[0].answer,undefined);
 s.assessmentResultJson.responses.q={response:'A',clientEventId:'e'};
 assert.equal(lessonExerciseView(s).questions[0].answer,'B');
 assert.equal(lessonExerciseView(s).questions[0].reason.status,'draft');
});
test('partial source approval or an unpromoted staged grammar key keeps a lesson locked',()=>{
 const rows=[{sourceId:'s',lessonKey:'l',itemId:'i',source:{title:'Book'},verificationStatus:'verified',item:{status:'approved'}}],studied=[{itemId:'i',introducedAt:new Date()}];
 assert.equal(lessonGroups(rows,studied,[{sourceId:'s',lessonKey:'l',expected:2,missing:1}])[0].unlocked,false);
 rows[0].item.status='draft';assert.equal(lessonGroups(rows,studied)[0].unlocked,false);
});
test('unknown full-lesson count cannot establish lesson completeness',()=>{
 const rows=[{sourceId:'s',lessonKey:'l',itemId:'i',source:{title:'Book'},verificationStatus:'verified',item:{status:'approved'}}],studied=[{itemId:'i',introducedAt:new Date()}];
 assert.equal(lessonGroups(rows,studied,[{sourceId:'s',lessonKey:'l',expected:null,missing:0}])[0].unlocked,false);
 assert.equal(lessonGroups(rows,studied)[0].unlocked,false);
});
