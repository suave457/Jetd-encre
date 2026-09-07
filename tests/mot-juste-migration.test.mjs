import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { seedLocalPilot } from '../scripts/pilot-local-store.mjs';

const directory=new URL('../drizzle/',import.meta.url);
const migration=()=>readFileSync(process.env.MOT_JUSTE_MIGRATION||new URL('0011_mot_juste.sql',directory),'utf8');
function before(){const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')&&n<'0011').sort())db.exec(readFileSync(new URL(name,directory),'utf8'));seedLocalPilot(db);return db;}
function addAttempt(db,id,game='culture-generale'){
  db.prepare('INSERT INTO pilot_quiz_attempts VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?,0,9999999999,NULL)').run(id,'pilot-school-a','pilot-a-student',game,'fixture',game==='defi-du-jour'?'2025-01-01':null,'["fixture"]','{"phase":"feedback","answers":[{"isCorrect":true}]}',id,'h'.repeat(64),id,'h'.repeat(64));
}
test('0011 preserves every previous attempt and reward with foreign keys enabled',()=>{
  const db=before();try{
    addAttempt(db,'culture');addAttempt(db,'daily','defi-du-jour');
    db.prepare('UPDATE pilot_quiz_attempts SET rowid=100 WHERE id=?').run('daily');
    for(const [id,game] of [['culture','culture-generale'],['daily','defi-du-jour']])db.prepare('INSERT INTO pilot_quiz_awards VALUES (?,?,?,?,?,10,0)').run('pilot-school-a','pilot-a-student',game,'q:0',id);
    const attempts=db.prepare('SELECT rowid,* FROM pilot_quiz_attempts ORDER BY id').all(),awards=db.prepare('SELECT * FROM pilot_quiz_awards ORDER BY game_id').all();
    assert.throws(()=>addAttempt(db,'word-before','mot-juste'),/CHECK/);
    assert.doesNotMatch(migration(),/foreign_keys\s*=\s*OFF/i);
    db.exec('BEGIN');db.exec(migration());db.exec('COMMIT');
    assert.deepEqual(db.prepare('SELECT rowid,* FROM pilot_quiz_attempts ORDER BY id').all(),attempts);
    assert.deepEqual(db.prepare('SELECT * FROM pilot_quiz_awards ORDER BY game_id').all(),awards);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
    addAttempt(db,'word','mot-juste');
    db.prepare('INSERT INTO pilot_quiz_awards VALUES (?,?,?,?,?,10,0)').run('pilot-school-a','pilot-a-student','mot-juste','q:0','word');
    assert.throws(()=>db.prepare('INSERT INTO pilot_quiz_awards VALUES (?,?,?,?,?,10,0)').run('pilot-school-a','pilot-a-other','mot-juste','wrong','word'),/FOREIGN KEY/);
    assert.throws(()=>db.prepare('UPDATE pilot_quiz_attempts SET daily_key=? WHERE id=?').run('2025-01-01','word'),/CHECK/);
    assert.throws(()=>addAttempt(db,'unknown','made-up'),/CHECK/);
    assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name LIKE '__new_%' OR name='__mot_juste_attempt_owner'").get().n,0);
    assert.equal(db.prepare('PRAGMA index_list(pilot_quiz_attempts)').all().length,5);
    assert.deepEqual(db.prepare('PRAGMA index_info(pilot_quiz_attempt_owner)').all().map(row=>row.name),['id','school_id','student_id','game_id']);
    assert.equal(db.prepare('PRAGMA index_list(pilot_quiz_attempts)').all().find(row=>row.name==='pilot_quiz_attempt_owner').unique,1);
  }finally{db.close();}
});
test('0011 fails atomically on incompatible historical award ownership',()=>{
  const db=before();try{
    addAttempt(db,'culture');db.exec('PRAGMA foreign_keys=OFF');
    db.prepare('INSERT INTO pilot_quiz_awards VALUES (?,?,?,?,?,10,0)').run('pilot-school-a','pilot-a-other','culture-generale','wrong','culture');db.exec('PRAGMA foreign_keys=ON');
    const beforeAwards=db.prepare('SELECT * FROM pilot_quiz_awards').all();
    db.exec('BEGIN');assert.throws(()=>db.exec(migration()),/FOREIGN KEY/);db.exec('ROLLBACK');
    assert.deepEqual(db.prepare('SELECT * FROM pilot_quiz_awards').all(),beforeAwards);
    assert.throws(()=>addAttempt(db,'word','mot-juste'),/CHECK/);
    assert.equal(db.prepare("SELECT count(*) n FROM sqlite_schema WHERE name LIKE '__new_%'").get().n,0);
  }finally{db.close();}
});
