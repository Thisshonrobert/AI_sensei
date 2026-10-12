import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedOption,answerBinding,reasonFor,answerReasonData} from '../src/lib/server/content/lesson-answer-reasons.mjs';
const question=()=>({id:'question-1',revision:2,kind:'question',origin:'book',payloadJson:{prompt:'Choose the polite form.',options:[{label:'1',text:'A'},{label:'2',text:'B'}],questionReview:{sourceAnswerTextVerified:true},answer_specification:{source_answer_text:'2',correct_option_labels:['1']}}});
const reason=q=>({...answerReasonData(q,{answer_reason:'Original draft explanation.',generationProvenance:{method:'bounded engineering draft'}}),id:'reason-1'});
test('verified source answer resolves one exact label, never stale structured answers',()=>{
 const q=question();assert.equal(verifiedOption(q),'2');q.payloadJson.questionReview.sourceAnswerTextVerified=false;assert.equal(verifiedOption(q),null);
 q.payloadJson.questionReview.sourceAnswerTextVerified=true;q.payloadJson.options.push({label:'2',text:'C'});assert.equal(verifiedOption(q),null);
 q.payloadJson.options.pop();q.payloadJson.answer_specification.source_answer_text='2 or 1';assert.equal(verifiedOption(q),null);
});
test('ordering source label must agree with the retained permutation star slot',()=>{
 const q=question();q.payloadJson.format='sentence_ordering';q.payloadJson.prompt='Choose __ __ ★ __.';
 q.payloadJson.options.push({label:'3',text:'C'},{label:'4',text:'D'});
 q.payloadJson.answer_specification.source_answer_text='2 (3421)';assert.equal(verifiedOption(q),'2');
 q.payloadJson.answer_specification.source_answer_text='4 (3421)';assert.equal(verifiedOption(q),null);
 q.payloadJson.answer_specification.source_answer_text='2 (3221)';assert.equal(verifiedOption(q),null);
 q.payloadJson.answer_specification.source_answer_text='2 extra';assert.equal(verifiedOption(q),null);
 q.payloadJson.answer_specification.source_answer_text='2 (3421)';q.payloadJson.prompt='Choose __ ★ __.';assert.equal(verifiedOption(q),null);
});
test('answer binding changes with prompt, option, revision or verified answer evidence',()=>{
 const q=question(),binding=answerBinding(q);
 for(const mutate of [x=>x.payloadJson.prompt+='!',x=>x.payloadJson.options[0].text='C',x=>x.revision++,x=>x.payloadJson.answer_specification.source_answer_text='1',x=>x.payloadJson.questionReview.sourceAnswerTextVerified=false]){const changed=question();mutate(changed);assert.notEqual(answerBinding(changed),binding);}
});
test('reasons require exact parent, revision, binding, label and one current generated reason',()=>{
 const q=question(),r=reason(q);assert.equal(reasonFor(q,[r]).answer_reason,'Original draft explanation.');
 assert.equal(reasonFor(q,[{...r,status:'approved'}]).status,'approved');
 for(const mutate of [x=>x.parentContentId='wrong',x=>x.payloadJson.questionRevision++,x=>x.payloadJson.correctOption='1',x=>x.payloadJson.answerBinding='stale',x=>x.origin='book',x=>x.status='rejected']){const changed=structuredClone(r);mutate(changed);assert.equal(reasonFor(q,[changed]),null);}
 assert.equal(reasonFor(q,[r,{...r,id:'competing'}]),null);
 const changed=question();changed.payloadJson.options[0].text='new';assert.equal(reasonFor(changed,[r]),null);
});
test('reason data cannot alter provenance or bypass verified evidence',()=>{
 const q=question();assert.equal(reason(q).status,'draft');assert.equal(reason(q).origin,'generated');
 q.payloadJson.questionReview.sourceAnswerTextVerified=false;assert.throws(()=>answerReasonData(q,{answer_reason:'Draft'}));
});
