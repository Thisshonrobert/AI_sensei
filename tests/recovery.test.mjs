import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreName, privateOutput, databaseConnection } from '../scripts/backup.mjs';
test('remote backups require Neon with TLS and use a direct connection',()=>{
 assert.equal(databaseConnection('postgresql://user:secret@ep-example-pooler.region.neon.tech/neondb?sslmode=require').hostname,'ep-example.region.neon.tech');
 assert.throws(()=>databaseConnection('postgresql://user:secret@ep-example.neon.tech/neondb'));
 assert.throws(()=>databaseConnection('postgresql://user:secret@example.com/db?sslmode=require'));
 assert.equal(databaseConnection('postgresql://user:secret@127.0.0.1:5433/study').hostname,'127.0.0.1');
});
test('recovery refuses the source, arbitrary names and paths outside private backups',()=>{
 assert.throws(()=>restoreName('study','study'));
 assert.throws(()=>restoreName('postgres','study'));
 assert.throws(()=>restoreName('ai_sensei_restore_x; DROP DATABASE study','study'));
 assert.equal(restoreName('ai_sensei_restore_checked','study'),'ai_sensei_restore_checked');
 assert.throws(()=>privateOutput('public/history'));
 assert.throws(()=>privateOutput('private-data/backups/../../public'));
 assert.ok(privateOutput('private-data/backups/test'));
});
