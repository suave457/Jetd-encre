import assert from 'node:assert/strict';
import test from 'node:test';
import { getAssignmentRequest, getSchoolAssignmentSelection, assignmentMatchesSelection, schoolAssignmentPath } from '../src/features/pilote/schoolNavigationCore.js';
import { openPilotDatabase, seedLocalPilot } from '../scripts/pilot-local-store.mjs';
import { handleLocalPilot } from '../scripts/pilot-local-api.mjs';
import { issueSession } from '../worker/pilot/session.js';

const first='00000000-0000-4000-8000-000000000001';
const second='00000000-0000-4000-8000-000000000002';
const old='00000000-0000-4000-8000-000000000003';
const workspace={
  classes:[{id:'class-a',name:'Classe A'},{id:'class-b',name:'Classe B'}],
  children:[{id:'child-a',classId:'class-a',name:'Élève A'},{id:'child-b',classId:'class-b',name:'Élève B'}],
  assignments:[{id:first,classId:'class-a'},{id:second,classId:'class-b'}],
};

test('devoir explicite : identifiant canonique, champs dupliqués ou vides refusés sans repli',()=>{
  assert.deepEqual(getAssignmentRequest(''),{present:false,id:null,error:''});
  assert.equal(getAssignmentRequest('?devoir='+old.toUpperCase()).id,old);
  for(const query of ['?devoir=','?devoir=not-a-uuid','?devoir='+'a'.repeat(36),'?devoir='+first+'&devoir='+second]){
    const result=getAssignmentRequest(query);
    assert.equal(result.present,true);assert.equal(result.id,null);assert.ok(result.error);
    const selected=getSchoolAssignmentSelection(query,'enseignant',workspace);
    assert.equal(selected.assignmentId,null);assert.ok(selected.error);
  }
});

test('devoir absent de la première page : son identifiant reste la cible, jamais le premier devoir',()=>{
  const result=getSchoolAssignmentSelection('?section=devoirs&devoir='+old,'enseignant',workspace);
  assert.equal(result.assignmentId,old);assert.equal(result.explicit,true);assert.equal(result.error,'');
  const empty=getSchoolAssignmentSelection('?devoir='+old,'enseignant',{classes:[],children:[],assignments:[]});
  assert.equal(empty.assignmentId,old);
});

test('filtres : classe ou enfant inconnus, dupliqués et non autorisés échouent fermés',()=>{
  for(const [role,query] of [
    ['enseignant','?classe=missing'],['enseignant','?classe='],['enseignant','?classe=class-a&classe=class-b'],
    ['parent','?enfant=missing'],['parent','?enfant='],['parent','?enfant=child-a&enfant=child-b'],
    ['parent','?classe=class-a'],['enseignant','?enfant=child-a'],
    ['parent','?enfant=child-a&classe=class-a'],
  ]){
    const result=getSchoolAssignmentSelection(query,''+role,workspace);
    assert.ok(result.error,query);assert.equal(result.assignmentId,null,query);
    assert.equal(assignmentMatchesSelection(workspace.assignments[0],result),false,query);
  }
});

test('filtres valides : la sélection par défaut et le détail restent dans le bon groupe',()=>{
  const teacher=getSchoolAssignmentSelection('?classe=class-b','enseignant',workspace);
  assert.equal(teacher.assignmentId,second);assert.equal(teacher.requestedClass.name,'Classe B');
  const parent=getSchoolAssignmentSelection('?enfant=child-a&devoir='+second,'parent',workspace);
  assert.equal(parent.assignmentId,second,'Un lien explicite ne doit pas être réécrit silencieusement.');
  assert.equal(assignmentMatchesSelection(workspace.assignments[1],parent),false);
  assert.equal(assignmentMatchesSelection(workspace.assignments[0],parent),true);
});

test('un enfant rattaché à plusieurs classes conserve tous ses devoirs, sans ceux de son frère',()=>{
  const data={...workspace,children:[...workspace.children,{id:'child-a',classId:'class-c',name:'Élève A'}]};
  const selection=getSchoolAssignmentSelection('?enfant=child-a','parent',data);
  assert.deepEqual(selection.classIds,['class-a','class-c']);
  assert.equal(assignmentMatchesSelection({classId:'class-c'},selection),true);
  assert.equal(assignmentMatchesSelection({classId:'class-b'},selection),false);
});

test('navigation : clic, retour et rechargement reprennent le même devoir et les mêmes filtres',()=>{
  const initial='?section=classes&profil=enseignant&classe=class-a';
  const clicked=schoolAssignmentPath(initial,old), url=new URL(clicked,'https://school.invalid');
  assert.equal(url.pathname,'/pilote');
  assert.equal(url.searchParams.get('profil'),'enseignant');
  assert.equal(url.searchParams.get('classe'),'class-a');
  assert.equal(url.searchParams.get('section'),'devoirs');
  assert.equal(url.searchParams.get('devoir'),old);
  assert.equal(getSchoolAssignmentSelection(url.search,'enseignant',workspace).assignmentId,old);
  const next=schoolAssignmentPath(url.search,first);
  assert.equal(getSchoolAssignmentSelection(new URL(next,url).search,'enseignant',workspace).assignmentId,first);
  assert.equal(getSchoolAssignmentSelection(url.search,'enseignant',workspace).assignmentId,old,'Historique Retour');
  const parent=schoolAssignmentPath('?profil=parent&enfant=child-a&devoir='+first,old);
  assert.equal(new URL(parent,url).searchParams.get('enfant'),'child-a');
  assert.equal(new URL(parent,url).searchParams.getAll('devoir').length,1);
});

function setup(t){const store=openPilotDatabase();seedLocalPilot(store.sqlite);t.after(()=>store.close());return store;}
async function client(DB,id='pilot-a-student'){
  const session=await issueSession(DB,id,'local_fixture',true),cookie=session.cookie.split(';')[0];
  return async(path,body)=>{
    const response=await handleLocalPilot(new Request('http://127.0.0.1:5173/api/pilot'+path,{
      method:body===undefined?'GET':'POST',headers:{cookie,origin:'http://127.0.0.1:5173','Content-Type':'application/json','X-CSRF-Token':session.csrfToken},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    }),DB);
    return {status:response.status,data:await response.json()};
  };
}
function assignment(sqlite,id,createdAt){
  sqlite.prepare('INSERT INTO pilot_assignments VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,'pilot-school-a','pilot-class-a','pilot-a-teacher',
    'Devoir '+createdAt,'Décris un lieu familier et donne ton avis.','2026-10-20',createdAt,'request-'+id,'fixture-only');
}

test('API réelle : professeur et parent ouvrent un ancien devoir au-delà des cent premiers, autre école refusée',async t=>{
  const {DB,sqlite}=setup(t);
  assignment(sqlite,old,1);
  for(let index=0;index<101;index++)assignment(sqlite,crypto.randomUUID(),index+10);
  for(const id of ['pilot-a-teacher','pilot-a-parent']){
    const call=await client(DB,id),list=await call('/workspace');
    assert.equal(list.status,200);assert.equal(list.data.assignments.length,100);
    assert.equal(list.data.assignments.some(item=>item.id===old),false);
    const detail=await call('/assignments/'+old);
    assert.equal(detail.status,200);assert.equal(detail.data.assignment.id,old);
    const missing=await call('/assignments/'+first);
    assert.equal(missing.status,404);assert.equal(missing.data.assignment,undefined);
  }
  for(const id of ['pilot-b-teacher','pilot-b-parent','pilot-b-student'])
    assert.equal((await (await client(DB,id))('/assignments/'+old)).status,404);
});

test('API réelle : une copie remise reste lisible intégralement et sa correction zéro est conservée',async t=>{
  const {DB,sqlite}=setup(t),student=await client(DB),teacher=await client(DB,'pilot-a-teacher');
  assignment(sqlite,first,1);
  const body='Je préfère la cour ombragée. Je lis sous un arbre avec mes camarades.';
  const saved=await student('/assignments/'+first+'/submission',{body});
  assert.equal(saved.status,201);
  assert.equal((await teacher('/submissions/'+saved.data.id+'/review',{score:0,feedback:'Précise la position du lieu en ajoutant une phrase.'})).status,201);
  const fresh=await client(DB),detail=await fresh('/assignments/'+first);
  assert.equal(detail.status,200);assert.equal(detail.data.submissions.length,1);
  assert.equal(detail.data.submissions[0].body,body);assert.equal(detail.data.submissions[0].score,0);
  assert.equal((await (await client(DB,'pilot-a-other'))('/assignments/'+first)).data.submissions.length,0);
});

test('API réelle : les compteurs globaux ne doivent pas être attribués à un seul devoir',async t=>{
  const {DB,sqlite}=setup(t),student=await client(DB),other=await client(DB,'pilot-a-other'),teacher=await client(DB,'pilot-a-teacher');
  assignment(sqlite,first,1);assignment(sqlite,second,2);
  const body='Notre cour possède de beaux arbres. Nous aimons y lire ensemble.';
  const reviewed=await student('/assignments/'+first+'/submission',{body});
  await other('/assignments/'+first+'/submission',{body});
  await student('/assignments/'+second+'/submission',{body});
  await teacher('/submissions/'+reviewed.data.id+'/review',{score:18,feedback:'La description est claire. Ajoute un repère de lieu.'});
  const all=await teacher('/workspace'), latest=await teacher('/assignments/'+second);
  assert.deepEqual(all.data.counts,{assignments:2,submitted:3,reviewed:1});
  assert.equal(latest.data.total,1);assert.equal(latest.data.reviewed,0);
  const family=await client(DB,'pilot-a-parent');
  assert.deepEqual((await family('/workspace')).data.counts,{assignments:2,submitted:2,reviewed:1});
  assert.equal((await family('/assignments/'+second)).data.reviewed,0);
});
