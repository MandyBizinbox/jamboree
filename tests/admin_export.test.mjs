import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(new URL('../server.mjs',import.meta.url)));
const dir=mkdtempSync(path.join(os.tmpdir(),'wsj-admin-'));const port=39891;
const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:String(port),APP_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),SESSION_SECRET:crypto.randomBytes(32).toString('hex'),CMT_ADMIN_EMAIL:'owner@example.test',CMT_ADMIN_PASSWORD:'SecureAdminPassword123!',DATA_DIR:dir},stdio:'ignore'});
let cookie='';
async function call(url,dat){const res=await fetch(`http://127.0.0.1:${port}${url}`,{method:dat===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:dat===undefined?undefined:JSON.stringify(dat)});const set=res.headers.get('set-cookie');if(set?.startsWith('wsj_admin='))cookie=set.split(';')[0];return [res.status,res.headers.get('content-type')?.includes('json')?await res.json():Buffer.from(await res.arrayBuffer())];}
async function ready(){for(let n=0;n<80;n++){try{const [status]=await call('/api/schema');if(status===200)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('server failed');}
try{await ready();await test('named CMT login, protected export, configuration and preserved workbook',async()=>{
 let [n]=await call('/api/admin/list');assert.equal(n,401);
 let [l,login]=await call('/api/admin/login',{email:'owner@example.test',password:'SecureAdminPassword123!'});assert.equal(l,200);assert.equal(login.role,'owner');
 let [p]=await call('/api/admin/patrols',{role:'Youth Participants',names:['Example Troop']});assert.equal(p,200);
 let [newstatus,created]=await call('/api/drafts',{role:'Youth Participants',dob:'2014-12-03',firstName:'Synthetic',surname:'Participant',patrol:'Example Troop'});assert.equal(newstatus,201);
 let [check,c]=await call('/api/drafts/check',{reference:created.reference,code:created.code,values:{}});assert.equal(check,200);assert.ok(c.issues.length>10);
 let [up]=await call('/api/admin/update',{reference:created.reference,values:{E:'Example Troop',CY:'Poland',DD:'Lech Walesa Airport',DE:'2027-07-30'}});assert.equal(up,200);
 let [record,details]=await call('/api/admin/record',{reference:created.reference});assert.equal(record,200);assert.equal(details.values.CY,'Poland');
 let [f,ff]=await call('/api/admin/form-fields',{column:'S',label:'Identification Number'});assert.equal(f,200);assert.equal(ff.saved,true);
 let [sch,sc]=await call('/api/schema');assert.equal(sch,200);assert.equal(sc.sections.find(x=>x.section.startsWith('02.')).questions.find(x=>x.column==='S').label,'Identification Number');
 let [blocked]=await call('/api/admin/export/preview',{});assert.equal(blocked,422);
 let [users,u]=await call('/api/admin/users',{email:'reviewer@example.test',password:'ReviewPersonPass123!',role:'reviewer'});assert.equal(users,201);
 let [lg]=await call('/api/admin/logout',{});assert.equal(lg,200);
 let [forbidden]=await call('/api/admin/record',{reference:created.reference});assert.equal(forbidden,401);
 });}finally{child.kill();rmSync(dir,{recursive:true,force:true});}
