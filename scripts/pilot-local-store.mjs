// Node-only test/development adapter. Never import from the published Worker.
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
export function sqliteBinding(sqlite) {
  const prepare=sql=>{
    const statement=sqlite.prepare(sql);
    const bound=(values=[])=>({sql,values,
      first:async()=>statement.get(...values)??null,
      all:async()=>({results:statement.all(...values)}),
      run:async()=>{const r=statement.run(...values);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};},
      bind:(...next)=>bound(next)});
    return bound();
  };
  return {prepare,batch:async statements=>{
    sqlite.exec("BEGIN");
    try{const results=[];for(const s of statements){const r=sqlite.prepare(s.sql).run(...s.values);results.push({success:true,meta:{changes:Number(r.changes)}});}sqlite.exec("COMMIT");return results;}
    catch(error){sqlite.exec("ROLLBACK");throw error;}
  }};
}
export function openPilotDatabase(file=":memory:") {
  const sqlite=new DatabaseSync(file);
  sqlite.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;");
  sqlite.exec("CREATE TABLE IF NOT EXISTS __pilot_local_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL)");
  const directory=new URL("../drizzle/",import.meta.url);
  try{
    for(const name of readdirSync(directory).filter(f=>f.endsWith(".sql")).sort()){
      const sql=readFileSync(new URL(name,directory),"utf8"),checksum=createHash("sha256").update(sql).digest("hex");
      const previous=sqlite.prepare("SELECT checksum FROM __pilot_local_migrations WHERE name=?").get(name);
      if(previous){if(previous.checksum!==checksum)throw new Error("Applied migration changed: "+name);continue;}
      sqlite.exec("BEGIN");
      try{sqlite.exec(sql);sqlite.prepare("INSERT INTO __pilot_local_migrations VALUES (?,?)").run(name,checksum);sqlite.exec("COMMIT");}
      catch(error){sqlite.exec("ROLLBACK");throw error;}
    }
    return {sqlite,DB:sqliteBinding(sqlite),close:()=>sqlite.close()};
  }catch(error){sqlite.close();throw error;}
}
export const LOCAL_PROFILES=Object.freeze([
  {id:'pilot-local-admin',name:'Administration Jet d’Encre · test local',role:'admin',schoolId:null,schoolName:'Toutes les écoles fictives'},
  {id:"pilot-a-teacher",name:"Salma · enseignante",role:"enseignant",schoolId:"pilot-school-a",schoolName:"École Atlas · fictive"},
  {id:"pilot-a-student",name:"Lina · élève",role:"eleve",schoolId:"pilot-school-a",schoolName:"École Atlas · fictive"},
  {id:"pilot-a-parent",name:"Youssef · parent de Lina",role:"parent",schoolId:"pilot-school-a",schoolName:"École Atlas · fictive"},
  {id:"pilot-a-other",name:"Adam · autre élève",role:"eleve",schoolId:"pilot-school-a",schoolName:"École Atlas · fictive"},
  {id:"pilot-b-teacher",name:"Amine · enseignant",role:"enseignant",schoolId:"pilot-school-b",schoolName:"École Oliviers · fictive"},
  {id:"pilot-b-student",name:"Nora · élève",role:"eleve",schoolId:"pilot-school-b",schoolName:"École Oliviers · fictive"},
  {id:"pilot-b-parent",name:"Imane · parent de Nora",role:"parent",schoolId:"pilot-school-b",schoolName:"École Oliviers · fictive"},
  {id:"pilot-a-director",name:"Samira · direction fictive",role:"directeur",schoolId:"pilot-school-a",schoolName:"École Atlas · fictive"},
  {id:"pilot-b-director",name:"Karim · direction fictive",role:"directeur",schoolId:"pilot-school-b",schoolName:"École Oliviers · fictive"},
]);
export function seedLocalPilot(sqlite) {
  sqlite.exec("BEGIN");
  try{
    for(const suffix of ["a","b"]){
      const schoolId="pilot-school-"+suffix,name=suffix==="a"?"École Atlas · fictive":"École Oliviers · fictive";
      sqlite.prepare("INSERT OR IGNORE INTO pilot_schools(id,name) VALUES (?,?)").run(schoolId,name);
      sqlite.prepare("INSERT OR IGNORE INTO pilot_classes(id,school_id,name) VALUES (?,?,?)").run("pilot-class-"+suffix,schoolId,"5e AEP · classe de test");
    }
    for(const p of LOCAL_PROFILES){
      sqlite.prepare("INSERT OR IGNORE INTO pilot_users(id,display_name,created_at) VALUES (?,?,?)").run(p.id,p.name,Math.floor(Date.now()/1000));
      if(p.role==='admin'){sqlite.prepare('INSERT OR IGNORE INTO pilot_admins(user_id) VALUES (?)').run(p.id);continue;}
      sqlite.prepare("INSERT OR IGNORE INTO pilot_memberships(school_id,user_id,role) VALUES (?,?,?)").run(p.schoolId,p.id,p.role);
      if(["enseignant","eleve"].includes(p.role))sqlite.prepare("INSERT OR IGNORE INTO pilot_class_members(school_id,class_id,user_id) VALUES (?,?,?)").run(p.schoolId,"pilot-class-"+(p.schoolId.endsWith("a")?"a":"b"),p.id);
    }
    for(const s of ["a","b"])sqlite.prepare("INSERT OR IGNORE INTO pilot_family_links(school_id,parent_id,student_id) VALUES (?,?,?)").run("pilot-school-"+s,`pilot-${s}-parent`,`pilot-${s}-student`);
    sqlite.exec("COMMIT");
  }catch(error){sqlite.exec("ROLLBACK");throw error;}
}
