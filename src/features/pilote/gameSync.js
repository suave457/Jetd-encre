import { MOTS_FLECHES_GRIDS } from '../games/mots-fleches/motsFlechesData.js';
import { buildGridModel, sanitizeProgress } from '../games/mots-fleches/motsFlechesEngine.js';

const models = new Map(MOTS_FLECHES_GRIDS.map(grid => [grid.id, buildGridModel(grid)]));
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const content = (id, value={}) => ({progress:sanitizeProgress(models.get(id),value.progress),hintCount:Math.min(10000,Math.max(0,Math.floor(Number(value.hintCount)||0)))});
const empty = id => ({gridId:id,...content(id),revision:0,lastRequestId:null,completedAt:null,awardedXp:0});
// Deliberately outside the jde.* namespace cleared by "Reset demonstration".
export const gameCacheKey = (userId,schoolId) => 'jde-school.crosswords.v1:'+JSON.stringify([schoolId,userId]);

// One bounded outbox per authenticated identity. Server revisions prevent silent
// overwrites from another device; an uncertain response retains the same UUID.
export class GameSync {
  constructor({userId,schoolId,initial,storage,send,onChange=()=>{},uuid=()=>crypto.randomUUID()}) {
    if(initial.userId!==userId||initial.schoolId!==schoolId) throw new Error('Compte modifié. Reconnecte-toi.');
    Object.assign(this,{userId,schoolId,storage,send,onChange,uuid});
    this.key=gameCacheKey(userId,schoolId);this.records={};this.drafts={};this.operations={};this.conflicts={};this.resultsByGrid={};this.xpTotal=initial.xpTotal;this.error=null;this.disposed=false;this.running=null;
    for(const id of models.keys())this.records[id]=empty(id);
    for(const record of initial.grids)if(models.has(record.gridId))this.records[record.gridId]={...record,...content(record.gridId,record)};
    try {
      const raw=storage?.getItem(this.key);const saved=raw&&raw.length<150000?JSON.parse(raw):null;
      if(saved?.userId===userId&&saved?.schoolId===schoolId)for(const id of models.keys()) {
        const draft=saved.drafts?.[id],op=saved.operations?.[id];if(!draft)continue;
        this.drafts[id]={...content(id,draft),complete:draft.complete===true};
        const acknowledged=Boolean(op?.body?.requestId&&op.body.requestId===this.records[id].lastRequestId);
        if(acknowledged&&same(content(id,draft),content(id,op.body))&&(!draft.complete||this.records[id].completedAt)){delete this.drafts[id];continue;}
        if(!acknowledged&&saved.revisions?.[id]!==this.records[id].revision){this.conflicts[id]=this.records[id];continue;}
        if(!acknowledged&&op&&['progress','complete'].includes(op.action)&&/^[a-f0-9-]{36}$/i.test(op.body?.requestId||'')&&op.body.ownerId===userId&&op.body.revision===this.records[id].revision)
          this.operations[id]={action:op.action,body:{ownerId:userId,...content(id,op.body),revision:op.body.revision,requestId:op.body.requestId}};
      }
    } catch { this.storageWarning=true; }
  }
  snapshot() {
    return {xpTotal:this.xpTotal,records:Object.values(this.records),progressByGrid:Object.fromEntries([...models.keys()].map(id=>[id,(this.drafts[id]||this.records[id]).progress])),hintCounts:Object.fromEntries([...models.keys()].map(id=>[id,(this.drafts[id]||this.records[id]).hintCount])),pending:Object.keys(this.drafts).length,conflicts:Object.keys(this.conflicts),error:this.error,storageWarning:!!this.storageWarning,saving:!!this.running};
  }
  emit() {
    if(this.disposed)return;
    try {this.storage?.setItem(this.key,JSON.stringify({userId:this.userId,schoolId:this.schoolId,drafts:this.drafts,operations:this.operations,revisions:Object.fromEntries(Object.entries(this.records).map(([id,r])=>[id,r.revision]))}));this.storageWarning=!this.storage;}catch {this.storageWarning=true;}
    this.onChange(this.snapshot());
  }
  update(progressByGrid,hintCounts) {
    if(this.disposed)return;
    for(const id of models.keys()) {
      const value=content(id,{progress:progressByGrid[id],hintCount:hintCounts[id]});
      if(!same(value,content(id,this.drafts[id]||this.records[id])))this.drafts[id]={...value,complete:false};
    }
    this.emit();
  }
  async flush() {
    if(this.running)return this.running;
    if(this.disposed||Object.keys(this.conflicts).length)return false;
    this.running=this.drain();this.emit();
    try {return await this.running;} finally {this.running=null;this.emit();}
  }
  async drain() {
    this.error=null;
    while(!this.disposed&&Object.keys(this.drafts).length) {
      const id=Object.keys(this.drafts)[0];
      const draft=this.drafts[id];
      const op=this.operations[id]||(this.operations[id]={action:draft.complete?'complete':'progress',body:{ownerId:this.userId,...content(id,draft),revision:this.records[id].revision,requestId:this.uuid()}});
      this.emit();
      try {
        const result=await this.send(id,op.action,op.body);
        if(this.disposed)return false;
        if(result.userId!==this.userId||result.schoolId!==this.schoolId)throw Object.assign(new Error('Le compte a changé. Reconnecte-toi.'),{status:401});
        this.records[id]={...result.grid,...content(id,result.grid)};this.xpTotal=result.xpTotal;this.resultsByGrid[id]=result;
        if(same(content(id,this.drafts[id]),content(id,op.body))&&(!this.drafts[id].complete||op.action==='complete'))delete this.drafts[id];
        delete this.operations[id];this.emit();
      } catch(error) {
        if(this.disposed)return false;
        this.error={message:error.message,status:error.status||0};
        if(error.status===409){
          this.conflicts[id]=error.data?.grid||null;
          if(error.data?.userId===this.userId&&error.data?.schoolId===this.schoolId&&Number.isSafeInteger(error.data.xpTotal))this.xpTotal=error.data.xpTotal;
        }
        this.emit();return false;
      }
    }
    return !this.disposed;
  }
  async complete(id,progress,hintCount) {
    this.drafts[id]={...content(id,{progress,hintCount}),complete:true};this.emit();
    const ok=await this.flush();
    // A previous in-flight progress operation may have completed before this
    // completion intent was queued. Drain again if necessary.
    if(ok&&this.drafts[id])await this.flush();
    if(this.drafts[id]||!this.records[id].completedAt)return {ok:false};
    return {ok:true,awarded:this.resultsByGrid[id]?.awarded===true,totalXp:this.xpTotal};
  }
  resolveConflicts(useLocal) {
    for(const [id,remote] of Object.entries(this.conflicts)) {
      if(!remote)continue; // A fresh GET is required if the server omitted its copy.
      this.records[id]={...remote,...content(id,remote)};delete this.operations[id];
      if(!useLocal)delete this.drafts[id];delete this.conflicts[id];
    }
    this.error=null;this.emit();
  }
  dispose(){this.disposed=true;}
}
