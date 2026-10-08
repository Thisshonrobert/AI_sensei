import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTarget} from '../scripts/database-target.mjs';
test('explicit database targets prevent accidentally importing into the other database',()=>{
 const local='postgresql://user:password@127.0.0.1:5433/ai_sensei';
 const neon='postgresql://user:password@ep-example-pooler.region.neon.tech/neondb?sslmode=require';
 assert.equal(validateTarget('local',local),local);assert.equal(validateTarget('neon',neon),neon);
 for(const [target,url] of [['local',neon],['neon',local],['neon',neon.replace('?sslmode=require','')],['neon',neon.replace('.neon.tech','.example.com')],['local',local.replace('postgresql:','https:')]])assert.throws(()=>validateTarget(target,url));
});
